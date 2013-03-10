// Four different load types, depending on how much data is needed.
//
// Type 1.	No new data generated.  Graph is loaded from memory from its last state.  Acceptable when the previous
// 			state is < 1 day old.  Loading time: ~100 ms
//			(1b):	Load cached data, but regenerate Voronoi map.  Needed when the aspect ratio changes.
//					Loading time: ~300 ms
// Type 2.  New sites found from history, added using a best-fit metric to the existing clustering tree.  Acceptable
//			when the previous state is < 5 days old.  Loading time: ~700 ms
// Type 3.	New sites and coincidence data merged with cached data, new clustering tree generated.  Should always yield
//			an acceptable update.  Good to do every ~5 days.  Loading time: ~1400 ms
// Type 4.	Regenerate data from scratch.  Do this on first load, when the user changes settings, or when there's a bug 
//			in the data.  Loading time: ~4000 ms
//
// Sample Timing:
//
// Load Type 1:
//   Loading polygons for clusterTree: 6 ms. 
//   Loading display: 86 ms. 
//   Total: 92 ms
// 
// Load Type 2:
//   Loading eventList: 54 ms. 
//   Loading eventTimes: 243 ms. 
//   Loading eventWeights, etc.: 6 ms. 
//   Loading eventTimesSorted: 21 ms. 
//   Loading domainEdgeList: 33 ms. 
//   Loading polygons for clusterTree: 352 ms. 
//   Loading display: 61 ms. 
//   Total: 770 ms
// 
// Load Type 3:
//   Loading eventList: 63 ms. 
//   Loading eventTimes: 247 ms. 
//   Loading eventWeights, etc.: 7 ms.
//   Loading eventTimesSorted: 25 ms. 
//   Loading domainEdgeList: 25 ms. 
//   Loading domainEdgeListS: 169 ms. 
//   Loading clusterParentList and clusterTree: 535 ms. 
//   Loading polygons for clusterTree: 335 ms. 
//   Loading display: 61 ms. 
//   Total: 1467 ms
// 
// Load Type 4:
//   Loading eventList: 202 ms. 
//   Loading eventTimes: 1518 ms. 
//   Loading eventWeights, etc.: 18 ms. 
//   Loading eventTimesSorted: 210 ms. 
//   Loading domainEdgeList: 387 ms. 
//   Loading domainEdgeListS: 224 ms. 
//   Loading clusterParentList and clusterTree: 819 ms. 
//   Loading polygons for clusterTree: 373 ms. 
//   Loading display: 75 ms. 
//   Saving cached data: 79 ms. 
//   Total: 3905 ms

var lastType2Load, lastType3Load;
var cutoffWeight = 0.5;

var domainListOld, domainListNew, domainListAdded;
var domainInverseOld, domainInverseNew, domainInverseAdded;
var domainEdgeListSearchable;	// Helper array, of the form [id1 + 10000*id2 -> w12]

function saveAllData ()
{
	if (clusterTree != null)
		chrome.storage.local.set({"clusterTree": JSON.stringify(clusterTree)});
	if (treemap != null)
		chrome.storage.local.set({"width": "" + treemap.width, "height": "" + treemap.height});
	if (eventTimes != null)
		chrome.storage.local.set({"eventTimes": JSON.stringify(eventTimes)});
	if (domainEdgeList != null)
		chrome.storage.local.set({"domainEdgeList": JSON.stringify(domainEdgeList)});
	if (domainList != null)
		chrome.storage.local.set({"domainList": JSON.stringify(domainList)});
	if (domainInverse != null)
		chrome.storage.local.set({"domainInverse": JSON.stringify(domainInverse)});
	if (eventTimesSorted != null)
		chrome.storage.local.set({"eventTimesSorted": JSON.stringify(eventTimesSorted)});
	if (clusterTree != null && treemap != null && eventTimes != null && domainList != null && eventTimesSorted != null
		&& domainEdgeList != null)
	{
		chrome.storage.local.set({"lastSave": "" + Date.now()});
		chrome.storage.local.set({"lookback": lookback});
	}
}

function saveTreeData ()
{
	if (clusterTree != null)
		chrome.storage.local.set({"clusterTree": JSON.stringify(clusterTree)});
	if (treemap != null)
		chrome.storage.local.set({"width": "" + treemap.width, "height": "" + treemap.height});
}

