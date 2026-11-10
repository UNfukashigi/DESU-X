// DESU-X JSON（format: qanima-editor-1。仕様は DESU-X_JSON仕様.md）のプロジェクトを読み込む。
// フォルダの中身: project.json（ページ・コマ・画像・文字の位置）、img/、fonts/
// ZIPを作らずにフォルダをそのまま選ぶ。file:// でも動くよう、画像は FileReader で dataURL にしてから置く
// （file:// の画像を直接読むとキャンバスが汚染され、保存・書き出しができなくなるため）。
// 座標はすべて書き出し側のページの画素（1748×2480）で、ここでキャンバスの大きさへ縮める。

function qaReadAsDataURL(file){
return new Promise(function(resolve,reject){
const reader=new FileReader();
reader.onload=function(){resolve(reader.result);};
reader.onerror=reject;
reader.readAsDataURL(file);
});
}

function qaLoadImage(dataUrl){
return new Promise(function(resolve){
fabric.Image.fromURL(dataUrl,function(img){resolve(img);});
});
}

// フォルダ選択で渡る webkitRelativePath は「選んだフォルダ名/img/xx.png」。先頭のフォルダ名を外して引く
function qaBuildFileMap(fileList){
const map=new Map();
Array.from(fileList).forEach(function(file){
const parts=file.webkitRelativePath.split('/');
map.set(parts.slice(1).join('/'),file);
});
return map;
}

// 埋め込み（data）があればそれを、なければ選んだフォルダのファイルを使う
async function qaGetImageDataURL(item,fileMap){
if(item.data){
return item.data;
}
const file=fileMap.get(item.img);
if(!file){
createToastError("DESU-X JSON 読み込み","画像がありません: "+item.img);
return null;
}
return await qaReadAsDataURL(file);
}

async function qaGetFontBuffer(font,fileMap){
if(font.data){
return Uint8Array.from(atob(font.data),function(c){return c.charCodeAt(0);}).buffer;
}
const file=fileMap.get(font.file);
return file?await file.arrayBuffer():null;
}

async function qaRegisterFonts(fonts,fileMap){
for(const font of fonts||[]){
if(!fontManager.existsFont(font.name)){
const buffer=await qaGetFontBuffer(font,fileMap);
if(!buffer){
createToastError("DESU-X JSON 読み込み","フォントがありません: "+font.file);
continue;
}
await fontManager.registerFontFromBuffer(buffer,font.name);
}
await document.fonts.load('40px "'+font.name+'"');
}
}

function qaCreatePanel(item,k){
const points=item.poly.map(function(p){return {x:p[0]*k,y:p[1]*k};});
const panel=new fabric.Polygon(points,{
strokeWidth:item.line*k,
strokeUniform:true,
stroke:item.noframe?"transparent":"black",
fill:"transparent",
objectCaching:false,
transparentCorners:false,
cornerColor:"Blue",
isPanel:true
});
setText2ImageInitPrompt(panel);
setPanelValue(panel);
panel.name=item.name;
canvas.add(panel);
// 取り込んだ物はロックしない（ロックするのはフォルダだけ。lfCreateFolder がロック付きで作る）
panel.selectable=true;
return panel;
}

// 楕円の吹き出しの SVG。外側の黒い楕円と内側の白い楕円（fillArea）。
// parseSvg() は面積が30%以上の面のうち小さい方を文字の入る形に使うので、内側の白が選ばれる
function qaEllipseBubbleSvg(w,h,line){
const cx=w/2,cy=h/2,rx=w/2,ry=h/2,irx=rx-line,iry=ry-line;
const ell=function(a,b){return "M "+(cx-a)+","+cy+" A "+a+","+b+" 0 1,0 "+(cx+a)+","+cy+" A "+a+","+b+" 0 1,0 "+(cx-a)+","+cy+" Z";};
return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+w+' '+h+'" width="'+w+'" height="'+h+'">'+
'<path fill="#000000" d="'+ell(rx,ry)+'"/>'+
'<path id="fillArea" class="st0" fill="#FFFFFF" d="'+ell(irx,iry)+'"/></svg>';
}

