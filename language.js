//	A string hashtable.  This is used to pick out the top strings from a list of webpages. 
function StringHashtable ()
{
	this.occurrenceList = {};
}

StringHashtable.prototype.add = function (str_in, n)
{
	str = reduceWord(str_in.toLowerCase());
	if (str in this.occurrenceList)
		this.occurrenceList[str] += n
	else if (str != "")
		this.occurrenceList[str] = n;
}

StringHashtable.prototype.addMultiple = function (strList, n)
{
	for (var i in strList)
		this.add(strList[i], n);
}

StringHashtable.prototype.topStrings = function (n)
{
	var out = [];
	for (var str in this.occurrenceList)
		out.push([str, this.occurrenceList[str]]);
	out.sort(function (a, b) {return b[1] - a[1];});	// Sort top to bottom
	return out.slice(0, n);
}

StringHashtable.prototype.prune = function (n)
{
	// Get a list of all keys and values.
	var keyvalues = _.keys(this.occurrenceList);
	if (keyvalues.length <= n)
		return;

	// Sort the list.  Remove the (occurrenceList.lengh - n) least popular words.
	keyvalues = _.map(_.keys(this.occurrenceList), function(x) {return [x, _.values(this.occurrenceList)];});	
	keyvalues.sort (function(a,b) {return a[1]-b[1];});
	for (var i = 0; i < keyvalues.length - n; i++)
		delete this.occurrenceList[keyvalues[i]];
}

function CombineHashtables (str1, str2)
{
	var ans = new StringHashtable ();
	for (var i in str1.occurrenceList)
		ans.occurrenceList[i] = str1.occurrenceList[i];
	for (var i in str2.occurrenceList)
	{
		if (i in ans.occurrenceList)
			ans.occurrenceList[i] += str2.occurrenceList[i];
		else
			ans.occurrenceList[i] = str2.occurrenceList[i];
	}
	return ans;
}

// Reduces a word to "nice" form.  Prunes special symbols at the ends.  Gets rid of common suffixes.  Gets rid of stopwords.
function reduceWord (str_in)
{
	var str = str_in.replace(/^\W+|\W+$/g, "");
	str = str.replace(/\.com$|\.org$|\.net$|\.gov$|\.edu$|\.mil$|'s$/g, "");
	if (str in stopwords)
		return "";
	else
		return str;
}

var stopwordsList = ["a", "able", "about", "across", "after", "all", "almost", "also", "am", "among", "an", "and", "any", "are", "as", "at", "be", "because", "been", "but", "by", "can", "cannot", "could", "dear", "did", "do", "does", "either", "else", "ever", "every", "for", "from", "get", "got", "had", "has", "have", "he", "her", "hers", "him", "his", "how", "however", "i", "if", "in", "into", "is", "it", "its", "just", "least", "let", "like", "likely", "may", "me", "might", "most", "must", "my", "neither", "no", "nor", "not", "of", "off", "often", "on", "only", "or", "other", "our", "own", "rather", "said", "say", "says", "she", "should", "since", "so", "some", "than", "that", "the", "their", "them", "then", "there", "these", "they", "this", "tis", "to", "too", "twas", "us", "wants", "was", "we", "were", "what", "when", "where", "which", "while", "who", "whom", "why", "will", "with", "would", "yet", "you", "your"];
var stopwords = {};
for (var i in stopwordsList)
	stopwords[stopwordsList[i]] = true;