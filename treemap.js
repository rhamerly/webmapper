/* VoronoiTreemap *****************************************************************************************************

Constructor:
	new VoronoiTreemap (tree, bbox, vis, options)
	options -> {"font", "figs", "color", "animation", "strokeWidth"}
	
Properties:
	tree
	bbox
	options
	colors
	d3_polydata
	d3_edgedata
	animation_state
	zoom_state
	onclick
	onmousemove
	onmouseout
	initialized

Methods:
	on (evt, fn)		-- event handling
	getPoly (x, y)		-- find polygon at this position
	start ()			-- animation on / off
	stop ()
	step (clusterId) 	-- animate one step
	zoom (clusterId)	-- zoom in on a cluster
	draw ()				-- draw the map
	resize (w, h)		-- resize to new width, height
	clear ()			-- erase visual (doesn't clear data)
	drag(clusterId, [x, y]) -- move clusterId to position [x, y]
	delete (clusterId)	-- removes a node
	add (clusterId)		-- adds a node
	
**********************************************************************************************************************/
	
function VoronoiTreemap (tree, bbox, vis, options)
{
	this.tree = tree;		// Data
	this.bbox = bbox;
	this.options = options;
	this.id = treemap_instanceCounter++;
	this.vis = vis;					// Drawing
	this.g = null;
	this.colors = treemap_defaultColors;
	this.textColor = null;
	this.colorsBackup = null;				
	this.strokeWidth = null;
	this.d3_polydata = [];
	this.d3_textdata = [];
	this.width = 0;
	this.height = 0;
	this.display_polys = null;
	this.display_text = null;
	this.redraw_polys = true;
	this.text = function (d) {return d.id};
	this.animation_state = null;	// Animation
	this.animation_enabled = true;
	this.animation_queue = [];
	this.animation_id = 0;
	this.selectedPolygon = -1;
	this.zooming = true;			// Zooming
	this.zoomState = -1;
	this.zoomStateLast = -1;
	this.currentZoomAnim = null;
	this.lastZoomAnim = null;
	this.zoomoutPolys = null;
	this.onpolyclick = {};			// Events
	this.ontextclick = {};
	this.onclick = {};
	this.onmousemove = {};
	this.onscroll = {};
	//this.onmouseout = {};
	this.tooltip = null;
	this.tooltip_name = "";
	this.tooltip_text = null;
	this.active = true;
	
	__construct = function (it)
	{
		temp_treemap = it;
		
		d3_defaultColors = d3.scale.category20 ();
		for (var i = 0; i < 20; i++)
			d3_defaultColors(i);
		it.colors = (options && options.color) ? options.color : treemap_defaultColors;
		it.textColor = (options && options.textColor) ? options.textColor : "white";
		it.animation_enabled = (options && options.animation_enabled) ? options.animation_enabled : true;
		it.strokeWidth = (options && options.strokeWidth) ? options.strokeWidth : treemap_defaultStrokeWidth;
		if (options && options.width && options.height)
		{
			it.width = options.width;
			it.height = options.height;
		}
		it.tooltip = (options && options.tooltip) ? options.tooltip : null;
		it.tooltip_name = it.tooltip ? it.tooltip.attr("id") : "";
		it.tooltip_text = (options && options.tooltip_text) ? options.tooltip_text : null;
		it.display_polys = (options && options.display_polys) ? options.display_polys : null;
		it.display_text = (options && options.display_text) ? options.display_text : null;
		if (options && options.text) {it.text = options.text;}
		
		it.redraw_polys = (options && options.redraw_polys != undefined) ? options.redraw_polys : true;
		
		it.initialize();
	}(this);
}

var temp_treemap;

var treemap_wheelMoves = [];
var treemap_instanceCounter = 0;