// エディタの吹き出し（フキダシ＋文字の枠＋文字がつながった物）を、手で置いたときと同じ作り方で作る
// （loadSpeechBubbleSVGReadOnly → createSpeechBubbleMetrics）。そのあと文字・書体・大きさを差し替える
async function qaCreateBubble(item,k){
const w=item.box[2],h=item.box[3];
// フキダシは楕円（配布版には手描きフキダシの形は入っていないので、shape は使わない）
const svg=qaEllipseBubbleSvg(w,h,item.line||4);
const svgObject=await new Promise(function(resolve){
fabric.loadSVGFromString(svg,function(objects,options){resolve(fabric.util.groupSVGElements(objects,options));});
});
svgObject.set({
left:item.box[0]*k,top:item.box[1]*k,
scaleX:w*k/svgObject.width,scaleY:h*k/svgObject.height,
selectable:true,hasControls:true,hasBorders:true
});
svgObject.baseScaleX=svgObject.scaleX;
svgObject.baseScaleY=svgObject.scaleY;
svgObject.name=item.name;
withoutHistory(function(){
canvas.add(svgObject);
});
createSpeechBubbleMetrics(svgObject,parseSvg(svg));
const text=getSpeechBubbleTextBySVG(svgObject);
if(text){
text.set({
text:item.text,
fontFamily:item.font,
fontSize:item.size*k,
lineHeight:1.15/fabric.Text.prototype._fontSizeMult,
fill:"#000000",
stroke:null,
strokeWidth:0
});
text.name=item.name;
// エディタは縦書きの文字の高さ（折り返す長さ）を、文字の入る枠の「幅」で作る（createSpeechBubbleMetrics）。
// 縦長のフキダシだと短すぎてセリフが途中で折り返されるので、枠の高さに直す
const textRect=getSpeechBubbleRectBySVG(svgObject);
if(textRect&&isVerticalText(text)){
text.set({height:textRect.height});
}
if(text.initDimensions){
text.initDimensions();
}
updateObjectPositions(svgObject,true);
}
return svgObject;
}

async function qaPlaceItem(item,k,fileMap){
if(item.type==="panel"){
const panel=qaCreatePanel(item,k);
// 画像の入っていないコマ（エディタで書き出した空のコマ）
if(!item.img&&!item.data){
return [panel];
}
const dataUrl=await qaGetImageDataURL(item,fileMap);
if(!dataUrl){
return [panel];
}
const img=await qaLoadImage(dataUrl);
img.set({left:item.left*k,top:item.top*k,scaleX:item.scale*k,scaleY:(item.scaleY!=null?item.scaleY:item.scale)*k,angle:item.angle||0,flipX:!!item.flip,flipY:!!item.flipY});
img.name=item.imgName||item.name;
// 書き出し（qanima-export.js）のときに、元の画像の場所（project.json からの相対パス）として使う
img.qaSrc=item.img;
const center=panel.getCenterPoint();
putImageInFrame(img,center.x,center.y,true,false,false,panel);
return [panel,img];
}
if(item.type==="image"){
const dataUrl=await qaGetImageDataURL(item,fileMap);
if(!dataUrl){
return;
}
const img=await qaLoadImage(dataUrl);
const sx=item.scaleX!=null?item.scaleX:1;
img.set({left:item.left*k,top:item.top*k,scaleX:sx*k,scaleY:(item.scaleY!=null?item.scaleY:sx)*k,angle:item.angle||0,flipX:!!item.flip,flipY:!!item.flipY});
img.name=item.name;
img.qaSrc=item.img;
canvas.add(img);
return img;
}
if(item.type==="bubble"){
return await qaCreateBubble(item,k);
}
if(item.type==="text"&&item.horizontal){
const textH=new fabric.Textbox(item.text,{
fontFamily:item.font,fontSize:item.size*k,fill:"#000000",
stroke:item.stroke?"#ffffff":null,strokeWidth:item.stroke*k*2,paintFirst:"stroke",
originX:"center",originY:"center",left:item.cx*k,top:item.cy*k,width:item.w*k,textAlign:"left"
});
textH.name=item.name;
canvas.add(textH);
return textH;
}
if(item.type==="text"){
const text=new VerticalTextbox(item.text,{
fontFamily:item.font,
fontSize:item.size*k,
fill:"#000000",
stroke:item.stroke?"#ffffff":null,
strokeWidth:item.stroke*k*2,
paintFirst:"stroke",
textAlign:"right",
// 列の間隔を組版（1列＝文字の1.15倍）に合わせる。
// 既定のままだと列が広がり、2列目以降がフキダシ・枠の外へ出る
lineHeight:1.15/fabric.Text.prototype._fontSizeMult,
// 縦書きは右の列から並ぶので、右上を合わせる（中心で合わせると、エディタが測る幅の分だけ左へずれる）
originX:"right",
originY:"top",
left:(item.cx+item.w/2)*k,
top:(item.cy-item.h/2)*k,
height:item.h*k,
cornerSize:8,
transparentCorners:false,
cornerStyle:'circle',
borderScaleFactor:2,
padding:10
});
text.name=item.name;
canvas.add(text);
// VerticalTextbox は left/origin をそのまま使わないことがあるので、描いた後の外接矩形で右上を合わせ直す
// （寸法は最初の描画で決まり直すので、一度描いてから測る）
canvas.renderAll();
const box=text.getBoundingRect(true,true);
text.set({left:text.left+(item.cx+item.w/2)*k-(box.left+box.width),top:text.top+(item.cy-item.h/2)*k-box.top});
text.setCoords();
return text;
}
}

