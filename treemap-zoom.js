function treemap_zoomMousewheel (treemap)
{
	return function ()
	{
		if (treemap.active)
		{
			// Now that we've registered wheel motion, do something with it (zooming).
			var mouseXY = d3.mouse(this);
			var path = treemap.getMousePoly(mouseXY[0], mouseXY[1]).path;
			var zoomNode = path[0];
			
			if (treemap.zooming)
			{
				// Stuff dealing with movement of the mouse's wheel.
				treemap_wheelMoves = _.filter(treemap_wheelMoves, function (x) {return (x[1] > Date.now() - 800)});
				treemap_wheelMoves.push([d3.event.wheelDeltaY, Date.now()]);
				var sum = 0;
				for (var i in treemap_wheelMoves)
					sum += treemap_wheelMoves[i][0];
				var wheelmove = 0;
				if (sum > 600)
				{
					treemap_wheelMoves = [];
					wheelmove = 1;
				}
				else if (sum < -600)
				{
					treemap_wheelMoves = [];
					wheelmove = -1;
				}
				else
					return;
	
				if (zoomNode == -1 && wheelmove == 1)
					return;
				else
					treemap.zoom(wheelmove, zoomNode);				
			}
			
			if (path[0] != -1)
			{
				var node = getTreeNode(treemap.tree, path);
				for (var fn in treemap.onscroll)
					treemap.onscroll[fn](node, path);
			}
		}
	}
}

// Directs the diagram to zoom in (direction = 1) or out (direction = -1), focusing on zoomNode.
VoronoiTreemap.prototype.zoom = function (direction, zoomNode)
{
	var nFrames = 3;
	
	if (this.currentZoomAnim == null)
	{
		var zoomingOut = this.zoomState != -1 && direction < 0;
		var widthMatches = this.lastZoomAnim && this.width == this.lastZoomAnim.w && this.height == this.lastZoomAnim.h;
		var savedZoom = this.zoomStateLast == -1 && widthMatches;
		if (savedZoom && zoomingOut)
		{
			this.currentZoomAnim = this.lastZoomAnim;
			this.currentZoomAnim.index = this.currentZoomAnim.int_nodes.length - 1;
			this.currentZoomAnim.direction = -1;	// Zooming backwards.
			zoomNode = -1;	// Just in case...
			
			for (var i = 0; i < nFrames; i++)
				this.animation_queue.push(animateZoom);
		}
		else if ((direction > 0 && zoomNode != this.zoomState) || (zoomingOut && !savedZoom))
		{
			var bubbleFactor = 7;
			
			var int_nodes = [];
			debug.int_nodes = int_nodes;
			var initNode = this.zoomoutPolys;
			if (!widthMatches)
				tessellateCentroidal (initNode, this.bbox, {"applyToInput": true, "newCenters": true});
			var currNode = initNode; int_nodes.push(currNode);
			for (var i = 0; i < nFrames; i++)
			{
				// Set up the new node list.
				var newNode = _.map(currNode, function(x) {return {"center": x.center, 
					"polygon": x.polygon, "nodeWeight": x.nodeWeight}});
				newNode[zoomNode].nodeWeight = initNode[zoomNode].nodeWeight * Math.pow(bubbleFactor, (i+1)/nFrames);
				if (this.zoomState != -1 && direction > 0)
					newNode[this.zoomState].nodeWeight = initNode[this.zoomState].nodeWeight * Math.pow(bubbleFactor,
						1 - (i+1)/nFrames);
				// Perform centroidal tessellation.
				tessellateCentroidal (newNode, this.bbox, {"applyToInput": true, "newCenters": true, 
					"sortWeights": _.map(initNode, function(x) {return x.weight;})}); // nC -> false?
				int_nodes.push(newNode);
				currNode = newNode;
			}
			
			// Schedule drawing events.
			if (direction > 0)
				this.currentZoomAnim = {"int_nodes": int_nodes, "index": 0, "direction": 1, 
					"w": this.width, "h": this.height};
			else
				this.currentZoomAnim = {"int_nodes": int_nodes, "index": int_nodes.length - 1, "direction": -1,
					"w": this.width, "h": this.height};
			
			for (var i = 0; i < nFrames; i++)
				this.animation_queue.push(animateZoom);
		}
		else
		{
//			console.log("No need to zoom out from zoomed-out state, or zoom into an enlarged node.");
			return;
		}
		
		// Update state.
		this.zoomStateLast = this.zoomState;
		this.zoomState = (direction > 0) ? zoomNode : -1;
	
		
		this.start();
	}
	else
	{
//		console.log("Mousewheel during zoom animation not currently supported.");
	}
}

// Searches a sorted array for element elem.  Returns the closest value.
function binarySearch (array, elem)
{
	var n1 = 0, n2 = array.length - 1;
	if (elem <= array[n1])
		return 0;
	else if (elem >= array[n2])
		return n2;
	else
	{
		while (n2 - n1 > 1)
		{
			var n3 = (n1 + n2) >> 1;	// floor[(n1+n2)/2]
			if (elem < array[n3])
				n2 = n3;
			else
				n1 = n3;
		}
		if (elem - array[n1] < array[n2] - elem)
			return n1;
		else
			return n2;
	}
}

// Searches through an array for elem.  Returns the first element >= elem in the array.
function binarySearchGreater (array, elem)
{
	var n1 = 0, n2 = array.length - 1;
	if (elem <= array[n1])
		return 0;
	else if (elem >= array[n2])
		return n2;
	else
	{
		while (n2 - n1 > 1)
		{
			var n3 = (n1 + n2) >> 1;	// floor[(n1+n2)/2]
			if (elem < array[n3])
				n2 = n3;
			else
				n1 = n3;
		}
		if (elem == array[n1])
			return n1
		else
			return n2;
	}	
}

function animateZoom (treemap)
{
	var z = treemap.currentZoomAnim;
	z.index += z.direction;
//	console.log("Zoom " + z.index);
	var nodes = z.int_nodes[z.index]
	
	// TODO -- finish this function
	// Redraw the treemap.
	for (var i = 0; i < nodes.length; i++)
	{
		treemap.tree.children[i].nodeWeight = nodes[i].nodeWeight;
		treemap_step (treemap, treemap.tree.children[i], nodes[i].polygon);
		if (i == this.zoomState)
		{
			tessellateCentroidal (treemap.tree.children[i].children, treemap.tree.children[i].polygon, 
				{"applyToInput": true, "newCenters": false})
			
//			treemap_step (treemap, treemap.tree.children[i]);
//			treemap_step (treemap, treemap.tree.children[i]);
//			treemap_step (treemap, treemap.tree.children[i]);
//			treemap_step (treemap, treemap.tree.children[i]);
		}
	}
	
	if ((z.index == z.int_nodes.length - 1 && z.direction == 1) || (z.index == 0 && z.direction == -1))
	{
		treemap.lastZoomAnim = treemap.currentZoomAnim;
		treemap.currentZoomAnim = null;
	}
	treemap.draw();
}

function animateStepDraw (treemap)
{
	treemap.step (); treemap.draw();
}