function saveListData ()
{
	Tick();
	if (domainList.length > 0)
		localStorage.domainList = JSON.stringify(domainList);
	if (domainEdgeList.length > 0)
		localStorage.domainEdgeList = JSON.stringify(domainList);
	console.log("Saving cached data: " + Tick() + " ms.");
}

function loadDataType1 (do_next)
{
	loadType = "1";
	chrome.storage.local.get(["clusterTree", "width", "height", "eventTimes", "domainList", "domainInverse"], function (storage)
	{
		storage.width = storage.width ? parseInt(storage.width) : 0;
		storage.height = storage.height ? parseInt(storage.height) : 0;
		if (!storage.clusterTree || !storage.eventTimes || !storage.domainList ||
			!storage.domainInverse)
		{
			if (!storage.clusterTree)
				console.log("Notice: Local storage file clusterTree not found.");
			if (!storage.eventTimes)
				console.log("Notice: Local storage file eventTimes not found.");
			if (!storage.domainList)
				console.log("Notice: Local storage file domainList not found.");
			if (!storage.domainInverse)
				console.log("Notice: Local storage file domainInverse not found.");
				
			loadType = "4";
			loadDataType4(do_next);
		}
		else
		{
			eventTimes = JSON.parse(storage.eventTimes);
			clusterTree = JSON.parse(storage.clusterTree);
			domainList = JSON.parse(storage.domainList);
			domainInverse = JSON.parse(storage.domainInverse);
			
			init_display_params ();
//			console.log([width, height, storage.width, storage.height]);
			if (width == storage.width && height == storage.height)
			{
//				console.log("NOINIT");
				redraw_polys = false;
			}

			do_next ();
		}
	})
}

/*function loadDataType2 (do_next)
{
	loadType = "2";	
	if (!localStorage || !localStorage.domainList || !localStorage.domainEdgeList || !localStorage.clusterTree)
	{
		if (!localStorage)
			console.log("Warning: Local storage not available on this browser.");
		else
		{
			if (!localStorage.domainList)
				console.log("Notice: Local storage file domainList not found.");
			if (!localStorage.domainEdgeList)
				console.log("Notice: Local storage file domainEdgeList not found.");
			if (!localStorage.clusterTree)
				console.log("Notice: Local storage file clusterTree not found.");
		}
		
		load_history (do_next);
	}
	else
	{
		lastType3Load = parseInt(localStorage.lastType3Load);

		// First, update the following:
		// * domainList -- combined list of all domains, minus those with sizes under the threshold
		// * domainListOld, domainInverseOld -- all old domains, up to the last Type 3 load
		// * domainListNew, domainInverseNew -- all new domains.  May overlap with domainList old.
		// * domainListAdded, domainInverseAdded -- Added = New \ Old (in new, not in old)
		updateEdgeList(function ()
		{
			// Go through clusterTree, update properties of existing elements to match those of domainList.
			currentID = domainList.length;
			
			// Add new elements (domainListAdded) to the clusterTree, using a crude step-by-step best-fit approach.
			clusterTree = JSON.parse(localStorage.clusterTree);
			updateClusterTree(clusterTree);
			
			for (var i in domainInverseAdded)
				treeAddInc(clusterTree, domainInverse[i], domainEdgeListSearchable)
			treeClearWTemp(clusterTree);

			for (var i in clusterTree.children)
				truncateTreeLevels (clusterTree.children[i], clusterNmax);

			lastType2Load = localStorage.lastType2Load = dateEnd + "";
			
			calculateApparentSizes(clusterTree);
			checkTree (clusterTree);

//			delete clusterTree.polygon;	// This fools the display into redrawing polygons for all layers in the tree.
			init_display_params ();
			updateTreePolygons (clusterTree, boundingBox, 9999);
			do_next ();
		});
	}
}*/

