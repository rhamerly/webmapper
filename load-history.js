// Important data structures instantiated when the page loads.
//
// eventList -- a list of chrome.history.HistoryItem events.  One for each webpage visited.
// eventTimes -- a "master list" of the following form:
//    {domain1: {n:   numVisits
//               wt:  weight
//               c:   {url1: {title: (title1), n: numVisits, wt: weight, t: [t1, ..., tN]},
//                     url2: {title: (title2), n: numVisits, wt: weight, t: [t1, ..., tN]},
//                     ...}},
//     domain2: {...}, 
//     ...}
// domainList -- a list of domain names.  Example: news.google.com; www.caltech.edu, etc.  Here we distinguish domain names even when they have the same host / suffix: scholar.google.com != docs.google.com, for instance.  Takes the form [url, lastVisited, title, numVisits, keyword_hashtable, icon_url, weight]
// domainEdgeList -- Linked-node graph for all of the domains.  Format: [[i1, j1, w1], ..., [iN, jN, wN]].  (i, j) are nodes, w is the edge weight.  The edge weight is a function of how close (in time) page views from the two domains were -- technically w_{ij} = \sum_{t_i,t_j} e^{-|t_i - t_j|/tExp}.  Redundancy is subtle and is included for consistency.
// domainEdgeListS -- List of the form [n1, n2, w11, w12, w22, r12 = w12^2/(w11*w22)].  SArray, searchable on the n1, n2, and r12 columns.  Used for clustering domain data.
// eventWeights -- the weigths for eventTimes, given by w_i = 1 - e^{-(t_i - t_{i-1})/\tau). 
// eventTimesSorted -- list of the form [[t1, i1], [t2, i2], ..., [tN, iN]], where t1, t2, ..., tN are the times, and i1, i2, ..., iN are the indices corresponding domains visited (domainList[iK] is the actual domain name for time tK).
// clusterParentList -- list of the form [parent, child1, child2, numVisits, r12], where parent >= N_nodes is the parent ID, and child1, child2 are the child ID's; child < N_nodes if the child is a unique domain; child >= N_nodes if the child is itself a parent node.  Here numVisits is the number of times the parent is visited, r12 is the correlation metric w12*w12/w11*w22 between the two children.  Used for clustering domain data.
// clusterTree -- a nested list, of the form [numVisits, keywords, url/id, r12, [child1, child2], keyword_hashtable, icon_url], where each child has the same list form.

var eventList = [];
var domainList = [];
var domainInverse = {};
var domainEdgeList = []; 
var domainEdgeListS = null;
var eventTimes = null, eventTimes_ = {};
var eventTimesSorted = [];
var clusterParentList = [];
var clusterTree = null;

// Cluster nodes are sized by this power -- if V is the viewed size and v_i is the real size of each website, then
// V = (\sum_i{v_i^Q})^P
// For a leaf node, this is just V_i = v_i^{pq}.
var clusterSizePowerP = 0.7;
var clusterSizePowerQ = 0.8;
var clusterThreshold = 0.12;
var clusterNmax = 20;

// When detecting similarities between data sets, we use a "convolution-like" correlation function:
// w_{ij} = \sum_{t_i,t_j} e^{-|t_i - t_j|/tExp}
// The cutoff time tCutoff limits the size of our summation window.  Taking tCutoff / tExp = 4 is accurate to ~2%
var tCutoff = 4*3600*1000;
var tExp = 1*3600*1000;

// Weighting for sites is given by the formula:
//   w = e^(-(tNow-tEvt) / tSizeCutoff) * [cNear + (1-cNear)*(1 - e^(-(tEvt-tPrev) / tExp))]
// The constant cNear gives the weight of a site clicked -immediately after- another site in the same domain.
// For a true exponential cutoff, cNear = 0.  For no cutoff, cNear = 1.  0.1 is a compromise.
var cNear = 0.1;