async function qaImportFolder(fileList){
const fileMap=qaBuildFileMap(fileList);
const projectFile=fileMap.get("project.json");
if(!projectFile){
createToastError("フォルダから読み込み","project.json がありません。DESU-X JSON の project.json が入ったフォルダを選んでください");
return;
}
await qaImportProject(JSON.parse(await projectFile.text()),fileMap);
}

// キャンバスへ project.json を1つドロップしたとき。画像・フォントは JSON に埋め込まれている物を使い、
// 新しいページとして足す（今のページが空ならそこを使う）
async function qaImportDroppedJson(file){
const project=JSON.parse(await file.text());
if(project.format!=="qanima-editor-1"){
createToastError("DESU-X JSON 読み込み","DESU-X JSON（format: qanima-editor-1）ではありません");
return;
}
const loading=OP_showLoading({icon:'process',step:'Step1',substep:'DESU-X JSON Load',progress:0});
try{
await qaImportProject(project,new Map());
}finally{
OP_hideLoading(loading);
}
}

function qaIsQanimaJsonFile(file){
return /\.json$/i.test(file.name);
}

function qaIsQanimaZipFile(file){
return /\.zip$/i.test(file.name);
}

// qanima-export.js が書き出した ZIP（project.json＋img/）をドロップしたとき。
// ZIP の中のファイルを、フォルダから読み込むときと同じ「相対パス → Blob」の表にして渡す
async function qaImportDroppedZip(file){
const zip=await JSZip.loadAsync(file);
const names=Object.keys(zip.files).filter(function(n){return !zip.files[n].dir;});
const projectName=names.find(function(n){return n==="project.json"||n.endsWith("/project.json");});
if(!projectName){
createToastError("DESU-X JSON 読み込み","ZIP の中に project.json がありません");
return;
}
const base=projectName.slice(0,projectName.length-"project.json".length);
const fileMap=new Map();
for(const n of names){
if(n.startsWith(base)){
fileMap.set(n.slice(base.length),await zip.file(n).async("blob"));
}
}
const project=JSON.parse(await zip.file(projectName).async("string"));
const loading=OP_showLoading({icon:'process',step:'Step1',substep:'DESU-X JSON Load',progress:0});
try{
await qaImportProject(project,fileMap);
}finally{
OP_hideLoading(loading);
}
}

