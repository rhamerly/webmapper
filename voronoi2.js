// This is my attempt to re-work Scott Chung's Voronoi Treemap algorithm.  I think that a local, neighbor-based
// approach may improve performance, especially when the number of nodes becomes large.
//
// Summary of Algorithm:
//
// A Voronoi map is generated from a list of vertices by creating bisecting lines to split these vertices.  The weighted
// Voronoi diagram is similar, but for one caveat: The lines forming polygon edges are not perpendicular bisectors; they
// are still perpendicular, but they no longer bisect; otherwise, the diagram would not be weighted.
//
// 1.  Rescale node weights.  Node weights must be scaled such that |w_2 - w_1| < r_12^2 for all nodes 1 and 2.
//     Splitting lines are displaced from the bisection point by an amount (w_2 - w_1)/(2*r_12).  Rescaling is needed
//     to ensure that displacements never exceed half the distance between nodes.
// 2.  Add largest two points.  Insert a splitting line.  Create two "sites", one for each point, of the form:
//     {
//      	center: [x, y],
//      	id: node_id,
//      	nodeWeight: node_wt,					(normalized weight)
//      	polygon: [[x1,y1], ..., [xn,yn]]	(ordered counterclockwise)
//      	neighbors: [n1, n2, ..., nk],		(neighbor n_r lies on polygon edge [[x_r,y_r], [x_{r+1},y_{r+1}]], null 
//												 if edge lies on bounding box)
//      	contains: [vert1, ..., vertN]		(list of vertices this node's polygon "contains", but which havne't yet
//    											 been added to the graph, sorted by weight)
//     }
// 3.  Pick any other point (preferably one with a large weight, X), inside the polygon of site C.
// 4.    Get splitting line between X and C.  Find the polygon exit point, and the corresponding neighbor.
//       (If neighbor is a null (boundary), iterate around the polygon until you find a non-null neighbor.)
//       Trim C's polygon, keeping track of the neighbors.
// 5.    Repeat (4), until you return to C.
// 6.  Repeat (3-5) for other points, until no new points need to be added.
//
// This has pretty good performance, which follows a quadratic fit:
//
// T = (-0.0169 + 0.0277 n + 0.000177 n^2) ms
// 
// N      T(N)
// ------------
// 1:     0.012
// 2:     0.037
// 3:     0.062
// 4:     0.089
// 5:     0.111
// 10:    0.267
// 15:    0.431
// 20:    0.604
// 30:    1.014
// 40:    1.445
// 50:    1.960
// 75:    3.350
// 100:   4.650
// 150:   8.450
// 200:   12.35
// 300:   24.20
// 500:   52.25



var addNode_beenThereDoneThat = {};	// Used for addNodeClipPoly
var addNodeClipPoly_beginPoint = null;
var addNodeClipPoly_currentPoint = null;
var addNodeClipPoly_continueFromEdge = false;
var edgePoints = [];	// Elements take the form {point: [x, y], nodePrev: node, nodeNext: node}
var rThreshold = 0.0000000001;
var lastWeightFactor = {"default": -1};
var lastNumNodes = {"default": -1};
var weightDelayConstant = 0.7;	// A constant c, delays the weight factor: factor = (1-c)*current + c*last
var maxSizeFrac = 0.95;	// A constant.  1-maxSizeFrac is the relative size of the smallest possible node.  Must be > 0.
var superMaxSizeFrac = 0.98;	// Tight bound, always satisfied.
						
function getEdgePointInd(pt)
{
	for (var i = 0; i < edgePoints.length; i++)
		if (comparePoints(pt, edgePoints[i].point))
			return i;
	return -1;
}

function getPolyPointInd(pt, poly)
{
	for (var i = 0; i < poly.length; i++)
		if (comparePoints(pt, poly[i]))
			return i;
	return -1;
}