function loadDataType3 (do_next)
{
	loadType = "3";
	chrome.storage.local.get(["eventTimes", "domainList", "domainInverse", "eventTimesSorted"], function(storage)
	{
		if (!storage.eventTimes || !storage.domainList || !storage.domainInverse || !storage.eventTimesSorted)
		{
			if (!storage.eventTimes)
				console.log("Notice: Local storage file eventTimes not found.");
			if (!storage.eventTimesSorted)
				console.log("Notice: Local storage file eventTimesSorted not found.");
			if (!storage.domainList)
				console.log("Notice: Local storage file domainList not found.");
			if (!storage.domainInverse)
				console.log("Notice: Local storage file domainInverse not found.");

			loadType = "4";
			loadDataType4 (do_next);
		}
		else
		{
			eventTimesSorted = JSON.parse(storage.eventTimesSorted);
			lastType3Load = eventTimesSorted[eventTimesSorted.length - 1][1] + 1;
			storage.eventTimes = JSON.parse(storage.eventTimes);
			storage.eventTimesSorted = JSON.parse(storage.eventTimesSorted);
			storage.domainList = JSON.parse(storage.domainList);
			storage.domainInverse = JSON.parse(storage.domainInverse);

			// Update eventTimes and the other quantities.
			updateTimesDomains (dateEnd, dateStart, storage, function (out)
			{
				loadType34 (out, do_next);
			});
		}	
	})
}

// Previously load_history
function loadDataType4 (do_next)
{
	Tick();
	updateProgressBar(0, "Loading Site List");
	// Loads eventTimes, domainList, eventTimesSorted.
	loadTimesDomains (dateStart, dateEnd/*(dateStart + dateEnd) / 2*/, function (out)	
	{
//		console.log ("Half loaded.");
//		updateTimesDomains (dateEnd, 0, out, function (out)
//		{		

		// Load the rest of the stuff, then go to visual.
		loadType34 (out, do_next);
		
//		});
	});
}

function loadType34 (out, do_next)
{
	eventTimes = out.eventTimes; domainList = out.domainList;
	eventTimesSorted = out.eventTimesSorted; domainInverse = out.domainInverse;
		
	// Create domainEdgeList.
	updateProgressBar(getProgress[loadType].other, "Processing data");
	setTimeout(function ()
	{
		domainEdgeList = loadDomainEdgeList (eventTimesSorted, domainList, dateStart, dateEnd);
		updateProgressBar((getProgress[loadType].other + getProgress[loadType].clusterTree)/2, "Processing data");
		setTimeout(function ()
		{
			domainEdgeListS = loadDomainEdgeListS (domainEdgeList);
		
			updateProgressBar(getProgress[loadType].clusterTree, "Clustering data");
			setTimeout (function ()
			{
				// Create clusterTree.
				Tick();
				clusterTree = formTree();
				standardTreeProcessing(clusterTree);
				console.log("Loading clusterParentList and clusterTree: " + Tick() + " ms.");
			
				localStorage.lastType3Load = localStorage.lastType2Load = dateEnd + "";
			
				// After the history is loaded, load the visual.
				updateProgressBar(getProgress[loadType].polygons, "Loading display");
				setTimeout (do_next, 1);
			}, 1);
		}, 1);
	}, 1);
}