// Initializes the map.  This works by applying tessellate to all levels of the tree.
VoronoiTreemap.prototype.initialize = function ()
{
	Tick();

	this.tree.polygon = this.bbox;
	if (this.redraw_polys)	// Sometimes (like when loading a saved file) we don't need to redraw the polygons.
		treemap_initialize (this, this.tree, this.bbox);
	this.zoomoutPolys = _.map(this.tree.children, function(x) {return {"center": x.center, "polygon": x.polygon, "nodeWeight": x.nodeWeight}});	// Save current state, in case of subsequent zoomout.  TODO -- THIS NEEDS TO BE UPDATED ON EVERY RESIZE EVENT!
	
	this.g = this.vis.append("g");
	if (this.width == 0 || this.height == 0)
	{
		this.width = parseInt(this.vis.attr("width"));
		this.height = parseInt(this.vis.attr("height"));
	}
	
	// Events.  Allow multiple events to be registered.
	this.vis.on("mousemove.treemap" + this.id, treemap_mousemove (this));
	this.vis.on("click.treemap" + this.id, treemap_click (this));
	this.vis.on("mouseout.treemap" + this.id, treemap_mouseout (this));
	this.vis.on("mousewheel.treemap" + this.id, treemap_zoomMousewheel (this));
	
	console.log("Initializing Treemap: " + Tick() + " ms.");
}

VoronoiTreemap.prototype.dispose = function ()
{
	this.vis.on("mousemove.treemap" + this.id, null);
	this.vis.on("click.treemap" + this.id, null);
	this.vis.on("mouseout.treemap" + this.id, null);
	this.vis.on("mousewheel.treemap" + this.id, null);
	this.g.remove();
}

// Performs a single centroidal Voronoi tessllation step -- first, tessellates the plane at the top level of the tree and shifts the centroids.  Then it shifts all the child points into the new polygons using display-distort.js.  Finally, it performs a single tessellation step on all the children, recursively.
// There are two optional parameter, one which takes one of three values:
//   node = (blank)     -- perform step on the whole tree
//   node = i           -- perform step on cluster i
//   node = [i,j,...,k] -- perform step on sub-cluster [i,j,...,k]
// And bbox, which if left blank assumes that the bounding box does not change.
VoronoiTreemap.prototype.step = function (node, bbox)
{
	var tree;
	if (node != undefined && node != [] && node != null)
	{
		if (typeof(node) == "number")
			tree = this.tree.children[node];
		else
		{
			tree = this.tree;
			for (var i in node)
				tree = tree.children[node[i]];
		}
		if (tree == undefined)
			throw "VoronoiTreemap.step: No such node " + node + " exists.";
	}
	else
	{
		tree = this.tree;
		if (bbox)
			this.bbox = bbox;
	}
	treemap_step (this, tree, bbox); //, tree.polygon, bbox);
}

// Draws the treemap.
VoronoiTreemap.prototype.draw = function ()
{
	// TEMP (well, maybe not)
	this.step ();
	
	// Get polygon, text data.
	this.d3_polydata = [];
	this.d3_textdata = [];
	treemap_getd3polydata (this.d3_polydata, this, this.tree)
	treemap_getd3textdata (this.d3_textdata, this, this.tree)
	
	// Display the polygons.
	var polys = this.g.selectAll("polygon").data(this.d3_polydata)
	polys.enter().append("polygon");
	if (this.display_polys != null)
		this.display_polys(polys);
	else
		polys.attr("points", function(d) {return d.points;})
			.attr("fill", function(d) {return d.color;})
			.attr("stroke","white")
			.attr("stroke-width", function(d) {return d.width;})
			.attr("id", function(d) {return "poly" + d.id;})
			.on("click", treemap_polyclick(this))
			.on("mousemove", treemap_mousemove(this));
	polys.exit().remove();
	
	// Display the text.
	var text = this.g.selectAll("text").data(this.d3_textdata); //, function (d) {return d.id;});
	text.enter().append("text");
	if (this.display_text != null)
		this.display_text(text);
	else
		text.attr("x", function(d) {return d.x;})
			.attr("y", function(d) {return d.y + d.size / 2;})
			.text(function(d) {return d.text;})
			.style("font-size", function (d) {return d.size + "px"})
			.attr("fill", this.textColor)
			.attr("text-anchor", "middle")
			.on("click", treemap_textclick(this))
			.on("mousemove", treemap_mousemove(this));
	text.exit().remove();
}

