var centroidWithXBound;

function Site()
{
	this.weight = 0;
	this.x = 0;
	this.y = 0;
	this.cell = [];
	this.enclosed = false;
	this.order = -1;
}
	
function Line()
{
	//line in point-slope form
	this.x;
	this.y;
	this.slope;
}
	
function lineConnect(p1, p2)
{
	// p = [x, y]
	var line = new Line();
	line.x = p1[0];
	line.y = p1[1];
	if(p1[0] - p2[0] == 0)
	{
		line.slope = null;
	}
	else
	{
		line.slope = (p1[1] - p2[1]) / (p1[0] - p2[0]);
	}
	return line;
}
	
function yLineX(line, x)
{
	var y = line.slope*(x-line.x) + line.y;
	if(isNaN(y))
	{
		console.log(line);
		console.log(x);
		asdf;
	}
	return y;
}
	
function intersectWithHalfPlane(s, l)
{
	// s = site; l = line
	var cellTemp = s.cell.slice();
	var cell = s.cell.slice();
	var comp; // function; true if on same side
	if(l.slope == null)
	{
		if(s.x<l.x)
		{
			comp = function(p, l){return p[0] < l.x};
		}
		else
		{
			comp = function(p, l){return p[0] > l.x};
		}						
	}
	else
	{
		if(yLineX(l, s.x)<s.y)
		{
			comp = function(p, l)
			{
				var y = yLineX(l, p[0]);
				return y<p[1];
			};
		}
		else
		{
			comp = function(p, l){
				var y = yLineX(l, p[0]);
				return y>p[1];
			};
		}
	}
	var compMap = _.map(cell, function(p){ return comp(p, l);});
	var pinch1 = null;
	var pinch2 = null;
	var idx = 0;
	if (_.all(compMap, _.identity))
	{
		return s;
	}
	if (_.all(compMap, function(value){return !value;}))
	{
		return s;
	}
	while(pinch1 == null || pinch2 == null)
	{
		if(pinch1 != null)
		{
			if(compMap[idx])
			{
				pinch2 = (idx-1+compMap.length) %compMap.length;
			}
		}
		else
		{
			if(compMap[idx] && !compMap[(idx+1)%compMap.length])
			{
				pinch1 = (idx+1) % compMap.length;
			}
		}
		idx = (idx+1) % compMap.length;
	}
		
	//get new points
	var newPoint1 = lineIntersect(l, lineConnect(cell[(pinch1-1+cell.length)%cell.length], cell[pinch1]));
	var newPoint2 = lineIntersect(l, lineConnect(cell[pinch2], cell[(pinch2+1)%cell.length]));
		
	if(pinch2>=pinch1)
	{
		cell.splice(pinch1, pinch2-pinch1+1, newPoint1, newPoint2);
	}
	else
	{
		cell.splice(pinch1, cell.length-pinch1, newPoint1, newPoint2);
		cell.splice(0, pinch2+1);
	}
		
	s.cell = cell;
	if(s.cell.length<=2)
	{
		debug.cell = cellTemp;
		console.log("something's wrong");
		console.log(l);
		console.log(cell);
		asdfjsdfl;
	}
		
	//debug
	var sum = _.reduce(compMap, function(memo, item){ return memo+item;}, 0);
	if( sum + 2 != cell.length)
	{
		debug.pinch1 = pinch1;
		debug.pinch2 = pinch2;
		debug.compMap = compMap;
		debug.cell = cell;
		console.log(cell.length);
		console.log(cellTemp.length);
		console.log(sum);
		asdf;
	}
		
	return s;
}
	
function lineIntersect(l1, l2)
{
	if(l1.slope == l2.slope)
	{	
		return null;
	}
	var temp;
	var ix;
	var iy;
	if(l1.slope == null)
	{
		ix = l1.x;
		temp = l1;
		l1 = l2;
		l2 = temp;
	}
	else if(l2.slope == null)
	{
		ix = l2.x;
	}
	else
	{
		if(l1.slope > l2.slope)
		{
			temp = l1;
			l1 = l2;
			l2 = temp;
		}
		ix = (l1.y - l2.y + l2.slope*l2.x - l1.slope*l1.x) / (l2.slope - l1.slope);
	}
	iy = l1.slope*(ix - l1.x)+l1.y;
	return [ix, iy];
}
	
