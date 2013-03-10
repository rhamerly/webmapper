// Display-related functions.  Also see voronoi.js.

var reloadTimer = null;
var xVis = 10, yVis = 60;	// Offsets from the top of the screen.
var gMain;	// The main "g" object.
var inflatedBubble = -1, prevBubble = -1;
var homeInflatedBubble = -1;
var maxStroke = 7;
var color;
var colorPastel, colorWater, colorFire, color0, color1, color2, color3, color4, color5, color6;
var waterColors, fireColors, colors3, colors4, colors5, colors6
var selectedColor = 0;
var selectedShading = 1;
var colorList = [];
var progressBar = null;
var redraw_polys = true;

var treemap = null;
var treemap_bubble = null;

var activeTree;		// We may have multiple clusterTree's in memory.  This tells you which one is active.

function init_display_params ()
{
	// Various initializations.
	if ($(window).width () > 0)
	{
		width = $(window).width() - 2*xVis;
		height = $(window).height() - yVis - 10;
		if (!(width > 0) || !(height > 0))
			throw "Invalid window dimensions: [" + width + ", " + height + "]";		
	}
	boundingBox = [[0, 0], [width, 0], [width, height], [0, height]];
}

function load_display (tree)
{
	Tick();
	
	// TODO -- clean this up a bit.
	if (tree)					// Resets activeTree.
		activeTree = tree;
	else if (activeTree)		// Doesn't reset.
		tree = activeTree;
	else
		throw "Do not let this happen.";
	init_display_params();
	var gs = vis.selectAll("g");
		  
	// Create the main treemap and draw it.
	treemap = new VoronoiTreemap (activeTree, boundingBox, vis, {"tooltip": d3.select("#tip"),
		"tooltip_text": function(d) {return d.url;},
		"text": function (d) {return d.url.replace("www.", "");},
		"redraw_polys": redraw_polys,
		"color": defaultColors, "textColor": color.text});
	treemap.on("polyclick", zoomIn);
	treemap.on("textclick", visitSite);
	treemap.draw ();
	gs.remove();
	
	document.body.onresize = displayResize;	
}

function displayResize ()
{
	var w = $(window).width() - 2*xVis;
	var h = $(window).height() - yVis - 10;
	width = w;
	height = h;
	
	vis.attr("width", w).attr("height", h);
	treemap.resize(w, h);
	
	if (treemap_bubble != null)
	{
		var poly = _.map(d3.select(bubbleId).attr("points").split(" "), 
			function(x) {var y = x.split(","); return [parseFloat(y[0]), parseFloat(y[1])]})
		var ans = getBubblePolygon (poly, w, h, domainList_bubble.length);
		polyBubbleSmall.points = _.map(ans.polySmall, function(x) {return x.join(",");}).join(" ");
		polyBubbleLarge.points = _.map(ans.polyLarge, function(x) {return x.join(",");}).join(" ");
		treemap_bubble.step(null, ans.polyLargeClipped);
		treemap_bubble.draw();
	}
	// TODO -- add data for resizing the bubble, too.
}

function displayEnableInteractivity (g)
{
	// Callback events		
	g.selectAll("polygon")
		.on("click", onPolygonClick);
	g.selectAll("text")
		.on("click", onTextClick);
}


function hslAdjust (color, h, s, l)
{
	var hsl = d3.hsl(color);
	hsl.h += h;
	hsl.s = Math.min(Math.max(hsl.s * s, 0), 1);
	hsl.l = Math.min(Math.max(hsl.l * l, 0), 1);
	return hsl.toString();
}

// For a given color, this returns a coloring function that brightens or darkens these colors, as it deems best.
function brightnessColorScheme (color, numColors)
{
	var cList = _.map(ArrayShuffleReturn(d3.range(numColors)), 
		function (x) {return d3.rgb(color).darker(2.0 * x/numColors).toString()});
	
	return function (i) {return cList[i];}
}

function hslColorScheme (color, numColors, dh, ds, dl)
{
	var dhList = _.map(d3.range(-dh/2, dh/2, dh/(numColors-0.999)));
	var dsList = _.map(d3.range(1 - ds/2, 1 + ds/2, ds/(numColors-0.999)));
	var dlList = _.map(d3.range(1 - dl/2, 1 + dl/2, dl/(numColors-0.999)));
	var cList = [];
	for (var i = 0; i < numColors; i++)
		cList.push(hslAdjust(dhList[i], dsList[i], dlList[i]));
	return function (i) {return cList[i];}
}