VoronoiTreemap.prototype.recolor = function (color, delay)
{
	var oldColor = this.colors;
//	if (color.poly)
//		this.colors = color.poly;
//	else
//		this.colors = color;
	this.colors = color;
	
	this.d3_polydata = [];
	treemap_getd3polydata (this.d3_polydata, this, this.tree);
	
	var polys = this.g.selectAll("polygon").data(this.d3_polydata)
	var text = this.g.selectAll("text");
	polys.enter().append("polygon");
	if (delay > 0)
	{
		polys.transition().duration(delay)
			.attr("fill", function(d) {return d.color;});
//		if (color.text)
//			text.transition().duration(delay).attr("fill", color.text);
	}
	else
	{
		polys.attr("fill", function(d) {return d.color;});
//		if (color.text)
//			text.attr("fill", color.text);
	}
	polys.exit().remove();	
}

VoronoiTreemap.prototype.drawPartial = function (node)
{
	var tree = this.tree;
	node = (typeof(node) == "number") ? [node] : node;
	for (var i in node)
	{
		tree = tree.children[node[i]];
		if (tree == undefined)
			throw "VoronoiTreemap.step: No such node " + node + " exists.";
	}
	
	// TEMP
	treemap_step (this, tree, tree.polygon);

	this.d3_polydata = [];
	this.d3_textdata = [];
	treemap_getd3polydata (this.d3_polydata, this, tree, node)
	treemap_getd3textdata (this.d3_textdata, this, tree)
	
	var validIds = {};
	for (var i = 0; i < this.d3_polydata.length; i++)
		validIds[this.d3_polydata[i].id] = true;
	
	var polys = this.g.selectAll("polygon").filter(function(d) {return (d.id in validIds)});
	var text = this.g.selectAll("text").filter(function(d) {return (d.id in validIds)});
	
	polys.data(this.d3_polydata)
		.attr("points", function(d) {return d.points;})
		.attr("fill", function(d) {return d.color;})
		.attr("stroke","white")
		.attr("stroke-width", function(d) {return d.width;})
		.attr("id", function(d) {return "poly" + d.id;})
		.on("click", treemap_polyclick(this))
		.on("mousemove", treemap_mousemove(this));

	text.data(this.d3_textdata)
		.attr("x", function(d) {return d.x;})
		.attr("y", function(d) {return d.y + d.size / 2;})
		.text(function(d) {return d.text;})
		.style("font-size", function (d) {return d.size + "px"})
		.attr("fill", "white")
		.attr("text-anchor", "middle")
		.on("click", treemap_textclick(this))
		.on("mousemove", treemap_mousemove(this));
}

VoronoiTreemap.prototype.start = function ()
{
	this.animation_id = setInterval (treemap_animateStep(this), 20);
}

VoronoiTreemap.prototype.stop = function ()
{
	clearInterval(this.animation_id);
}

function treemap_animateStep (treemap)
{
	return function ()
	{
		var fn = treemap.animation_queue.splice(0, 1)[0];
		if (treemap.animation_queue.length == 0)
			clearInterval(treemap.animation_id);
		fn (treemap);
	}
}

function treemap_getd3textdata (d3_textdata, treemap, tree)
{
	applyToTreeLeaves (tree, function (leaf, path)
	{
		d3_textdata.push(treemap_getTreeText(treemap, leaf, path));
	});
}