function splitLine(s1, s2)
{
	line = new Line();
	if((s1.y-s2.y) != 0)
	{
		line.slope = -(s1.x-s2.x) / (s1.y-s2.y);
		line.x = 0;
		line.y = (s1.y*s1.y + s1.x*s1.x - s2.y*s2.y - s2.x*s2.x - s1.weight + s2.weight) / (2*(s1.y-s2.y));
	}
	else
	{
		line.slope = null;
		line.x = (s1.x*s1.x - s2.x*s2.x - s1.weight + s2.weight) / (2*(s1.x-s2.x));
		line.y = s1.y;
	}
	return line;
}
	
function centroid(cell)
{
	if(cell.length<=2)
	{
		return null;
	}
	var cx = 0;
	var cy = 0;
	var a = 0;
	for(var i =0; i<cell.length; i++)
	{
		cx = cx + (cell[i][0] + cell[(i+1)%cell.length][0]) * (cell[i][0]*cell[(i+1)%cell.length][1] - cell[(i+1)%cell.length][0]*cell[i][1]);
		cy = cy + (cell[i][1] + cell[(i+1)%cell.length][1]) * (cell[i][0]*cell[(i+1)%cell.length][1] - cell[(i+1)%cell.length][0]*cell[i][1]);
		a = a + (cell[i][0]*cell[(i+1)%cell.length][1] - cell[(i+1)%cell.length][0]*cell[i][1]);
	}
	a = a/2;
	cx = cx/6/a;
	cy = cy/6/a;
	return [cx, cy];
}
	
centroidWithXBound = function(cell)
{
	c = centroid(cell);
	l = new Line();
	l.x = c[0];
	l.y = c[1];
	l.slope = 0;
		
	var comp = function(p, l)
	{
		var y = yLineX(l, p[0]);
		return y < p[1];
	}
		
	var bound1;
	var bound2;
	for(var i = 0; i<cell.length; i++)
	{
		var p1 = cell[i];
		var p2 = cell[(i+1)%cell.length];
		var l2 = lineConnect(p1, p2);
		if(comp(p1, l) && !comp(p2, l))
		{
			var intersect = lineIntersect(l, l2);
			bound1 = intersect[0];
		}
		if(!comp(p1, l) && comp(p2, l))
		{
			var intersect = lineIntersect(l, l2);
			bound2 = intersect[0];
		}
	}
	return [c[0], c[1], Math.min(bound1, bound2), Math.max(bound1, bound2)];
}
	
function dist(p1, p2)
{
	var ret = Math.pow(p1[0]- p2[0], 2) + Math.pow(p1[1]- p2[1], 2);
	return Math.sqrt(ret);
}
	
function dist2(p1, p2)
{
	var ret = Math.pow(p1[0]- p2[0], 2) + Math.pow(p1[1]- p2[1], 2);
	return ret;
}

function polar2euclidean(r, theta)
{
	var x = r*Math.cos(theta);
	var y = r*Math.sin(theta);
	return [x, y];
}
	
centralVoronoi = function(weights, boundingShape)
{
	//make an array of sites with weights
	// bounding shape must have at least 3 points.
	var sites = [];
	var newSite;
	for(var i = 0; i< weights.length; i++)
	{
		newSite = new Site();
		newSite.weight = weights[i];
		newSite.order = i;
		sites.push(newSite);
	}
		
	//initialize location of sites; assume it'll fit in circle of radius 1.5 around centroid.
	var boundingCentroid = centroid(boundingShape);
	sites = _.sortBy(sites, function(site){return -site.weight;});
	var n_Angles = Math.min(sites.length-1, 8);
	var d_theta = Math.PI*2 / n_Angles;
	var d2_theta = d_theta / (sites.length / n_Angles);
	var d_r = 1 / (sites.length/n_Angles);
		
	sites[0].x = boundingCentroid[0];
	sites[0].y = boundingCentroid[1];
	var i = 1;
	var ang = 0;
	var r = 0.1;
	while(i<sites.length)
	{
		coord = polar2euclidean(r, ang);
		sites[i].x = coord[0] + boundingCentroid[0];
		sites[i].y = coord[1] + boundingCentroid[1];
			
		ang = ang + d_theta;
		if(i%n_Angles == 0)
		{
			ang = ang + d2_theta;
			r = r + d_r;
		}
		i = i+1;
	}
		
	//generate initial tessellation
	sites = voronoiTessellation(sites, boundingShape);
		
	//call recursive method
	sites = cvtRecursor(sites, boundingShape, 0);
		
	//process sites and return
	sites = _.sortBy(sites, function(site){return site.order;});
	return _.map(sites, function(site){return site.cell;});
}

