var lastColor = 0;
var isColorPickerBar = false;
var isSubcolorPickerBar = false;
var isLookbackPickerBar = false;
var isHelpBar = false;
var saveShading = 0, lastShading = 0;

var colorPicker_size = 22;
var colorPicker_button = 29;

var colorPickerTessellation = null;

function createColorPickerIcon (div, color)
{
	var svg = div.select("svg");
	if (svg[0][0] == null)
		svg = div.append("svg");
	svg.attr("width", colorPicker_size).attr("height", colorPicker_size);
	svg.attr("padding", "0px").attr("margin", "0px");
	var x1 = 2, x2 = colorPicker_size / 2, x3 = colorPicker_size - 2;
	var polys = [[[x1,x1],[x1,x2],[x2,x2],[x2,x1]],
		[[x1,x2],[x1,x3],[x2,x3],[x2,x2]],
		[[x2,x1],[x2,x2],[x3,x2],[x3,x1]],
		[[x2,x2],[x2,x3],[x3,x3],[x3,x2]]];
	var data = [];
	for (var i = 0; i < 4; i++)
		data.push({"points": _.map(polys[i], function(x) {return x.join(",")}).join(" "), "color": d3.rgb(color.poly(i)).darker(0.25).toString()});
	var polys = svg.selectAll("polygon").data(data);
	polys.enter().append("polygon");
	polys.attr("points", function(d) {return d.points})
		.attr("stroke", "white")
		.attr("stroke-width", 2)
		.attr("fill", function (d) {return d.color});
		
}

function createColorPickerBar ()
{
	if (isColorPickerBar)
		return;
	
	var posX = d3.select("#colorbutton").style("left");
	posX = parseInt(posX.slice(0, posX.length - 2)) - colorPicker_button * 5/2;
	var posY = d3.select("#colorbutton").style("top");
	posY = parseInt(posY.slice(0, posY.length - 2)) + colorPicker_button + 3;
	
	var box = d3.select("#colorpicker");
	box.selectAll("div").remove();
	box.style("position", "absolute")
		.style("left", posX + "px")
		.style("top", posY + "px")
		.style("display", "block")
		.style("padding", "0px 0px 0px 0px")
		.style("opacity", "0.0")
		.transition().duration(200)
		.style("opacity", "0.93");
	document.getElementById("colorbutton").classList.remove("toolbutton");
	document.getElementById("colorbutton").classList.add("toolbutton-active");

	var buttons = [];
	for (var i = 0; i < 6; i++)
	{
		buttons[i] = box.append("div")
			.attr("id", "colorpicker" + i)
		createColorPickerIcon (buttons[i], colorList[i]);
		if (i == selectedColor)
			document.getElementById("colorpicker" + i).classList.add("toolbutton-selected");
 		else
			document.getElementById("colorpicker" + i).classList.add("toolbutton-unselected");
		buttons[i].on("mousemove", setColor(i, 200, false));
		buttons[i].on("click", setColor(i, 100, true));
	}
	setTimeout (function () {d3.select(document).on("click.colorpicker", removeColorPickerBar)}, 10);
	isColorPickerBar = true;
}

function removeColorPickerBar ()
{
	d3.select("#colorpicker").transition().duration(200).style("opacity", 0.0).each("end", function ()
	{
		d3.select("#colorpicker").selectAll("div").remove();
	});
	d3.select(document).on("click.colorpicker", null);
	document.getElementById("colorbutton").classList.remove("toolbutton-active");
	document.getElementById("colorbutton").classList.add("toolbutton");
//	console.log(selectedColor);
	setColor(selectedColor, 200, true)();
	isColorPickerBar = false;
}

function setColor (i, delay, set)
{
	return function ()
	{
		if (i != lastColor)
		{
//			console.log("Set (" + set + ") color to " + i);
			color = colorList[i];
			textColor = colorList[i].text;
			treemap.recolor(treemap.colors, delay);
			if (treemap_bubble != null)
				treemap_bubble.recolor(treemap_bubble.colors, delay);
			lastColor = i;			
		}
		if (set)
		{
			selectedColor = i;
			chrome.storage.local.set({"selectedColor": selectedColor});
			createColorPickerIcon (d3.select("#colorbutton"), colorList[selectedColor]);
			createSubcolorPickerIcon (d3.select("#subcolorbutton"), selectedShading);
		}
	}
}