function updateTimesDomains (dateEnd, dateCutoff, dataOld, do_next)
{
	var eventTimesOld = dataOld.eventTimes;
	var eventTimesSortedOld = dataOld.eventTimesSorted;
	var domainListOld = dataOld.domainList;
	var domainInverseOld = dataOld.domainInverse;
	if (!eventTimesOld)
		throw "Does not exist: dataOld.eventTimes";
	if (!eventTimesSortedOld)
		throw "Does not exist: dataOld.eventTimesSorted";
	if (!domainListOld)
		throw "Does not exist: dataOld.domainList";
	if (!domainInverseOld)
		throw "Does not exist: dataOld.domainInverse";
	var dateStart = eventTimesSortedOld[eventTimesSortedOld.length - 1][1];

	if (dateCutoff > dateStart)
	{
		loadTimesDomains(dateStart, dateEnd, do_next);
		return;
	}

	loadTimesDomains (dateStart, dateEnd, function(out)
	{
		var eventTimesNew = out.eventTimes;
		var eventTimesSortedNew = out.eventTimesSorted;
		var domainListNew = out.domainList;
		var domainInverseNew = out.domainInverse;
		
		// Discount weights of all old data.
		var discountFactor = Math.exp((dateStart - dateEnd) / tSizeCutoff);
		var discountFactorSq = discountFactor * discountFactor;

		// First, process the old eventTimes data.  Discount old points.  Remove points below the cutoff.
		var eventTimesMerged = eventTimesOld;
		for (var i in eventTimesMerged)
		{
			var t = eventTimesMerged[i].t;
			if (t[t.length - 1] < dateCutoff)
				delete eventTimesMerged[i];
			else
			{
				var ind = binarySearchGreater (t, dateCutoff);
				eventTimesMerged[i].t = t.slice(ind);
				for (var j in eventTimesMerged.c)
				{
					var t = eventTimesMerged[i].c[j];
					if (t[t.length - 1] < dateCutoff)
						delete eventTimesMerged[i].c[j];
					else
					{
						var ind = binarySearchGreater (t, dateCutoff);
						eventTimesMerged[i].c[j].t = t.slice(ind);
					}
				}
			}
		}
		// Next, add the new data.
		for (var i in eventTimesNew)
		{
			if (i in eventTimesMerged)
			{
				eventTimesMerged[i].t = eventTimesMerged[i].t.concat(eventTimesNew[i].t);
				for (var j in eventTimesNew[i].c)
				{
					if (j in eventTimesMerged[i].c)
						eventTimesMerged[i].c[j].t = eventTimesMerged[i].c[j].t.concat(eventTimesNew[i].c[j].t);
					else
						eventTimesMerged[i].c[j] = eventTimesNew[i].c[j];
				}
			}
			else
				eventTimesMerged[i] = eventTimesNew[i];
		}
		// Finally, compute the appropriate weights.
		for (var i in eventTimesMerged)
		{
			var wts = getSequenceWeights(eventTimesMerged[i].t, dateEnd);
			eventTimesMerged[i].wt = wts[0];
			eventTimesMerged[i].wts = wts[1];
			eventTimesMerged[i].n = eventTimesMerged[i].t.length;
			for (var j in eventTimesMerged[i].c)
			{
				wts = getSequenceWeights(eventTimesMerged[i].c[j].t, dateEnd);
				eventTimesMerged[i].c[j].wt = wts[0];
				eventTimesMerged[i].c[j].wts = wts[1];
				eventTimesMerged[i].c[j].n = eventTimesMerged[i].c[j].t.length;
//				if (eventTimesMerged[i].c[j].t.length != eventTimesMerged[i].c[j].wts.length)
//					throw "Waaaaa... firetruck hit updateTimesDomains: " + j;				
			}
		}
		
		// Now we are ready to compute domainList, domainInverse, and eventTimesSorted.
		// Code stolen from load-history.js, loadTimesDomains ().
		var domainListMerged = [], domainInverseMerged = {};
		for (var dom in eventTimesMerged)
		{
			var evt = eventTimesMerged[dom];
			domainListMerged.push({"url": dom, "lastVisited": evt.t[evt.t.length-1], "numVisits": evt.n,
				"weight": evt.wt})
			domainInverseMerged[dom] = domainListMerged.length - 1;
		}
		var eventTimesSortedMerged = [];
		for (var dom in eventTimesMerged)
			for (var i in eventTimesMerged[dom].t)
				eventTimesSortedMerged.push([domainInverseMerged[dom], eventTimesMerged[dom].t[i],
					eventTimesMerged[dom].wts[i]])
		eventTimesSortedMerged.sort(function (a, b) {return a[1]-b[1];});
		
//		for (var i in eventTimesMerged)
//		{
//			if (eventTimesMerged[i].t.length != eventTimesMerged[i].wts.length)
//				throw "A firetruck hit updateTimesDomains: " + i;
//			for (var j in eventTimesMerged[i].c)
//				if (eventTimesMerged[i].c[j].t.length != eventTimesMerged[i].c[j].wts.length)
//					throw "A firetruck hit updateTimesDomains: " + j;
//		}
		
		do_next({"eventTimes": eventTimesMerged, "eventTimesSorted": eventTimesSortedMerged,
			"domainList": domainListMerged, "domainInverse": domainInverseMerged});
	})
}


// Obtains old data from last Type 3 load, obtains new data since the last load, and merges this data sets.
// Creates:
// * domainList -- combined list of all domains, minus those with sizes under the threshold
// * domainListOld, domainInverseOld -- all old domains, up to the last Type 3 load
// * domainListNew, domainInverseNew -- all new domains.  May overlap with domainList old.
// * domainListAdded, domainInverseAdded -- Added = New \ Old (in new, not in old)
// * domainEdgeListSearchable -- id1 + 10000*id2 -> w12

var domainEdgeListOld, domainEdgeListNew;

