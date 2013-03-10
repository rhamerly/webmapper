// Global variables.
// Data -- old data was a tree of the form [apparentSize, title, url, children, realSize, r, keywordHashtable]
// Now it's just equivalent to clusterTree
var data;
var data_keys;
var debug = {};
var vis;
var width;
var height;
var boundingBox;
var clusterPolygons;
var d3_poly_data = [];	// Polygon and line data.
var d3_line_data = [];
var line_id;
var displayVoronoi = true;
var clusterProcessing = 5;	// (0) no processing, (1) rebalance children, (2) rebalance children recursively,
							// (3) flatten, (4) size-based rebalancing, (5) size-based rebalancing plus flattening
// Time bounds for the history search.
var lookback = 30;
var dateStart; 
var dateEnd;
var tSizeCutoff = lookback*86400*1000;
var loadType;
var homepage = "about:blank";	// TODO -- update this to reflect the actual GitHub page.


function doc_onload ()
{
	initSearch ();
	
	chrome.windows.getCurrent(function (win)
	{		
		width = win.width;
		height = win.height - 66;	// workaround

		createSVG ();
		Tick ();

		// Load user parameters, or set defaults.
		chrome.storage.local.get(["selectedColor", "selectedShading", "lookback", "lastSave"], function (storage)
		{
			lookback = storage.lookback ? parseInt(storage.lookback) : 30;
			selectedColor = (storage.selectedColor != undefined) ? parseInt(storage.selectedColor) : 0;
			selectedShading = (storage.selectedShading != undefined) ? parseFloat(storage.selectedShading) : 1;
			dateStart = Date.now() - lookback*86400*1000;
			dateEnd = Date.now() - 0*86400*1000;
			setColorsAndToolbars ();
			
			if (storage.lastSave)
			{
				var daysSinceSave = (Date.now () - storage.lastSave)/86400000;
//				console.log(daysSinceSave + " days since last save.");
				if (daysSinceSave < 5)
					loadType = "1";
				else if (storage.lastSave > dateStart)
					loadType = "3";
				else
					loadType = "4";
			}
			else
				loadType = "4";
			console.log("Load Type: " + loadType);
			
//			loadType = "3";

			if (loadType == "1")
			{
				loadDataType1 (function () {load_display (clusterTree); saveTreeData();
					load_interaction ();});
			}
			else if (loadType == "1b")
			{
			
			}
			else if (loadType == "2")
			{
				throw "Type 2 Load not yet implemented.";
				loadDataType2 (function () {load_display (clusterTree);
					load_interaction ();});
			}
			else if (loadType == "3")
			{
				loadDataType3 (function () {load_display (clusterTree); saveAllData ();
					load_interaction ();});
			}
			else if (loadType == "4")
			{
				loadDataType4 (function () {load_display (clusterTree); saveAllData ();
					load_interaction ();});
			}
		});
	});
}

// When the page is loaded, process doc_onload.
document.addEventListener('DOMContentLoaded', doc_onload);