function treemap_getd3polydata (d3_polydata, treemap, tree, path)
{
	path = path ? path : [];
	// First, add child data.
	for (var i in tree.children)
		treemap_getd3polydata(d3_polydata, treemap, tree.children[i], path.concat([i]));
		
	// Next, add data for this polygon
	var polyPts = _.map(tree.polygon, function(x) {return x[0]+","+x[1];}).join(" ");
	d3_polydata.push({"points": polyPts, "width": treemap.strokeWidth(path.length), 
		"color": tree.children.length == 0 ? treemap.colors(path, tree) : "none", "id": treemap.id + "_" + tree.id,
		"path": path});
}

// Step function.  Called from VoronoiTreemap.step (); also called recursively.
// Takes about 10 ms to update the whole treemap (30 days' data).  Awesome!
function treemap_step (treemap, tree, bboxNew)
{
	debug.tree = tree;
	debug.bboxNew = bboxNew;
//	console.log("A");
//	console.log(MathematicaForm(tree.polygon));
//	console.log("B");
//	console.log(MathematicaForm(bboxNew));
	
	if (bboxNew)
	{
		// Move nodes from old bounding-box to new bounding-box.
		if (tree.children.length == 1)
			tree.children[0].center = centroid(bboxNew);
		else if (tree.children.length > 0)
		{
			var pts = _.map(tree.children, function(x) {return x.center});
//			console.log(MathematicaForm(pts));
			pts = distortPolygonPoints (pts, tree.polygon, bboxNew, centroid(tree.polygon), centroid(bboxNew), 1);
			for (var i = 0; i < tree.children.length; i++)
				tree.children[i].center = pts[i];
//			console.log(MathematicaForm(pts));
//			console.log(MathematicaForm(centroid(tree.polygon)));
//			console.log(MathematicaForm(centroid(bboxNew)));
		}
		
		// Change the tree's own polygon, and center it.
		tree.polygon = clone_array(bboxNew);
		tree.center = centroid(bboxNew);
	}
	
	// Re-tessellate the region
	if (tree.children.length > 0)
	{
		var newPolys = tessellate(tree.children, tree.polygon, {"taskId": treemap.id + ":" + tree.id});
		for (var i in tree.children)
			treemap_step (treemap, tree.children[i], newPolys[i].polygon)
	}
}

// Initialization function.  Called from VoronoiTreemap.initialize (); also called recursively.
function treemap_initialize (treemap, tree, bbox)
{
//	debug.tree = tree;
	if (tree.children.length > 0)
	{
		tessellateCentroidal (tree.children, bbox, {"applyToInput": true});
	
		// Recursively do the same for the children.
		for (var i in tree.children)
			treemap_initialize(treemap, tree.children[i], tree.children[i].polygon);
	}
}

// Sets the initial positions using Scott's spiral graph technique.
function treemap_setInitialPositions (tree, bbox)
{
	var center = centroid(bbox);
	var n = tree.children.length;
	
	if (n == 1)
	{
		tree.children[0].center = [center[0], center[1]];
	}
	else if (n == 2)
	{
		tree.children[0].center = [center[0]+0.05, center[1]-0.5];
		tree.children[1].center = [center[0]-0.05, center[1]+0.5];
	}
	else
	{
		// A first approach: Spiral out from centroid, it'll all fit in circle of radius 1.5 around centroid.
		var r_poly = 9999999;
		for (var i = 0; i < bbox.length; i++)
		{
			var x01 = bbox[i][0] - center[0], y01 = bbox[i][1] - center[1];
			var x12 = bbox[(i+1)%bbox.length][0] - bbox[i][0];
			var y12 = bbox[(i+1)%bbox.length][1] - bbox[i][1];
			r_poly = Math.min(r_poly, Math.sqrt(x01*x01 + y01*y01 - Math.pow(x01*x12 + y01*y12, 2) / (x12*x12 + y12*y12)));
		}
//		console.log("r_poly = " + r_poly + ", id = " + tree.id);
		r_poly *= 0.48;
		
		var nodes = _.sortBy(tree.children, function(node){return -node.nodeWeight;});
		var n_Angles = Math.min(nodes.length - 1, 8);
		var d_theta = Math.PI*2 / n_Angles;
		var d2_theta = d_theta / (nodes.length / n_Angles);
		var d_r = r_poly / (nodes.length/n_Angles);
		
		nodes[0].center = [center[0], center[1]];
		var ang = 0, r = r_poly;
		for (var i = 1; i < nodes.length; i++)
		{
			var coord = polar2euclidean(r, ang);
			nodes[i].center = [coord[0] + center[0], coord[1] + center[1]];
			
			ang = ang + d_theta;
			if(i%n_Angles == 0)
			{
				ang = ang + d2_theta;
				r = r + d_r;
			}
		}
	}
}