// To add a node (X) to the Voronoi map, we need to clip off some material from the polygon of an existing node (C).
// Arguments:
// - nodeX: the polygon being built and added
// - nodeC: the polygon being clipped
function addNodeClipPoly (nodeX, nodeC)
{
	debug.nodeX = nodeX; debug.nodeC = nodeC;
	
	//debugcomment// console.log ("AddNodeClipPoly ---------------------------------------------------------------");
	//debugcomment// DisplayDebugPoly ();
	//debugcomment// console.log (debugPolyId - 1);
	//debugcomment// console.log("nodeX = " + nodeX.id + ", nodeC = " + nodeC.id);	
	
	if (nodeC.id in addNode_beenThereDoneThat)	// If I've already been to this node, I'm returning.  Quit.
		return "done";
	
	// Get line splitting X and C nodes.  Find its intersections with the polygon.  Since the polygon is convex,
	// there will be only two intersection points.
	var inPointInd = -1, outPointInd = -1;
	var line = nodeSplittingLine (nodeX, nodeC);
	var c1 = nodeC.polygon[0][0]*line.a + nodeC.polygon[0][1]*line.b - line.c;
	var c2 = 0;
	var n = nodeC.polygon.length;
	for (var i = 0; i < nodeC.polygon.length; i++)
	{
		c2 = nodeC.polygon[(i+1)%n][0]*line.a + nodeC.polygon[(i+1)%n][1]*line.b - line.c;
		if ((c1 > 0) ^ (c2 > 0))
		{
			if (c1 < 0)
				inPointInd = i;
			else
				outPointInd = i;
//			if (inPointInd != -1 && outPointInd != -1)
//				break;
		}
		// Updates the properties of the boundary points, if any.  All boundary points on nodeX's side of the separator
		// must be reassigned to nodeX, through either nodePrev or nodeNext.
		if (c2 < 0)		
		{
			//debugcomment// console.log ("Our side:    " + nodeC.polygon[(i+1)%n] + ", with neighbors " + (nodeC.neighbors[i] ? nodeC.neighbors[i].id : null) + ", " + (nodeC.neighbors[((i+1)%n)] ? nodeC.neighbors[(i+1)%n].id : null));
			if (nodeC.neighbors[i] == null || nodeC.neighbors[(i+1)%n] == null)
			{
				var ind = getEdgePointInd(nodeC.polygon[(i+1)%n]);	// This is the point that corresponds to c2.
				if (ind == -1)
					throw "Edge point " + ((i+1)%n) + " (" + nodeC.polygon[(i+1)%n] + ") not registered on edgePoints.";
				if (nodeC.neighbors[i] == null)
				{
					if (edgePoints[ind].nodePrev.id != nodeC.id)
					{
						//debugcomment// console.log ("Warning: At edge pt " + ind + " (" + nodeC.polygon[(i+1)%n] + "), nodePrev = " + edgePoints[ind].nodePrev.id + ", not nodeC (" + nodeC.id + ")");
					}
					edgePoints[ind].nodePrev = nodeX;
				}
				if (nodeC.neighbors[(i+1)%n] == null)
				{
					if (edgePoints[ind].nodeNext.id != nodeC.id)
					{
						//debugcomment// console.log("Warning: At edge pt " + ind + " (" + nodeC.polygon[(i+1)%n] + "), nodeNext = " + edgePoints[ind].nodeNext.id + ", not nodeC (" + nodeC.id + ")");
					}
					edgePoints[ind].nodeNext = nodeX;
				}
			}
		}
		c1 = c2;	// Reuse data, save time.
	}
	if (inPointInd == -1 || outPointInd == -1)
	{
		debug.nodeX = nodeX; debug.nodeC = nodeC;
		throw "Bisection line between nodeX and nodeC does not pass through polygon C.";
	}
	var inPoint = lineIntersectPoint (line, nodeC.polygon[inPointInd], nodeC.polygon[(inPointInd+1)%n]);
	var outPoint = lineIntersectPoint (line, nodeC.polygon[outPointInd], nodeC.polygon[(outPointInd+1)%n]);
	// Add two extra boundary points at polygon-line intersections.
	if (nodeC.neighbors[inPointInd] == null)
		edgePoints.splice(getEdgePointInd(nodeC.polygon[(inPointInd+1)%n]), 0, {"point": inPoint, "nodePrev": nodeX,
			"nodeNext": nodeC});
	if (nodeC.neighbors[outPointInd] == null)
		edgePoints.splice(getEdgePointInd(nodeC.polygon[(outPointInd+1)%n]), 0, {"point": outPoint, "nodePrev": nodeC,
			"nodeNext": nodeX});
			
	// If inPoint is an interior point (not a boundary point), then currentPoint *must* be equal to the inPoint in order
	// for the standard code (create line segment joining the two) to work.  This works fine whenever both inPoint and
	// currentPoint are interior points (this can be proven).
	// The problem is, someties currentPoint is an edge point.  The solution to this problem is to have currentPoint
	// wrap around the boundary, picking up points for nodeX's polygon, ignoring the fact that these point are supposed
	// to belong to nodeC.  Eventually, you reach a non-nodeC point.  Repeat the process from there.
	if (nodeC.neighbors[inPointInd] != null && addNodeClipPoly_currentPoint != null && !comparePoints(addNodeClipPoly_currentPoint, inPoint))
	{
		//debugcomment// console.log("This case: inPoint is interior, but currentPoint != inPoint.");
		//debugcomment// console.log("Set edges to belong to Node " + nodeX.id + ", return null.");
		return null;
		//var a = traverseEdge(nodeX);
		//	throw "We haven't worked this out yet.  Edge " + ((a != null) ? a.id : null);
		// See Configuration #1, below, which fails without this.
	}
			
			
	// Create a new polygon for node C.  Start at inPointInd, end at outPointInd, inclusive.
	var newPoly = [];
	var newNeighbors = [];
	if (outPointInd > inPointInd)
	{
		newPoly = nodeC.polygon.slice(inPointInd, outPointInd+1);
		newNeighbors = nodeC.neighbors.slice(inPointInd, outPointInd+1);
	}
	else
	{
		newPoly = nodeC.polygon.slice(inPointInd).concat(nodeC.polygon.slice(0, outPointInd+1));
		newNeighbors = nodeC.neighbors.slice(inPointInd).concat(nodeC.neighbors.slice(0, outPointInd+1));
	}
	newPoly[0] = inPoint;	// Modify the first point -- should be the incoming intersection.
	newPoly.push(outPoint);	// Finally, add the last edge to the polygon, and add nodeX as a neighbor.
	newNeighbors.push(nodeX);
	
	//debugcomment// console.log("In point: " + inPointInd + " (" + inPoint + "), out point: " + outPointInd + " (" + outPoint + ")");
	
	// If nodeX is just getting started, update the beginPoint variable.  Then, when we return to beginPoint later on,
	// we will know when to stop. (This is much more rigorous than assigning an index, or something else, because indices
	// change -- points don't.  Will crash if you have highly symmetric systems with 4-way crossings, etc.)
	if (nodeX.polygon.length == 0)
	{
		//debugcomment// console.log("Begin Point: (" + inPoint + ")");
		addNodeClipPoly_beginPoint = clone_array(inPoint);
	}
	
	// If we are arriving (but not starting out) at a polygon and inPoint is an edge point, we need to traverse around
	// the edge to get to that point.
	if (nodeC.neighbors[inPointInd] == null && nodeX.polygon.length > 0)
	{
		var currInd = getEdgePointInd(addNodeClipPoly_currentPoint);
		var inInd = getEdgePointInd(inPoint);
		if (currInd == -1)
			throw "Current Edge Point " + addNodeClipPoly_currentPoint + " not found in edgePoints.";
		if (inInd == -1)
			throw "Current Incoming Point " + inPoint + " not found in edgePoints.";
		for (var i = currInd; i != inInd; i = (i+1)%edgePoints.length) //i != (inInd+1)%edgePoints.length; i = (i+1)%edgePoints.length)
		{
			// Update nodeX polygon.  Not necessary to update edgePoint.prevNode, etc., since this is done previously.
			//debugcomment// console.log("Poly" + nodeX.id + " added point " + edgePoints[i].point);
			nodeX.polygon.push(clone_array(edgePoints[i].point));
			nodeX.neighbors.push(null);
		}
	}
		
	// Add the in point.	
	//debugcomment// console.log("Poly" + nodeX.id + " added point " + inPoint);
	nodeX.polygon.push([inPoint[0], inPoint[1]]);
	nodeX.neighbors.push(nodeC);
	
	// The next node to progress to.  This is null if outPoint is on the boundary.  In that case, boundary traversal,
	// rather than this method, is used to determine the next node.	
	var nextNode = nodeC.neighbors[outPointInd];
	addNodeClipPoly_currentPoint = outPoint;
	
	// Allocate nodes from nodeC's "contains" list to nodeC and nodeX, depending on which side of the line they lie on.
	var newContains = [];
	for (var i = 0; i < nodeC.contains.length; i++)
	{
		if (nodeC.contains[i].center[0]*line.a + nodeC.contains[i].center[1]*line.b - line.c < 0)
		{
			//debugcomment// console.log("Node " + nodeC.contains[i].id + "(" + nodeC.contains[i].center + ") transferred from " + nodeC.id + " to " + nodeX.id);
			nodeX.contains.push(nodeC.contains[i]);
			nodeC.contains[i].parent = nodeX;
		}
		else
			newContains.push(nodeC.contains[i]);
	}
	nodeX.contains.sort(function(a, b) {return b.rank - a.rank /*a.nodeWeight - b.nodeWeight*/});
	//	newContains.sort(function(a, b) {return a.nodeWeight - b.nodeWeight});	// Probably unnecessary, since contains is sorted.
	
//	nodeC.startPointInd = startPointInd;
//	nodeC.endPointInd = endPointInd;
//	nodeC.oldPoly = nodeC.polygon;	// debugging
//	nodeC.oldNeighbors = nodeC.neighbors;	// debugging
	nodeC.polygon = newPoly;
	nodeC.neighbors = newNeighbors;
	nodeC.contains = newContains;
	addNode_beenThereDoneThat[nodeC.id] = true;		// debugging
	
	// This is the next node in the sequence.  If outPoint wasn't on an edge, this is non-null, and lets us directly
	// proceed to the next node.  If outPoint is on an edge, this is null, and we must traverse the boundary in order to
	// find the next node.
	return nextNode;
}

