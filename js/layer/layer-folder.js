// レイヤーフォルダ。オブジェクトに layerFolderId（どのフォルダか）・layerFolderName（名前）・
// layerFolderClosed（畳んでいるか）を持たせるだけで、キャンバス上の入れ物は作らない。
// fabric.Group にまとめると、コマの画像の切り抜き（clipPath）・吹き出しの親子リンク・AI生成の対象など、
// 既存の仕組みが「キャンバス直下にある」前提で動いているところが全部壊れるため。
// フォルダの行をクリックすると中身を ActiveSelection で選ぶので、そのままドラッグすればまとめて動く。
// 保存・Undo は commonProperties（settings.js）に入れた3つの値で残る。

let lfOpenNameEditId=null;

function lfGetMembers(folderId){
return canvas.getObjects().filter(function(o){return o.layerFolderId===folderId;});
}

// 選んでいる物（複数選択なら全部）。コマを選んでいたら、その中の画像も一緒に入れる
// （コマだけ動かすと、中の画像が置いていかれる）
function lfCollectTargets(){
const active=canvas.getActiveObject();
if(!active){
return [];
}
const list=active.type==='activeSelection'?active.getObjects().slice():[active];
const guidMap=createGUIDMap(canvas.getObjects());
list.slice().forEach(function(obj){
if(isPanel(obj)&&obj.guids){
obj.guids.forEach(function(guid){
const child=guidMap.get(guid);
if(child&&list.indexOf(child)===-1){
list.push(child);
}
});
}
});
return list;
}

function lfNextFolderName(){
const used=new Set(canvas.getObjects().map(function(o){return o.layerFolderName;}));
let n=1;
while(used.has("フォルダ"+n)){
n++;
}
return "フォルダ"+n;
}

function lfAssign(objects,folderId,name){
objects.forEach(function(obj){
obj.layerFolderId=folderId;
obj.layerFolderName=name;
obj.layerFolderClosed=false;
// フォルダのロック：解除ボタンで間違えて解かないためのもの。中身の編集・出し入れは止めない。作った時はロック
obj.layerFolderLocked=true;
});
}

// まとめる。名前を省けば「フォルダN」
function lfCreateFolder(objects,name){
if(!objects||objects.length===0){
return null;
}
const folderId=generateGUID();
lfAssign(objects,folderId,name||lfNextFolderName());
return folderId;
}

function lfCreateFolderFromSelection(){
const targets=lfCollectTargets();
if(targets.length===0){
createToastError("フォルダ","まとめるレイヤーを選んでください");
return;
}
const folderId=lfCreateFolder(targets);
commitHistory();
lfSelectFolder(folderId);
}

function lfIsFolderLocked(folderId){
return lfGetMembers(folderId).some(function(o){return o.layerFolderLocked;});
}

function lfToggleFolderLock(folderId){
const locked=!lfIsFolderLocked(folderId);
lfGetMembers(folderId).forEach(function(o){o.layerFolderLocked=locked;});
commitHistory();
updateLayerPanel();
}

function lfReleaseFolder(folderId){
if(lfIsFolderLocked(folderId)){
createToastError("フォルダ","ロック中のフォルダは解除できません。鍵を外してから解除してください");
return;
}
lfGetMembers(folderId).forEach(function(obj){
delete obj.layerFolderId;
delete obj.layerFolderName;
delete obj.layerFolderClosed;
delete obj.layerFolderLocked;
});
commitHistory();
updateLayerPanel();
}

// 選んでいる物が入っているフォルダを解く（ヘッダのボタン用）
function lfReleaseFolderOfSelection(){
const ids=new Set(lfCollectTargets().map(function(o){return o.layerFolderId;}).filter(Boolean));
if(ids.size===0){
createToastError("フォルダ","フォルダに入っているレイヤーを選んでください");
return;
}
ids.forEach(function(id){lfReleaseFolder(id);});
}

