// コマに付けた設定資料をキャンバス上に出す。
//
// ウインドウは「今選んでいるコマ」しか見せないため、ページ全体で何がどこに付いているのかは
// 一枚ずつ選び直さないと分からない。コマ割りを作ってから一気に割り当てる作業では、
// 付け忘れたコマがそのまま生成に流れる。
//
// 置き場所はfabricのラッパー（`canvas.wrapperEl`）。キャンバスと同じ論理座標系なので、
// #canvas-containerのCSS拡大にもスクロールにも勝手に追従する。
// 見た目の大きさだけは倍率の逆数で戻す（拡大率0.3で文字が読めなくなるため）
var referenceCanvasOverlay=(function(){
const STORAGE_KEY='referenceCanvasOverlayEnabled';
// 1枚も省かない。「+3」では何が付いているのか結局コマを選び直すことになり、
// キャンバスに出している意味が無くなる。並びきらない分はコマの幅で折り返す
const CHIP_MIN_WIDTH=52;
var rootEl=null;
var dropEl=null;
var enabled=true;
var loaded=false;
var items=[];
var lastSignature='';
var frameRequested=false;
function isEnabled(){
if(!loaded){
enabled=localStorage.getItem(STORAGE_KEY)!=='false';
loaded=true;
}
return enabled;
}
function setEnabled(on){
enabled=!!on;
loaded=true;
localStorage.setItem(STORAGE_KEY,enabled?'true':'false');
syncCheckboxes();
update();
}
// 切り替えの入口はウインドウの帯とメニューの表示タブの2か所ある。
// 状態はこのモジュールだけが持ち、書き換えたらまとめて合わせる。
// 片方のonchangeでもう片方を触る作りにすると、入口を増やすたびに直す場所が増える
const CHECKBOX_IDS=['rsShowOnCanvas','view_reference_marks_checkbox'];
function syncCheckboxes(){
CHECKBOX_IDS.forEach(function(id){
var el=$(id);
if(el)el.checked=isEnabled();
});
}
function ensureRoot(){
if(rootEl&&rootEl.parentNode)return rootEl;
if(typeof canvas==='undefined'||!canvas||!canvas.wrapperEl)return null;
rootEl=document.createElement('div');
rootEl.id='referenceCanvasOverlay';
canvas.wrapperEl.appendChild(rootEl);
return rootEl;
}
// 設定資料の割り当てはコマ枠に持つが、コマの外のレイヤーにも付けられる。
// 対象を枠だけに絞ると、レイヤーに付けた分がキャンバスから消える
function collectHosts(){
var result=[];
if(typeof canvas==='undefined'||!canvas)return result;
canvas.getObjects().forEach(function(object){
if(object.excludeFromExport)return;
var ids=Array.isArray(object.referenceIds)?object.referenceIds:[];
if(!ids.length)return;
result.push({host:object,ids:ids,groups:ReferenceCollector.getGroups(object)});
});
return result;
}
// 中身が変わったときだけ作り直す。位置合わせは毎フレーム走るため、
// ここで毎回DOMを作ると拡大やドラッグのたびに画像を読み直すことになる
function signatureOf(hosts){
return hosts.map(function(item){
// 枠を組み替えたときも作り直す。入れないと鎖のしるしが古いまま残る
var groups=item.groups.map(function(group){
return group.ids.join('+')+'>'+(group.prompt||'');
}).join(';');
return(item.host.guid||'')+':'+item.ids.join(',')+':'+groups;
}).join('|');
}
function buildThumb(sheet){
var img=document.createElement('img');
img.src=sheet.dataUrl;
img.alt='';
return img;
}
// 実体の無い参照を黙って飛ばさない。付けたつもりの参照が抜けたまま生成されるのを防ぐ
function buildMissingMark(count){
var mark=document.createElement('span');
mark.className='rs-canvas-chip-missing';
mark.textContent='!'+count;
return mark;
}
// 枠の中身（何と何が組か）は枠そのもので見せる。文字はツールチップへ回す
function relationLines(item,sheets){
var nameById={};
sheets.forEach(function(sheet){nameById[sheet.id]=sheet.name||i18next.t('refSlotUnnamed');});
var lines=[];
item.groups.forEach(function(group){
var names=group.ids.map(function(id){return nameById[id];}).filter(Boolean);
// 1枚だけの枠は関係ではない
if(names.length<2)return;
var line=names.join(' + ');
if(group.prompt)line+=': '+group.prompt;
lines.push(line);
});
return lines;
}
function chipTitle(item,sheets,missingCount,relations){
var lines=sheets.map(function(sheet){
return sheet.name||i18next.t('refSlotUnnamed');
});
if(relations.length)lines=lines.concat([''],relations);
if(missingCount)lines.push(i18next.t('refMissingSheets',{count:missingCount}));
return lines.join('\n');
}
// **枠はウインドウと同じ形で出す。** 鎖のアイコン1つでは「関係が付いている」ことしか
// 分からず、何と何が組なのかは結局コマを選び直して確かめることになる。
// 同じ資料を複数の枠で使っていれば、その枚数だけ枠の中に出る（送る画像は1枚のまま）
function buildChip(item){
var chip=document.createElement('div');
chip.className='rs-canvas-chip';
var sheets=[];
var byId={};
var missingCount=0;
item.ids.forEach(function(id){
var sheet=ReferenceSheetStore.getProjectById(id);
if(sheet){
sheets.push(sheet);
byId[id]=sheet;
}else{
missingCount++;
}
});
item.groups.forEach(function(group){
var members=group.ids.filter(function(id){return byId[id];});
if(!members.length)return;
// 1枚だけの枠は関係を持たない。囲むと全部が組に見える。
// ただし**余白は枠と同じだけ取る**（取らないと枠の分だけずれて並びが揃わない）
if(members.length===1){
var solo=document.createElement('div');
solo.className='rs-canvas-solo';
solo.appendChild(buildThumb(byId[members[0]]));
chip.appendChild(solo);
return;
}
var box=document.createElement('div');
box.className='rs-canvas-group';
// 囲みだけでは「なぜ囲まれているのか」が読めない。鎖のしるしを先頭に置く
var mark=document.createElement('i');
mark.className='material-icons rs-canvas-group-mark';
mark.textContent='link';
box.appendChild(mark);
members.forEach(function(id){
box.appendChild(buildThumb(byId[id]));
});
chip.appendChild(box);
});
if(missingCount)chip.appendChild(buildMissingMark(missingCount));
chip.title=chipTitle(item,sheets,missingCount,relationLines(item,sheets));
// 押したらそのコマを選んでウインドウを開く。見つけた場所から直せるようにする
chip.addEventListener('mousedown',function(event){
event.stopPropagation();
});
chip.addEventListener('click',function(event){
event.stopPropagation();
// ロックしたコマは選択できない。選択の代わりに対象コマとして渡す
referenceSheetWindow.open(item.host);
});
return chip;
}
function rebuild(hosts){
var root=ensureRoot();
if(!root)return;
root.textContent='';
items=hosts.map(function(item){
var chip=buildChip(item);
root.appendChild(chip);
return{host:item.host,el:chip};
});
}
function reposition(){
if(!rootEl)return;
var scale=typeof getCanvasDisplayScale==='function'?getCanvasDisplayScale():1;
rootEl.style.setProperty('--rs-chip-inv',String(scale?1/scale:1));
items.forEach(function(item){
var rect=item.host.getBoundingRect(true,true);
item.el.style.left=Math.round(rect.left+4)+'px';
item.el.style.top=Math.round(rect.top+4)+'px';
// コマの右端で折り返す。**チップの中身は倍率の逆数で戻している**ため、
// 幅もキャンバス上の大きさではなく画面上の大きさへ換算してから渡す
// （換算しないと、拡大するほど折り返しが早まる）
var available=Math.round((rect.width-8)*(scale||1));
item.el.style.maxWidth=Math.max(CHIP_MIN_WIDTH,available)+'px';
});
}
// ドロップ先の枠。**チップの表示（#rsShowOnCanvas）とは別に持つ。**
// 表示を切っている人にも、どのコマへ入るのかは見えないと落とせない
function ensureDropEl(){
if(dropEl&&dropEl.parentNode)return dropEl;
if(typeof canvas==='undefined'||!canvas||!canvas.wrapperEl)return null;
dropEl=document.createElement('div');
dropEl.id='referenceCanvasDropTarget';
dropEl.style.display='none';
canvas.wrapperEl.appendChild(dropEl);
return dropEl;
}
function setDropHost(host){
var el=ensureDropEl();
if(!el)return;
if(!host){
el.style.display='none';
return;
}
var rect=host.getBoundingRect(true,true);
el.style.left=Math.round(rect.left)+'px';
el.style.top=Math.round(rect.top)+'px';
el.style.width=Math.round(rect.width)+'px';
el.style.height=Math.round(rect.height)+'px';
el.style.display='block';
}
function update(){
var root=ensureRoot();
if(!root)return;
if(!isEnabled()){
if(items.length||root.childNodes.length){
root.textContent='';
items=[];
lastSignature='';
}
root.style.display='none';
return;
}
root.style.display='block';
var hosts=collectHosts();
var signature=signatureOf(hosts);
if(signature!==lastSignature){
lastSignature=signature;
rebuild(hosts);
}
reposition();
}
// 描画のたびに走るため、1フレームに1回へまとめる。
// 隠れているタブでは描画自体が不要なので、発火しないままで問題ない
function requestUpdate(){
if(frameRequested)return;
frameRequested=true;
requestAnimationFrame(function(){
frameRequested=false;
update();
});
}
// 割り当てを変えた直後は、次の描画を待たずに作り直す
function refresh(){
lastSignature='';
requestUpdate();
}
document.addEventListener('DOMContentLoaded',function(){
syncCheckboxes();
if(typeof canvas==='undefined'||!canvas)return;
canvas.on('after:render',requestUpdate);
var scrollContainer=$('resizable-container');
if(scrollContainer)scrollContainer.addEventListener('scroll',requestUpdate,{passive:true});
window.addEventListener('resize',requestUpdate);
requestUpdate();
});
return{
isEnabled:isEnabled,
setEnabled:setEnabled,
syncCheckboxes:syncCheckboxes,
update:requestUpdate,
refresh:refresh,
setDropHost:setDropHost
};
})();