function updateEdgeList (storage, dateEnd, do_next)
{
	var t1 = storage.lastSave;
	var t2 = dateEnd;
	
	// Load old data from file.
	domainListOld = JSON.parse(storage.domainList);
	domainInverseOld = {}; for (var i in domainListOld) {domainInverseOld[domainListOld[i].url] = i;}
	domainEdgeListOld = JSON.parse(storage.domainEdgeList);

	// Discount weights of all old data.
	var discountFactor = Math.exp((t1 - t2) / tSizeCutoff);
	var discountFactorSq = discountFactor * discountFactor;
	for (var i in domainListOld)
	{
		domainListOld[i].weight *= discountFactor;
		for (var j in domainListOld[i].keyword_hashtable.occurrenceList)
			domainListOld[i].keyword_hashtable.occurrenceList[j] *= discountFactor;
	}
	for (var i in domainEdgeListOld)
		domainEdgeListOld[i][2] *= discountFactorSq;
		
//	var discTree = function (x) {x.weight *= discountFactor; for (var i in x.children) {discTree(x.children[i]);}}
		
	// Load new data (eventTimesNew, domainListNew) from the browser history.
	loadTimesDomains (t1 - tCutoff, t2, function ()
	{
		domainListNew = domainList; domainInverseNew = domainInverse;	// "New" items (since last load)
		domainListAdded = [], domainInverseAdded = {};					// New items that didn't appear in "old" list.
		domainList = []; domainInverse = {};
			
		// Merge the two domain lists.  Creates a new list, called domainList, and the corresponding domainInverse,
		// containing all the "big enough" or "new enough" webpages.
		var domainListAll = domainListOld.concat(domainListNew);
		for (var i in domainListAll)
		{
			var item = domainListAll[i];
				
			if (item.url in domainInverse)
			{
				// If the current element is already accounted for in domainList, don't add it.  Just add the weights.
				var item2 = domainList[domainInverse[item.url]];
				item2.weight += item.weight; item2.numVisits += item.numVisits;
//				item2.keyword_hashtable = CombineHashtables (item2.keyword_hashtable, item.keyword_hashtable);
//				console.log(item2.keyword_hashtable);
//				console.log(item.keyword_hashtable);
//				item2.keyword_hashtable.prune (hashtable_size);
			}
			else if (item.url in domainInverseNew || item.weight > cutoffWeight)
			{
				// Otherwise, if the item is big enough, or new enough, add it to the domain list.
				domainList.push(item); domainInverse[item.url] = domainList.length - 1;
				if (!(item.url in domainInverseOld))
				{
					domainListAdded.push(item); domainInverseAdded[item.url] = domainListAdded.length - 1;
				}
			}
		}
//		console.log("domainListAdded: " + domainListAdded.length);
//		console.log("domainListOld: " + domainListOld.length);
//		console.log("domainListNew: " + domainListNew.length);
//		console.log("domainListAll: " + domainListAll.length);
//		console.log("domainList: " + domainList.length);
		

		// Load domainEdgeListNew.
		var eventTimesSortedNew = eventTimesSorted;
		domainEdgeListNew = loadDomainEdgeList (eventTimesSortedNew, domainListNew, t1, t2);
			
		// Merge domainEdgeLists.
		var domainEdgeListTemp = {}
		for (var i0 = 0; i0 < 2; i0++)
		{
			var theList = (i0 == 0) ? domainListOld : domainListNew;
			var theEdge = (i0 == 0) ? domainEdgeListOld : domainEdgeListNew;

			for (var i in theEdge)
			{
				var url1 = theList[theEdge[i][0]].url;
				var url2 = theList[theEdge[i][1]].url;
				if (url1 in domainInverse && url2 in domainInverse)
				{
					// Add new id to domainEdgeList
					var id1 = domainInverse[url1], id2 = domainInverse[url2];	// New domain id's
					var id = Math.min(id1, id2)+10000*Math.max(id1, id2);
					if (id in domainEdgeListTemp)
						domainEdgeListTemp[id] += theEdge[i][2]
					else
						domainEdgeListTemp[id] = theEdge[i][2]
				}
			}
		}
		domainEdgeList = [];
		for (var i in domainEdgeListTemp)
			domainEdgeList.push([i%10000, Math.floor(i/10000), domainEdgeListTemp[i]]);	
		domainEdgeListSearchable = domainEdgeListTemp;
		
			
		do_next ();
	});
}

