var searchBox;
var searchButtonGo, searchButtonX;
var searchBoxOverwrite = true;
var isSearchResults = false;	// Whether the screen is displaying search results right now.
var searchResultsColors = false;	// Whether the screen is displaying search results right now.
var whichButton;	// 0 = magnifying glass, 1 = X
var searchBoxFocused = false;
var searchJustDefocused = false;
var searchResults = {};
var isAutocomplete = true;

// Initializes the search box.
function initSearch ()
{
	searchBox = document.getElementById("searchBox");
	searchButtonGo = document.getElementById("searchButtonGo");
	searchButtonX = document.getElementById("searchButtonX");
	searchBoxOverwrite = true;
	$("#search").submit(function() {	// Prevents page refresh upon submitting
		searchSubmit();
	    return false;
	});
	searchBox.onfocus = searchFocused;
	searchBox.onblur = searchBlurred;
	searchButtonGo.onclick = function() {if (searchBox.value != "Search" && searchBox.value != "") {searchSubmit(true)};}
	searchButtonX.onclick = function() {
		searchBox.value = "Search";
		if (!searchBoxOverwrite) {grayBox(); searchBoxOverwrite = true;}
		searchClear();}
	$("#searchButtonX").hide();
}

// Turns the search box black.	
function blackBox ()
{
	searchBox.style.color = "#000000";
	searchButtonGo.style.opacity = 1.0;
	searchButtonX.style.opacity = 1.0;
}
	
// Turns the search box gray.
function grayBox ()
{
	searchBox.style.color = "#AAAAAA";
	searchButtonGo.style.opacity = 0.4;
	searchButtonX.style.opacity = 0.4;
}

// Submits a search query.
// TODO: Make this actually do something, besides the visuals.
function searchSubmit (fromButton, isAutocomplete)
{
	isAutocomplete = isAutocomplete ? true : false;
	
	if (searchBox.value.length > 0)
	{
		if (!isAutocomplete)
		{
			isSearchResults = true;
			searchResultsColors = true;
			searchBoxOverwrite = true;
			grayBox();
	
			whichButton = 1;
			$("#searchButtonX").show();
			$("#searchButtonGo").hide();
	
			// Move cursor to the front of the search box.
			//   Code from Josh Stodola, "Setting Cursor Position in a Textbox or TextArea with Javascript"
			//   http://stackoverflow.com/questions/512528/set-cursor-position-in-html-textbox
			if (fromButton != true)
			{
		        if(searchBox.createTextRange)
				{
		            var range = searchBox.createTextRange();
		            range.move('character', 0);
		            range.select();
		        }
		        else if(searchBox.selectionStart)
				{
		            searchBox.setSelectionRange(0, 0);
		        }
			}
		}
	
		// Search the history for the desired terms.
		doSearch (searchBox.value, function()
		{
			var val = _.filter(_.values(searchResults), function (x) {return (x < 1)});
			var maxVal = Math.log(_.max(val))
			var minVal = Math.log(Math.min(_.min(val) / 2, 0.05));
			for (var domain in searchResults)
			if (searchResults[domain] > 0 && searchResults[domain] < 1)
				searchResults[domain] = (Math.log(searchResults[domain]) - minVal) / (maxVal - minVal);
				
//			applyToTreeLeaves (activeTree, function (x) 
//				{if (x.url in domains) {x.highlight = domains[x.url];} else {delete x.highlight;}});
			displaySearchHighlight ("search");
		});
	}
	
	return false;
}

function doSearch (text, do_next)
{
/*	chrome.history.search ({"text": text, "startTime": 0, "maxResults": 1000}, function (ans)
	{
		console.log("Search returned " + ans.length + " results.");
		searchResults = {};
		for (var i in ans)
		{
			var domain = isZoom ? ans[i].url : parseUri(ans[i].url).host;
			if (domain in searchResults)
				searchResults[domain] += ans[i].visitCount;
			else
				searchResults[domain] = ans[i].visitCount;
		}
		do_next();
	});*/


	text = text.toLowerCase();
	searchResults = {};
	for (var d in eventTimes)
	{
		var n = 0;
		for (var e in eventTimes[d].c)
		{
			if (eventTimes[d].c[e].title.toLowerCase().search(text) > -1 || e.toLowerCase().search(text) > -1)
			{
				n += eventTimes[d].c[e].n;
				searchResults[e] = 1;
			}
		}
		if (n > 0)
			searchResults[d] = n / eventTimes[d].n;
	}
	
	do_next();
}

