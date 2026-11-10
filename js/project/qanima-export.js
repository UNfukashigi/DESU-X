// DESU-X JSON で書き出す（ファイル → DESU-X JSON で書き出し）。
// 取り込み（qanima-folder-import.js）と同じ形式 "qanima-editor-1" で、全ページの文字と配置を JSON にする。
//   JSON だけ：画像は場所（読み込んだ JSON・ZIP の project.json からの相対パス img/xxx.png）だけを書く。
//              取り込んだ画像は qaSrc（元の相対パス）、エディタで足した画像・線などは img/added_*.png（ZIP にだけある）
//   ZIP     ：同じ project.json に、すべての画像（img/）を入れる。ZIP はキャンバスへドロップすると取り込める
// 座標は取り込みと同じく、横 1748 のページの画素（作品の組版と同じ）。キャンバスの大きさで割って戻す。
// ブラウザは画像の絶対パスを知れないので、絶対パスは書かない（作品名 title と相対パスから、受け取った側で決める）

const QA_PAGE_WIDTH=1748;

function qaRound(v){
return Math.round(v*100)/100;
}

// 多角形の点を、キャンバスの座標（回転・拡大込み）で返す
function qaPanelPoints(panel){
const m=panel.calcTransformMatrix();
return panel.points.map(function(pt){
return fabric.util.transformPoint({x:pt.x-panel.pathOffset.x,y:pt.y-panel.pathOffset.y},m);
});
}

async function qaBlobFromSrc(src){
const res=await fetch(src);
return await res.blob();
}

// 1ページ分を書き出す。images は ZIP に入れる画像（相対パス → 取り出し方）
async function qaExportCurrentPage(pageNo,images){
const k=canvas.width/QA_PAGE_WIDTH;
const objects=canvas.getObjects();
const panels=objects.filter(function(o){return isPanel(o);});
const items=[];
let added=0;

function folderOf(o,item){
if(o.layerFolderName){
item.folder=o.layerFolderName;
item.folderLocked=!!o.layerFolderLocked;
}
return item;
}
function panelIndexOf(o){
const i=o.relatedPoly?panels.indexOf(o.relatedPoly):-1;
return i>=0?i:null;
}
// 画像の相対パス。取り込んだ物は元の場所、エディタで足した物は ZIP の中だけの名前
function imagePathOf(o){
if(o.qaSrc){
if(!images.has(o.qaSrc)){
images.set(o.qaSrc,{src:o.getSrc()});
}
return {img:o.qaSrc,zipOnly:false};
}
added++;
const path="img/added_p"+pageNo+"_"+String(added).padStart(2,"0")+".png";
images.set(path,{src:o.getSrc()});
return {img:path,zipOnly:true};
}
// 種類の分からない物（ペンの線・トーン・図形など）は、見た目のまま画像にする
function rasterize(o){
added++;
const path="img/added_p"+pageNo+"_"+String(added).padStart(2,"0")+".png";
const br=o.getBoundingRect(true,true);
images.set(path,{dataUrl:o.toDataURL({multiplier:1/k})});
return {type:"image",img:path,zipOnly:true,left:qaRound(br.left/k),top:qaRound(br.top/k),scaleX:1,scaleY:1,name:o.name||o.type};
}
function textItem(t){
const br=t.getBoundingRect(true,true);
const c=t.getCenterPoint();
return {
text:t.text,font:t.fontFamily,size:qaRound(t.fontSize*(t.scaleX||1)/k),
cx:qaRound(c.x/k),cy:qaRound(c.y/k),w:qaRound(br.width/k),h:qaRound(br.height/k),
stroke:t.stroke&&t.strokeWidth?qaRound(t.strokeWidth/k/2):0,
name:t.name||t.text.replace(/\n/g,"").slice(0,12)
};
}

objects.forEach(function(o){
if(o.isInitMessage||o.excludeFromExport||!o.visible){
return;
}
if(isPanel(o)){
const pts=qaPanelPoints(o).map(function(p){return [qaRound(p.x/k),qaRound(p.y/k)];});
const item={type:"panel",poly:pts,line:qaRound((o.strokeWidth||0)/k),noframe:!o.stroke||o.stroke==="transparent",name:o.name||"コマ"};
// コマの中の最初の画像を、コマと組にして書く（取り込みと同じ形）。2枚目以降は image として書く
const img=objects.find(function(x){return isImage(x)&&x.relatedPoly===o&&x.visible;});
if(img){
const p=imagePathOf(img);
Object.assign(item,{img:p.img,zipOnly:p.zipOnly,left:qaRound(img.left/k),top:qaRound(img.top/k),
scale:img.scaleX/k,scaleY:img.scaleY/k,angle:img.angle||0,flip:!!img.flipX,flipY:!!img.flipY,imgName:img.name});
img.__qaDone=true;
}
items.push(folderOf(o,item));
return;
}
if(isImage(o)){
if(o.__qaDone){
delete o.__qaDone;
return;
}
const p=imagePathOf(o);
const item={type:"image",img:p.img,zipOnly:p.zipOnly,left:qaRound(o.left/k),top:qaRound(o.top/k),
scaleX:o.scaleX/k,scaleY:o.scaleY/k,angle:o.angle||0,flip:!!o.flipX,flipY:!!o.flipY,name:o.name||"画像"};
const pi=panelIndexOf(o);
if(pi!=null){
item.panelIndex=pi;
}
items.push(folderOf(o,item));
return;
}
if(isSpeechBubbleSVG(o)){
const text=getSpeechBubbleTextBySVG(o);
const item=Object.assign(text?textItem(text):{text:"",font:"",size:40},{
type:"bubble",
shape:null,
box:[qaRound(o.left/k),qaRound(o.top/k),qaRound(o.width*o.scaleX/k),qaRound(o.height*o.scaleY/k)],
line:4,name:o.name||"フキダシ"
});
const pi=panelIndexOf(o);
if(pi!=null){
item.panelIndex=pi;
}
items.push(folderOf(o,item));
return;
}
// 吹き出しの中の文字・文字の枠は、吹き出しと一緒に書いたので飛ばす
if(isSpeechBubbleText(o)||isSpeechBubbleRect(o)){
return;
}
if(isVerticalText(o)){
items.push(folderOf(o,Object.assign(textItem(o),{type:"text"})));
return;
}
if(isText(o)){
items.push(folderOf(o,Object.assign(textItem(o),{type:"text",horizontal:true})));
return;
}
items.push(folderOf(o,rasterize(o)));
});
return {width:QA_PAGE_WIDTH,height:qaRound(canvas.height/k),items:items};
}

