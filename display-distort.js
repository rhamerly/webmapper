// Polygon distortion code
//
// Suppose we have a bunch of stuff inside of a polygon P.  We then smoothly transform P to a new polygon Q.
// We want all of the stuff (points) inside P to smoothly move from its position inside P, to its position inside Q.
// In other words, we want to construct a map, from the interior of P to the interior of Q, which is continuous,
// easy to calculate, and "reasonably smooth".
//
// This is achieved as follows:
//
// (1)	Center both polygons P and Q about the origin.  Likewise move all the points to be transformed.
// (2)	For each point X, find rP and rQ, where rP is the distance at which the ray OX intersects P, and rQ is the
//		distance at which OX intersects Q.  Move X along the ray OX until it is a distance r' = (rQ/rP) r from the
//		origin, where r = |OX|.
//
// This is not an ideal map, but it works reasonably well.  The ideal map would be a conformal transformation, but from
// my readings, conformal transformations between polygons require integrals and elliptic functions, so they aren't
// necessarily easy to compute.  This algorithm, by contrast, only computes line intersections and vector scalings,
// and is very fast (2,000 points take about 10 ms).
//
// Internal Functions:
//   distortPolygonSetup:	does (1), setting up the two centered polygons, and computing the angles of
// 							the polygon vertices, in polar coordinates.
//   distortPolygon: 		does (2), as explained above.
//
// User-Friendly Functions:
//   distortPolygonPoints (pts, poly1, poly2, [center1, center2, frac])
//	   This function takes points pts, and maps them from polygon poly1 to poly2.  The auxiliary parameters center1,
//     center2, and frac (used for partial polygon maps) are optional.
//   distortPolygonLines (lines, poly1, poly2, [center1, center2, frac])
//     Same, but lines is an array of [x1, y1, x2, y2] objects.
//   distortPolygonPolys (lines, poly1, poly2, [center1, center2, frac])
//     Same, but polys is an array of [[x1, y1], [x2, y2], ..., [xN, yN]] objects.
//   distortTree (tree, newPoly, [newCenter])
//     Performs this distortion to a whole cluster tree, recalculating polygons using the Voronoi treemap.

var distortPolygonAngles1 = [], distortPolygonAngles2 = [];
var distortPolygonPoints1 = [], distortPolygonPoints2 = [];
var distortCenter1, distortCenter2;
var distortFrac;

function distortPolygonSetup (center1, center2, poly1, poly2, frac)
{
	distortFrac = frac ? frac : 1;
	distortCenter1 = center1; distortCenter2 = center2;
	distortPolygonAngles1 = []; distortPolygonAngles2 = [];
	distortPolygonPoints1 = []; distortPolygonPoints2 = [];
	var pointsAngles = [];
	for (var i in poly1)
	{
		var pt = [poly1[i][0] - center1[0], poly1[i][1] - center1[1]];
		pt.push(Math.atan2(pt[1], pt[0])); pointsAngles.push(pt);
	}
	pointsAngles.sort(function(a, b) {return a[2] - b[2];});
	distortPolygonAngles1 = _.map(pointsAngles, function(x) {return x[2];});
	distortPolygonPoints1 = _.map(pointsAngles, function(x) {return [x[0], x[1]];});
	pointsAngles = [];
	for (var i in poly2)
	{
		var pt = [poly2[i][0] - center2[0], poly2[i][1] - center2[1]];
		pt.push(Math.atan2(pt[1], pt[0])); pointsAngles.push(pt);
	}
	pointsAngles.sort(function(a, b) {return a[2] - b[2];});
	distortPolygonAngles2 = _.map(pointsAngles, function(x) {return x[2];});
	distortPolygonPoints2 = _.map(pointsAngles, function(x) {return [x[0], x[1]];});
}

// Intersections needed between line OR and AB
//
// xR y - yR x = 0
// (xB - xA)(y - yA) - (yB - yA)(x - xA) = 0
//
// Matrix equation.  Solution is:
// x = xR (xA yB - xB yA) / (xR yAB - yR xAB)
// y = yR (xA yB - yB yA) / (xR yAB - yR xAB)
function distortPolygon (pt)
{
	var frac = distortFrac;
	
	// Initializations
	var x = pt[0] - distortCenter1[0], y = pt[1] - distortCenter1[1];
	var theta = Math.atan2(y, x);
	var indPoly1A, indPoly1B, indPoly2A, indPoly2B;
	// Find the lines we need to intersect with
	for (var i = 0; i < distortPolygonAngles1.length; i++)
		if (theta < distortPolygonAngles1[i])
			break;
	indPoly1A = (i == 0) ? (distortPolygonAngles1.length - 1) : i - 1;
	indPoly1B = (indPoly1A + 1) % distortPolygonAngles1.length;
	for (var i = 0; i < distortPolygonAngles2.length; i++)
		if (theta < distortPolygonAngles2[i])
			break;
	indPoly2A = (i == 0) ? (distortPolygonAngles2.length - 1) : i - 1;
	indPoly2B = (indPoly2A + 1) % distortPolygonAngles2.length;
	// Find points at edges of two polygons.
	var pt1 = distortPolygonIntersect (x, y, distortPolygonPoints1[indPoly1A][0], distortPolygonPoints1[indPoly1A][1],
		distortPolygonPoints1[indPoly1B][0], distortPolygonPoints1[indPoly1B][1]);
	var pt2 = distortPolygonIntersect (x, y, distortPolygonPoints2[indPoly2A][0], distortPolygonPoints2[indPoly2A][1],
		distortPolygonPoints2[indPoly2B][0], distortPolygonPoints2[indPoly2B][1]);
	var factor;
	var r1sq = pt1[0]*pt1[0] + pt1[1]*pt1[1];
	var r2sq = pt2[0]*pt2[0] + pt2[1]*pt2[1];
	var rsq = x*x + y*y
	// Push out from one polygon to another, as follows:
	// If r < r1, r -> r(1 + a(r2/r1 - 1))
	// If r = r1, r -> r + a(r2 - r1)
	// If r > r1, r -> r(1 + a(r2/r - 1))
	// If r > r2, r -> r
	if (rsq < r1sq)
		factor = 1 + (Math.sqrt(r2sq / r1sq) - 1) * frac
	else
		factor = 1 + (Math.sqrt(r2sq / rsq) - 1) * frac

	return [distortCenter2[0] + x*factor, distortCenter2[1] + y*factor];
}

