// unsaved-guard.js - 保存していない変更があるまま離脱するのを防ぐ
//
// 「変更イベントを数える」方式にすると、起動時やページ切替時に走る内部の
// captureState()まで拾ってしまい、何もしていないのに警告が出る。
// そのため、保存した時点の内容そのものを控えておき、現在の内容と突き合わせて判定する。
var UnsavedGuard=(function(){
var savedSnapshot=null;
var everMarked=false;

// canvasGuidはページの識別子であって絵の中身ではない。
// ページを作り直すたびに振り直されるので、比較からは外す
function normalize(json){
if(!json)return null;
return json.replace(/,?"canvasGuid":"[^"]*"/,'');
}

function currentSnapshot(){
if(typeof stateStack==='undefined'||typeof currentStateIndex==='undefined')return null;
if(currentStateIndex<0||currentStateIndex>=stateStack.length)return null;
return normalize(stateStack[currentStateIndex]);
}

// 保存直後・読み込み直後・履歴のベースラインを張り直した直後に呼ぶ。
// この時点で履歴がまだ空なら基準を取れないので、記録せず次の機会に回す。
// 空のまま基準にすると、その後の最初の描画がすべて「変更あり」になってしまう
function markSaved(){
var snap=currentSnapshot();
if(snap===null)return;
savedSnapshot=snap;
everMarked=true;
}

function isDirty(){
if(!everMarked)return false;
var now=currentSnapshot();
if(now===null)return false;
return now!==savedSnapshot;
}

// 起動処理の途中では履歴がまだ無いことがあるため、
// 描画が落ち着いた時点の内容を基準として取り直す
window.addEventListener('load',function(){
setTimeout(function(){
if(!everMarked)markSaved();
},1000);
});

// ブラウザは独自の文言を出すため、ここで渡す文字列は表示されない。
// returnValueへ空でない値を入れることが離脱確認を出す条件になっている
window.addEventListener('beforeunload',function(e){
if(!isDirty())return;
e.preventDefault();
e.returnValue=typeof getText==='function'?getText('unsavedChangesWarning'):'';
return e.returnValue;
});

return {
markSaved:markSaved,
isDirty:isDirty
};
})();
