// This javascript file contains all the clustering functions.

var currentID = 0;

function printClusterTree (tree, indent)
{
	indent = (indent > 0) ? indent : 0;
	var strIndent = "";
	for (var i = 0; i < indent; i++)
		strIndent = strIndent + " ";
	console.log(strIndent + ">" + (tree.url.length <= 40 ? tree.url : tree.url.slice(0, 40) + "...") + " (" + tree.numVisits + ", " + tree.r12 + ")");
	if (tree.children.length > 0)
		for (var i in tree.children)
			printClusterTree(tree.children[i], indent + 1);
}

// Performs the standard rebalancing algorithm to clusterTree.
function standardTreeProcessing (tree, processing)
{
	processing = (typeof(processing) == "number") ? processing : clusterProcessing;
	
	// Construct the cluster tree...
	switch (processing)
	{
		case 0:
			// Do nothing.
			break;
		case 1:
			for (var i in tree.children)
				rebalanceClusterTree (tree.children[i], clusterNmax, clusterThreshold, false);
			break;
		case 2:
			for (var i in tree.children)
			{
				rebalanceClusterTree (tree.children[i], clusterNmax, clusterThreshold, true);
			}
			break;
		case 3:
			truncateTreeLevels (tree, clusterNmax);
			break;
		case 4:
			for (var i in tree.children)
			{
				rebalanceClusterTree (tree.children[i], clusterNmax, clusterThreshold, true);
				rebalanceClusterTree (tree.children[i], clusterNmax, 
					function(wt) {return clusterThreshold + (1 - clusterThreshold)*wt;}, false);
			}
			break;
		case 5:
			if (tree.children.length == 0)
				tree = makeTreeChild(tree);
			for (var i in tree.children)
			{
				if (tree.children[i].length == 0)
					tree.children[i] = makeTreeChild(tree.children[i]);
				rebalanceClusterTree (tree.children[i], clusterNmax, clusterThreshold, true);
				rebalanceClusterTree (tree.children[i], clusterNmax, 
					function(wt) {return clusterThreshold + (1 - clusterThreshold)*wt;}, false);
				truncateTreeLevels (tree.children[i], clusterNmax);
			}
			break;
	}

	// Sets nodeWeight, which controls how large objects appear on the screen.
	calculateApparentSizes (tree);
	
	// Sets colors, an array of color indexes.
	tree.colors = d3.range(tree.children.length);
}

function rebalanceClusterTree (tree, nMax, rMax, recursive)
{
	if (!(recursive == true))
		recursive = false;
	if (tree.children.length == 0)
		return;	// Don't rebalance nodes without children.
	
	if (typeof rMax == "number")
		r = function (wt) {return tree.r12 + rMax};	// Pull up all children with r_child < r_root + rMax
	else
		r = function (wt) {return tree.r12 + rMax(wt)};	// Pull up all children with r_child < r_root + rMax
	
	// Rebalance the top node first.
	while (true)
	{
		var i = -1;	// Pull up all children with r_child < r_root + rMax
		for (var testInd in tree.children)	// Find the best child node to "pull up".
		{
			var child = tree.children[testInd];
			if (child.children.length > 0 && child.r12 < r(child.weight / tree.weight))
			{
				i = testInd;
				break;
			}
		}
		if (i > -1)	// Add the preferred child node's children to the parent node.
		{
//			tree.r12 = Math.min(tree.r12, r);
			var addNodes = tree.children[i].children;
			tree.children.splice(i, 1);
			tree.children = tree.children.concat(addNodes);
			tree.children.sort(function(a, b) {return a.weight - b.weight;});
		}
		else
			break;	// No more nodes to drag in!
	}
	
	// Reorder and group child nodes if there are more than you want.
	if (tree.children.length > nMax)
	{
		var m = tree.children.length;
		var k = Math.ceil((m - nMax)/(nMax - 1));
		var numRemove = Math.min(m, m - (nMax - k));
		var smallestChildren = tree.children.splice(0, numRemove);	// Removes them from tree[4], returns removed elements
		ArrayShuffle(smallestChildren);
		var newChildren = [];newChildrenLists = [], sizeLists = [];
		for (var i = 0; i < k; i++)				// Create a list of new child nodes.
		{
			// [size, title, url/id, r12, [child1, child2]]
			newChildren.push({"numVisits": 0, "title": "", "url": 0, "r12": 0, "children": [], "w11": 0, "id": currentID});
			currentID++;
		}
		for (var i = 0; i < numRemove; i++)		// Fill in the node properties.
		{
			newChildren[i % k].numVisits += smallestChildren[i].numVisits;
			newChildren[i % k].weight += smallestChildren[i].weight;
			newChildren[i % k].w11 += smallestChildren[i].w11;
//			newChildren[i % k][1] = "";		// TO BE COMPLETED.
			newChildren[i % k].children.push(smallestChildren[i]);
		}
		for (var i = 0; i < k; i++)				// Update the parent node and clusterParentList.
		{
			// [parent, child1, child2, numVisits, r12]
			var id = clusterParentList.length;
			clusterParentList.push([id, -1, -1, newChildren[i].numVisits, 0]);
			tree.children.push(newChildren[i]);
		}
	}
	
	// Then rebalance the child nodes.
	if (recursive)
	{
		if (tree.children[0] != -1)
			for (var i in tree.children)
				rebalanceClusterTree (tree.children[i], nMax, rMax, recursive);
	}
	weightClusterTree(tree);
}