// Tessellates the region and moves the centroids.
// Note -- this does not readjust the centers of all the child nodes, so should only be used before the child nodes
// have been set up!
// Returns the maximum distance that polygon shifts in this step.
function treemap_tessellateStep (treemap, tree, bbox)
{
//	debug.tree = tree;
	tessellate(tree.children, bbox, {"taskId": treemap.id + ":" + tree.id, "applyToInput": true});
	var distance = 0;
	for (var i in tree.children)
	{
		var newCenter = centroid(tree.children[i].polygon);
		distance = Math.max(distance, dist2(tree.children[i].center, newCenter));
		tree.children[i].center = newCenter;
	}
	return distance;
}

var d3_defaultColors;
function treemap_defaultColors (path, node)
{
//	return d3_defaultColors(path[0]);
	return d3.rgb(d3_defaultColors(path[0])).darker(path.length > 1 ? 0.02 * ((37*path[1]) % 100) : 0).toString();
}

function treemap_defaultStrokeWidth (level)
{
	return (level > 0 ? 14 / Math.pow(2.5, level) : 8);
}

// Text ----------------------------------------------------------------------------------------------------------------

function treemap_measureText(pText, pFontSize, pStyle)
{
    var lDiv = document.createElement('lDiv');

    document.body.appendChild(lDiv);

    if (pStyle != null) {
        lDiv.style = pStyle;
    }
    lDiv.style.fontSize = "" + pFontSize + "px";
    lDiv.style.position = "absolute";
    lDiv.style.left = -1000;
    lDiv.style.top = -1000;
	
    lDiv.innerHTML = pText;

    var lResult = {
        width: lDiv.clientWidth,
        height: lDiv.clientHeight
    };

    document.body.removeChild(lDiv);
    lDiv = null;

    return lResult;
}

function treemap_approxMeasureText (pText, pFontSize)
{
	return pText.length * pFontSize * 0.45;		// This runs much faster...
}

function treemap_estFontSize (pText, length)
{
	return Math.round(length / treemap_approxMeasureText (pText, 1.0));
}

function treemap_exactFontSize (pText, length)
{
	return Math.round(12 * length / treemap_measureText(pText, 12.0, "").width);
}

