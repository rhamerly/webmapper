/*

Creates a searchable QuadTree out of a list of two-dimensional points.  This is especially useful if we want to do nearest-neighbor searches on a large list and don't want to iterate through the list every time we need to do a search.

Functions:
-------------------------------------------------------------------
new QuadTree(input_array, rect)
	Constructs a new QuadTree object.  Input input_array gives the points; rect is the bounding rectangle.
	O(N log N) complexity.  Observed T = (0.01 N) ms
NLookup(x, y, nPoints)
	Finds the closest nPoints points to (x, y).
	O(log N) complexity.  Observed T = (0.002 log2(N)) ms
RLookup(x, y, r)
	Finds all points within a radius r of (x, y).
	O(log N) * O(max(1, N r^2/A)) complexity.  Observed T = (0.02 max(1, Nr^2/A)) ms.
Add(elem)
	Adds an element (elem) to the tree.
	O(log N) complexity.  Observed T = 0.001 ms.
Remove(elem)
	Removes an element (elem) from the tree.
	O(log N) complexity.  Observed T = 0.001 ms.
RemoveAt(x, y)
	Removes any element at (x, y) from the tree.
	O(log N) complexity.  Observed T = 0.001 ms.


*/
function QuadTree (input_array, rect)
{
	this.input_array_temp = input_array;
	this.rect = rect;
	this.tree = null;
	
	__construct = function (it)
	{
		it.tree = createQuadTree_(it.input_array_temp, it.rect);
		it.input_array_temp = null;
	}(this);
}

/* 

Constructor for QuadTree:  new QuadTree (input_array, [x1, x2, y1, y2])

This constructs a KD tree out of an array.  A KD tree will look something like the following:

[[(i1, x1, y1), [], (i2, x2, y2), []], [], [], [(i3, x3, y3)]]

It's a nested array of arrays.  The top-level array corresponds to the top screen.  This screen is broken up into four quadrants, [q0, q1, q2, q3], given on the screen by
 
 0 | 1 
---+---
 2 | 3 
 
In this case, the top-left quadrant has two dots; hence it has to broken up into four more quadrants; at the second level, the two dots i1 and i2 separate.  The dot i3 separated from the first two in the first level.

The constructor calls the helper function createQuadTree_(), which constructs the nested KD tree.  It works recursively, first separating the dots into four quadrants, and then applying createQuadTree_() on each of the quadrants.

Computational Complexity: O(N log N)
Observed Complexity: T = (0.01 N) ms, which is O(N). 

N       | T(N)
--------+------
1       | 0 ms
10      | 0
100     | 1
1000    | 11
10000   | 98
100000  | 945
1000000 | 2593

*/
function createQuadTree_ (input_array, rect)
{
	// Error checking.
	var x1 = rect[0], x2 = rect[1], y1 = rect[2], y2 = rect[3];
	if (x2 - x1 < CreateQuadTree_MINSIZE)
	{
		console.log(x1 + " " + x2 + " " + y1 + " " + y2);
		throw ("CreateQuadTree::Sector width Too Small: w = " + (x2 - x1) + ".  Points: " + input_array + ".  There are " + input_array.length + " points clustered in this region.");		
	}
	else if (y2 - y1 < CreateQuadTree_MINSIZE)
	{
		console.log(x1 + " " + x2 + " " + y1 + " " + y2);
		throw ("CreateQuadTree::Sector height Too Small: h = " + (y2 - y1) + ".  Points: " + input_array + ".  There are " + input_array.length + " points clustered in this region.");
	}
					
	if (input_array == [] || input_array.length == 0)	// The easiest case -- no dot at all!
		return [];
	else if (input_array.length == 1)	// Also an easy case.
		return input_array[0];
	else	// The nontrivial case.
	{
		var ct;
		var n = input_array.length;
		var Q = [[], [], [], []];	// The 4 quadrants.
		var xM = (x1 + x2) / 2.0, yM = (y1 + y2) / 2.0;	// Midpoint.
		// Step 1: Separate data array into the 4 quadrants.
		for (ct = 0; ct < n; ct++)
		{
			var data = input_array[ct];
			var quadrant = (data[2] > yM ? 2 : 0) + (data[1] > xM ? 1 : 0);
			Q[quadrant].push(data);
		}
		// Step 2: Convert the data from the 4 quadrants into QuadTree form.
		var x1q = [x1, xM, x1, xM], y1q = [y1, y1, yM, yM],
			x2q = [xM, x2, xM, x2], y2q = [yM, yM, y2, y2];
		for (ct = 0; ct < 4; ct++)
			Q[ct] = createQuadTree_(Q[ct], [x1q[ct], x2q[ct], y1q[ct], y2q[ct]]);
		return Q;
	}
}
		