// Updates domain id's and weights in clusterTree 
var updateClusterTree = function (tree)
{
	if (tree.children.length > 0)
	{
		tree.id = currentID; currentID++;
		for (var i in tree.children)
			updateClusterTree (tree.children[i]);
		tree.children = _.filter(tree.children, function(x) {return !("remove" in x)});
		if (tree.children.length == 0)
			tree.remove = true;
	}
	else if (tree.url in domainInverse)
	{
		tree.id = domainInverse[tree.url];
		tree.numVisits = domainList[tree.id].numVisits;
		tree.weight = domainList[tree.id].weight;
		tree.keyword_hashtable = domainList[tree.id].keyword_hashtable;
	}
	else
	{
//		console.log ("Removing url " + tree.url + ", weight " + tree.weight);
		tree.remove = true;
	}
}

// Here, edgelist is formatted as: {id1+10000*id2 -> w12}
function treeCreateWTemp (tree, idNew, edgelist)
{
	if (tree.children.length > 0)
	{
		tree.tempW12 = 0;
		for (var i in tree.children)
		{
			treeCreateWTemp(tree.children[i], idNew, edgelist);
			tree.tempW12 += tree.children[i].tempW12;
		}
	}
	else
	{
		var idOld = tree.id;
		if ((idOld + 10000*idNew) in edgelist)
			tree.tempW12 = edgelist[idOld + 10000*idNew];
		else
			tree.tempW12 = 0;
	}
}

function treeClearWTemp (tree)
{
	delete tree.tempW12;
	for (var i in tree.children)
		delete tree.children[i].tempW12;
}

var tmpvar = [];

function treeAddInc (tree, idNew, edgelist, depth)
{
	depth = depth ? depth : 0;
	var dom = domainList[idNew];
	if (depth == 0 || depth == 1)
	{
		if (depth == 0)
		{
			treeCreateWTemp (tree, idNew, edgelist);	
			tmpvar = [];
		}
		
		var w22 = edgelist[idNew + 10000*idNew];
		var r12List = _.map(tree.children, function (x, ind) {return [ind, (x.tempW12*x.tempW12)/(x.w11*w22), x.r12]});

		var newList = r12List;
//		var newList = _.filter(r12List, function (x) {return (x[1] > x[2]);});

//		console.log("" + idNew);
//		console.log("" + w22);
//		console.log("" + r12List.length);
//		print_array(r12List);
//		console.log("" + newList);
		
		if (depth == 0)
		{
			// Must add to one of the child nodes.
			var bestInd = _.max(newList.length > 0 ? newList : r12List, function(x) {return x[1]/x[2];})[0];
//			console.log("" + _.max(newList.length > 0 ? newList : r12List, function(x) {return x[1]/x[2];}));
			tmpvar.push(bestInd);
			treeAddInc (tree.children[bestInd], idNew, edgelist, depth + 1);
		}
		else
		{
			// May (not must) add to one of the child nodes.
			if (newList.length > 0)
			{
				var bestInd = _.max(newList, function(x) {return x[1]/x[2]})[0];
//				console.log("" + _.max(newList.length > 0 ? newList : r12List, function(x) {return x[1]/x[2];}));
				tmpvar.push(bestInd);
				treeAddInc (tree.children[bestInd], idNew, edgelist, depth + 1);
			}
			else
			{
				console.log("Added URL " + dom.url + " to " + tmpvar);
				
				tree.children.push({"numVisits": dom.numVisits,
				"keywords": dom.title,
				"id": idNew,
				"url": dom.url,
				"r12": 0,
				"w11": edgelist[idNew + 10000*idNew],
				"children": [],
				"keyword_hashtable": dom.keyword_hashtable,
				"icon_url": dom.icon_url,
				"weight": Math.pow(dom.weight, clusterSizePowerQ)/*,
				"highlight": true*/})
			}
		}
	}
	else if (depth == 2)
	{
//		console.log("Added URL " + dom.url + " to " + tmpvar);

		tree.children.push({"numVisits": dom.numVisits,
			"keywords": dom.title,
			"id": idNew,
			"url": dom.url,
			"r12": 0,
			"w11": edgelist[idNew + 10000*idNew],
			"children": [],
			"keyword_hashtable": dom.keyword_hashtable,
			"icon_url": dom.icon_url,
			"weight": Math.pow(dom.weight, clusterSizePowerQ)/*,
			"highlight": true*/});
	}
	else
	{
		throw "Internal error -- treeAddInc should never go to depth >= 3.  Depth = " + depth + ".";
	}
	
	if (depth == 0)
		weightClusterTree (tree);
}