// Finds the best text size (and clipping) for text placed inside a polygon (bound) at the centroid (center).
function treemap_getTreeText (treemap, tree, path)
{
	// First, find the left and right-hand bounds of the text box, set by edges of the polygon.
	var text = treemap.text(tree);
	var bound = tree.polygon, center = tree.center;
	var leftBound = 0, rightBound = 0, leftSlope = 0, rightSlope = 0;
	var nb = bound.length;
	for (var i = 0; i < nb; i++)
		if ((bound[i][1] > center[1]) ^ (bound[(i+1)%nb][1] > center[1]))
		{
			// Points (x1, y1) & (x2, y2) form a line.  This intersects the x-axis at
			// x = (x1 y2 - x2 y1) / (y2 - y1)
			var newBound = (bound[i][0] * (bound[(i+1)%nb][1] - center[1]) + 
				bound[(i+1)%nb][0] * (center[1]-bound[i][1])) / (bound[(i+1)%nb][1] - bound[i][1]);
			if (newBound > center[0])
			{
				rightBound = newBound;
				rightSlope = Math.abs((bound[(i+1)%nb][0] - bound[i][0]) / (bound[(i+1)%nb][1] - bound[i][1]));
			}
			else
			{
				leftBound = newBound;
				leftSlope = Math.abs((bound[(i+1)%nb][0] - bound[i][0]) / (bound[(i+1)%nb][1] - bound[i][1]));
			}
		}
		
	//console.log("XY:  " + (leftBound) + ", " + (rightBound));
	//console.log("Rel: " + (leftBound - center[0]) + ", " + (rightBound - center[0]));
	
	var exp1 = 0.5;
	var expFrac = 0.08;
	var maxSlope = 1.5;
	leftSlope = Math.min(leftSlope, maxSlope);	rightSlope = Math.min(rightSlope, maxSlope);
	
	var length = (rightBound - leftBound) * Math.min(0.75, 0.7 * Math.pow(400 / (rightBound - leftBound), expFrac));
	var maxChars = Math.round(20*Math.pow(length / 400, exp1)) + 1;
	var truncated;
	
	if (maxChars >= text.length - 1)
	{
		// No pruning for text.
		maxChars = text.length;
		truncated = false;
	}
	else
	{
		// Prune text in a "nice" way.
		truncated = true;
		if (text[maxChars - 1] == ".")
			maxChars--;
		else if (maxChars == text.length - 2 && text[maxChars - 2] == ".")
			maxChars -= 2;
	}
	
	var prunedText = text.substring(0, maxChars) + (truncated ? "..." : "");
	
	// Crude approximation -- just estimate the font size, given the text length and the width of the polygon.
	var size = treemap_estFontSize (prunedText, length); //treemap_exactFontSize (prunedText, length);
	var txtCenter = [(rightBound + leftBound) / 2, center[1]];
	
	// Return an object.
	return {"size": size, "x": txtCenter[0], "y": txtCenter[1], "text": prunedText, "id": tree.id, "path": path};
}

// Find out which polygon a given point lies atop.
// Returns an object {path: [ind1, ..., indN], distance: dist}, where dist is the distance from the polygon edge.
VoronoiTreemap.prototype.getMousePoly = function (x, y)
{
	var x = getMousePoly (x, y, this.tree);
	if (x[0] == -1)
		return {"path": [-1], "distance": 0};
	else
		return {"path": x.slice(0, x.length - 1), "distance": x[x.length - 1]};
}

function getMousePoly (x, y, tree)
{
	for (var i in tree.children)
	{
		var poly = tree.children[i].polygon, center = tree.children[i].center
//		print_array(poly);
		if (poly == undefined || center == undefined)
			return [-1];
		for (var j = 0; j < poly.length; j++)
		{
			var xAX = x - poly[j][0];
			var yAX = y - poly[j][1];
			var xAB = poly[(j+1)%poly.length][0] - poly[j][0];
			var yAB = poly[(j+1)%poly.length][1] - poly[j][1];
			var xAC = center[0] - poly[j][0]; //poly[(j+2)%poly.length][0] - poly[(j+1)%poly.length][0];
			var yAC = center[1] - poly[j][1]; //poly[(j+2)%poly.length][1] - poly[(j+1)%poly.length][1];
//			console.log(i + ", " + j + ":  " + (xAB*yAX - yAB*xAX > 0) + ", " + (xAB*yAC - yAB*xAC > 0))
			if ((xAB*yAX - yAB*xAX > 0) ^ (xAB*yAC - yAB*xAC > 0))
				break;	// Quits prematurely, because point is outside of polygon.
		}
		if (j == poly.length)	// If doesn't quit prematurely, point is inside polygon.
		{
//			console.log("WOOHOO " + i);
			if (tree.children[i].children.length == 0)
			{
				var dist = 9999;
				for (var j = 0; j < poly.length; j++)
				{
					var xAX = x - poly[j][0];
					var yAX = y - poly[j][1];
					var xAB = poly[(j+1)%poly.length][0] - poly[j][0];
					var yAB = poly[(j+1)%poly.length][1] - poly[j][1];
					dist = Math.min(dist, Math.abs(xAX*yAB - yAX*xAB)/Math.sqrt(xAB*xAB + yAB*yAB));
				}
				return [i, dist];
			}
			else
				return [i].concat (getMousePoly(x, y, tree.children[i]));
		}
	}
	return [-1];
}