var CreateQuadTree_MINSIZE = 0.0000000001;	// Throw an exception when this happens.


/*

QuadTree.NLookup(x, y, numPoints)
QuadTree.RLookup(x, y, r)

These functions find points on a map that are close to the lookup coordinates (x, y).  NLookup() finds the numPoints closest points; RLookup() finds all points within a distance r.

Returns a pair of triples [id, x, y], sorted by increasing distance.

Works by breaking the map down into four quadrants, as the quad_tree allows.  Q00 is the quadrant containing (x, y).  QX0, Q0Y, and QXY are obtained by flipping about the central divider lines.  First, we search the quadrant Q00 and find the closest point(s) in ans00.  Proceed as follows:

(1)	Determine whether ans00 is sufficient.  If so, return.
(2) If distance requires us to search across the row boundary, search QX0, find ansX0.  Combine answers.
(3) If distance requires us to search across the column boundary, search QX0, find ans0Y.  Combine answers.
(4) If distance requires us to search across both boundaries, search QX0, find ansXY.  Combine answers.

This is a recursive function, calling itself each of the relevant quadrants of the KD tree.  Most of the time, only one quadrant needs to be examined.

NLookup Computational Complexity: O(log N)
NLookup Observed Complexity: T = (0.002 log2(N)) ms, which is O(log N)

N       | T(N)
--------+------
1       | 0.002 ms
10      | 0.021 (outlier)
100     | 0.011
1000    | 0.016
10000   | 0.019
100000  | 0.024
1000000 | 0.026

RLookup Computational Complexity: O(log N) * O(max(1, N r^2/A))
Observed complexity is comparable.  For Nr^2/A < 1, T ~ 0.01 ms, like NLookup.  For Nr^2/A >> 1, T ~ (0.02 Nr^2/A) ms.  The cutoff is due to the average number of points in the circle.  For Nr^2/A >> 1, the number of points grows linearly, so we expect a linear scaling.

*/

QuadTree.prototype.NLookup = function (x, y, numPoints)
{
	return quadTreeNLookup_(this.tree, this.rect, x, y, numPoints);
}

QuadTree.prototype.RLookup = function (x, y, r)
{
	return quadTreeRLookup_(this.tree, this.rect, x, y, r);
}

QuadTree.prototype.Count = function ()
{
	return quadTreeCount_(this.tree)
}

function quadTreeCount_(tree)
{
	var ct = 0;
	ct += (tree[0].length == 4) ? quadTreeCount_(tree[0]) : ((tree[0].length == 3) ? 1 : 0);
	ct += (tree[1].length == 4) ? quadTreeCount_(tree[1]) : ((tree[1].length == 3) ? 1 : 0);
	ct += (tree[2].length == 4) ? quadTreeCount_(tree[2]) : ((tree[2].length == 3) ? 1 : 0);
	ct += (tree[3].length == 4) ? quadTreeCount_(tree[3]) : ((tree[3].length == 3) ? 1 : 0);
	return ct;
}

function distSq(x1, y1, x2, y2)
{
	return (x1-x2)*(x1-x2) + (y1-y2)*(y1-y2);
}