function weightClusterTree (tree)
{
	// Assign weights to a cluster tree.
	if (tree.children.length == 0)
	{
		if (tree.weight && tree.numVisits)
		{
			if (isNaN(tree.weight) || isNaN(tree.numVisits))
				throw "Weight " + tree.weight + ", numVisits " + tree.numVisits + ", in " + tree.id + ", " + tree.url;
			
			tree.nodeWeight = Math.pow(tree.weight, clusterSizePowerP);
			return [tree.numVisits, tree.weight];			
		}
		else
			throw "Found leaf node with no weight set: " + tree.id + ", " + tree.url;
	}
	else
	{
		var numVisits = 0;
		var wt = 0;
		for (var i in tree.children)
		{
			var temp = weightClusterTree(tree.children[i]);
			numVisits += temp[0];
			wt += temp[1];
		}
		tree.weight = wt;
		tree.numVisits = numVisits;
		if (isNaN(tree.weight) || isNaN(tree.numVisits))
			throw "Weight " + tree.weight + ", numVisits " + tree.numVisits + ", in " + tree.id + ", " + tree.url;
		tree.nodeWeight = Math.pow(tree.weight, clusterSizePowerP);
		return [numVisits, wt];
	}
}

// "Bottom-up" clustering algorithm, which works as follows:
// 1.	Take the highest-ranking pair (a, b) in domainEdgeListS.
//		  (a) Define a new object "c", to be the parent to (a, b).
//		  (b) If cluster is too big (wt_c > debugMaxClusterWeight(r_ab)), skip this cluster & repeat
//		  (c) Add an entry to clusterParentList: [c, a, b].
// 2.	If cluster is not too big, find all rows of domainEdgeListS containing either a or b.
//		For each row, 
//		  (a) remove from the array,
//		  (b) replace a -> c, b -> c,
//		  (c) update w's: w_aa -> w_cc = w_aa + w_bb + 2w_ab; w_az -> w_cz = w_az + w_bz; update r12
//		  (d) add back to list
// 3.	Repeat until all links gone!
function formTree (domainList_int, domainEdgeList_int, domainEdgeListS_int)
{
	domainList_int = domainList_int ? domainList_int : domainList;
	domainEdgeList_int = domainEdgeList_int ? domainEdgeList_int : domainEdgeList;
	domainEdgeListS_int = domainEdgeListS_int ? domainEdgeListS_int : domainEdgeListS;
	
	var edgesLeft = domainEdgeListS_int.GetAvlTree(0).getCount();
	var firstChildren = {};	// Top-level children of the cluster tree.
	var sumWeight = 0;
	var w11List = [];	// List of elements w_ii for all domains.	
	clusterParentList = [];
	
	for (var i in domainEdgeList_int)
		if (domainEdgeList_int[i][0] == domainEdgeList_int[i][1])
		{
			if (!isNaN(domainEdgeList_int[i][2]))
				w11List.push(domainEdgeList_int[i][2]);
			else
				throw "You firetruck " + i + ", " + domainEdgeList_int[i][2];			
		}
	
	for (var c = 0; c < domainList_int.length; c++)
	{
		var dom = domainList_int[c];
		var cElem = {"numVisits": dom.numVisits,
			"title": dom.title,
			"id": c,
			"url": dom.url,
			"r12": 0,
			"w11": w11List[c],
			"children": [],
			"keyword_hashtable": dom.keyword_hashtable,
			"icon_url": dom.icon_url,
			"weight": Math.pow(dom.weight, clusterSizePowerQ)};
		currentID = c + 1;
		clusterParentList.push(cElem);
		sumWeight += clusterParentList[c].weight;
		firstChildren[c] = true;		// Originally, all sites are "top children".
	}
	for (var c = domainList_int.length; edgesLeft > 0; )
	{
		// Step 1
		// (a) -- define "c" as the parent of a and b
		var topElem = domainEdgeListS_int.GetAvlTree("R").getMaximum();
		domainEdgeListS_int.Remove(topElem); edgesLeft--;
		var a = topElem[0], b = topElem[1];
		var waa = topElem[2], wbb = topElem[3], wab = topElem[4];
		var wcc = waa + wbb + 2*wab;
		var cElem = {"numVisits": clusterParentList[a].numVisits + clusterParentList[b].numVisits,
			"title": "",
			"url": "",
			"id": c,
			"r12": topElem[5],
			"w11": wcc,
			"children": [clusterParentList[a], clusterParentList[b]],
			"keyword_hashtable": null,
			"icon_url": "",
			"weight": clusterParentList[a].weight + clusterParentList[b].weight};
		currentID = c + 1;
		// (b) -- skip clusters c that are too big
		if (cElem.weight / sumWeight > debugMaxClusterWeight(cElem.r12))
		{
//			console.log("> Cluster " + cElem.id + " has weight " + cElem.weight + ", r = " + cElem.r12);
			continue;	// Return to loop.  We have already removed the a-b edge.
		}
		else
		{
			delete firstChildren[a];
			delete firstChildren[b];
			firstChildren[c] = true;
		}
		// (c) -- add to clusterParentList
		clusterParentList.push(cElem);
//				console.log("Nodes [" + clusterParentList[a][0] + "/" + clusterParentList[a][3] + "], [" + clusterParentList[b][0] + "/" + clusterParentList[b][3] + "] combining to form " + c);
		
		
		// Step 2
		if (edgesLeft > 0)
		{
			var zPairs = domainEdgeListS_int.Filter("N1", a)
				.concat(domainEdgeListS_int.Filter("N1", b))
				.concat(domainEdgeListS_int.Filter("N2", a))
				.concat(domainEdgeListS_int.Filter("N2", b));
//					console.log(zPairs.length + " matching pairs.");
			var zValues = {};
			for (var i = 0; i < zPairs.length; i++)
			{
				// Step 2(a)
				if (!domainEdgeListS_int.Contains(zPairs[i]))
					continue;
				domainEdgeListS_int.Remove(zPairs[i]); edgesLeft--;
				var xz = zPairs[i], yz;
//					console.log("> Pair " + i + " of " + zPairs.length + ": " + xz);
				var z, x, y;	// Here "z" is any other index, excepting a or b.  If it's a pair (a, z), x = a; y = b.  If (b, z), x = b; y = a.
				var wzz, wcz;	// We already know w_xz.  We need to run an extra query to get w_yz.
				var xFirst = (zPairs[i][0] == a || zPairs[i][0] == b);
				wzz = xFirst ? xz[3] : xz[2];
				z = xFirst ? xz[1] : xz[0]; 
				if (z == a || z == b || z in zValues)	
					continue;		// Addresses the following situation: Both (a, z) and (b, z) are present.
				else				// We only want one final (c, z).  Or: z = a or b.
					zValues[z] = 0;
				var xa = (zPairs[i][0] == a || zPairs[i][1] == a);
				x = xa ? a : b;
				y = xa ? b : a;
				// Step 2(b)
				xz[xFirst ? 0 : 1] = c;
//						if (edgesLeft < 10) {console.log("EL = " + edgesLeft + ", " + domainEdgeListS.ToArray(0).length);}
				yz = (edgesLeft == 0 ? null : domainEdgeListS_int.Lookup(0, [Math.min(y, z), Math.max(y, z), 0, 0, 0, 0]));
//						if (edgesLeft < 10) {console.log("ELL");}
				// Step 2(c)
				if (yz != null && yz[0] == Math.min(y, z) && yz[1] == Math.max(y, z))
				{
//						console.log("> Counterpair " + yz);
					wcz = xz[4] + yz[4];	// w_cz = w_xz + w_yz
					domainEdgeListS_int.Remove(yz); edgesLeft--;
				}
				else
				{
//						console.log("> No Counterpair");
					wcz = xz[4];	// No y-z connection, so w_yz = 0.
				}
				var zFirst = (z < c);
				// Step 2(d)
				var cz = zFirst ? [z, c, wzz, wcc, wcz, wcz*wcz/(wzz*wcc)] : 
					[c, z, wcc, wzz, wcz, wcz*wcz/(wzz*wcc)];
//					console.log("> Merged Pair " + cz);
				domainEdgeListS_int.Add(cz); edgesLeft++;
			}
		}
		else
		{
					
		}
		
		// Step 3
		c++;	// woot
	}
	
	while (true)
	{
		var n1 = _.min(_.keys(firstChildren), function(x) {return clusterParentList[x].weight;});
//		console.log("n1 = " + n1 + ", " + clusterParentList[n1].weight);
		if (clusterParentList[n1].weight / sumWeight < 1/(2*clusterNmax) && _.keys(firstChildren).length > 2)
		{
			delete firstChildren[n1];
			var n2 = _.min(_.keys(firstChildren), function(x) {return clusterParentList[x].weight;});
//			console.log("n2 = " + n2 + ", " + clusterParentList[n2].weight);
			delete firstChildren[n2];
			var n3 = clusterParentList.length;
			var child1 = clusterParentList[n1].children.length > 0 ? clusterParentList[n1].children :
				 [clusterParentList[n1]];
 			var child2 = clusterParentList[n2].children.length > 0 ? clusterParentList[n2].children :
 				 [clusterParentList[n2]];
			var cElem = {"numVisits": clusterParentList[n1].numVisits + clusterParentList[n2].numVisits,
				"title": "",
				"url": "",
				"id": n3,
				"r12": Math.min(clusterParentList[n1].r12, clusterParentList[n2].r12),
				"w11": clusterParentList[n1].w11 + clusterParentList[n2].w11,
				"children": child1.concat(child2),
				"keyword_hashtable": null,
				"icon_url": "",
				"weight": clusterParentList[n1].weight + clusterParentList[n2].weight};
			currentID = n3 + 1;
			firstChildren[n3] = true;
			clusterParentList.push(cElem);
//			console.log("n3 = " + n3 + ", " + clusterParentList[n3].weight);
			
		}
		else
		{
			break;
		}
	}

	var clusterTree_int = {"numVisits": 0, "title": "root", "url": "", "id": -1, "r12": 0, "children": [],
			"keyword_hashtable": null, "icon_url": "", "weight": 0, "w11": 0};
	for (var c in firstChildren)
	{
		var elem = clusterParentList[c];
		clusterTree_int.children.push(elem);
		clusterTree_int.numVisits += elem.numVisits;
		clusterTree_int.weight += elem.weight;
//		console.log("First child: " + elem.id + ", wt = " + elem.weight + ", r = " + elem.r12);
	}

	orderTree (clusterTree_int);
	clusterTree_int.colors = d3.range(clusterTree_int.children.length);
	
	return clusterTree_int;
}