function positionTreeLeaves (treeOld, treeNew, w, h)
{
	// Get a list of all URL's in each top-level cluster.
	var leafListOld = [], leafListNew = [];
	for (var i in treeOld.children)
		leafListOld.push(getTreeLeaves (treeOld.children[i]));
	for (var i in treeNew.children)
		leafListNew.push(getTreeLeaves (treeNew.children[i]));
	
	// Create an array corr2 of the form [indOld, indNew, correlation], where the correlation is equal to the weight of
	// all of the URL's commonly held between the old and new cluster.  Sort by correlation.
	var indexed = {};
	for (var i in leafListOld)
		for (var j in leafListOld[i])
			indexed[leafListOld[i][j].url] = [i, leafListOld[i][j].weight];
	var corr1 = {};
	for (var indNew in leafListNew)
		for (var j in leafListNew[indNew])
			if (leafListNew[indNew][j].url in indexed)
			{
				var indOld = indexed[leafListNew[indNew][j].url][0];
				var ind = parseInt(indOld) + 10000 * parseInt(indNew);
				if (ind in corr1)
					corr1[ind] += indexed[leafListNew[indNew][j].url][1];
				else
					corr1[ind] = indexed[leafListNew[indNew][j].url][1];
			}
	var corr2 = [];
	for (var i in corr1)
		corr2.push([i%10000, Math.floor(i/10000), corr1[i]]);
	corr2.sort (function(a, b) {return a[2] - b[2];});

	// Go through the list corr2, from highest to lowest correlation, and construct a map between old clusters to new
	// clusters, based on the links with the strongest correlations.  Here, picked is an array of the form 
	// [indOld, indNew] for all mapped indices.  If #old != #new, then some indices won't get matched.
	var pickedOld = {}, pickedNew = {}
	var picked = [];
	for (var corr = corr2.pop(); corr != undefined; corr = corr2.pop())
	{
		if (corr[0] in pickedOld || corr[1] in pickedNew)
			continue;
		else
		{
			picked.push([corr[0], corr[1]]);
			pickedOld[corr[0]] = true;
			pickedNew[corr[1]] = true;
		}
	}
	
	debug.picked = picked;
	
	// The property tree.colors is a list of integers [i1, ..., iN], where the k-th color is given by the color function:
	// color(ik), where color() gives the d3 standard colors.
	var oldColors = treeOld.colors ? treeOld.colors : d3.range(0, treeOld.children.length)
	var newColors = new Array(treeNew.children.length);
	var oldCentroids = _.map(treeOld.children, function(x) {return x.center;});
	var newCentroids = new Array(treeNew.children.length);

	debug.centroid1 = _.map(treeOld.children, function(x) {return x.center;});
	debug.centroid2 = _.map(treeOld.children, function(x) {return centroid(x.polygon);});

	// Two possibilities:
	// (1) Mode old child nodes than new child nodes.  In this case, we map each new node's color to its corresponding
	//     old node's color.  Each new node has a corresponding old node.
	// (2) Mode new child nodes than old child nodes.  In this case, not all new nodes map to old nodes.  So we need to
	//     repeat the procedure in (1) and then map new colors to the unmapped nodes.

	for (var i in picked)	// In either case, all mapped nodes map their colors and centroids.
	{
		newColors[picked[i][1]] = oldColors[picked[i][0]];
		newCentroids[picked[i][1]] = oldCentroids[picked[i][0]]
	}
	// Additional mappings for case (2).  If all newColors are defined, as happens in case (1), this doesn't do anything.
	// Now we need to map nodes that don't match up with anything.  We just pick random centroids, and find colors that aren't contained in newColors.
	for (var i = 0; i < treeNew.children.length; i++)
	{
		if (newColors[i] == undefined)
		{
			for (var j = 0; j < treeNew.children.length; j++)
				if (!_.contains(newColors, j))
				{
					newColors[i] = j;
					break;
				}
			newCentroids[i] = [w * Math.random(), h * Math.random()];
		}
	}
	
	treeNew.colors = newColors;
	for (var i in treeNew.children)
		treeNew.children[i].center = newCentroids[i];
}

function getTreeLeaves (tree)
{
	if (tree.children.length == 0)
		return [tree];
	else
	{
		var out = [];
		for (var i in tree.children)
			out = out.concat(getTreeLeaves(tree.children[i]));
		return out;
	}
}