VoronoiTreemap.prototype.getLeaf = function (arr, tree)
{
	tree = tree ? tree : this.tree;
	if (arr.length > 0 && arr[0] > -1 && tree.children.length > arr[0])
		return getLeaf(arr.slice(1), tree.children[arr[0]]);
	else if (arr.length > 0)
		return null;
	else
		return tree;
}

function treemap_mousemove (treemap)
{
	return function ()
	{
		if (treemap.active)
		{
			var mouseXY = d3.mouse(this);
			var x = mouseXY[0], y = mouseXY[1];
		
			var p = treemap.getMousePoly(x, y);
			var l = treemap.getLeaf(p.path);
			var tooltip = "#" + treemap.tooltip_name; //"#treemap_" + treemap.id + "_tip";
			if (l != null && p.distance > 2)	// polyBorderSize = 2
			{
				// Tooltip
				if (treemap.tooltip != null && treemap.tooltip_text != null)
				{
					var outString = treemap.tooltip_text (l, p.path);
					d3.select(tooltip).html(outString).style("display", "block");
					var w = $(tooltip).width(); //console.log(w);
					x = d3.event.pageX;
					x = (x < treemap.width - w) ? x + 15 : x - w - 15;
					$(tooltip).css("top", ""+(d3.event.pageY+15)+"px");
					$(tooltip).css("left", ""+x+"px");
				}
		
				// Color selected polygon
				treemap.highlight (l.id);
			}
			else
			{
				// Remove tooltip
				if (treemap.tooltip != null)
					d3.select(tooltip).style("display", "none");
		
				// Uncolor selected polygon
				treemap.highlight (-1);
			}
		}
	}
}

// Highlights the polygon on mouse-over.  Can't use standard CSS highlighting because it fails when we mouse-over the text, or when we mouse-over close to the borders.
VoronoiTreemap.prototype.highlight = function (id)
{
	var tag = "#poly" + this.id + "_";
//	console.log(id + " " + this.selectedPolygon);
	if (id == -1 && this.selectedPolygon != -1)
	{
		d3.select(tag + this.selectedPolygon)
			.attr("fill", function(d) {return d.color;});
	}
	else if (id != -1)
	{
		d3.select(tag + selectedPolygon)
			.attr("fill", function(d) {return d.color;});
		d3.select(tag + id)
			.attr("fill", function(d) {return d3.rgb(d.color).darker(1.5).toString();});
//		d3.select(tag + id)
//			.attr("fill", "#000000");
		this.selectedPolygon = id;
	}
}


function treemap_click (treemap)
{
	return function ()
	{
		if (treemap.active)
		{
			var mouseXY = d3.mouse(this);

			// do stuff
		}
	}
}

function treemap_mouseout (treemap)
{
	return function (d)
	{
		if (treemap.active)
		{
			// Remove tooltip
			if (treemap.tooltip != null)
				treemap.tooltip.style("display", "none");
			// Uncolor selected polygon
			treemap.highlight (-1);
		}
	}
}

// Event handling functions.
function treemap_polyclick (treemap)
{
	return function (d)
	{
		if (treemap.active)
		{
			var node = getTreeNode(treemap.tree, d.path);
			for (var fn in treemap.onpolyclick)
				treemap.onpolyclick[fn](node, d.path);
			for (var fn in treemap.onclick)
				treemap.onclick[fn](node, d.path);
		}
	}
}