function makeTreeChild (tree)
{
	return {"numVisits": tree.numVisits,
			"title": tree.title,
			"id": currentID++,
			"url": tree.url,
			"r12": tree.r12,
			"w11": tree.w11,
			"children": [tree],
			"keyword_hashtable": tree.keyword_hashtable,
			"icon_url": tree.icon_url,
			"weight": tree.weight}
}

function orderTree (tree)
{
	if (tree.children.length > 0)
	{
		tree.children = tree.children.sort(function(a, b) {return b.weight - a.weight;});
		for (var i in tree.children)
			orderTree(tree.children[i]);
	}
}

function truncateTreeLevels (tree, nMax)
{
	if (tree.children.length == 0)
		return;
	for (var i in tree.children)
	{
		var child = tree.children[i];
		if (child.children.length == 0)
		{
			tree.children[i] = {"numVisits": child.numVisits, "title": "", "url": child.url, "r12": child.r12, "children": [child], "keyword_hashtable": child.keyword_hashtable, "icon_url": child.icon_url, "w11": child.w11, "id": currentID};
			continue;
		}
		currentID++;
		var leaves = getLeaves(child);
		leaves.sort(function (a, b) {return a.weight - b.weight;});
		if (leaves.length > nMax)
			leaves.splice(0, leaves.length - nMax);
		tree.children[i].children = leaves;
	}
	weightClusterTree(tree);
}

