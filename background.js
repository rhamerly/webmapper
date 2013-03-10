// This tells the app to crate a tab when the icon is clicked.
chrome.browserAction.onClicked.addListener(function ()
{
	chrome.tabs.create ( {"url": "mainpage.html"} )
});