function setColorsAndToolbars ()
{
	colorPastel = {"poly": d3.scale.category20(), "text": "#ffffff"}; 	// Standard D3 colors.
	for (var i = 0; i < 20; i++)
		colorPastel.poly(i);
	waterColors = ["#1A5D7F", "#187263", "#188396", "#0FA8AA", "#14799E"];	// Blue hues.
	for(var i = 0; i < 4; i++)
		for(var j = 0; j < 5; j++)
			waterColors.push(d3.rgb(waterColors[j]).brighter(i*0.65+1).toString());
	colorWater = {"poly": function(i) {return waterColors[i%waterColors.length];}, "text": "#ffffff"};
	fireColors = [];	// Fire colors.
/*	for (var i = 0; i < 101; i++)
	{
		var fireInd = (i * 39 % 100) * 1.0 / 100 + 1.0;
		if (fireInd < 1)
			fireColors.push(d3.rgb(Math.round(255*fireInd), 0, 0).toString());
		else if (fireInd < 2)
			fireColors.push(d3.rgb(Math.round(128 + 127*(2-fireInd)), Math.round(128*(fireInd-1)), 0).toString());
//		else
//			fireColors.push(d3.rgb(255, 255, Math.round(255*(fireInd-2)))).toString();
	}*/
	// See http://www.colorcombos.com/color-schemes/421/ColorCombo421.html
	fireColors = ["#EC633F", "#E44D2E", "#EC6C3F", "#F9D654", "#F3D8BD"];	
	for(var i = 0; i < 4; i++)
		for(var j = 0; j < 5; j++)
			fireColors.push(d3.rgb(fireColors[j]).brighter(i*0.45-1.5).toString());
	colorFire = {"poly": function(i) {return fireColors[i%fireColors.length];}, "text": "#ffffff"};
	// http://www.colorcombos.com/color-schemes/419/ColorCombo419.html
	colors3 = ["#d9ccb9", "#df7782", "#e95d22", "#017890", "#613d2d"];
	for(var i = 0; i < 4; i++)
		for(var j = 0; j < 5; j++)
			colors3.push(d3.rgb(colors3[j]).brighter(i*0.45-1.5).toString());
	color3 = {"poly": function(i) {return colors3[i%colors3.length];}, "text": "#ffffff"};
	// http://www.colorcombos.com/color-schemes/418/ColorCombo418.html
	colors4 = ["#2f2f2f", "#ccb647", "#d6dee4", "#ce7898", "#98c5ab"];
	for(var i = 0; i < 4; i++)
		for(var j = 0; j < 5; j++)
			colors4.push(d3.rgb(colors4[j]).brighter(i*0.45-1.5).toString());
	color4 = {"poly": function(i) {return colors4[i%colors4.length];}, "text": "#ffffff"};
	// http://www.colorcombos.com/color-schemes/422/ColorCombo422.html	
	colors5 = ["#ad7460", "#88382d", "#a84a5c", "#d6a354", /*"#f5d4bc"*/ "#68463a"];
	for(var i = 0; i < 4; i++)
		for(var j = 0; j < 5; j++)
			colors5.push(d3.rgb(colors5[j]).brighter(i*0.45-0.0).toString());
	color5 = {"poly": function(i) {return colors5[i%colors5.length];}, "text": "#ffffff"};
	// http://www.colorcombos.com/color-schemes/420/ColorCombo420.html
	colors6 = ["#397249", "#628b61", "#9cb770", "#c7e1ba", "#f3d5bd"];
	for(var i = 0; i < 4; i++)
		for(var j = 0; j < 5; j++)
			colors6.push(d3.rgb(colors6[j]).brighter(i*0.45-1.5).toString());
	color6 = {"poly": function(i) {return colors6[i%colors6.length];}, "text": "#ffffff"};
	// http://www.colorcombos.com/color-schemes/184/ColorCombo184.html
	colors7 = ["#cccfbc", "#a37b45", "#86942a", "#507642"];
	for(var i = 0; i < 5; i++)
		for(var j = 0; j < 4; j++)
			colors7.push(d3.rgb(colors7[j]).brighter(i*0.35-1.5).toString());
	color7 = {"poly": function(i) {return colors7[i%colors7.length];}, "text": "#ffffff"};
	// http://www.colorcombos.com/color-schemes/178/ColorCombo178.html
	colors8 = ["#ef597b", "#ff6d31", "#73b66b", "#ffcb18", "#29a2c6"];
	for(var i = 0; i < 4; i++)
		for(var j = 0; j < 5; j++)
			colors8.push(d3.rgb(colors8[j]).brighter(i*0.45-1.5).toString());
	color8 = {"poly": function(i) {return colors8[i%colors8.length];}, "text": "#ffffff"};
	
	color0 = colorPastel; color1 = colorWater; color2 = colorFire;
	
	colorList = [color0, color1, color3, color5, color7, color8];
	color = colorList[selectedColor];
	
	createColorPickerIcon (d3.select("#colorbutton"), colorList[selectedColor]);
	createSubcolorPickerIcon (d3.select("#subcolorbutton"), selectedShading);
	d3.select("#colorbutton").on("click", createColorPickerBar);	
	d3.select("#subcolorbutton").on("click", createSubcolorPickerBar);	
	d3.select("#lookbackbutton").on("click", createLookbackPickerBar);	
	d3.select("#lookbackbutton-text").html(lookback + "d");
	d3.select("#refreshbutton").on("click", function ()
	{
		if (!isColorPickerBar && !isSubcolorPickerBar && !isLookbackPickerBar)
			setLookback (lookback)();
	})
	d3.select("#helpbutton").on("click", createHelpBar)
}