function createSVG ()
{
	// Add the SVG to the page.
	init_display_params();
	if (vis)
		vis.remove();
	vis = d3.select("#app")
		.append("svg:svg")
		.attr("width", width)
		.attr("height", height)
		.style("position", "absolute")
		.style("left", xVis)
		.style("top", yVis); 
//	console.log([width, height]);
}

function updateProgressBar (progress, message, title)
{
	progress = Math.min(1, Math.max(0, progress));
	title = title ? title : "Initializing";
	var w = vis.attr("width"), h = vis.attr("height");
	var w1 = 300, h1 = 100;
	var x0 = w/2, y0 = h/2 - h1/2;
	var w2 = 250, h2 = 15, y2 = 70;
	if (progressBar == null)
	{	
		progressBar = vis.append("g").attr("id", "progress-g");
		progressBar.append("rect")
			.attr("x", x0 - w1/2).attr("y", y0)
			.attr("width", w1).attr("height", h1)
			.attr("fill", "whitesmoke").attr("stroke", "gray").attr("stroke-width", 2);
		progressBar.append("rect")
			.attr("x", x0 - w2/2).attr("y", y0 + y2)
			.attr("width", w2).attr("height", h2)
			.attr("fill", "white").attr("stroke", "gray").attr("stroke-width", 1);
		progressBar.append("rect")
			.attr("x", x0 - w2/2).attr("y", y0 + y2)
			.attr("width", w2 * progress).attr("height", h2)
			.attr("fill", "steelblue").attr("stroke-width", 0)
			.attr("id", "progress");
		progressBar.append("text")
			.attr("id", "progress-title")
			.attr("x", x0).attr("y", y0 + 30)
			.attr("fill", "black").style("text-anchor", "middle")
			.style("font", "bold 16pt sans-serif")
			.text(title);
		progressBar.append("clipPath").attr("id", "progress-clip")
			.append("rect").attr("x", x0 - w1/2).attr("y", y0)
			.attr("width", w1).attr("height", h1).style("stroke", "none").style("fill", "none");
		progressBar.append("text")
			.attr("id", "progress-text")
			.attr("x", x0).attr("y", y0 + 60)
			.attr("fill", "black").style("text-anchor", "middle")
			.style("font", "8pt sans-serif")
			.style("clip-path", "url(#progress-clip)")	
			.text(message);
	}
	else
	{
		d3.select("#progress-text").text(message);
		d3.select("#progress-title").text(title);
		d3.select("#progress").attr("width", w2 * progress);
	}
}

function removeProgressBar ()
{
	if (progressBar != null)
		progressBar.remove();
	progressBar = null;
}

var getProgress = {
	4: {"eventTimes": function (i, n) {return 0.05 + 0.45*i/n},
	"other": 0.5,
	"clusterTree": 0.6,
	"polygons": 0.8},
	3: {"eventTimes": function (i, n) {return 0.2*i/n},
	"other": 0.2,
	"clusterTree": 0.4,
	"polygons": 0.8},
	2: {"eventTimes": function (i, n) {return 0.45*i/n},
	"other": 0.45,
	"polygons": 0.55}};


function defaultColors (path, node)
{
	return d3.rgb(color.poly(path[0])).darker(path.length > 1 ? 
		(0.0*(1 - selectedShading)) + selectedShading * 0.02 * ((37*path[1]) % 100) : 0).toString();
}

function grayColors (path, node)
{
	var a = d3.hsl(defaultColors(path, node));
	a.s = 0; a.l = 0.625 + (a.l - 0.625)*0.4; 
	return a.toString();
}

function searchColors (path, node)
{
	var a = d3.hsl(defaultColors(path, node));
	a.s = 0; a.l = 0.625 + (a.l - 0.625)*0.4; noHighlight = a.toString();
	var url = isZoom ? node.url : parseUri(node.url).host;
	if (url in searchResults)
	{
		var highlight = Math.min(searchResults[url], 0.8) + 0.2;
		var currentColor = d3.hsl(noHighlight);
		currentColor.h = 0; currentColor.s = highlight;
		currentColor.l += (0.35 - currentColor.l)*highlight;
		currentColor = currentColor.toString();
		return currentColor;
	}
	else
	{
		return noHighlight;
	}
}

function darkenColors (color)
{
	return function (path, node)
	{
		return d3.rgb(color).darker(0.03 * ((37*path[0]) % 100)).toString();
	}
}