// Keeps the closest numPoints points in the sector.
function quadTreeNLookup_(quad_tree, rect, x, y, numPoints)
{
	if (quad_tree == [] || quad_tree.length == 0)	// The zero-item case
		return [];
	else if (quad_tree.length == 3)	// The one-item case: quad_tree = [id, x, y].
		return [quad_tree];
	else if (quad_tree.length != 4)
	{
		array_display(quad_tree);
		throw "quadTreeNLookup_::quad_tree is not a valid KD tree.  Should be either empty, a triplet [id, x, y], or a quadruplet [Q0, Q1, Q2, Q3].";
	}

	var x1 = rect[0], x2 = rect[1], y1 = rect[2], y2 = rect[3];
	var xM = (x1 + x2) / 2.0, yM = (y1 + y2) / 2.0;	// Midpoint.
	var dx = Math.abs(x - xM), dy = Math.abs(y - yM);
		
	// The quadrant of (x, y).  The rest of the quadrants.  Quadrant boundaries.
	var Q00 = (y > yM ? 2 : 0) + (x > xM ? 1 : 0);
	var QX0, Q0Y, QXY;
	if (Q00 == 0)
	{
		QX0 = 1; Q0Y = 2; QXY = 3;
		rect00 = [x1, xM, y1, yM]; rectX0 = [xM, x2, y1, yM];
		rect0Y = [x1, xM, yM, y2]; rectXY = [xM, x2, yM, y2];
	}
	else if (Q00 == 1)
	{
		QX0 = 0; Q0Y = 3; QXY = 2;	
		rectX0 = [x1, xM, y1, yM]; rect00 = [xM, x2, y1, yM];
		rectXY = [x1, xM, yM, y2]; rect0Y = [xM, x2, yM, y2];
	}
	else if (Q00 == 2)
	{
		QX0 = 3; Q0Y = 0; QXY = 1;
		rect0Y = [x1, xM, y1, yM]; rectXY = [xM, x2, y1, yM];
		rect00 = [x1, xM, yM, y2]; rectX0 = [xM, x2, yM, y2];
	}
	else
	{
		QX0 = 2; Q0Y = 1; QXY = 0;
		rectXY = [x1, xM, y1, yM]; rect0Y = [xM, x2, y1, yM];
		rectX0 = [x1, xM, yM, y2]; rect00 = [xM, x2, yM, y2];
	}
		
	// Order the quadrants by "closeness" to (x, y), Q0 closer than Q1, Q2, Q3.
	var d1, d2, dist3, Q0, Q1, Q2, Q3, rect0, rect1, rect2, rect3;
	if (dx < dy)	
	{
		d1 = dx*dx; d2 = dy*dy; dist3 = d1+d2; // dist3 rather than d3, because d3 refers to the D3 library.
		Q0 = Q00; Q1 = QX0; Q2 = Q0Y; Q3 = QXY;
		rect0 = rect00; rect1 = rectX0; rect2 = rect0Y; rect3 = rectXY;
	}
	else
	{
		d1 = dy*dy; d2 = dx*dx; dist3 = d1+d2;
		Q0 = Q00; Q1 = Q0Y; Q2 = QX0; Q3 = QXY;
		rect0 = rect00; rect1 = rect0Y; rect2 = rectX0; rect3 = rectXY;
	}
		
	var distXY = function (z) {return distSq(z[1], z[2], x, y);};
	var distComp = function (a, b) {return distXY(a) - distXY(b);};
		
	// Find the closest numPoints points, determine how many of them are inside d1, d2, d3.
	var ans0 = quadTreeNLookup_(quad_tree[Q0], rect0, x, y, numPoints);
	
	var nD1 = d3.sum(ans0, function(z) {return (distXY(z) < d1) ? 1 : 0;});  // Number inside d1 
	var nD2 = d3.sum(ans0, function(z) {return (distXY(z) < d2) ? 1 : 0;});  // Number inside d2
	var nD3 = d3.sum(ans0, function(z) {return (distXY(z) < dist3) ? 1 : 0;});  // Number inside d3

	// If all of the numPoints points are closer than d1, we're good!
	if (nD1 == numPoints)
		return ans0.sort(distComp);

	// Now check out the quadrant Q1.
	var ans1 = quadTreeNLookup_(quad_tree[Q1], rect1, x, y, numPoints - nD1);
	nD2 += d3.sum(ans1, function(z) {return (distXY(z) < d2) ? 1 : 0;});  
	nD3 += d3.sum(ans1, function(z) {return (distXY(z) < dist3) ? 1 : 0;});
		
	// If at least numPoints points are closer than d2, we're good!
	if (nD2 >= numPoints)
		return ans0.concat(ans1).sort(distComp).slice(0, numPoints);
		
	// Now check out the quadrant Q2.
	var ans2 = quadTreeNLookup_(quad_tree[Q2], rect2, x, y, numPoints - nD2);
	nD3 += d3.sum(ans2, function(z) {return (distXY(z) < dist3) ? 1 : 0;});
		
	// If at least numPoints points are closer than d3, we're good!
	if (nD3 >= numPoints)
		return ans0.concat(ans1, ans2).sort(distComp).slice(0, numPoints);
			
	// Last quadrant!  Now check out the quadrant Q3.
	var ans3 = quadTreeNLookup_(quad_tree[Q3], rect3, x, y, numPoints - nD3);
		
	// Return the closest numPoints points in our collection.
	return ans0.concat(ans1, ans2, ans3).sort(distComp).slice(0, numPoints);
}

