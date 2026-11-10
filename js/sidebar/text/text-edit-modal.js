// 文字の入力モーダル。レイヤーパネルの文字・吹き出しの行の「文字編集」ボタンから開く。
// 横書きのふつうの入力欄で打ち、OK で文字に反映する（縦書きの文字はそのまま縦書きで描かれる）。
// キャンバスに直接打つと、縦書き・日本語入力（IME）で不安定になりやすいため、その代わりの入口。
// 反映は text を差し替えて canvas の text:changed を出すだけにする。吹き出しの大きさ合わせ・履歴は
// 既存の text:changed の処理（fabric-management.js）に任せる（キャンバスで打ったときと同じ流れ）

let temTarget=null;

// 吹き出しの行から開いたときは、中の文字を対象にする
function temTextOf(layer){
if(isSpeechBubbleSVG(layer)){
return getSpeechBubbleTextBySVG(layer);
}
if(isFreehandBubblePath(layer)){
return getFreehandBubbleTextByPath(layer);
}
return (isText(layer)||isVerticalText(layer))?layer:null;
}

function temEnsureModal(){
let modal=$("text-edit-modal");
if(modal){
return modal;
}
modal=document.createElement("div");
modal.id="text-edit-modal";
modal.innerHTML=
'<div class="tem-box" role="dialog" aria-modal="true" aria-labelledby="tem-title">'+
'<div class="tem-title" id="tem-title">文字の編集</div>'+
'<textarea class="tem-input" rows="6"></textarea>'+
'<div class="tem-note">改行すると、縦書きでは次の列（左）になります。Ctrl+Enter で反映、Esc で閉じる</div>'+
'<div class="tem-buttons">'+
'<button type="button" class="tem-cancel">キャンセル</button>'+
'<button type="button" class="tem-ok">反映</button>'+
'</div></div>';
document.body.appendChild(modal);
modal.querySelector(".tem-cancel").addEventListener("click",temClose);
modal.querySelector(".tem-ok").addEventListener("click",temApply);
modal.addEventListener("mousedown",function(e){
if(e.target===modal){
temClose();
}
});
modal.querySelector(".tem-input").addEventListener("keydown",function(e){
// 変換中の Enter・Esc は IME に渡す
if(e.isComposing){
return;
}
if(e.key==="Enter"&&(e.ctrlKey||e.metaKey)){
e.preventDefault();
temApply();
}else if(e.key==="Escape"){
e.preventDefault();
temClose();
}
// ショートカット（Delete で消す など）がキャンバスに届かないようにする
e.stopPropagation();
});
return modal;
}

function openTextEditModal(layer){
const text=temTextOf(layer);
if(!text){
return;
}
if(text.isEditing){
text.exitEditing();
}
temTarget=text;
const modal=temEnsureModal();
const input=modal.querySelector(".tem-input");
input.value=text.text;
modal.classList.add("tem-open");
input.focus();
input.setSelectionRange(input.value.length,input.value.length);
}

function temClose(){
const modal=$("text-edit-modal");
if(modal){
modal.classList.remove("tem-open");
}
temTarget=null;
}

function temApply(){
const text=temTarget;
const modal=$("text-edit-modal");
if(!text||!modal){
temClose();
return;
}
const value=modal.querySelector(".tem-input").value.replace(/\r\n/g,"\n");
if(value!==text.text){
text.set({text:value});
if(text.initDimensions){
text.initDimensions();
}
text.setCoords();
canvas.fire("text:changed",{target:text});
canvas.requestRenderAll();
updateLayerPanel();
}
temClose();
}

// レイヤーパネルのボタン（layer-management.js から呼ぶ）
function putTextEditButton(buttonsDiv,layer){
if(!temTextOf(layer)){
return;
}
const button=document.createElement("button");
button.className="layer-text-edit-button";
button.title="文字を編集（横書きの入力欄で打つ）";
button.innerHTML='<i class="material-icons">edit_note</i>';
button.onclick=function(e){
e.stopPropagation();
openTextEditModal(layer);
};
buttonsDiv.appendChild(button);
}

// 文字が入っている吹き出し（なければ null）
function temBubbleOf(text){
if(!text||!isSpeechBubbleText(text)){
return null;
}
if(text.targetObject&&canvas.getObjects().indexOf(text.targetObject)>=0){
return text.targetObject;
}
return canvas.getObjects().find(function(o){
return isSpeechBubbleSVG(o)&&o.guids&&o.guids.indexOf(text.guid)>=0;
})||null;
}

// 吹き出しの文字の枠（文字の入る範囲）の中央へ、文字の見た目の中心を合わせる。
// 縦書きの文字は left/origin と描かれる位置がずれることがあるので、外接矩形の中心で合わせる
function centerTextInBubble(text){
const bubble=temBubbleOf(text);
if(!bubble){
return;
}
if(text.isEditing){
text.exitEditing();
}
const rect=getSpeechBubbleRectBySVG(bubble);
const area=rect?rect.getBoundingRect(true,true):bubble.getBoundingRect(true,true);
const box=text.getBoundingRect(true,true);
text.set({
left:text.left+(area.left+area.width/2)-(box.left+box.width/2),
top:text.top+(area.top+area.height/2)-(box.top+box.height/2)
});
text.setCoords();
canvas.requestRenderAll();
commitHistory();
}

// レイヤーパネルのボタン（文字の行）。吹き出しの中の文字のときだけ押せる
function putCenterInBubbleButton(buttonsDiv,layer){
if(!(isText(layer)||isVerticalText(layer))){
return;
}
const button=document.createElement("button");
button.className="layer-center-in-bubble-button";
const inBubble=!!temBubbleOf(layer);
button.disabled=!inBubble;
button.title=inBubble?"フキダシの中央に配置":"フキダシの中の文字のときだけ使えます";
button.innerHTML='<i class="material-icons">center_focus_strong</i>';
button.onclick=function(e){
e.stopPropagation();
centerTextInBubble(layer);
};
buttonsDiv.appendChild(button);
}