// Loops around the boundary of the polygon, stopping when edgePoint.nextNode != nodeX (that is, the point borders a
// node).  Will also stop if edgePoint.point = beginPoint, returning null and signaling that the application should
// halt.
function traverseEdge(nodeX)
{
	//debugcomment// console.log ("TraverseEdge ---------------------------------------------------------------");
	//debugcomment// console.log (debugPolyId - 1);	
	//debugcomment// DisplayDebugPoly ();
	var edgeInd = getEdgePointInd(addNodeClipPoly_currentPoint);
	if (edgeInd == -1)
		throw "traverseEdge: Edge point (" + addNodeClipPoly_currentPoint + ") to traverse from does not exist."
	//debugcomment// console.log ("Traversing edge from point " + edgeInd + " (" + edgePoints[edgeInd].point + ")");
	for (var i = 0; i < edgePoints.length; i++)
	{
		var ind = (edgeInd + i) % edgePoints.length;
		//debugcomment// console.log(edgePoints[ind].point);
		addNodeClipPoly_currentPoint = edgePoints[ind].point;
		if (comparePoints(edgePoints[ind].point, addNodeClipPoly_beginPoint))
		{
			return null;
		}
		if (edgePoints[ind].nodeNext.id != nodeX.id)
		{
			return edgePoints[ind].nodeNext;
		}
		//debugcomment// console.log("Poly" + nodeX.id + " added point " + edgePoints[ind].point);
		nodeX.polygon.push(edgePoints[ind].point);
		nodeX.neighbors.push(null);	
	}
	if (ind == edgePoints.length)
		throw "Infinite for loop -- traverseEdge traversed all the way around the edge, didn't find anything."
}