// 全ページを順に開いて書き出し、最後に元のページへ戻す
async function qaExportProject(){
await btmSaveCurrentPage(false);
const original=getCanvasGUID();
const images=new Map();
const pages=[];
const guids=btmGetGuids();
for(let i=0;i<guids.length;i++){
await chengeCanvasByGuid(guids[i]);
await btmWaitForPageReady(10000);
canvas.discardActiveObject();
pages.push(await qaExportCurrentPage(i+1,images));
}
if(original&&guids.indexOf(original)>=0){
await chengeCanvasByGuid(original);
}
const titled=canvas.getObjects().find(function(o){return o.qaWork;});
const title=titled?titled.qaWork:"manga";
const project={format:"qanima-editor-1",title:title,source:"DESU-X",
note:"img は project.json からの相対パス。zipOnly の画像は ZIP にだけある",fonts:[],pages:pages};
return {project:project,images:images,title:title};
}

function qaDownloadBlob(blob,name){
const a=document.createElement("a");
a.href=URL.createObjectURL(blob);
a.download=name;
document.body.appendChild(a);
a.click();
a.remove();
setTimeout(function(){URL.revokeObjectURL(a.href);},5000);
}

async function qaExportDownload(withImages){
const loading=OP_showLoading({icon:'process',step:'Step1',substep:'DESU-X JSON Export',progress:0});
try{
const result=await qaExportProject();
const json=JSON.stringify(result.project,null,1);
if(!withImages){
qaDownloadBlob(new Blob([json],{type:"application/json"}),result.title+".json");
return;
}
const zip=new JSZip();
zip.file("project.json",json);
for(const [path,info] of result.images){
const blob=info.dataUrl?await qaBlobFromSrc(info.dataUrl):await qaBlobFromSrc(info.src);
zip.file(path,blob);
}
qaDownloadBlob(await zip.generateAsync({type:"blob"}),result.title+".zip");
}catch(error){
console.error(error);
createToastError("DESU-X JSON で書き出し",String(error));
}finally{
OP_hideLoading(loading);
}
}

document.addEventListener('DOMContentLoaded',function(){
const jsonButton=$("qanimaExportJson");
const zipButton=$("qanimaExportZip");
if(jsonButton){
jsonButton.addEventListener("click",function(e){e.preventDefault();qaExportDownload(false);});
}
if(zipButton){
zipButton.addEventListener("click",function(e){e.preventDefault();qaExportDownload(true);});
}
});
