var eventTimes_bubble, domainList_bubble, domainInverse_bubble, clusterTree_bubble;
var domainEdgeList_bubble, domainEdgeListS_bubble;
var polyBubbleSmall, polyBubbleLarge;

var isZoom = false;		// Whether the app is zoomed in on a website or not.
var isBubble = false;
var isBubbleGrayed = false;

var bubbleId = "";

function zoomIn (node, path)
{
	Tick();
	var host = node.url;
	var tmp = loadTimesForGivenHost (eventTimes, host);
	eventTimes_bubble = tmp.eventTimes;
	eventTimesSorted_bubble = tmp.eventTimesSorted;
	domainList_bubble = tmp.domainList;
	domainInverse_bubble = tmp.domainInverse;

	// Create domainEdgeList.
	domainEdgeList_bubble = loadDomainEdgeList (eventTimesSorted_bubble, domainList_bubble, dateStart, dateEnd);
	domainEdgeListS_bubble = loadDomainEdgeListS (domainEdgeList_bubble);
		
	// Create clusterTree.
	Tick();
	clusterTree_bubble = formTree(domainList_bubble, domainEdgeList_bubble, domainEdgeListS_bubble);
	
	standardTreeProcessing(clusterTree_bubble);
	console.log("Loading clusterParentList and clusterTree: " + Tick() + " ms.");

	console.log("Website " + host + " has total of " + domainList_bubble.length + " pages.");
	
	d3.select("#tip").style("display", "none");

	// Decides whether to enlarge the full screen, or just open up a bubble with possible choices.
	// TODO -- implement full zoom-in
	if (false && domainList_bubble.length > 250)
		zoomInFull ();
	else
		zoomInBubble (node, path);
}

// TODO -- implement full-screeen zoom-in
function zoomInFull ()
{
	throw "ZoomInFull: Not yet implemented."
	isZoom = true;
	homeInflatedBubble = inflatedBubble;
	inflatedBubble = -1;
			
	// After the history is loaded, load the visual.
	load_display(clusterTree_bubble);	
}

function zoomInBubble (node, path)
{
	isZoom = true; isBubble = true;
	homeInflatedBubble = inflatedBubble;
	inflatedBubble = -1;
			
	// After the history is loaded, load the visual.
	displayCreateBubble (clusterTree_bubble, node, path);
	//load_display(clusterTree_bubble);	
}

function zoomOut ()
{
	treemap_bubble.dispose();
	treemap_bubble = null;
	vis.on("click.bubble", null);
	var polyTemp = vis.append("polygon").attr("points", polyBubbleLarge.points)
		.attr("fill", polyBubbleLarge.fill)
		.attr("stroke", polyBubbleLarge.stroke)
		.attr("stroke-width", polyBubbleLarge.strokewidth)
	polyTemp
		.transition()
		.duration(200)
		.attr("points", polyBubbleSmall.points)
		.attr("fill", polyBubbleSmall.fill)
		.attr("stroke-width", polyBubbleSmall.strokewidth)
		.each("end", function ()
		{
			polyTemp.remove();
			isZoom = false;
			isBubble = false;
			inflatedBubble = homeInflatedBubble;
			treemap.activate();
		})
	if (isBubbleGrayed)
	{
//		treemap.colorsBackup = (treemap.colorsBackup != null ? treemap.colorsBackup : treemap.colors);
		treemap.recolor(isSearchResults ? searchColors : defaultColors, 200);
		isBubbleGrayed = false;
	}
}

