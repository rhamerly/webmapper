// Converts it into a format suitable for the draw_treemap script, below.
function treemap_format (tree)
{
	if (tree.children.length == 0)
	{
		return {"name": tree.url.replace("www.", ""), "size": Math.pow(tree.weight, clusterSizePowerP), "realsize": tree.numVisits, "weight": tree.weight};
	}
	else
	{
		var children = [];
		for (var i in tree.children)
			children.push(treemap_format (tree.children[i]));
		return {"name": tree.id+"", "children": children, "realsize": tree.numVisits, "weight": tree.weight, "r12": tree.r12};
	}
}

function draw_treemap (root)
{
	// Copied verbatim from http://bl.ocks.org/4063582.  For testing purposes.
	var margin = {top: 40, right: 10, bottom: 10, left: 10},
	    width = 960 - margin.left - margin.right,
	    height = 500 - margin.top - margin.bottom;

	var color = d3.scale.category20c();

	var treemap = d3.layout.treemap()
	    .size([width, height])
	    .sticky(true)
	    .value(function(d) { return d.size; });

	var div = d3.select("body").append("div")
	    .style("position", "relative")
	    .style("width", (width + margin.left + margin.right) + "px")
	    .style("height", (height + margin.top + margin.bottom) + "px")
	    .style("left", margin.left + "px")
	    .style("top", margin.top + "px");

	var node = div.datum(root).selectAll(".node")
		.data(treemap.nodes)
	.enter().append("div")
	 	.attr("class", "node")
	 	.call(position)
	 	.style("background", function(d) { return d.children ? color(d.name) : null; })
	 	.text(function(d) { return d.children ? null : d.name; });

	d3.selectAll("input").on("change", function change()
	{
	    var value = this.value === "count"
	        ? function() { return 1; }
	        : function(d) { return d.size; };

   		node
	        .data(treemap.value(value).nodes)
        	.transition()
        	.duration(1500)
        	.call(position);
	});
}

// Also from the D3 examples repository.
// http://bl.ocks.org/4063530
function draw_circlemap (root)
{
	var diameter = 960,
	    format = d3.format(",d");

	var pack = d3.layout.pack()
	    .size([diameter - 4, diameter - 4])
	    .value(function(d) { return d.size; });

	var svg = d3.select("body").append("svg")
	    .attr("width", diameter)
	    .attr("height", diameter)
	  .append("g")
	    .attr("transform", "translate(2,2)");

	  var node = svg.datum(root).selectAll(".node")
	      .data(pack.nodes)
	    .enter().append("g")
	      .attr("class", function(d) { return d.children ? "node" : "leaf node"; })
	      .attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; });

/*	  node.append("title")
	      .text(function(d) {return d.name + ", n = " + (d.children ? clusterParentList[d.name][0] : d.realsize) + (d.children ? ", w = " + clusterParentList[d.name][4] : ""); });*/
	  node.append("title")
  	      .text(function(d) {if (d.name == "root")
			  return "root";
		  else if (d.children)
			  return d.name + ", n = " + d.realsize + ", wt = " + d.weight + ", r12 = " + d.r12;
		  else
			  return d.name + ", n = " + d.realsize + ", wt = " + d.weight;
	   });
	  node.append("circle")
	      .attr("r", function(d) { return d.r; })
		  .attr("fill-opacity", function(d) {return d.children ? d.r12 : 1;});

	  node.filter(function(d) { return !d.children; }).append("text")
	      .attr("dy", ".3em")
	      .style("font", "8px sans-serif")
	      .style("text-anchor", "middle")
	      .text(function(d) { return d.name.substring(0, d.r / 3); });

	d3.select(self.frameElement).style("height", diameter + "px");
}

function debug_display ()
{
	// Style correction.
	document.body.style.backgroundColor = "white";
	
	//draw_treemap(treemap_format(clusterTree));
	draw_circlemap(treemap_format(clusterTree));	
}


function position()
{
  this.style("left", function(d) { return d.x + "px"; })
      .style("top", function(d) { return d.y + "px"; })
      .style("width", function(d) { return Math.max(0, d.dx - 1) + "px"; })
      .style("height", function(d) { return Math.max(0, d.dy - 1) + "px"; });	
}