// visitList -- a list of chrome.history.VisitItem events.  Triggered by url_clicked(a) function.
var visitList = {};		
var numEventsRegistered = 0;

// Max size of the keyword hashtable, for each site.
var hashtable_size = 30;


// Debug Parameters.
var isDebug = true;
var debugClusterProcessing = 5;
var debugWeighted = true;
var debugMaxClusterWeight = function (r12) {return Math.max(1/clusterNmax, r12);};
var debugThreshold = function (wt) {return Math.max(wt, clusterThreshold)};

// If true, don't clip domains at the host level.
var debugDomain = false;
var debugDomainURL = "github.com";

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// Tick () returns the time since the last Tick (), and resets the timer.		
// Tock () returns the time since the last Tick (), but doesn't reset the timer.
var clocktime_ = 0;
function Tick ()
{
	var temp = GetTimeMS () - clocktime_;
	clocktime_ += temp;
	return temp;
}
function Tock ()
{
	return GetTimeMS () - clocktime_;
}
function GetTimeMS ()
{
	return Date.now ();
}


// Writes data to the document.  Better than console, sometimes.
function docWrite (a, options)
{
	var doc = document.createElement("p");
	doc.innerHTML = a;
	if (options)
		for (var i in options)
			doc[i] = options[i];
	document.body.appendChild(doc);
}

// Clears all child nodes and HTML from a given node.
function docClear (node)
{
	while (node.firstChild)
		node.removeChild(node.firstChild);
	node.innerHTML = "";
}

// Creates a function that adds all of the event times to eventTimes, then increments numEventsRegistered.
// If the last URL has been processed, goes to doNext.
function url_visitData(domainId, doNext, startIndex)
{
	return function (out)
	{
		// Only add data to eventTimes if it comes from a valid URL.
		if (/\.|localhost/.test(parseUri(eventList[domainId].url).host))
		{
			// Create a new domain, if necessary, and add the data.
			if (!(domainId in eventTimes_))
				eventTimes_[domainId] = [];
			for (var i = 0; i < out.length; i++)
				eventTimes_[domainId].push(out[i].visitTime);
		}

		numEventsRegistered++;
		
		if (numEventsRegistered == eventList.length)
		{
			getEventTimesHelper ();
			var eventTimes_tmp = eventTimes_; eventTimes_ = {};
			doNext(eventTimes_tmp);
		}
		else if (numEventsRegistered == startIndex + getBlock)
		{
			// Updating the status bar.
			updateProgressBar(getProgress[loadType].eventTimes(numEventsRegistered, eventList.length), 
				"Loading Visits:  " + parseUri(eventList[domainId].url).host);
			setTimeout(function ()
			{
				getEventTimes(doNext, startIndex + getBlock);
			}, 1);
		}
	}
}

var getBlock = 100;
var getEventTimes_start, getEventTimes_end;

// Gets visit times for all event items (there are ~6,000 of them).
function getEventTimes(doNext, startIndex, startTime, endTime)
{
	if (startTime && endTime)
	{
		getEventTimes_start = startTime;
		getEventTimes_end = endTime;
	}
//	console.log("WOOOOOT " + startIndex);
	if (!startIndex)
	{
		startIndex = 0;
		numEventsRegistered = 0;
		eventTimes_ = {};
	}
	for (var i = startIndex; i < Math.min (eventList.length, startIndex + getBlock); i++)
	{
		var domain = eventList[i].url; //getHost(eventList[i].url);
		chrome.history.getVisits ({"url": eventList[i].url}, url_visitData(i, doNext, startIndex));
	}
}