function quadTreeRLookup_(quad_tree, rect, x, y, r)
{
	if (quad_tree == [] || quad_tree.length == 0)	// The zero-item case
		return [];
	else if (quad_tree.length == 3)	// The one-item case: quad_tree = [id, x, y].
	{
		if (distSq(x, y, quad_tree[1], quad_tree[2]) < r*r)
			return [quad_tree];
		else
		{
			return [];
		}
	}
	else if (quad_tree.length != 4)
	{
		array_display(quad_tree);
		throw "quadTreeNLookup_::quad_tree is not a valid KD tree.  Should be either empty, a triplet [id, x, y], or a quadruplet [Q0, Q1, Q2, Q3].";
	}

	var x1 = rect[0], x2 = rect[1], y1 = rect[2], y2 = rect[3];
	var xM = (x1 + x2) / 2.0, yM = (y1 + y2) / 2.0;	// Midpoint.
	var dx = Math.abs(x - xM), dy = Math.abs(y - yM);
		
	// The quadrant of (x, y).  The rest of the quadrants.  Quadrant boundaries.
	var Q00 = (y > yM ? 2 : 0) + (x > xM ? 1 : 0);
	var QX0, Q0Y, QXY;
	if (Q00 == 0)
	{
		QX0 = 1; Q0Y = 2; QXY = 3;
		rect00 = [x1, xM, y1, yM]; rectX0 = [xM, x2, y1, yM];
		rect0Y = [x1, xM, yM, y2]; rectXY = [xM, x2, yM, y2];
	}
	else if (Q00 == 1)
	{
		QX0 = 0; Q0Y = 3; QXY = 2;	
		rectX0 = [x1, xM, y1, yM]; rect00 = [xM, x2, y1, yM];
		rectXY = [x1, xM, yM, y2]; rect0Y = [xM, x2, yM, y2];
	}
	else if (Q00 == 2)
	{
		QX0 = 3; Q0Y = 0; QXY = 1;
		rect0Y = [x1, xM, y1, yM]; rectXY = [xM, x2, y1, yM];
		rect00 = [x1, xM, yM, y2]; rectX0 = [xM, x2, yM, y2];
	}
	else
	{
		QX0 = 2; Q0Y = 1; QXY = 0;
		rectXY = [x1, xM, y1, yM]; rect0Y = [xM, x2, y1, yM];
		rectX0 = [x1, xM, yM, y2]; rect00 = [xM, x2, yM, y2];
	}
		
	// Order the quadrants by "closeness" to (x, y), Q0 closer than Q1, Q2, Q3.
	var d1, d2, dist3, Q0, Q1, Q2, Q3, rect0, rect1, rect2, rect3;
	if (dx < dy)	
	{
		d1 = dx*dx; d2 = dy*dy; dist3 = d1+d2; // dist3 rather than d3, because d3 refers to the D3 library.
		Q0 = Q00; Q1 = QX0; Q2 = Q0Y; Q3 = QXY;
		rect0 = rect00; rect1 = rectX0; rect2 = rect0Y; rect3 = rectXY;
	}
	else
	{
		d1 = dy*dy; d2 = dx*dx; dist3 = d1+d2;
		Q0 = Q00; Q1 = Q0Y; Q2 = QX0; Q3 = QXY;
		rect0 = rect00; rect1 = rect0Y; rect2 = rectX0; rect3 = rectXY;
	}
		
	var distXY = function (z) {return distSq(z[1], z[2], x, y);};
	var distComp = function (a, b) {return distXY(a) - distXY(b);};
		
	// Find the closest numPoints points in Q0, determine how many of them are inside d1, d2, dist3.
	// If r > d1, also check Q1, since it falls within our range.  If r > d2, check Q2; if r > dist3, check Q3
	var ans = quadTreeRLookup_(quad_tree[Q0], rect0, x, y, r);
	if (r*r > d1)
	ans = ans.concat(quadTreeRLookup_(quad_tree[Q1], rect1, x, y, r));
	if (r*r > d2)
	ans = ans.concat(quadTreeRLookup_(quad_tree[Q2], rect2, x, y, r));
	if (r*r > dist3)
	ans = ans.concat(quadTreeRLookup_(quad_tree[Q3], rect3, x, y, r));
	
	return ans.sort(distComp);
}