// Based on center information for nodes nodeA, nodeB, computes their polygons within the bounding box.
// The Voronoi tessellation algorithm starts with the first two nodes ("First Couple"), not to be confused
// with Mr. and Mrs. Obama.
function firstCouple (nodeList, bound)
{
	nodeList.sort(function(a, b) {return b.nodeWeight - a.nodeWeight});		// Sort by weight, lowest-to-highest
	for (var i = 0; i < nodeList.length; i++)
		nodeList[i].rank = i;
	var nodes = nodeList.slice(0); nodes.reverse();
	var nodeA = nodes.pop();
	var nodeB = nodes.pop();
	
	// Create two polygons, one on each side of the bounding line.	
	var line = nodeSplittingLine (nodeA, nodeB);
	var n = bound.length;
	var c1 = bound[0][0]*line.a + bound[0][1]*line.b - line.c;
	var c2 = 0;
	nodeA.polygon = []; nodeB.polygon = []; nodeA.neighbors = []; nodeB.neighbors = [];
	edgePoints = [];
	for (var i = 0; i < n; i++)		
	{
		c2 = bound[(i+1)%n][0]*line.a + bound[(i+1)%n][1]*line.b - line.c;

		if (c1 < 0 && c2 < 0)
		{
			nodeA.polygon.push(bound[i]);
			nodeA.neighbors.push(null);
			edgePoints.push({"point": clone_array(bound[i]), "nodePrev": nodeA, "nodeNext": nodeA});
		}
		else if (c1 > 0 && c2 > 0)
		{
			nodeB.polygon.push(bound[i]);
			nodeB.neighbors.push(null);
			edgePoints.push({"point": clone_array(bound[i]), "nodePrev": nodeB, "nodeNext": nodeB});
		}
		else if (c1 < 0 && c2 > 0)
		{
			var intersect = lineIntersectPoint(line, bound[i], bound[(i+1)%n]);
			nodeA.polygon.push(bound[i]);
			nodeA.neighbors.push(null);
			edgePoints.push({"point": clone_array(bound[i]), "nodePrev": nodeA, "nodeNext": nodeA});
			nodeA.polygon.push(intersect);
			nodeA.neighbors.push(nodeB);
			nodeB.polygon.push(clone_array(intersect));
			nodeB.neighbors.push(null);
			edgePoints.push({"point": clone_array(intersect), "nodePrev": nodeA, "nodeNext": nodeB});
		}
		else if (c1 > 0 && c2 < 0)
		{
			var intersect = lineIntersectPoint(line, bound[i], bound[(i+1)%n]);
			nodeB.polygon.push(bound[i]);
			nodeB.neighbors.push(null);
			edgePoints.push({"point": clone_array(bound[i]), "nodePrev": nodeB, "nodeNext": nodeB});
			nodeB.polygon.push(intersect);
			nodeB.neighbors.push(nodeA);
			nodeA.polygon.push(clone_array(intersect));
			nodeA.neighbors.push(null);
			edgePoints.push({"point": clone_array(intersect), "nodePrev": nodeB, "nodeNext": nodeA});
		}

		c1 = c2;
	}
	
	// Add the rest of the nodes to nodeA or nodeB's "contains" lists, depending on which polygon they reside in.
	nodeA.contains = [];
	nodeB.contains = [];
	for (var i = 0; i < nodes.length; i++)
	{
		if (nodes[i].center[0]*line.a + nodes[i].center[1]*line.b - line.c < 0)
		{
			//debugcomment// console.log("Node " + nodes[i].id + "(" + nodes[i].center + ") belongs to " + nodeA.id);
			nodes[i].parent = nodeA;
			nodeA.contains.push(nodes[i]);
		}
		else
		{
			//debugcomment// console.log("Node " + nodes[i].id + "(" + nodes[i].center + ") belongs to " + nodeB.id);
			nodes[i].parent = nodeB;
			nodeB.contains.push(nodes[i]);
		}
	}
}