function createSubcolorPickerIcon (div, amt)
{
	var svg = div.select("svg");
	if (svg[0][0] == null)
		svg = div.append("svg");
	svg.attr("width", colorPicker_size).attr("height", colorPicker_size);
	svg.attr("padding", "0px").attr("margin", "0px");
	var x1 = 2, x2 = colorPicker_size - 2;
	var rect = [[x1, x1], [x2, x1], [x2, x2], [x1, x2]];
	if (colorPickerTessellation == null)
		colorPickerTessellation = tessellateCentroidal (_.map(d3.range(20), function (i) {
		return {"center": [x1+(x2-x1)*Math.random(), x1+(x2-x1)*Math.random()], "nodeWeight": Math.pow((i+1), 1)}}),
		rect, {"newCenters": true});
	var data = [rect].concat(_.map(colorPickerTessellation, function(x) {return x.polygon}));	
	var polys = svg.selectAll("polygon").data(data);
	polys.enter().append("polygon");
	var c = color.poly(0);
	polys.attr("points", function(d) {return _.map(d, function(x) {return x.join(",")}).join(" ")})
		.attr("stroke", "white")
		.attr("stroke-width", function(d, i) {return (i > 0 ? 0.5 : 2)})
		.attr("fill", function (d, i) {return d3.rgb(c).darker(0.02 * amt * ((37*i) % 100)).toString();});
	polys.exit().remove();
}

function createSubcolorPickerBar ()
{
	if (isSubcolorPickerBar)
		return;
	
	var posX = d3.select("#subcolorbutton").style("left");
	posX = parseInt(posX.slice(0, posX.length - 2)) - colorPicker_button * 3/2;
	var posY = d3.select("#subcolorbutton").style("top");
	posY = parseInt(posY.slice(0, posY.length - 2)) + colorPicker_button + 3;
	
	var box = d3.select("#subcolorpicker");
	box.selectAll("div").remove();
	box.style("position", "absolute")
		.style("left", posX + "px")
		.style("top", posY + "px")
		.style("display", "block")
		.style("padding", "0px 0px 0px 0px")
		.style("opacity", "0.0")
		.transition().duration(200)
		.style("opacity", "0.93");
	document.getElementById("subcolorbutton").classList.remove("toolbutton");
	document.getElementById("subcolorbutton").classList.add("toolbutton-active");

	var buttons = [];
	var amtList = [0.0, 0.5, 1.0, 1.5];
	for (var i = 0; i < 4; i++)
	{
		buttons[i] = box.append("div")
			.attr("id", "subcolorpicker" + i)
		createSubcolorPickerIcon (buttons[i], amtList[i]);
		if (amtList[i] == selectedShading)
			document.getElementById("subcolorpicker" + i).classList.add("toolbutton-selected");
 		else
			document.getElementById("subcolorpicker" + i).classList.add("toolbutton-unselected");
		buttons[i].on("mousemove", setSubcolor(amtList[i], 200, false));
		buttons[i].on("click", setSubcolor(amtList[i], 100, true));
	}
	setTimeout (function () {d3.select(document).on("click.subcolorpicker", removeSubcolorPickerBar)}, 10);
	isSubcolorPickerBar = true;
	saveShading = selectedShading;
}

function removeSubcolorPickerBar ()
{
	d3.select("#subcolorpicker").transition().duration(200).style("opacity", 0.0).each("end", function ()
	{
		d3.select("#subcolorpicker").selectAll("div").remove();
	});
	d3.select(document).on("click.subcolorpicker", null);
	document.getElementById("subcolorbutton").classList.remove("toolbutton-active");
	document.getElementById("subcolorbutton").classList.add("toolbutton");
//	console.log(selectedColor);
	setSubcolor(saveShading, 200, true)();
	isSubcolorPickerBar = false;
}

function setSubcolor (i, delay, set)
{
	return function ()
	{
		if (i != lastShading)
		{
//			console.log("Set (" + set + ") color to " + i);
			selectedShading = i;
			treemap.recolor(treemap.colors, delay);
			if (treemap_bubble != null)
				treemap_bubble.recolor(treemap_bubble.colors, delay);
			lastShading = i;
		}
		if (set)
		{
			selectedShading = i;
			saveShading = i;
			chrome.storage.local.set({"selectedShading": selectedShading});
			createSubcolorPickerIcon (d3.select("#subcolorbutton"), selectedShading);
		}
	}
}