// 中身をまとめて選ぶ。非表示・ロック中のものは選ばない（見えない物が一緒に動くのを防ぐ）
function lfSelectFolder(folderId){
// 吹き出しの文字の枠（excludeFromLayerPanel）もパネルには出ないが一緒に動かす
const members=lfGetMembers(folderId).filter(function(o){return o.visible;});
canvas.discardActiveObject();
if(members.length===1){
canvas.setActiveObject(members[0]);
}else if(members.length>1){
canvas.setActiveObject(new fabric.ActiveSelection(members,{canvas:canvas}));
}
canvas.requestRenderAll();
updateLayerPanel();
}

function lfToggleFolder(folderId){
const members=lfGetMembers(folderId);
const closed=!(members[0]&&members[0].layerFolderClosed);
withoutHistory(function(){
members.forEach(function(o){o.layerFolderClosed=closed;});
});
updateLayerPanel();
}

function lfRenameFolder(folderId,name){
if(!name){
return;
}
lfGetMembers(folderId).forEach(function(o){o.layerFolderName=name;});
commitHistory();
updateLayerPanel();
}

// レイヤーパネルの並び：フォルダの中身を、いちばん手前の中身の位置へ寄せて並べる（並びは元の親子順のまま）
function lfGroupLayerOrder(order){
const result=[];
const done=new Set();
order.forEach(function(item){
const id=item.layer.layerFolderId;
if(!id){
result.push(item);
return;
}
if(done.has(id)){
return;
}
done.add(id);
order.forEach(function(other){
if(other.layer.layerFolderId===id){
// フォルダの中でも親子（コマ→中の絵・吹き出し→文字）の段差は残し、フォルダの分だけ1段下げる
result.push({layer:other.layer,level:other.level+1,folderId:id});
}
});
});
return result;
}

function lfIsFolderSelected(folderId){
const active=canvas.getActiveObject();
if(!active){
return false;
}
const selected=active.type==='activeSelection'?active.getObjects():[active];
// 中身を全部選んでいるときだけ（1つだけ選んでいるときはその行だけに色を付ける）
const members=lfGetMembers(folderId).filter(function(o){return o.visible;});
return selected.length===members.length&&selected.every(function(o){return o.layerFolderId===folderId;});
}

function lfCreateFolderRow(folderId,firstMember){
const row=document.createElement("div");
row.className="layer-item layer-folder-row";
if(lfIsFolderSelected(folderId)){
row.classList.add("layer-active");
}
row.setAttribute("data-folder-id",folderId);

const toggle=document.createElement("button");
toggle.className="layer-folder-toggle";
toggle.innerHTML='<i class="material-icons">'+(firstMember.layerFolderClosed?"chevron_right":"expand_more")+'</i>';
toggle.onclick=function(e){
e.stopPropagation();
lfToggleFolder(folderId);
};

const icon=document.createElement("i");
icon.className="material-icons layer-folder-icon";
icon.textContent=firstMember.layerFolderClosed?"folder":"folder_open";

const name=document.createElement("span");
name.className="layer-folder-name";
name.textContent=firstMember.layerFolderName;
name.title="ダブルクリックで名前を変える";
name.ondblclick=function(e){
e.stopPropagation();
const next=window.prompt("フォルダの名前",firstMember.layerFolderName);
if(next!==null){
lfRenameFolder(folderId,next.trim());
}
};

const release=document.createElement("button");
release.className="layer-folder-release";
release.title="フォルダを解除（中身は残す）";
release.innerHTML='<i class="material-icons">folder_off</i>';
release.onclick=function(e){
e.stopPropagation();
lfReleaseFolder(folderId);
};
const locked=lfIsFolderLocked(folderId);
if(locked){
release.disabled=true;
release.title="ロック中は解除できません";
release.style.opacity="0.3";
}
const lock=document.createElement("button");
lock.className="layer-folder-lock";
lock.title=locked?"フォルダのロックを外す（解除できるようにする）":"フォルダをロック（解除できないようにする）";
lock.innerHTML='<i class="material-icons">'+(locked?"lock":"lock_open")+'</i>';
lock.onclick=function(e){
e.stopPropagation();
lfToggleFolderLock(folderId);
};

row.appendChild(toggle);
row.appendChild(icon);
row.appendChild(name);
row.appendChild(lock);
row.appendChild(release);
row.onclick=function(){
lfSelectFolder(folderId);
};
return row;
}