// Generates a Voronoi tessellation.
//   nodes -- list of nodes, which must contain {"nodeWeight": wt, "center": [x, y]}
//   bound -- the bounding box for this tessellation.  Always go counterclockwise
//   check -- checks for user errors, like negative weights, centers outside the bounding box, clockwise polygons, etc.
//			  defaults to false for performance
function tessellate (nodes, bound, options)
{
	debug.nodes = nodes;
	
	var check = (options && options.check) ? options.check : true;
	var taskId = (options && options.taskId) ? options.taskId : "default";
	var resetMemory = (options && options.resetMemory) ? options.resetMemory : false;
	var applyToInput = (options && options.applyToInput) ? options.applyToInput : false;
	
	// First, the really easy case.
	if (nodes.length == 1)
	{
		if (applyToInput)
		{
			nodes[0].center = centroid(bound);
			nodes[0].polygon = clone_array(bound);
			return;
		}
		else
			return [{"center": centroid(bound),
				"nodeWeight": nodes[0].nodeWeight,
				"polygon": clone_array(bound)}];
	}
	else if (nodes.length == 0)
		throw "Tessellate called without any nodes."
	
	// Scaling the weights.  Find the minimum value r_12^2/wt_1.  We will multiply all weights by this, so that all
	// bisection lines pass between points 1 and 2, separating them.
	var n = nodes.length;
	var weightScale = Math.pow(10, 100);	// Start at a max of 10^100.  So don't use googol-scale weights.

	// For smaller graphs (n < 250), it's faster to iterate over all pairs of points, even though this scales as O(N^2). For larger graphs, we use a QuadTree.  This has overhead, which is why it does not perform as well for small graphs, but shows significant savings when the graphs get large (30% faster at 500, 2x faster at 1000).
	if (n < 250)
	{
		// Regular implementation.
		for(var i = 0; i < nodes.length; i++)
			for(var j = i + 1; j < nodes.length; j++)
				weightScale = Math.min(dist2(nodes[i].center, nodes[j].center) * maxSizeFrac / 
					Math.max(nodes[i].nodeWeight, nodes[j].nodeWeight), weightScale);	// 0.9 scaling factor
	}
	else
	{
		// QuadTree implementation.	
		var weightPtList = [], qtX1 = bound[0][0], qtX2 = bound[0][0], qtY1 = bound[0][1], qtY2 = bound[0][1]; 
		for (var i = 1; i < bound.length; i++)
		{
			qtX1 = Math.min(bound[i][0], qtX1); qtX2 = Math.max(bound[i][0], qtX2);
			qtY1 = Math.min(bound[i][1], qtY1); qtY2 = Math.max(bound[i][1], qtY2);
		}
		for (var i = 0; i < nodes.length; i++)
			weightPtList.push([nodes[i].nodeWeight, nodes[i].center[0], nodes[i].center[1]]);
		var qt = new QuadTree(weightPtList, [qtX1, qtX2, qtY1, qtY2]);
		debug.qt = qt;
		for (var i = 0; i < nodes.length; i++)
		{
			var nearest = qt.NLookup(nodes[i].center[0], nodes[i].center[1], 2)[1];
			weightScale = Math.min(weightScale, dist2(nodes[i].center, [nearest[1], nearest[2]]) * maxSizeFrac / nodes[i].nodeWeight);
		}
	}
	
	if (resetMemory || lastNumNodes[taskId] != n)
	{
		lastWeightFactor[taskId] = weightScale;
		lastNumNodes[taskId] = n;
	}
	else
	{
		var maxWeightScale = weightScale / maxSizeFrac * superMaxSizeFrac;
		var prevWeightScale = lastWeightFactor[taskId];
		weightScale = Math.min((1 - weightDelayConstant)*weightScale + weightDelayConstant*prevWeightScale,
			maxWeightScale);
		lastWeightFactor[taskId] = weightScale;
	}
				
	//debugcomment// console.log("Weight scale: " + weightScale);

	var nodesOut = [];	
	for (var i = 0; i < n; i++)
		nodesOut.push({"center": clone_array(nodes[i].center), "id": i, "nodeWeight": nodes[i].nodeWeight * weightScale,
			"polygon": [], "neighbors": [], "contains": [], "parent": null, "rank": 0});
	
	// More error checking.		
	if (check)
	{
		var msg = "";
		var err1 = [];
		var err2 = [];
		for (var i = 0; i < n; i++)
		{
			if (nodes[i].nodeWeight <= 0)
				err1.push(i);
			if (!isInsidePolygon(nodes[i].center, bound))
				err2.push(i);
		}
		if (err1.length > 0)
			msg += "Weights negative: [" + err1 + "].  ";
		if (err2.length > 0)
			msg += "Points outside polygon: [" + err2 + "].  ";
		var aCCW = 0;
		for (var i = 0; i < bound.length; i++)
			aCCW += (bound[i][0]+bound[(i+1)%bound.length][0])*(bound[(i+1)%bound.length][1]-bound[i][1]);
		if (aCCW < 0)
		{
			msg += "Bounding box faces clockwise.";
		}
		if (msg.length > 0)
			throw msg;
	}
	
	// Get the top two nodes, set up a dividing line, and break into polygons.
	// Also, sort nodes from 
	firstCouple(nodesOut, bound);
	
	//debugcomment// DisplayDebugPoly (0);
	
	//console.log(_.map(nodesOut[0].contains, function(x) {return x.nodeWeight}));
	//console.log(_.map(nodesOut[1].contains, function(x) {return x.nodeWeight}));
	
	//debugcomment// console.log("WOOHOO");
	
	// Goes down the list.  For each node, finds its parent, dissociates it, and forms a new polygon.
	for (var i = 2; i < nodesOut.length; i++)
	{
		// Reset global variables.
		addNode_beenThereDoneThat = {};
		addNodeClipPoly_beginPoint = null;
		addNodeClipPoly_currentPoint = null;
		addNodeClipPoly_continueFromEdge = false;
		
		var nodeX = nodesOut[i]; var nodeParent = nodeX.parent;
		var nodeX2 = nodeParent.contains.pop();	// Remove nodeX from nodeParent.
		if (nodeX.id != nodeX2.id)
			throw "Inconsistent ID's: " + nodeX.id + "(parent " + nodeX.parent.id + "), " + nodeX2.id + "(parent " + nodeParent.id + ")";
		nodeX.parent = null;
		//debugcomment// console.log("Node " + nodeX.id + "(" + nodeX.center + ") liberated from " + nodeParent.id);
		
//		console.log(i);
//		console.log(nodeX);
//		console.log(nodeParent);
		var nodeC = nodeParent;
		addNode_beenThereDoneThat = {};
//		print_array(_.map(edgePoints, function (x) {return {"x": Math.round(x.point[0]), "y": Math.round(x.point[1]), "nodePrev": x.nodePrev.id, "nodeNext": x.nodeNext.id}}))
		for (var j = 0; j < 25; j++)
		{
			nodeC = addNodeClipPoly(nodeX, nodeC);
//			print_array(_.map(edgePoints, function (x) {return {"x": Math.round(x.point[0]), "y": Math.round(x.point[1]), "nodePrev": x.nodePrev.id, "nodeNext": x.nodeNext.id}}))

//			DisplayDebugPoly ();

			if (nodeC == "done")
				break;

			if (nodeC == null)
			{
				nodeC = traverseEdge(nodeX);
//				DisplayDebugPoly ();
			}

			if (nodeC == null)
				break;
		}
		if (j == 25)
			throw "Runaway For Loop caused by addNodeClipPoly.";
	}

	addNode_beenThereDoneThat = {};	// Used for addNodeClipPoly
	addNodeClipPoly_beginPoint = null;
	addNodeClipPoly_currentPoint = null;
	addNodeClipPoly_continueFromEdge = false;
	edgePoints = [];	// Elements take the form {point: [x, y], nodePrev: node, nodeNext: node}

	// Copy data to old nodes list, or create a new list.
	if (applyToInput)
	{
		for (var i in nodesOut)
		{
			nodes[nodesOut[i].id].polygon = nodesOut[i].polygon;
			nodes[nodesOut[i].id].neighbors = _.map(nodesOut[i].neighbors, function(x) {return x != null ? x.id : -1});
			delete nodesOut[i].neighbors;
		}
	}
	else
	{
		nodesOut = nodesOut.sort (function(a,b) {return a.id - b.id});
		for (var i in nodesOut)
		{
			nodesOut[i].nodeWeight = nodes[i].nodeWeight;
			for (var j in nodesOut[i].neighbors)
				nodesOut[i].neighbors[j] = (nodesOut[i].neighbors[j] != null ? 
					nodesOut[i].neighbors[j].id : -1);	// Removes memory-leaking cross-references.
	//		delete nodesOut[i].oldNeighbors;
	//		delete nodesOut[i].oldPoly;
			delete nodesOut[i].parent;
			delete nodesOut[i].contains;
			delete nodesOut[i].rank;
		}
		return nodesOut;
	}
}