function searchClear ()
{
	if (whichButton == 1)
	{
		whichButton = 0;
		$("#searchButtonGo").show();
		$("#searchButtonX").hide();
	}
	if (isSearchResults)
	{
		isSearchResults = false;
		searchResultsColors = false;
		applyToTreeLeaves (clusterTree, function (x) {delete x.highlight;});
		displaySearchHighlight ("clear");
	}

}

// Called when the search box gains focus.
function searchFocused ()
{
	if (searchBoxOverwrite)
	{
		if (searchBox.value == "Search")
		{
			searchBox.value = "";
			searchBoxOverwrite = false;
			blackBox();
		}
	}
	else
	{
		searchBoxOverwrite = false;
		blackBox();
	}
	if ((searchBox.value != "Search" && searchBox.value != ""))
	{
		if (isAutocomplete)
		{
			isSearchResults = true;
			searchSubmit (false, true);
		}
	}
	else
	{
		displaySearchHighlight ("gray");
	}
	searchResultsColors = true;	// Gray screen when search box opened?  It's a thought...
	searchBoxFocused = true;
}

// Called when the search box loses focus.
function searchBlurred ()
{
	if (searchBox.value == "")
	{
		searchBoxOverwrite = true;
		searchBox.value = "Search";
		grayBox();
	}
	if (!isSearchResults)
	{
		searchResultsColors = false;
		displaySearchHighlight ("clear");
	}
	searchBoxFocused = false;
}

// Called when the user presses a key inside the search box.  When overwrite = true (gray text, leftover from the last query), we need to be extra careful to distinguish between key presses suggesting a desire to preserve the existing text (like arrow keys), neutral keys (shift, tab, etc.) and those suggesting a desire to overwrite it (everything else).
function searchKeyPress (event)
{ 
	debug.evt = event;
	r = event.keyCode;
	if (r == 27)
		searchJustDefocused = true;
	
	//console.log(r);
	if (searchBoxOverwrite)
	{
		// ESC = 27 -- clear, lose focus
		// Arrow Keys = 37-40, HOME, END, PAGEUP, PAGEDOWN = 33-36 -- confirms that user wants to edit text
		// BKSP = 8, DEL = 46 -- delete contents
		// TAB = 9, CAPS = 20, SHIFT = 16, CTRL = 17, OPT = 18, CMD = 91 -- do nothing
		// Anything else -- overwrite
		if (r == 27)
		{
			searchBox.value = "";
			searchBox.blur();
		}
		else if (r >= 33 && r <= 40)
		{
			searchBoxOverwrite = false;
			blackBox();
		}
		else if (r == 8 || r == 46)
		{
			searchBox.value = "";
			searchBoxOverwrite = false;
			blackBox();
		}
		else if (r == 9 || r == 20 || r == 16 || r == 17 || r == 18 || r == 91)
		{
			// Do nothing
		}
		else
		{
			searchBox.value = "";
			searchBoxOverwrite = false;
			blackBox();
		}
	}
	else
	{
		if (r == 27)
			searchBox.blur();
		else if (r != 13 && r != 9 && r != 20 && r != 16 && r != 17 && r != 18 && r != 91 && 
			r != 37 && r != 38 && r != 39 && r != 40 && r != 33 && r != 34 && r != 35 && r != 36)
		{
			setTimeout (function ()
			{
				if (searchBox.value.length > 2)
				{
					if (isAutocomplete)
					{
						isSearchResults = true;
						searchSubmit(false, true);
					}
				}
				else
				{
					searchResults = {};
					isSearchResults = false;
					displaySearchHighlight ("gray");
				}
			}, 1);
		}
	}
}

function displaySearchHighlight (command)
{
	if (command == "clear")
	{
		treemap.recolor(defaultColors, 200);
		if (treemap_bubble != null)
			treemap_bubble.recolor(defaultColors, 200);
	}
	else if (command == "gray")
	{
		treemap.recolor(grayColors, 200);
		if (treemap_bubble != null)
			treemap_bubble.recolor(grayColors, 200);
	}
	else if (command == "search")
	{
		if (treemap_bubble != null)
		{
			if (isBubbleGrayed)
				treemap.recolor(grayColors, 200);
			else
				treemap.recolor(searchColors, 200);
			treemap_bubble.recolor(searchColors, 200);
		}
		else
		{
			treemap.recolor(searchColors, 200);
		}
	}
}