// まとめて動かしている間、コマの画像の切り抜きをコマに追随させる。
// 切り抜きは置いた時のコマの位置に固定（absolutePositioned）なので、コマと画像を一緒に動かすと
// 画像だけが元の位置の切り抜きで欠ける。calcTransformMatrix は選択の変形まで含むので、
// 選択中でもコマの今の位置で作り直せる
function lfSyncClipPathsInSelection(e){
const target=e.target;
if(!target||target.type!=='activeSelection'){
return;
}
const objects=target.getObjects();
objects.forEach(function(obj){
if(obj.relatedPoly&&objects.indexOf(obj.relatedPoly)!==-1){
updateClipPath(obj,obj.relatedPoly);
}
});
}

// レイヤーパネルで行をドラッグして、フォルダへ入れる・フォルダから出す。
// 落とし先：フォルダの行 → そのフォルダへ／フォルダの中の行 → その行のフォルダへ／
// フォルダに入っていない行・空いている所 → フォルダから出す。重ね順は変えない。
// 行は更新のたびに作り直されるので、入れ物（#layer-content）に1回だけ付ける
let lfDragGuid=null;

function lfFindObjectByGuid(guid){
return canvas.getObjects().find(function(o){return String(o.guid)===String(guid);})||null;
}

// コマを動かすときは中の画像も一緒に（コマだけ入れると中身が置いていかれる）
function lfWithPanelChildren(obj){
const list=[obj];
if(isPanel(obj)&&obj.guids){
const guidMap=createGUIDMap(canvas.getObjects());
obj.guids.forEach(function(guid){
const child=guidMap.get(guid);
if(child){
list.push(child);
}
});
}
return list;
}

// ドロップ先の行から、入れるフォルダを決める。null はフォルダから出す
function lfDropFolderOf(row){
if(!row){
return null;
}
if(row.dataset.folderId){
return row.dataset.folderId;
}
const target=lfFindObjectByGuid(row.dataset.guid);
return target&&target.layerFolderId?target.layerFolderId:null;
}

// ドロップ先の行から、入れるコマを決める（コマの行、またはコマの中の画像の行）
function lfDropPanelOf(row){
if(!row||!row.dataset.guid){
return null;
}
const target=lfFindObjectByGuid(row.dataset.guid);
if(!target){
return null;
}
if(isPanel(target)){
return target;
}
return target.relatedPoly&&isPanel(target.relatedPoly)?target.relatedPoly:null;
}

// コマに入れる。絵の中心がコマの外なら、コマの中心へ動かす（入れても切り抜きの外で見えなくなるため）。
// 大きさは変えない。リンクの張り方は relinkToPanelUnderObject（panel-manager.js）と同じ
function lfPutIntoPanel(obj,panel){
if(obj.relatedPoly){
releasePanelLink(obj);
}
const center=getAbsoluteCenterPoint(obj);
if(!isPointInShape(panel,center.x,center.y)){
obj.setPositionByOrigin(panel.getCenterPoint(),'center','center');
obj.setCoords();
}
// 重ね順はコマより手前に（後ろにあるとコマの塗りに隠れる）
if(canvas.getObjects().indexOf(obj)<canvas.getObjects().indexOf(panel)){
canvas.moveTo(obj,canvas.getObjects().indexOf(panel));
}
moveSettings(obj,panel);
setGUID(panel,obj);
}