// Constructs a centroidal Voronoi diagram.  Various options:
// - applyToInput [false]: Whether the tessellation is applied directly to the input nodes, or outputs a new nodes object.
// - maxSteps [200]: Quit after this many steps.
// - accuracy [0.5]: Quit once motion of all the centers is less than this bound
// - newCenters [true]: Whether we should start with new centers, in a spiral pattern, or use the provided ones
// - sortWeights [nodes.nodeWeights]: List of weights to sort the nodes by, rather than the actual weights.

function tessellateCentroidal (nodes, bbox, options)
{
	var applyToInput = (options && options.applyToInput) ? options.applyToInput : false;
	var maxSteps = (options && options.maxSteps) ? options.maxSteps : 200;
	var accuracy = (options && options.accuracy) ? options.accuracy : 0.5;
	var newCenters = (options && options.newCenters) ? options.newCenters : true;
	var sortWeights = (options && options.sortWeights) ? options.sortWeights : null;
	
	// Output object.  If applyToInput = false, we need to create a new object.
	var nodesOut;
	if (applyToInput)
		nodesOut = nodes;
	else
		nodesOut = _.map(nodes, function (x) {return {"center": x.center, "polygon": x.polygon, 
			"nodeWeight": x.nodeWeight}});
	debug.nodesOut = nodesOut;
		
	// Node placement.  Spiral out from centroid, it'll all fit in circle of some radius around centroid.
	if (newCenters)
	{
		var center = centroid(bbox);
		var n = nodes.length;
	
		if (n == 1)
		{
			nodesOut[0].center = [center[0], center[1]];
		}
		else if (n == 2)
		{
			nodesOut[0].center = [center[0]+0.05, center[1]-0.5];
			nodesOut[1].center = [center[0]-0.05, center[1]+0.5];
		}
		else
		{
			// Compute size of the initial spiral.
			var rSq_poly = 1.e100;
			for (var i = 0; i < bbox.length; i++)
			{
				var x01 = bbox[i][0] - center[0], y01 = bbox[i][1] - center[1];
				var x12 = bbox[(i+1)%bbox.length][0] - bbox[i][0];
				var y12 = bbox[(i+1)%bbox.length][1] - bbox[i][1];
				rSq_poly = Math.min(rSq_poly, x01*x01 + y01*y01 - 
					(x01*x12 + y01*y12)*(x01*x12 + y01*y12) / (x12*x12 + y12*y12));
			}
			r_poly = Math.sqrt(rSq_poly) * 0.48;

			// Sort nodes by weight, or alternate measure.
			var nodezz;
			if (sortWeights != null)
			{
				var tempWeights = _.map(nodesOut, function(x) {return x.nodeWeight});
				for (var i in nodesOut) {nodesOut[i].nodeWeight = sortWeights[i];}
				nodezz = _.sortBy(nodesOut, function(node){return -node.nodeWeight;});
				for (var i in nodesOut) {nodesOut[i].nodeWeight = tempWeights[i];}
			}
			else
			{
				nodezz = _.sortBy(nodesOut, function(node){return -node.nodeWeight;});
			}

			// Place nodes in spiral.
			var n_Angles = Math.min(nodes.length - 1, 8);
			var d_theta = Math.PI*2 / n_Angles;
			var d2_theta = d_theta / (nodes.length / n_Angles);
			var d_r = r_poly / (nodes.length/n_Angles);
			nodezz[0].center = [center[0], center[1]];
			var ang = 0, r = r_poly;
			for (var i = 1; i < nodezz.length; i++)
			{
				var coord = polar2euclidean(r, ang);
				nodezz[i].center = [coord[0] + center[0], coord[1] + center[1]];
			
				ang = ang + d_theta;
				if(i%n_Angles == 0)
				{
					ang = ang + d2_theta;
					r = r + d_r;
				}
			}		
		}
	}
	
	// Lloyd's Method -- tessellate the plane, move centers to the polygon centroids, and repeat until you reach "maxSteps" steps or until all of the polygons move a distance less than "accuracy".
	var accuracy2 = accuracy * accuracy;
	for (var i = 0; i < maxSteps; i++)
	{
		tessellate(nodesOut, bbox, {"resetMemory": (i == 0), "applyToInput": true});
		var moveDist2 = 0;
		for (var i = 0; i < nodesOut.length; i++)
		{
			var newCenter = centroid(nodesOut[i].polygon);
			moveDist2 = Math.max(moveDist2, dist2(newCenter, nodesOut[i].center));
			nodesOut[i].center = newCenter;
		}
		if (moveDist2 < accuracy2)
			break;
	}
	
	if (i == maxSteps)
		console.log("TessellateCentroidal: Reached maximum of " + maxSteps + " steps.");
	if (!applyToInput)
		return nodesOut;	
}