function getLeaves (tree)
{
	if (tree.children.length == 0)
		return [tree];
	else
	{
		var leaves = [];
		for (var i in tree.children)
			leaves = leaves.concat(getLeaves(tree.children[i]));
		return leaves;
	}
}

function getLeafByUrl (tree, url)
{
	if (tree.children.length == 0)
	{
		if (tree.url == url)
			return tree;
		else
			return null;
	}
	for (var i in tree.children)
	{
		var l = getLeafByUrl(tree.children[i], url);
		if (l != null)
			return l;
	}
	return null;
}

function checkTree (tree, depth)
{
	depth = depth ? depth : [];
	if (!(tree.nodeWeight > 0))
		throw ("CheckTree Error at node [" + depth + "]: nodeWeight not positive");
	if (!(tree.weight > 0))
		throw ("CheckTree Error at node [" + depth + "]: weight not positive");
	if (!(tree.numVisits > 0))
		throw ("CheckTree Error at node [" + depth + "]: numVisits not positive");

	for (var i in tree.children)
		checkTree (tree.children[i], depth.concat([i]));
}

function createNodeKeywordTables (tree)
{
	if (tree.keyword_hashtable == null)
	{
		for (var i in tree.children)
			createNodeKeywordTables (tree.children[i]);
		tree.keyword_hashtable = new StringHashtable ();
		for (var i in tree.children)
			for (var j in tree.children[i].keyword_hashtable.occurrenceList)
			{
				if (j in tree.keyword_hashtable.occurrenceList)
					tree.keyword_hashtable.occurrenceList[j] += tree.children[i].keyword_hashtable.occurrenceList[j];
				else
					tree.keyword_hashtable.occurrenceList[j] = tree.children[i].keyword_hashtable.occurrenceList[j];
			}
	}
}

// Apply a function f to a tree and all its children, recursively (the tree first, then its children).
function applyToTree (tree, f, path)
{
	path = path ? path : [];
	f(tree, path);	//f(tree, f);
	for (var i = 0; i < tree.children.length; i++)
		applyToTree(tree.children[i], f, path.concat([i]));
}

function applyToTreeLeaves (tree, f, path)
{
	path = path ? path : [];
	if (tree.children.length == 0)
		f(tree, path);	//f(tree, f);
	else
		for (var i = 0; i < tree.children.length; i++)
			applyToTreeLeaves(tree.children[i], f, path.concat([i]));
}

// Gets the tree node at a given path = [i1, i2, ..., in], equal to tree.children[i1].children[i2]...children[in]
function getTreeNode (tree, path, i)
{
	i = i ? i : 0;
	if (path.length == 0)
		return tree;
	var child = tree.children[path[0]];
	if (child)
		child = getTreeNode (child, path.slice(1), i + 1);
	if ((child != undefined && child != null) || i > 0)	
		return child;
	else
		throw "Tree does not have node at path [" + path + "].";
}