// 今のページが空ならそこを使い、中身があれば新しいページを足す
async function qaImportProject(project,fileMap){
await qaRegisterFonts(project.fonts,fileMap);
for(let i=0;i<project.pages.length;i++){
const page=project.pages[i];
// 1ページ目は、今のページが空ならそこに作る（空のページが1枚余らないように）
// （起動直後のページもボトムバーには載っているので、中身があるかで見る）
const newPage=i>0||canvas.getObjects().some(function(o){return !o.isInitMessage;});
await loadBookSize(210,210*page.height/page.width,false,newPage);
withoutHistory(function(){
canvas.getObjects().filter(function(o){return o.isInitMessage;}).forEach(function(o){canvas.remove(o);});
});
const k=canvas.width/page.width;
await withoutHistoryAsync(async function(){
// "folder" の付いた物（フキダシと文字など）は、名前ごとにレイヤーフォルダへまとめる
const folders=new Map();
const folderLocked=new Map();
const panelByFolder=new Map();
const panels=[];
for(const item of page.items){
const placed=await qaPlaceItem(item,k,fileMap);
if(!placed){
continue;
}
(Array.isArray(placed)?placed:[placed]).forEach(function(o){o.qaWork=project.title;});
if(Array.isArray(placed)&&isPanel(placed[0])){
panels.push(placed[0]);
}
// panelIndex：そのページの何番目のコマに入っているか（エディタで書き出したJSON）。コマの形で切れる
if(item.panelIndex!=null&&panels[item.panelIndex]&&!Array.isArray(placed)){
moveSettings(placed,panels[item.panelIndex]);
setGUID(panels[item.panelIndex],placed);
}
if(item.folder&&item.folderLocked===false){
folderLocked.set(item.folder,false);
}
if(item.folder){
const key=item.folder;
if(!folders.has(key)){
folders.set(key,[]);
}
// コマは中の画像と、吹き出しは中の文字・文字の枠と一緒に入れる（片方だけだと、まとめて動かしたときに置いていかれる）
let objs=Array.isArray(placed)?placed:[placed];
if(Array.isArray(placed)&&isPanel(placed[0])){
panelByFolder.set(key,placed[0]);
}
// コマの中の吹き出しは、そのコマに入れる（コマの形で切れる。文字が見えていればフキダシは枠で切れてよい）
if(item.panelIndex==null&&isSpeechBubbleSVG(placed)&&panelByFolder.has(key)){
const host=panelByFolder.get(key);
moveSettings(placed,host);
setGUID(host,placed);
}
if(isSpeechBubbleSVG(placed)){
objs=[placed,getSpeechBubbleTextBySVG(placed),getSpeechBubbleRectBySVG(placed)].filter(Boolean);
}
folders.set(key,folders.get(key).concat(objs));
}
}
folders.forEach(function(objs,name){
const id=lfCreateFolder(objs,name);
// フォルダは既定でロック。書き出したときにロックを外していたフォルダだけ外す
if(folderLocked.get(name)===false){
lfGetMembers(id).forEach(function(o){o.layerFolderLocked=false;});
}
});
});
canvas.renderAll();
updateLayerPanel();
commitHistory();
flushHistory();
}
await btmSaveCurrentPage(false);
createToast("フォルダから読み込み",project.title+"（"+project.pages.length+"ページ）");
}

// withoutHistory は同期の関数用。await をまたぐので深さカウンタを直接使い、finally で必ず戻す
async function withoutHistoryAsync(fn){
changeDoNotSaveHistory();
try{
await fn();
}finally{
changeDoSaveHistory();
}
}

document.addEventListener('DOMContentLoaded',function(){
const button=$("qanimaFolderLoad");
const input=$("qanimaFolderInput");
if(!button||!input){
return;
}
button.addEventListener("click",function(e){
e.preventDefault();
input.value="";
input.click();
});
input.addEventListener("change",async function(){
if(!input.files||input.files.length===0){
return;
}
const loading=OP_showLoading({icon:'process',step:'Step1',substep:'Folder Load',progress:0});
try{
await qaImportFolder(input.files);
}catch(error){
console.error(error);
createToastError("フォルダから読み込み",String(error));
}finally{
OP_hideLoading(loading);
}
});
});
