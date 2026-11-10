// 誤操作防止：選んでいない物は、最初のクリックでは選ぶだけにして動かさない。
// もう一度同じ物を押してドラッグしたときだけ動く。
// mouse:down:before（fabric が選択を変える前）に「今選ばれているか」を見て、選ばれていなければ
// その押している間だけ移動を止める（lockMovementX/Y）。離したら元の値に戻す。
// set() を通さず直接代入するのは、履歴の自動コミット網（set() のフック）に拾わせないため。
// 大きさ・回転のハンドルは選んだ後にしか出ないので、移動だけ止めればよい。

let csfHeld=null;

function csfIsSelected(target){
const active=canvas.getActiveObject();
if(!active||!target){
return false;
}
if(active===target){
return true;
}
return active.type==='activeSelection'&&active.contains(target);
}

function csfRelease(){
if(!csfHeld){
return;
}
csfHeld.obj.lockMovementX=csfHeld.x;
csfHeld.obj.lockMovementY=csfHeld.y;
csfHeld=null;
}

document.addEventListener('DOMContentLoaded',function(){
canvas.on('mouse:down:before',function(e){
csfRelease();
const target=e.target;
// 吹き出しの中の文字は、元のエディタでは動かせない設定（lockMovementX/Y）で作られる。
// 文字だけ位置を直せるよう、ここで外す（吹き出しを動かしたときは今までどおり文字もついてくる。
// 中央へ戻すのはレイヤーパネルの「フキダシの中央に配置」ボタン）。保存済みのプロジェクトの文字もここで外れる
if(target&&isSpeechBubbleText(target)&&!target.isEditing){
target.lockMovementX=false;
target.lockMovementY=false;
}
// Shift などで複数選択に足すときは、そのまま（選ぶだけで動かすことはない）
if(!target||csfIsSelected(target)){
return;
}
csfHeld={obj:target,x:target.lockMovementX,y:target.lockMovementY};
target.lockMovementX=true;
target.lockMovementY=true;
});
canvas.on('mouse:up',csfRelease);
// フォルダを選んでいる（中身をまとめて選んでいる）ときに文字をダブルクリックしたら、その文字だけを選び直して
// 入力に入る。まとめて選んだままだとクリックがまとまりに吸われ、文字の入力に入れない
canvas.on('mouse:dblclick',function(e){
const active=canvas.getActiveObject();
if(!active||active.type!=='activeSelection'){
return;
}
const pointer=canvas.getPointer(e.e);
const point=new fabric.Point(pointer.x,pointer.y);
const texts=active.getObjects().filter(function(o){
return (isText(o)||isVerticalText(o))&&o.editable!==false&&o.visible;
});
canvas.discardActiveObject();
const hit=texts.reverse().find(function(o){return o.containsPoint(point);});
if(!hit){
canvas.requestRenderAll();
return;
}
canvas.setActiveObject(hit);
hit.enterEditing();
// カーソルはダブルクリックした位置へ（隠しテキスト欄にも反映しないと、打った字が先頭に入る）
const index=hit.getSelectionStartFromPointer(e.e);
hit.selectionStart=hit.selectionEnd=index;
hit._updateTextarea();
canvas.requestRenderAll();
});
});

// 選んだ物は、fabric がいちばん手前に描く（preserveObjectStacking=false）。そのため、下のレイヤーの画像を選ぶと、
// 本来その上にある吹き出し・文字・画像が隠れて見えなくなる。選んでいる間だけ、選んだ物より上にある物を
// 選んだ物の上に半透明で重ねて描く（選んだ物と重なる物だけ）。吹き出しを選んだときの中の文字は、そのままの濃さで描く。
// 書き出し（toDataURL など）も after:render を通るので、画面の描画（contextContainer）のときだけ描く
const CSF_UPPER_ALPHA=0.5;        // 上にある物の濃さ
const CSF_BUBBLE_TEXT_ALPHA=1;    // 選んだ吹き出しの中の文字の濃さ（1＝そのまま）
function csfOverlaps(a,b){
return a.left<b.left+b.width&&b.left<a.left+a.width&&a.top<b.top+b.height&&b.top<a.top+a.height;
}
document.addEventListener('DOMContentLoaded',function(){
canvas.on('after:render',function(e){
const ctx=e&&e.ctx;
const active=canvas.getActiveObject();
// 文字の入力中は重ねない（カーソル・選択範囲・入力中の字が上の物に隠れる）
if(!ctx||ctx!==canvas.contextContainer||!active||active.isEditing){
return;
}
const selected=active.type==='activeSelection'?active.getObjects():[active];
const objects=canvas.getObjects();
const lowest=Math.min.apply(null,selected.map(function(o){return objects.indexOf(o);}));
const area=active.getBoundingRect(true,true);
const bubbleText=isSpeechBubbleSVG(active)?getSpeechBubbleTextBySVG(active):null;
const uppers=objects.slice(lowest+1).filter(function(o){
return selected.indexOf(o)<0&&o.visible&&!o.isEditing&&!o.excludeFromExport&&!isSpeechBubbleRect(o)&&
csfOverlaps(o.getBoundingRect(true,true),area);
});
if(uppers.length===0){
return;
}
ctx.save();
const v=canvas.viewportTransform;
ctx.transform(v[0],v[1],v[2],v[3],v[4],v[5]);
uppers.forEach(function(o){
ctx.save();
ctx.globalAlpha=o===bubbleText?CSF_BUBBLE_TEXT_ALPHA:CSF_UPPER_ALPHA;
o.render(ctx);
ctx.restore();
});
ctx.restore();
});
});

// 下の物を選んでいるときに、上にある物をクリックしたら上の物を選ぶ。
// fabric は preserveObjectStacking=false のとき、選んでいる物の範囲を押すと、上に別の物があっても
// 選んでいる物を返す（選んだ物がいちばん手前に描かれるため）。findTarget を包み、選んでいる物より上にあって
// 押した所にある物（選べる物だけ）を先に返す。大きさを変えるハンドルを押したときは、選んでいる物のまま
function csfWrapFindTarget(){
const original=canvas.findTarget.bind(canvas);
canvas.findTarget=function(e,skipGroup){
const target=original(e,skipGroup);
const active=this.getActiveObject();
// 文字の入力中は、文字の中を押したらカーソルを動かすだけにする（上の物に選び直すと入力が切れる）
if(skipGroup||!active||target!==active||active.isEditing){
return target;
}
const pointer=this.getPointer(e,true);
if(active._findTargetCorner&&active._findTargetCorner(pointer,e&&e.pointerType==='touch')){
return target;
}
const selected=active.type==='activeSelection'?active.getObjects():[active];
const objects=this._objects;
const lowest=Math.min.apply(null,selected.map(function(o){return objects.indexOf(o);}));
for(let i=objects.length-1;i>lowest;i--){
const o=objects[i];
if(selected.indexOf(o)>=0||!o.visible||!o.evented||!o.selectable){
continue;
}
if(this._checkTarget(pointer,o,this.restorePointerVpt(pointer))){
return o;
}
}
return target;
};
}
document.addEventListener('DOMContentLoaded',csfWrapFindTarget);