function getEventTimesHelper ()
{
	// Reformat eventTimes once all events are in.
	//
	// Structure looks like this:
	// {domain1: {n: numVisits
	//            wt: weight
	//            c: {url1: {title: (title1), n: numVisits, wt: weight, t: [t1, ..., tN]},
	//                url2: {...}, ...}}, ...}
	var temp = {};
	for (var id in eventTimes_)
	{
		var url = eventList[id].url;
		var times = _.filter(eventTimes_[id], function(t) {return (t > getEventTimes_start && t < getEventTimes_end);});
		if (times.length > 0)
		{
			var title = eventList[id].title; var host = parseUri(url).host;
			if (!(host in temp))
				temp[host] = {"c": {}, "n": 0, "wt": 0};
			var wts = getSequenceWeights(times, dateEnd);
			temp[host].c[url] = {"title": title, "t":times, "n":times.length, 
				"wt": wts[0], "wts": wts[1]};
		}
	}
	eventTimes_ = temp;
	for (var dom in eventTimes_)
	{
		var t = [];
		for (var url in eventTimes_[dom].c)
			t = t.concat(eventTimes_[dom].c[url].t);
		t.sort();
		eventTimes_[dom].n = t.length;
		var wts = getSequenceWeights(t, dateEnd);
		eventTimes_[dom].t = t;
		eventTimes_[dom].wt = wts[0];
		eventTimes_[dom].wts = wts[1];
	}
}

function getHost (url)
{
	if (debugDomain)
		return url;
	
	return parseUri(url).host.replace(/\&.*$/g, "")
}

// This function will load the items:
// * domainList, domainInverse
// * eventTimes, eventTimesSorted
// It does not load them to global memory.  Rather, it passes them to the function do_next as an object:
// {"eventTimes": evt, "eventTimesSorted": evts, "domainList": dom, "domainInverse": dominv}
// from the user's browser history.  It only focuses on events in the time window [startTime, endTime].
function loadTimesDomains (startTime, endTime, do_next)
{
	chrome.history.search({"text": "", "startTime": startTime, "endTime": endTime, "maxResults": 100000}, function (ans)
	{
		console.log("Loading eventList: " + Tick() + " ms.");
		// Copy all the history data to a global variable.
		eventList = ans;
		
		
		if (debugDomain)
		{
			eventList = _.filter(eventList, function(x) {return (parseUri(x.url).host == debugDomainURL)});
			_.map(eventList, function(x) {if (x.title == "" && /\.\w{1,5}$/.test(x.url)) {x.title = x.url.replace(/^.*[\/|\?|\=]/, "").replace(/\%20/g, " "); console.log(x.title)}});
			eventList = _.filter(eventList, function(x) {return (x.title != "")});
			
			// Find and eliminate common prefixes.
			var threshold = Math.sqrt(eventList.length);
			var chars = {};
			var maxLength = _.max(_.map(eventList, function(x) {return x.title.length;}));
			for (var i = 0; i < eventList.length; i++)
			{
				for (var len = 5; len <= eventList[i].title.length; len++)
				{
					var str = eventList[i].title.substr(0, len).toLowerCase();
					if (str in chars)
						chars[str] += 1;
					else
						chars[str] = 1;
				}
			}
			for (var str in chars)
				if (chars[str] < threshold)
					delete chars[str];
			var keys = _.keys(chars); keys.sort(function(a, b) {return b.length - a.length});
			chars = [];
			for (var i in keys)
			{
				var j = 0;
				for (j = 0; j < chars.length; j++)
				{
					if (chars[j].substr(0, keys[i].length) == keys[i])
						break;
				}
				if (j == chars.length)
					chars.push(keys[i]);
			}
			print_array(chars);
			for (var i in eventList)
			{
				var title = eventList[i].title.toLowerCase();
				for (var j in chars)
				{
					if (title.substr(0, chars[j].length) == chars[j])
					{
						var tmp = eventList[i].title.substr(chars[j].length).replace(/^\W+/, "");
						if (tmp.length > 0)
						{
							eventList[i].title = tmp;	// Temporary fix
							break;
						}
					}
					else if (title.substr(0, 5) == chars[j].substr(0, 5))
					{
						var k;
						for (k = 5; k <= chars[j].length && title.substr(0, k) == chars[j].substr(0, k); k++) {}
						var tmp = eventList[i].title.substr(k - 1).replace(/^\W+/, "");
						if (tmp.length > 0)
						{
							eventList[i].title = tmp;	// Temporary fix
							break;
						}
					}
				}
				eventList[i].title = eventList[i].title.replace(/^\W+/, "");;
			}

			console.log(eventList.length + " events.");
		}
		updateProgressBar(getProgress[loadType].eventTimes(0, 1), "Loading Visits");
		
		getEventTimes(function (eventTimes_) 
		{
			console.log("Loading eventTimes: " + Tick() + " ms.");
						
			// Create an array of domains (index to domain), and its inverse (domain to index) -- a two-way searchable list.
			var domainList_ = [], domainInverse_ = {};
			for (var dom in eventTimes_)
			{
				var evt = eventTimes_[dom];
				domainList_.push({"url": dom, "lastVisited": evt.t[evt.t.length-1], "numVisits": evt.n, "weight": evt.wt})
				domainInverse_[dom] = domainList_.length - 1;
			}
							
			// Create a sorted list of event times, of the form [[t1, i1, w1], [t2, i2, w2], ..., [tN, iN, wN]], where t1, t2, ..., tN are the times, i1, i2, ..., iN are the corresponding domains visited, and the w's are weights, from eventWeights.
			// Here i is the index, eventTimes[i] = [t1, t2, ..., tN].  Add all time events to a long list. 
			var eventTimesSorted_ = [];
			for (var dom in eventTimes_)
				for (var i in eventTimes_[dom].t)
					eventTimesSorted_.push([domainInverse_[dom], eventTimes_[dom].t[i], eventTimes_[dom].wts[i]])
			eventTimesSorted_.sort(function (a, b) {return a[1]-b[1];})
			console.log("Loading eventTimesSorted: " + Tick() + " ms.");
			
			do_next({"domainList": domainList_, "domainInverse": domainInverse_,
				"eventTimes": eventTimes_, "eventTimesSorted": eventTimesSorted_});
		}, 0, startTime, endTime);
	});
}