function treemap_textclick (treemap)
{
	return function (d)
	{
		if (treemap.active)
		{
			var node = getTreeNode(treemap.tree, d.path);
			for (var fn in treemap.ontextclick)
				treemap.ontextclick[fn](node, d.path);
			for (var fn in treemap.onclick)
				treemap.onclick[fn](node, d.path);
		}
	}
}

function treemap_mousemove2 (treemap)
{
	return function (d)
	{
		if (treemap.active)
		{
			var node = getTreeNode(treemap.tree, d.path);
			for (var fn in treemap.onmousemove)
				treemap.onmousemove[fn](node, d.path);
		}
	}
}

VoronoiTreemap.prototype.on = function (event, fn)
{
	event = event.split(".");
	var eventRoot;
	switch (event[0])
	{
		case "click":
			eventRoot = this.onclick;
			break;
		case "textclick":
			eventRoot = this.ontextclick;
			break;
		case "polyclick":
			eventRoot = this.onpolyclick;
			break;
		case "mousemove":
			eventRoot = this.onmousemove;
			break;
		case "scroll":
			eventRoot = this.onscroll;
			break;
//		case "mouseout":
//			eventRoot = this.onmouseout;
//			break;
		default:
			throw "VoronoiTreemap.on: Event " + eventRoot + " not supported.";
	}
	var eventChild = event[1];
	if (eventChild)
	{
		if (fn != null)
			eventRoot[eventChild] = fn;
		else
			delete eventRoot[eventChild];
	}
	else
	{
		if (fn != null)
			this["on" + event[0]] = {"d3f4uLT": fn};
		else
			this["on" + event[0]] = {};
	}
}

VoronoiTreemap.prototype.activate = function ()
{
	this.active = true;
}

VoronoiTreemap.prototype.deactivate = function ()
{
	// Remove tooltip
	if (this.tooltip != null)
		this.tooltip.style("display", "none");
	// Uncolor selected polygon
	this.highlight (-1);
	this.active = false;
}

function getOffset(el)
{
    var _x = 0;
    var _y = 0;
    while( el && !isNaN( el.offsetLeft ) && !isNaN( el.offsetTop ) ) {
        _x += el.offsetLeft - el.scrollLeft;
        _y += el.offsetTop - el.scrollTop;
        el = el.offsetParent;
    }
    return [_x, _y];
}

VoronoiTreemap.prototype.resize = function (width, height, bboxNew)
{
	// Rescale stuff.  If bboxNew is specified, we use distortPolygonPoints to map the child centers from the old bounding box to the new one.  Otherwise, we just scale them to the new width and height.
	var xScale = width / this.width, yScale = height / this.height;
	this.width = width; this.height = height;
	if (!bboxNew)
	{
		for (var i = 0; i < this.bbox.length; i++)
		{
			this.bbox[i][0] *= xScale; this.bbox[i][1] *= yScale;
		}
		this.tree.polygon = clone_array(this.bbox);
		for (var i in this.tree.children)
		{
			this.tree.children[i].center[0] *= xScale; this.tree.children[i].center[1] *= yScale;
		}
	}
	else
	{
		var pts = distortPolygonPoints (_.map(this.tree.children, function(x) {return x.center}), this.bbox, bboxNew, 
			center(this.bbox), center(bboxNew), 1);
		for (var i in this.tree.children)
			this.tree.children[i].center = pts[i];
	}
	
	// Do a new centroidal tessellation, but only for the top-level nodes.
	var newPolys = tessellate (this.tree.children, this.bbox);
	tessellate(newPolys, this.bbox, {"applyToInput": true});
	tessellate(newPolys, this.bbox, {"applyToInput": true});
	for (var i in this.tree.children)
	{
		treemap_step (this, this.tree.children[i], newPolys[i].polygon);
	}
	this.draw();
}