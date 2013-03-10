var mouseX = -10, mouseY = -10;
var polyBorderSize = 2;		// Size of the effective polygon border, as far as the mouse is concerned.
var selectedPolygon = -1;

var interactionLoaded = false;
var isTransition = false;	// When isTransition is true, interactions are disabled.

// Initialize interactions.  Done after the page loads, to prevent funny things from happening to a partially loaded page.
function load_interaction ()
{
	if (!interactionLoaded)
	{
		d3.select(document).on("click", global_click);
		d3.select(document).on("mousemove", global_mousemove);
		d3.select(document).on("mouseout", global_mouseout);
		document.onmousewheel = global_mousewheel;	// D3 doesn't support this, it seems...
		$(document).bind('keydown', global_keydown);
		$("#searchBox").bind('keydown', searchKeyPress);
		$(document).bind('keydown', function (evt) {if (evt.keyCode == 27 && !isZoom) {searchClear();}});
		interactionLoaded = true;
	}
}

// Global mouse events.
function global_click ()
{
	mouseX = d3.event.pageX - xVis, mouseY = d3.event.pageY - yVis;
	// Nothing yet...
}

// Clicking on the polygons zooms in on that site.
function onPolygonClick (d, i)
{
	mouseX = d3.event.pageX - xVis, mouseY = d3.event.pageY - yVis;
	
	var p = getMousePoly(mouseX, mouseY);
	console.log ("Polygon " + p);
	var l = getLeaf(p.slice(0, p.length - 1));
	if (l != null && p[p.length - 1] > polyBorderSize)
	{
		// This needs much work, and will probably be moved to a local click event.
		console.log("X = " + mouseX + ", Y = " + mouseY + ", url = " + l.url);
	
		if (!isZoom)
			zoomIn(l.url, d);
	}
	else if (l != null && p[0] > -1)
	{
		calculateApparentSizes (activeTree);
		prevBubble = inflatedBubble;
		inflatedBubble = (inflatedBubble == p[0]) ? -1 : p[0];
		updateTreePolygonsPartial (activeTree, boundingBox);
		load_display();
	}
//	console.log("Clicked Polygon! " + mouseX + ", " + mouseY);
}

// Clicking on the text takes you to the site, a la hyperlinks.
function onTextClick (d, i)
{
//	console.log("Clicked Text! " + d.url);
	var url = isZoom ? d.url : ("http://" + d.url);
	window.open(url, '_blank');
	window.focus();	
}



function global_mousemove ()
{
	// This has currently been supplanted by the VoronoiTreemap class.
}

function global_mouseout ()
{
	// This has currently been supplanted by the VoronoiTreemap class.
}

var wheelMoves = [];

function global_mousewheel (evt)
{
	// This has currently been supplanted by the VoronoiTreemap class.
}


// Make key commands similar to Gmail keyboard shortcuts.
// http://support.google.com/mail/bin/answer.py?hl=en&answer=6594
function global_keydown (evt)
{
	switch (evt.keyCode)
	{
		case 79: 	// o -- zoom in (from Gmail)
			if (!searchBoxFocused)
			{
				var p = getMousePoly(mouseX, mouseY);
				var l = getLeaf(p.slice(0, p.length - 1));
				if (l != null && p[p.length - 1] > polyBorderSize && !isZoom)
					zoomIn(l.url);
				break;
			}
		case 85:	// u -- zoom out (from Gmail)
		case 27:	// ESC -- zoom out to main screen
			if (!searchBoxFocused && !searchJustDefocused)
			{
				if (isZoom)
				{
					zoomOut ();
				}
				else
				{
					console.log ("Clear search.");
					displaySearchHighlight("clear");
//					prevBubble = inflatedBubble;		// Deflate the current bubble.
//					inflatedBubble = -1;
//					updateTreePolygonsPartial (activeTree, boundingBox);
//					load_display();		
				}
			}
			else if (searchJustDefocused)
				searchJustDefocused = false;
			if (isColorPickerBar)
				removeColorPickerBar ();	
			if (isSubcolorPickerBar)
				removeSubcolorPickerBar ();	
			if (isLookbackPickerBar)
				removeLookbackPickerBar ();
			if (isHelpBar)
				removeHelpBar ();
			break;
	}
}

// Highlights the polygon on mouse-over.  Can't use standard CSS highlighting because it fails when we mouse-over the text, or when we mouse-over close to the borders.
function updatePolygonHighlight (id)
{
	var tag = isBubble ? "#b-poly" : "#poly";
//	console.log(id + " " + selectedPolygon);
	if (id == -1 && selectedPolygon != -1)
	{
		d3.select(tag + selectedPolygon)
			.attr("fill", function(d) {return d.color;});
	}
	else
	{
		d3.select(tag + selectedPolygon)
			.attr("fill", function(d) {return d.color;});
		d3.select(tag + id)
			.attr("fill", function(d) {return d3.rgb(d.color).darker(1.5).toString();});
//		d3.select(tag + id)
//			.attr("fill", "#000000");
		selectedPolygon = id;
	}
}

function getLeaf (arr, tree)
{
	tree = tree ? tree : activeTree;
	if (arr.length > 0 && arr[0] > -1 && tree.children.length > arr[0])
		return getLeaf(arr.slice(1), tree.children[arr[0]]);
	else if (arr.length > 0)
		return null;
	else
		return tree;
}

function visitSite (node, path)
{
	if (node.url != null)
	{
		console.log("Visiting site: http://" + node.url + "/");
		if(node.url != null)
		{
			window.open("http://"+ node.url + '/');
			window.focus();
		}
	}
}

function visitSiteBubble (node, path)
{
	if (node.url != null)
	{
		console.log("Visiting site: " + node.url);
		if(node.url != null)
		{
			window.open(node.url);
			window.focus();
		}
	}
}