// Returns a line of the form {"a": a, "b": b, "c": c}, which represents ax + by = c.
// This line serves as a splitting line between nodes 1 and 2.
// If ax + by < c, the point is closer to node1.  Otherwise, it's closer to node2.
function nodeSplittingLine (node1, node2)
{
	var a = node2.center[0] - node1.center[0];
	var b = node2.center[1] - node1.center[1];
	var c1 = a*node1.center[0] + b*node1.center[1];
	var c2 = a*node2.center[0] + b*node2.center[1];
	var frac = 0.5 + (node1.nodeWeight - node2.nodeWeight) / (2*(a*a+b*b));		// Node 1 pushes the line to Node 2.
	var c = c1 + frac * (c2 - c1);
	if (c1 > c2)
	{
		a *= -1; b *= -1; c *= -1;	// Flip everything if c1 > 0, so that ax_1 + by_1 < ax_2 + by_2
	}
	return {"a": a, "b": b, "c": c};
}

// Gets the intersection between a line given by {a, b, c | ax + by = c}, and a line that passes through {pt1, pt2}.
function lineIntersectPoint (line, pt1, pt2)
{
	// Two lines:
	//   ax + by = c
	//   (x - x1)(y2 - y1) - (y - y1)(x2 - x1) = 0
	// Solution:
	//   x = [c(x1 - x2) + b (x2 y1 - x1 y2)] / [a(x1 - x2) + b(y1 - y2)]
	//   y = [c(y1 - y2) + a (x1 y2 - x2 y1)] / [a(x1 - x2) + b(y1 - y2)]
	var dx = pt1[0] - pt2[0], dy = pt1[1] - pt2[1];
	var dxy = pt2[0]*pt1[1] - pt1[0]*pt2[1]
	var denom = line.a*dx + line.b*dy;
	return [(line.c*dx + line.b*dxy)/denom, (line.c*dy - line.a*dxy)/denom];
}