function distortPolygonPoints (pts, poly1, poly2, center1, center2, frac)
{
	center1 = center1 ? center1 : centroid (poly1);
	center2 = center2 ? center2 : centroid (poly2);
	frac = frac ? frac : 1;
	distortPolygonSetup (center1, center2, poly1, poly2, frac);
	
	var out = [];
	for (var i = 0; i < pts.length; i++)
		out.push(distortPolygon ([pts[i][0], pts[i][1]]));
	return out;
}

function distortPolygonLines (lines, poly1, poly2, center1, center2, frac)
{
	center1 = center1 ? center1 : centroid (poly1);
	center2 = center2 ? center2 : centroid (poly2);
	frac = frac ? frac : 1;
	distortPolygonSetup (center1, center2, poly1, poly2, frac);
	
	var out = [];
	for (var i = 0; i < lines.length; i++)
		out.push(distortPolygon ([lines[i][0], lines[i][1]])
			.concat(distortPolygon ([lines[i][2], lines[i][3]])));
	return out;
}

function distortPolygonPolys (polys, poly1, poly2, center1, center2, frac)
{
	center1 = center1 ? center1 : centroid (poly1);
	center2 = center2 ? center2 : centroid (poly2);
	frac = frac ? frac : 1;
	distortPolygonSetup (center1, center2, poly1, poly2, frac);

	var out = [];
	for (var i = 0; i < polys.length; i++)
	{
		var current = [];
		for (var j = 0; j < polys.length; j++)
			current.push (distortPolygon (polys[i][j]));
		out.push(current);
	}
}

// Line intersection code.
function distortPolygonIntersect (xR, yR, xA, yA, xB, yB)
{
	var factor = (xA*yB - xB*yA) / (xR*(yB - yA) - yR*(xB - xA));
	return [xR*factor, yR*factor];
}

var timeTestNum = 0;

// Given a cluster (tree), this function distorts the cluster's polygon to newPoly, which has a centroid newCenter (optional argument).  It works by first moving the child node's centroids using distortPolygonPoints, then recomputing the polygons with a Voronoi tessellation, then applying distortTree recursively on the child nodes with the new polygons.
function distortTree (tree, newPoly, newCenter)
{
	newCenter = newCenter ? newCenter : centroid (newPoly);
	
	// First, transform the parent's center and polygon.
	var oldPoly = tree.polygon;
	var oldCenter = tree.center;
	tree.polygon = clone_array(newPoly);
	tree.center = clone_array(newCenter);
	
	if (tree.children.length <= 1)
	{
		// Do something simple
		if (tree.children.length == 1)
			distortTree(tree.children[0], newPoly);
	}
	else
	{
		// Do something complicated.  First, transform the centers of the children.
		var centers = _.map (tree.children, function(x) {return x.center;});
//		console.log(centers);
//		console.log(tree.center);
//		console.log(newCenter);
//		console.log(tree.poly);
//		console.log(newPoly);
		centers = distortPolygonPoints (centers, oldPoly, newPoly, oldCenter, newCenter);
		debug.centers = centers;
//		console.log(centers);
		var sites = [];
		for(var i = 0; i < tree.children.length; i++)
		{
			newSite = new Site();
			newSite.weight = tree.children[i].apparentSize;
			newSite.order = i;
			newSite.x = centers[i][0]; newSite.y = centers[i][1];
			sites.push(newSite);
		}
		// Create a new Voronoi tessellation using the new sites.  Repeat, to center a bit better.
		sites = voronoiTessellation(sites, newPoly);
		_.map(sites, function(s) {var center = centroid(s.cell); s.x = center[0]; s.y = center[1];})
		sites = voronoiTessellation(sites, newPoly);
		_.map(sites, function(s) {var center = centroid(s.cell); s.x = center[0]; s.y = center[1];})
		// Transform each of the tree's children.
		for (var i in tree.children)
			distortTree (tree.children[i], sites[i].cell, [sites[i].x, sites[i].y]);
	}
}