function lfMoveToFolder(objects,folderId){
const name=folderId?(lfGetMembers(folderId)[0]||{}).layerFolderName:null;
const locked=folderId?lfIsFolderLocked(folderId):false;
objects.forEach(function(obj){
if(folderId){
obj.layerFolderId=folderId;
obj.layerFolderName=name;
obj.layerFolderClosed=false;
obj.layerFolderLocked=locked;
}else{
delete obj.layerFolderId;
delete obj.layerFolderName;
delete obj.layerFolderClosed;
delete obj.layerFolderLocked;
}
});
commitHistory();
updateLayerPanel();
}

function lfClearDropMarks(container){
container.querySelectorAll('.layer-drop-target').forEach(function(el){el.classList.remove('layer-drop-target');});
container.classList.remove('layer-drop-out');
}

function lfBindLayerDrag(container){
container.addEventListener('dragstart',function(e){
const row=e.target.closest&&e.target.closest('.layer-item[data-guid]');
if(!row||row.classList.contains('layer-folder-row')){
return;
}
lfDragGuid=row.dataset.guid;
e.dataTransfer.effectAllowed='move';
e.dataTransfer.setData('text/plain',lfDragGuid);
});
container.addEventListener('dragover',function(e){
if(!lfDragGuid){
return;
}
e.preventDefault();
lfClearDropMarks(container);
const row=e.target.closest('.layer-item');
const panel=lfDropPanelOf(row);
const dragged=lfFindObjectByGuid(lfDragGuid);
const folderId=lfDropFolderOf(row);
if(panel&&dragged&&!isPanel(dragged)){
row.classList.add('layer-drop-target');
container.querySelectorAll('.layer-item[data-guid="'+panel.guid+'"]').forEach(function(el){el.classList.add('layer-drop-target');});
}else if(folderId){
const header=container.querySelector('.layer-folder-row[data-folder-id="'+folderId+'"]');
(header||row).classList.add('layer-drop-target');
}else{
container.classList.add('layer-drop-out');
}
});
container.addEventListener('dragleave',function(e){
if(!container.contains(e.relatedTarget)){
lfClearDropMarks(container);
}
});
container.addEventListener('drop',function(e){
if(!lfDragGuid){
return;
}
e.preventDefault();
lfClearDropMarks(container);
const obj=lfFindObjectByGuid(lfDragGuid);
lfDragGuid=null;
if(!obj){
return;
}
const row=e.target.closest('.layer-item');
// 1. コマ（またはコマの中の絵）の行に落とした → そのコマの中へ。コマ自体はコマに入れない
const panel=lfDropPanelOf(row);
if(panel&&!isPanel(obj)){
if(obj.relatedPoly!==panel){
lfPutIntoPanel(obj,panel);
canvas.requestRenderAll();
commitHistory();
updateLayerPanel();
}
return;
}
// 2. フォルダの行・フォルダの中の行 → そのフォルダへ
const folderId=lfDropFolderOf(row);
if(folderId){
if(obj.layerFolderId!==folderId){
lfMoveToFolder(lfWithPanelChildren(obj),folderId);
}
return;
}
// 3. それ以外（コマにもフォルダにも入っていない行・空いている所） → コマからもフォルダからも出す
let changed=false;
if(obj.relatedPoly&&isPanel(obj.relatedPoly)){
releasePanelLink(obj);
canvas.requestRenderAll();
changed=true;
}
if(obj.layerFolderId){
lfMoveToFolder(lfWithPanelChildren(obj),null);
return;
}
if(changed){
commitHistory();
updateLayerPanel();
}
});
container.addEventListener('dragend',function(){
lfDragGuid=null;
lfClearDropMarks(container);
});
}

document.addEventListener('DOMContentLoaded',function(){
lfBindLayerDrag($("layer-content"));
canvas.on('object:moving',lfSyncClipPathsInSelection);
canvas.on('object:scaling',lfSyncClipPathsInSelection);
canvas.on('object:rotating',lfSyncClipPathsInSelection);
canvas.on('object:modified',lfSyncClipPathsInSelection);
});