function isInsidePolygon (pt, poly)
{
	var center = centroid(poly);
	for (var j = 0; j < poly.length; j++)
	{
		var xAX = pt[0] - poly[j][0], yAX = pt[1] - poly[j][1];
		var xAB = poly[(j+1)%poly.length][0] - poly[j][0], yAB = poly[(j+1)%poly.length][1] - poly[j][1];
		var xAC = center[0] - poly[j][0], yAC = center[1] - poly[j][1];
		if ((xAB*yAX - yAB*xAX > 0) ^ (xAB*yAC - yAB*xAC > 0))
			break;	// Quits prematurely, because point is outside of polygon.
	}
	return (j == poly.length);
}

function MathematicaForm (arr)
{
	var str = "";
	if (jQuery.isArray(arr))
	{
		str += "{";
		for (var i = 0; i < arr.length; i++)
			str += MathematicaForm(arr[i]) + (i < arr.length - 1 ? ", " : "");
		str += "}";
		return str;
	}
	else
		return "" + arr;
}

function DisplayPoly (poly, color, offset)
{
	color = color ? color : "black";
	offset = offset ? offset : [100, 100]
	vis.append("polygon").attr("fill", color).attr("stroke", "white").attr("stroke-width", 2)
		.attr("points", _.map(poly, function (r) {return (r[0]+offset[0])+","+(r[1]+offset[1])}).join(" "));
}

function DisplayPoints (pts_, offset)
{
	offset = offset ? offset : [100, 100]
	var pts;
	if (pts_.length == 2 && typeof(pts_[0]) == "number")
		pts = [pts_];
	else
		pts = pts_;

	for (var i in pts)
		vis.append("circle").style("fill", "white").attr("cx",  pts[i][0]+offset[0])
			.attr("cy", pts[i][1]+offset[1]).attr("r", 3)
}

var debugPolyId = 0;

function DisplayDebugPoly (id)
{
	if (id == 0)
	{
		debugPolyId = 0;
		vis.selectAll("polygon").remove();
		vis.selectAll("text").remove();
		vis.selectAll("circle").remove();
		vis.selectAll("line").remove();
	}
	else if (id > 0)
		debugPolyId = id;
		
	for (var k = 0; k < debug.nodes.length; k++)
	{
		var a = [10 + 120*(debugPolyId%6), 20 + 120*Math.floor(debugPolyId/6)];
		if (debug.nodes[k].polygon) {DisplayPoly(debug.nodes[k].polygon, color(k), a)};
		if (debug.nodes[k].center) {DisplayPoints(debug.nodes[k].center, a)};
		vis.append("text").attr("x", a[0]).attr("y", a[1] - 2).style("color", "black").style("font-size", "12px")
			.text("" + debugPolyId);
	}
	debugPolyId++;	
}

function DisplayClear ()
{
	vis.selectAll("polygon").remove();
	vis.selectAll("text").remove();
	vis.selectAll("circle").remove();
	vis.selectAll("line").remove();	
}

function DisplayAnimatePoly (nodes, txt)
{
	var offset = [10, 20];

	var polys = vis.selectAll("polygon").data(nodes);
	polys.enter().append("polygon");
	polys.attr("fill", function(d) {return color(d.id)})
		.attr("stroke", "white")
		.attr("stroke-width", 2)
		.attr("points", function(d) {return _.map(d.polygon, function (r) 
			{return (r[0]+offset[0])+","+(r[1]+offset[1])}).join(" ")});
	var circles = vis.selectAll("circle").data(nodes)
	circles.enter().append("circle");
	circles.style("fill", "white")
		.attr("cx", function(d) {return d.center[0] + offset[0]})
		.attr("cy", function(d) {return d.center[1] + offset[1]})
		.attr("r", 3);
	polys.exit().remove();
	circles.exit().remove();
	
	vis.selectAll("text").remove();
	vis.append("text").attr("x", offset[0]).attr("y", offset[1] - 4)
		.style("color", "black").style("font", "bold 12px sans-serif")
		.text("" + txt);
}

var compareLog = [];

function comparePoints (pt1, pt2)
{
	var d = dist2(pt1, pt2);
	if (d < rThreshold)
	{
		//compareLog.push(d);
		return true;
	}
	else
		return false;
}

function clone_array (arr)
{
	var arr2 = [];
	for (var i in arr)
		arr2.push(typeof arr[i] == "object" ? clone_array(arr[i]) : arr[i]);
	return arr2;
}

function centroid(cell)
{
	if(cell.length<=2){
		return null;
	}
	var cx = 0;
	var cy = 0;
	var a = 0;
	for(var i =0; i<cell.length; i++){
		cx = cx + (cell[i][0] + cell[(i+1)%cell.length][0]) * (cell[i][0]*cell[(i+1)%cell.length][1] - cell[(i+1)%cell.length][0]*cell[i][1]);
		cy = cy + (cell[i][1] + cell[(i+1)%cell.length][1]) * (cell[i][0]*cell[(i+1)%cell.length][1] - cell[(i+1)%cell.length][0]*cell[i][1]);
		a = a + (cell[i][0]*cell[(i+1)%cell.length][1] - cell[(i+1)%cell.length][0]*cell[i][1]);
	}
	a = a/2;
	cx = cx/6/a;
	cy = cy/6/a;
	return [cx, cy];
}