function generalVoronoi (sites, boundingShape, nMax)
{
	if (!nMax)
		nMax = 9999;
	
	//generate initial tessellation
	var sites2 = voronoiTessellation(sites, boundingShape);
		
	//call recursive method
	sites2 = cvtRecursor(sites2, boundingShape, 0, nMax);

	//process sites and return
	sites2 = _.sortBy(sites2, function(site){return site.order;});
	return _.map(sites2, function(site){return site.cell;});
}

function voronoiTessellation(sites, boundingShape)
{	
	//scale weights
	var weightScale;
	var r2;
	for(var i = 0; i< sites.length; i++)
	{
		for(var j = i+1; j< sites.length; j++)
		{
			r2 = dist2([sites[i].x, sites[i].y], [sites[j].x, sites[j].y]) * 0.9; // 0.9 scaling factor
			if(i==0 && j == 1)
			{
				weightScale = _.min([r2/sites[i].weight, r2/sites[j].weight]);
			}
			else
			{
				weightScale = _.min([r2/sites[i].weight, r2/sites[j].weight, weightScale]);
			}
		}
	}
	var originalWeights = [];
	for(var i = 0; i<sites.length; i++)
	{
		originalWeights.push(sites[i].weight);
		sites[i].weight = sites[i].weight * weightScale;
		if(sites[i].weight == 0)
		{
			console.log("fuuuu");
			//asdf;
		}
	}
		
	//generate map of lines
	var splitLines = [];
	var lines;
	for(var i = 0; i<sites.length; i++)
	{
		lines = [];
		for(var j = 0; j<i ; j++)
		{
			lines.push(splitLines[j][i]);
		}
		lines.push(null); //can't define a split line with same point
		for(var j = i+1; j<sites.length; j++)
		{
			lines.push(splitLine(sites[i], sites[j]));
		}
		splitLines.push(lines);
	}
		
	//initiate cells with boundingshape
	for(var i = 0; i<sites.length; i++)
	{
		sites[i].cell = boundingShape.slice();
	}
		
	//for each site, compute cell by intersecting it with half planes
	for(var i = 0; i<sites.length; i++)
	{
		for(var j = 0; j<sites.length; j++)
		{
			if(splitLines[i][j] != null)
			{
				sites[i] = intersectWithHalfPlane(sites[i], splitLines[i][j]);
			}
		}
	}
		
	//reassign original weights
	for(var i = 0; i<sites.length; i++)
	{
		sites[i].weight = originalWeights[i];
	}
		
	return sites
}
	
function cvtRecursor(sites, boundingShape, n, nMax)
{
	if (!nMax || nMax > 200)
		nMax = 200;	// I think that the stack is limited to 256.  Be a bit conservative.
		
	if(n >= nMax)
	{
		console.log("cvtRecursor: Hit max recursion limit of " + nMax);
		return sites;
		//debug.sites = sites;
		//return sites;
	}
		
	//
	change = 0.0;
	var cent;
	for(var i = 0; i<sites.length; i++)
	{
		cent = centroid(sites[i].cell);
		if(cent == null)
		{
			asdf;
		}
		change = Math.max( change, dist([sites[i].x, sites[i].y], cent));
		sites[i].x = cent[0];
		sites[i].y = cent[1];
	}

		
	if(change < 0.5)
	{
		//debug.n = n;
		//console.log("Recursion completed at step " + n + " for " + sites.length + " sites.")
		return sites;
	}
	else
	{
		return cvtRecursor(voronoiTessellation(sites, boundingShape), boundingShape, n+1);
	}
}