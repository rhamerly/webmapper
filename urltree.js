// This contains a tree of all URL's visited by the user.  

// A UrlTree has no information of its own, only children.
function CreateUrlTree ()
{
	return new UrlTreeNode (null, "", "");
}

// Nodes refer to non-leaf points in the tree -- including the root.
// They have children, and do not themselves represent URL's.
function UrlTreeNode (parent, domain, path)
{
	// Relations to other nodes in the hierarchy
	this.parent = parent;
	this.children = [];
	
	// domain might be something like "scholar.google.com" for a prefix+domain or "google.com" for a domain name
	// path might be something like "/~rhamerly/index.html" or "/wiki/Alligator"
	this.domain = domain;
	this.path = path;
}

// Leaves refer to individual URL's, not groups of URL's.  They have no children.
function UrlTreeLeaf (parent, url)
{
	this.parent = parent;
	this.domain = url.host;
	this.path = url.relative;
	this.url = url;
}

UrlTreeNode.prototype.add = function (url)
{
	url2 = (typeof url == "string") ? parseUri(url) : url;
	urlLeaf = new UrlTreeLeaf(null, url2);
	
//	console.log("Processing " + url2.host + url2.relative);
	
	
	// First, see whether any of the child nodes properly contain this URL.  If so, add and return.
	for (var i in this.children)
	{
		if (this.children[i].contains(url2))
		{
			this.children[i].add(url2);
			return;
		}
	}

//	console.log("Processing " + url2.host + url2.relative);
	
	// Next, see whether any of the child nodes contain a common parent with this URL, itself within the
	// current node.  If so, add an intermediate node between the parent and the two children.
	for (var i in this.children)
	{
		var child = this.children[i];
		var ans = getCommonNode (this, child, urlLeaf)
//		console.log((ans != null ? "" : "NOT ") + "Common node: (" + this.domain + this.path + " | " + child.domain + child.path + " : " + urlLeaf.domain + urlLeaf.path + ")" + (ans != null ? (" = " + ans.domain + ans.path) : ""));
		if (ans != null)
		{
			this.children.splice(i, 1);	// Remove element i from children
			this.children.push(ans);
			child.parent = ans;
			urlLeaf.parent = ans;
			return;
		}
	}
	
	// If we fail to find any matches, we just add the url to the current node.
//	console.log("Adding URL " + url2.host + url2.relative);
	this.children.push(urlLeaf);
	urlLeaf.parent = this;
}

UrlTreeLeaf.prototype.add = function (url)
{
	return;	// Do nothing.  It's a leaf, stupid (actually, this does get called occasionally...).
}

// Returns true if this.domain is contained in url.host, and this.path is contained in url.relative
UrlTreeNode.prototype.contains = function (url)
{
	return (url.host.slice(-this.domain.length) == this.domain) && (url.relative.slice(0, this.path.length) == this.path)
}

// Returns true if this.domain is contained in url.host, and this.path is contained in url.relative
UrlTreeLeaf.prototype.contains = function (url)
{
	return (url.host == this.domain && url.relative == this.path);
}

// Let A < B if B is a more specific URL than A, i.e. www.caltech.edu/* < www.caltech.edu/admissions.php
// If A < B and A < C, try to find the most specific URL D, such that A < D and D < B, D < C.
// Here, chlid2 is the node being added.
function getCommonNode (parent, child1, child2)
{
	// Corrects a common bug.
	if ((parent.domain == child1.domain && parent.path == child1.path) || (parent.domain == child2.domain && parent.path == child2.path))
		return null;
	
	if (child1.domain != child2.domain)
	{
		// Two children differ at the domain-name level
		var domain1 = child1.domain.split(".").reverse();
		var domain2 = child2.domain.split(".").reverse();
		var domainParent = parent.domain.split(".").reverse();
		var domain3 = [];
		for (var i = 0; i < Math.min(domain1.length, domain2.length); i++)
		{
			if (domain1[i] == domain2[i])			
				domain3.push(domain1[i]);
			else
				break; 
		}
		// No such node D if the longest common domain is as long as the parent domain
		if (domain3.length <= domainParent.length)
			return null;
			
		domain3 = domain3.reverse().join(".");
		if (domain3.replace(/..\...|.../, "").length == 0)
			return null;	// This corresponds to a common suffix like ".com" or ".co.jp" -- not unique.
		var ans = new UrlTreeNode (parent, domain3, "");
		ans.children = [child1, child2];
		return ans;
	}
	else
	{
		// Two children share the same domain name, differ at the path level
		var domain = child1.domain;
		var path1 = child1.path.split(/\/|\?|\&|#/);
		var path2 = child2.path.split(/\/|\?|\&|#/);
		var pathParent = parent.path.split(/\/|\?|\&|#/);
//		console.log(path1.join("-"));
//		console.log(path2.join("-"));
//		console.log(pathParent.join("-"));
		var pathLength = 0;
		var pathElems = 0;
		for (var i = 0; i < Math.min(path1.length, path2.length); i++)
		{
			if (path1[i] == path2[i])
			{
				pathElems++;
				pathLength += (path1[i].length + 1);
			}
			else
				break; 
		}
//		console.log(pathLength + " | " + + parent.path.length + "; " + child1.path.length + ", " + child2.path.length);
//		console.log(pathElems + " | " + + pathParent.length + "; " + path1.length + ", " + path2.length);
		
		// No such node D if the longest common path is as long as the parent path
		//if (pathElems <= pathParent.length)
		//	return null;
		
		if (pathLength <= parent.path.length)
			return null;
			
		var path3 = child1.path.slice(0, pathLength);
		var ans = new UrlTreeNode (parent, domain, path3);
		ans.children = [child1, child2];
		return ans;
	}
}

function displayTree (a, n)
{
	var n2 = (n) ? n : 0;
	if (n2 == 0)
		console.log("Root");
	else
	{
		var l = ""; for (var i = 0; i < n2; i++) {l = l + ">"};
		console.log(l + a.domain + a.path);		
	}
	if (a.children != null)
		for (var i in a.children)
			displayTree(a.children[i], n2+1);
}