function createLookbackPickerBar ()
{
	if (isLookbackPickerBar)
		return;
	
	var posX = d3.select("#lookbackbutton").style("left");
	posX = parseInt(posX.slice(0, posX.length - 2));
	var posY = d3.select("#lookbackbutton").style("top");
	posY = parseInt(posY.slice(0, posY.length - 2)) + colorPicker_button + 3;
	
	var box = d3.select("#lookbackpicker");
	box.selectAll("div").remove();
	box.style("position", "absolute")
		.style("left", posX + "px")
		.style("top", posY + "px")
		.style("display", "block")
		.style("padding", "0px 0px 0px 0px")
		.style("opacity", "0.0")
		.transition().duration(200)
		.style("opacity", "0.93");
	document.getElementById("lookbackbutton").classList.remove("toolbutton");
	document.getElementById("lookbackbutton").classList.add("toolbutton-active");

	var buttons = [];
	var lookbackList = [10, 15, 20, 30, 50, 100];
	for (var i = 0; i < 6; i++)
	{
		buttons[i] = box.append("div")
			.attr("id", "lookbackpicker" + i)
			.style("float", "none")
			.style("width", "51px")
			.style("text-align", "left")
			.html(lookbackList[i] + "d");
		if (lookbackList[i] == lookback)
		{
			document.getElementById("lookbackpicker" + i).classList.add("toolbutton-selected");
			buttons[i].style("width", "49px");
		}
 		else
			document.getElementById("lookbackpicker" + i).classList.add("toolbutton-unselected");
		buttons[i].on("click", setLookback(lookbackList[i]));
	}
	setTimeout (function () {d3.select(document).on("click.lookbackpicker", removeLookbackPickerBar)}, 10);
	isLookbackPickerBar = true;
}

function removeLookbackPickerBar ()
{
	d3.select("#lookbackpicker").transition().duration(200).style("opacity", 0.0).each("end", function ()
	{
		d3.select("#lookbackpicker").selectAll("div").remove();
	});
	d3.select(document).on("click.lookbackpicker", null);
	document.getElementById("lookbackbutton").classList.remove("toolbutton-active");
	document.getElementById("lookbackbutton").classList.add("toolbutton");
	isLookbackPickerBar = false;
}

function setLookback (i)
{
	return function ()
	{
		console.log("Lookback to be set to " + i);
		lookback = i;
		loadType = "4";
		dateStart = Date.now() - lookback*86400*1000;
		dateEnd = Date.now() - 0*86400*1000;
		isZoom = false; isBubble = false; isBubbleGrayed = false;
		redraw_polys = true;
		d3.select("#lookbackbutton-text").html(lookback + "d");
		removeProgressBar ();
		loadDataType4 (function () {load_display (clusterTree); saveAllData ();
			load_interaction ();});
	}
}

function createHelpBar ()
{
	if (isHelpBar)
		return;
	
	var w = 300;
	var w0 = 20;
	var posX = d3.select("#helpbutton").style("left");
	posX = parseInt(posX.slice(0, posX.length - 2)) - w + w0;
	var posY = d3.select("#helpbutton").style("top");
	posY = parseInt(posY.slice(0, posY.length - 2)) + colorPicker_button + 3;
	
	var box = d3.select("#helpbox");
	box.selectAll("div").remove();
	box.style("position", "absolute")
		.style("left", posX + "px")
		.style("top", posY + "px")
		.style("display", "block")
		.style("padding", "5px")
		.style("border", "solid 1px white")
		.style("opacity", "0.0")
		.style("background-color", "#ddd")
		.style("text-align", "left")
		.style("font-size", "12px")
		.html("<b>Webmapper v.1.0</b><br/><br/>Ryan Hamerly, Scott Chung, Sheta Chatterjee and Milinda Lakkam<br/>Learn more about Webmapper at <a href=\"" + homepage + "\" style=\"color:#444\" target=\"_blank\">our GitHub site &raquo;</a>")
		.transition().duration(200)
		.style("opacity", "1.00");
	document.getElementById("helpbutton").classList.remove("toolbutton");
	document.getElementById("helpbutton").classList.add("toolbutton-active");

	setTimeout (function () {d3.select(document).on("click.help", removeHelpBar)}, 10);
	isHelpBar = true;
}

function removeHelpBar ()
{
	d3.select("#helpbox").transition().duration(200).style("opacity", 0.0).each("end", function ()
	{
		d3.select("#helpbox").html("");
	});
	d3.select(document).on("click.help", null);
	document.getElementById("helpbutton").classList.remove("toolbutton-active");
	document.getElementById("helpbutton").classList.add("toolbutton");
	isHelpBar = false;
}