// For a given hostname, this loads event and domain data for every page on the site.  This is used in the "zoom-in"
// feature, where instead of displaying a map of the web, with each site as a polygon, we display a map of the chosen
// site, with each page represented by a polygon.  Thus the domains in domainList become pages, not sites.  But
// everything else is more or less the same.
//
// Returns: Object of the form
//    {domainList: {...},
//     domainListInverse: {...},
//     eventTimes: {...},
//     eventTimesclusSorted: {...}}
function loadTimesForGivenHost (eventTimes, host)
{
	if (!(host in eventTimes))
		throw "Hostname " + host + " not included in eventTimes.";
	eventTimes_ = JSON.parse(JSON.stringify(eventTimes[host].c));	// Copy list of all URL's, and their data.
	var numEvents = _.keys(eventTimes_).length;

	// When the title is blank, try to find a filename and have this stand in for the title.
	for (var url in eventTimes_)
	{
		var x = eventTimes_[url];
		var urlCleaned = url.replace(/#\.*/, "")
		if (x.title == "" && /\.\w{1,5}$/.test(url)) 
		{
			x.title = url.replace(/^.*[\/|\?|\=]/, "").replace(/\%20/g, " ");
//			console.log(x.title);
		}
		else if (x.title == "" && url.replace(new RegExp("^.{0,10}" + host), "").length < 25)
		{
			x.title = url.replace(new RegExp("^.{0,10}" + host), "");
//			console.log(x.title);
		}
	}
	for (var dom in eventTimes_) {if (eventTimes_[dom].title == "") {delete eventTimes_[dom];}}

	// Find and eliminate common prefixes. ("Google Scholar - ", "The Volokh Conspiracy - ", etc.)
	var threshold = Math.sqrt(numEvents);
	var chars = {};
	var maxLength = _.max(_.map(_.values(eventTimes_), function(x) {return x.title.length;}));
	for (i in eventTimes_)
		for (var len = 5; len <= eventTimes_[i].title.length; len++)
		{
			var str = eventTimes_[i].title.substr(0, len).toLowerCase();
			chars[str] = (str in chars) ? (chars[str] + 1) : 1;
		}
	for (var str in chars)
		if (chars[str] < threshold)
			delete chars[str];
	var keys = _.keys(chars); keys.sort(function(a, b) {return b.length - a.length});
	chars = [];
	for (var i in keys)
	{
		var j = 0;
		for (j = 0; j < chars.length; j++)
			if (chars[j].substr(0, keys[i].length) == keys[i])
				break;
		if (j == chars.length)
			chars.push(keys[i]);
	}
//	print_array(chars);
	for (var i in eventTimes_)
	{
		var title = eventTimes_[i].title.toLowerCase();
		for (var j in chars)
		{
			if (title.substr(0, chars[j].length) == chars[j])
			{
				var tmp = eventTimes_[i].title.substr(chars[j].length).replace(/^\W+/, "");
				if (tmp.length > 0)
				{
					eventTimes_[i].title = tmp;	// Temporary fix
					break;
				}
			}
			else if (title.substr(0, 5) == chars[j].substr(0, 5))
			{
				var k;
				for (k = 5; k <= chars[j].length && title.substr(0, k) == chars[j].substr(0, k); k++) {}
				var tmp = eventTimes_[i].title.substr(k - 1).replace(/^\W+/, "");
				if (tmp.length > 0)
				{
					eventTimes_[i].title = tmp;	// Temporary fix
					break;
				}
			}
		}
		eventTimes_[i].title = eventTimes_[i].title.replace(/^\W+/, "");;
	}
	if (_.keys(eventTimes_).length == 0)
		throw "All events were null events, with no title or intelligible file name.";	// temporary
	
	// Merge domains with identical titles.
	var urlTitleList = _.map(_.keys(eventTimes_), function(x) {return {"url": x, "title": eventTimes_[x].title};});
	urlTitleList.sort(function(a, b) {
		if (a.title > b.title) {return 1;} else if (a.title < b.title) {return -1;} else {return 0;}});
//	print_array(urlTitleList);
	var identicalTitles = [];	// A list of pairs (or triplets, etc.) of URL's with identical titles.
	var currentIdenticalTitle = [];
	for (var i = 0; i < urlTitleList.length; i++)	// Populate list of identically-titled URL's.
	{
		currentIdenticalTitle.push(i);
		if (i == urlTitleList.length - 1 || urlTitleList[i+1].title != urlTitleList[i].title)
		{
			if (currentIdenticalTitle.length > 1)
				identicalTitles.push(currentIdenticalTitle);
			currentIdenticalTitle = [];
		}
	}
//	print_array(identicalTitles);
	for (var i in identicalTitles)	// Remove most of these url's from the eventTimes copy (save the earliest one).
	{
		var indOrig = minIndex(_.map(identicalTitles[i], function(x) {return eventTimes_[urlTitleList[x].url].t[0];}));
		indOrig = identicalTitles[i][indOrig];
		var urlOrig = urlTitleList[indOrig].url;
//		console.log(indOrig + ": Original URL: " + urlOrig + ", title: " + urlTitleList[indOrig].title);
		eventTimes_[urlOrig].alt = [];	// Alternative URL's merged into this one, due to title similarities.
		for (var j in identicalTitles[i])
		{
			var ind = identicalTitles[i][j];
			if (ind != indOrig)
			{
				var url = urlTitleList[ind].url;
//				console.log(url + " woot " + urlOrig)
//				console.log(ind + ": URL: " + url + ", title: " + urlTitleList[ind].title);
				eventTimes_[urlOrig].alt.push(url);
				eventTimes_[urlOrig].t = eventTimes_[urlOrig].t.concat(eventTimes_[url].t);
				delete eventTimes_[url];	// Remove alternative URL's from the COPY OF eventTimes.
			}
		}
		eventTimes_[urlOrig].t.sort();
		var tmp = getSequenceWeights(eventTimes_[urlOrig].t, dateEnd);
		eventTimes_[urlOrig].wt = tmp[0];
		eventTimes_[urlOrig].wts = tmp[1];
	}
	
	// Create domainList, domainInverse
	var domainList_ = [], domainInverse_ = {};
	for (var dom in eventTimes_)
	{
		var evt = eventTimes_[dom];
		domainList_.push({"url": dom, "lastVisited": evt.t[evt.t.length-1], "numVisits": evt.n, "weight": evt.wt,
			"title": evt.title})
		domainInverse_[dom] = domainList_.length - 1;
	}
	
	// Create eventTimesSorted, a list of the form [[t1, i1, w1], ..., [tN, iN, wN]].
	var eventTimesSorted_ = [];
	for (var dom in eventTimes_)
		for (var i in eventTimes_[dom].t)
			eventTimesSorted_.push([domainInverse_[dom], eventTimes_[dom].t[i], eventTimes_[dom].wts[i]])
	eventTimesSorted_.sort(function (a, b) {return a[1]-b[1];})
	//console.log("Loading eventTimesSorted: " + Tick() + " ms.");
	
	// Rather than adding to the stack with a do_next(), we just return the object.
	// We only use do_next's elsewhere because the Chrome queries are asynchronous.
	return {"domainList": domainList_, "domainInverse": domainInverse_,
		"eventTimes": eventTimes_, "eventTimesSorted": eventTimesSorted_};
}



function loadDomainEdgeList (eventTimesSorted, domainList, t2min, t2max)
{
	// Create a linked-node graph, of the form [[i1, j1, w1], [i2, j2, w2], ..., [iN, jN, wN]], where i1, ..., iN; j1, ..., jN are the nodes; and w1, ..., wN are the link weights.
	// Only weights connections with t2 > t2min (this allows the edge list to be appended to, set to 0 if unneeded).
	// Cutoff time is important.  Link weight goes as exp(-dt/tExp).
	
	var nTimes = eventTimesSorted.length;
	var nDomains = domainList.length;
	var nodeGraph1 = {};
	var adds = 0, news = 0;
	for (var i in eventTimesSorted)
	{
		var t1 = eventTimesSorted[i][1];
		var t2 = 0;
		var w1 = eventTimesSorted[i][2];
		for (var j = i; j < nTimes && (t2 = eventTimesSorted[j][1]) < t1 + tCutoff; j++)
		{
			if (t2 > t2min && t2 < t2max)
			{
				var w2 = eventTimesSorted[j][2];
				var k = w1*w2*weightFn(t2 - t1);
				var ind1 = eventTimesSorted[i][0], ind2 = eventTimesSorted[j][0];
				var index = Math.min(ind1, ind2)*nDomains + Math.max(ind1, ind2);
				if (index in nodeGraph1)
				{
					if (ind1 == ind2 && i != j)
						nodeGraph1[index] += 2*k;	// Consistent double-counting.
					else
						nodeGraph1[index] += k;
					adds++;						
				}
				else
				{
					nodeGraph1[index] = k;
					news++;						
				}
			}
		}
	}
	
	var out = [];
	
	for (var k in nodeGraph1)
	{
		out.push([Math.floor(k/nDomains), k%nDomains, nodeGraph1[k]])
	}
	
	console.log("Loading domainEdgeList: " + Tick() + " ms.");
	return out;
}

function loadDomainEdgeListS (domainEdgeList)
{
	// Construct a self-ordered SArray of the form [N1, N2, w11, w22, w12, r12], sorted on N1, N2, and r12.  This object will assist us in clustering the data. 
	var domainEdgeList2 = {};
	for (var i in domainEdgeList)
		domainEdgeList2[[domainEdgeList[i][0], domainEdgeList[i][1]]] = domainEdgeList[i][2];
	var edgesLeft = 0;
	domainEdgeListS = new SArray ([0, 1, 5], ["N1", "N2", "R"]);
	for (var i = 0; i < domainEdgeList.length; i++)
	{
		var n1, n2, w11, w22, w12;
		n1 = domainEdgeList[i][0];
		n2 = domainEdgeList[i][1];
		if (n1 == n2)
			continue;
		w11 = domainEdgeList2[[n1, n1]];
		w12 = domainEdgeList2[[n1, n2]];
		w22 = domainEdgeList2[[n2, n2]];
		domainEdgeListS.Add([n1, n2, w11, w22, w12, w12*w12/(w11*w22)]);
		edgesLeft++;
	}
	console.log("Loading domainEdgeListS: " + Tick() + " ms.");	
	return domainEdgeListS;
}

// Experimenting with different weighting functions...
var tExp1 = 1*3600*1000;
var tExp2 = 4*3600*1000;
var aExp1 = 1;
var aExp2 = 0.1;

function weightFn (dt)
{
	return aExp1 * Math.exp(-(dt)/tExp1) + aExp2 * Math.exp(-(dt)/tExp2);
//	return Math.exp(-dt/tExp);
}

// Gets the "weight" for the current event, which depends only on the time of the event, and on the time
// of the last event, via the formula:
//
// w = e^(-(tNow-tEvt) / tSizeCutoff) * [cNear + (1-cNear)*(1 - e^(-(tEvt-tPrev) / tExp))]
//
// This down-weights subsequent visits to a site within the time tExp (about 1 hour), and down-weights sites viewed a long time ago (tSizeCutoff = 30d).
function getEventWeight (tEvt, tPrev, tNow)
{
	return Math.exp((tEvt-tNow) / tSizeCutoff) * (cNear + (1-cNear)*(1 - Math.exp((tPrev-tEvt) / tExp)));
}

// Gets the weight of a sequence of visits [t1, t2, ..., tN].  Uses getEventWeight, above.
function getSequenceWeights (tList, tNow)
{
	var wt = getEventWeight (tList[0], tList[0] - 100000000000 /* = 3 yrs */, tNow);
	var wts = [wt];
	for (var i = 1; i < tList.length; i++)
	{
		var temp = getEventWeight(tList[i], tList[i-1], tNow);
		temp = Math.round(temp*1000)/1000;
		wt += temp;
		wts.push(temp);
	}
	return [wt, wts];
}

// Fisher-Yates algorithm, http://sroucheray.org/blog/2009/11/array-sort-should-not-be-used-to-shuffle-an-array/
function ArrayShuffle (a)
{
    var i = a.length, j, temp;
    if ( i == 0 ) return;
    while ( --i ) {
        j = Math.floor( Math.random() * ( i + 1 ) );
        temp = a[i];
        a[i] = a[j];
        a[j] = temp;
    }
}

function ArrayShuffleReturn (a)
{
	var b = a.slice(0);
	ArrayShuffle(b);
	return b;
}

function calculateApparentSizes (tree)
{
	tree.nodeWeight = Math.pow(tree.weight, clusterSizePowerP);
	for (var i in tree.children)
		calculateApparentSizes (tree.children[i]);
}

function print_array (x)
{
	for (var i in x)
		console.log(x[i]);
}

function minIndex (a)
{
	var min = a[0], ind = 0;
	for (var i = 1; i < a.length; i++)
		if (a[i] < min)
		{
			min = a[i];
			ind = i;
		}
	return ind;
}

function maxIndex (a)
{
	var max = a[0], ind = 0;
	for (var i = 1; i < a.length; i++)
		if (a[i] > max)
		{
			max = a[i];
			ind = i;
		}
	return ind;
}