// Creates a "bubble" showing the pages of a given site, if there are few enough of them.
// bubbleTree -- the clusterTree object for the bubble
// url -- the url corresponding to the site
function displayCreateBubble (bubbleTree, node, path)
{
//	console.log("DisplayCreateBubble!  " + node.id);
//	console.log(path);

	var n = domainList_bubble.length;
	var url = node.url;
	isTransition = true;
		
	treemap.deactivate ();					// Disable interactivity in main tree.
		
	// Compute polygons for the bubble
	maxStroke /= 1.5;
	bubbleId = "#poly" + treemap.id + "_" + node.id;
	var bubbleColor1 = d3.select(bubbleId).attr("fill");
	var bubbleColor2 = treemap.colors(path, node);
	var bubbleEdge = d3.select(bubbleId).attr("fill");
	var bubbleWidth = d3.select(bubbleId).attr("stroke-width");
	var bubblePolyTemp1 = _.map(d3.select(bubbleId).attr("points").split(" "), 
		function(x) {var y = x.split(","); return [parseFloat(y[0]), parseFloat(y[1])]})
/*	var bubblePolyTemp2 = []; var m = bubblePolyTemp1.length; //console.log(m);
	for (var i = 0; i < bubblePolyTemp1.length; i++)
	{
		var m2 = 8;
		for (var j = 0; j < m2; j++)
			bubblePolyTemp2.push([(1-j/m2)*bubblePolyTemp1[i][0] + (j/m2)*bubblePolyTemp1[(i+1)%m][0],
				(1-j/m2)*bubblePolyTemp1[i][1] + (j/m2)*bubblePolyTemp1[(i+1)%m][1]]);
	}
	var c = centroid(bubblePolyTemp1);
	var r = Math.min((n + 5) * 0.4 / 20, 0.4) * Math.min(width, height);
	for (var i in bubblePolyTemp1)
		r = Math.max(r, dist(c, bubblePolyTemp1[i])*1.5);
	var bubblePoly = _.map (bubblePolyTemp2, function (pt) 
	{
		var dx = pt[0] - c[0], dy = pt[1] - c[1], xMax = width - c[0], yMax = height - c[1], xMin = -c[0], yMin = -c[1];
		var dr = Math.sqrt(dx*dx + dy*dy);
		dx *= r/dr; dy *= r/dr;
		dx = Math.max(Math.min(dx, xMax), xMin);
		dy = Math.max(Math.min(dy, yMax), yMin);
		return [c[0] + dx, c[1] + dy];
	})
	var bubblePoly2 = clone_array(bubblePoly);
	while (true)	// Get rid of redundant indices in bubblePoly.
	{
		var deletePoint = false;
		for (var i = bubblePoly2.length - 1; i >= 0; i--)
			if (bubblePoly2[i][0] == bubblePoly2[(i+1)%bubblePoly2.length][0] && 
				bubblePoly2[i][1] == bubblePoly2[(i+1)%bubblePoly2.length][1])
			{
				bubblePoly2.splice(i, 1);
			}
		break;
	}*/
	
	// TODO -- call getBubblePolygon
	var ans = getBubblePolygon (bubblePolyTemp1, width, height, n)
//	throw "Call getBubblePolygon here.";

	// Create the main treemap and draw it.
	var bubbleColors = (isSearchResults || n >= 15) ? treemap.colors : darkenColors(bubbleColor2);
	treemap_bubble = new VoronoiTreemap (clusterTree_bubble, ans.polyLargeClipped, vis, {"tooltip": d3.select("#tip"),
		"tooltip_text": function(d) {return (d.title.length <= 60 ? d.title : d.title.substr(0, 60) + "...")
			 + "<br>(" + (d.url.length <= 40 ? d.url : (d.url.substr(0, 40) + "...")) + ")";},
 		"text": function (d) {return d.title},
		"color": bubbleColors, "textColor": color.text
		});

	//print_array(bubblePoly2);
		
	// Create and expand the bubble.
	polyBubbleSmall = {"points": _.map(ans.polySmall, function(x) {return x.join(",");}).join(" "), 
		"fill": bubbleColor1, "stroke": "white", "strokewidth": bubbleWidth};
	polyBubbleLarge = {"points": _.map(ans.polyLarge, function(x) {return x.join(",");}).join(" "),
		"fill": bubbleColor2, "stroke": "white", "strokewidth": displayTreeStrokeWidth(0)};
	polyTemp = vis.append("polygon").attr("points", polyBubbleSmall.points)
		.attr("fill", bubbleColor1)
		.attr("stroke", "white")
		.attr("stroke-width", bubbleWidth);
	polyTemp
		.transition()
		.duration(200)
		.attr("points", polyBubbleLarge.points)
		.attr("fill", bubbleColor2)
		.attr("stroke-width", displayTreeStrokeWidth(0))
		.each("end", function () 
		{
			// Stuff to do after the transition ends.
			activeTree = clusterTree_bubble;
			isTransition = false;
			
			if (n > 15)		// Desaturate the exterior for large bubbles.
			{
				treemap.colorsBackup = (treemap.colorsBackup != null ? treemap.colorsBackup : treemap.colors);
				treemap.recolor(function (path, node)
				{
					var a = d3.hsl(treemap.colorsBackup(path, node));
					a.s = 0; a.l = 0.625 + (a.l - 0.625)*0.4; return a.toString();
				}, 1000);
				isBubbleGrayed = true;
			}
			
			treemap_bubble.draw ();
			treemap_bubble.on("click", visitSiteBubble);
			polyTemp.remove();
			vis.on("click.bubble", 
				function (x) {if (!isInsidePolygon(d3.mouse(this), treemap_bubble.bbox)) {zoomOut();}})
			
		});
}

function getBubblePolygon (poly, width, height, n)
{
//	var bubblePolyTemp1 = _.map(d3.select("#poly" + treemap.id + "_" + node.id).attr("points").split(" "), 
//		function(x) {var y = x.split(","); return [parseFloat(y[0]), parseFloat(y[1])]})
	var polySmall = []; var m = poly.length; //console.log(m);
	for (var i = 0; i < poly.length; i++)
	{
		var m2 = 8;
		for (var j = 0; j < m2; j++)
			polySmall.push([(1-j/m2)*poly[i][0] + (j/m2)*poly[(i+1)%m][0],
				(1-j/m2)*poly[i][1] + (j/m2)*poly[(i+1)%m][1]]);
	}
	var c = centroid(poly);
	var r = Math.min((n + 5) * 0.4 / 20, 0.4) * Math.min(width, height);
	for (var i in poly)
		r = Math.max(r, dist(c, poly[i])*1.5);
	var polyLarge0 = _.map (polySmall, function (pt) 
	{
		var dx = pt[0] - c[0], dy = pt[1] - c[1], xMax = width - c[0], yMax = height - c[1], xMin = -c[0], yMin = -c[1];
		var dr = Math.sqrt(dx*dx + dy*dy);
		dx *= r/dr; dy *= r/dr;
		dx = Math.max(Math.min(dx, xMax), xMin);
		dy = Math.max(Math.min(dy, yMax), yMin);
		return [c[0] + dx, c[1] + dy];
	})
	var polyLarge = clone_array(polyLarge0);
	while (true)	// Get rid of redundant indices in bubblePoly.
	{
		var deletePoint = false;
		for (var i = polyLarge.length - 1; i >= 0; i--)
			if (polyLarge[i][0] == polyLarge[(i+1)%polyLarge.length][0] && 
				polyLarge[i][1] == polyLarge[(i+1)%polyLarge.length][1])
			{
				polyLarge.splice(i, 1);
			}
		break;
	}
	
	return {"polySmall": polySmall, "polyLarge": polyLarge0, "polyLargeClipped": polyLarge};
}

function displayTreeStrokeWidth (level)
{
	return 14 / Math.pow(2.5, level+1);
}