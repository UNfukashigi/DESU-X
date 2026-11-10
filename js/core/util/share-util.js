function openWindow(url) {
var width=700;
var height=700;
var left=(screen.width/2)-(width/2);
var top=(screen.height/2)-(height/2);
window.open(url,'ShareWindow','toolbar=no, location=no, status=no, menubar=no, scrollbars=no, resizable=no, width='+width+', height='+height+', top='+top+', left='+left);
}

function snsTweet(){
clipCopy();

var tweetText="\nCreated by DESU-X (based on Manga Editor Desu!)\n#Manga_Editor_Desu\n[Web site]\nhttps://new-sankaku.github.io/manga-editor-desu/\n[GitHub]\nhttps://github.com/new-sankaku/manga-editor-desu";
var tweetUrl="https://twitter.com/intent/tweet?text="+encodeURIComponent(tweetText);
openWindow(tweetUrl);
}