/*

QuadTree.Add (elem)
QuadTree.Remove (elem)
QuadTree.RemoveAt (x, y)

Add (remove) the element elem to (from) the KD tree quad_tree.  Works recursively by determining which quadrant the element should be added to (removed from).  That element is then added to (removed from) that quadrant by calling Add (Remove) recursively.

Computational Complexity: O(log N)
Observed Complexity: T = 0.001 ms

*/

QuadTree.prototype.Add = function (elem)
{
	QuadTreeAdd(this.tree, this.rect, elem);
}

QuadTree.prototype.Remove = function (elem)
{
	QuadTreeRemove(this.tree, this.rect, elem, true);
}

QuadTree.prototype.RemoveAt = function (x, y)
{
	QuadTreeRemove(this.tree, this.rect, [0, x, y], false);
}

function QuadTreeAdd (quad_tree, rect, elem)
{
	if (quad_tree.length != 4)
		throw "QuadTreeAdd::Malformed input quad_tree.  Should be an array of four quadrants."
	var x1 = rect[0], x2 = rect[1], y1 = rect[2], y2 = rect[3];
	var xM = (x1+x2)/2.0, yM = (y1+y2)/2.0;
	var x = elem[1], y = elem[2];
	var quadrant = (x > xM ? 1 : 0) + (y > yM ? 2 : 0);
	var rectQ = (y < yM ? (x < xM ? [x1, xM, y1, yM] : [xM, x2, y1, yM]) : (x < xM ? [x1, xM, yM, y2] : [xM, x2, yM, y2]));
	
	if (quad_tree[quadrant] == [] || quad_tree[quadrant].length == 0)	// If the quadrant is empty, just insert the element.
		quad_tree[quadrant] = elem;
	else if (quad_tree[quadrant].length == 3)	// If there's one element, create a new KD tree with *gasp* two elements!
		quad_tree[quadrant] = createQuadTree_([quad_tree[quadrant], elem], rectQ);
	else	// Otherwise, act recursively.
		QuadTreeAdd(quad_tree[quadrant], rectQ, elem);
}

function QuadTreeRemove (quad_tree, rect, elem, checkEquality)
{
	if (quad_tree.length != 4)
		throw "QuadTreeRemove::Malformed input quad_tree.  Should be an array of four quadrants."
	var x1 = rect[0], x2 = rect[1], y1 = rect[2], y2 = rect[3];
	var xM = (x1+x2)/2.0, yM = (y1+y2)/2.0;
	var x = elem[1], y = elem[2];
	var quadrant = (x > xM ? 1 : 0) + (y > yM ? 2 : 0);
	var rectQ = (y < yM ? (x < xM ? [x1, xM, y1, yM] : [xM, x2, y1, yM]) : (x < xM ? [x1, xM, yM, y2] : [xM, x2, yM, y2]));

	if (quad_tree[quadrant].length == 3)
	{
		if ((!checkEquality || (elem[0] == quad_tree[quadrant][0])) && elem[1] == quad_tree[quadrant][1] && elem[2] == quad_tree[quadrant][2])
			quad_tree[quadrant] = [];	// Remove the element, since it equals elem.  Caveat: the id (element 0) must equal too.  If the id is an "object", equality testing might not work properly.
	}
	else if (quad_tree[quadrant].length == 4)
	{
		QuadTreeRemove(quad_tree[quadrant], rectQ, elem);
	}
	
	// Clean data.
	if (quad_tree[0].length == 0 && quad_tree[1].length == 0 && quad_tree[2].length == 0 & quad_tree[3].length == 0)
	{
		quad_tree.pop(); quad_tree.pop(); quad_tree.pop(); quad_tree.pop();
	}
}