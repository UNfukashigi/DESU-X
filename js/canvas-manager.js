var initialCanvasWidth=0;
var initialCanvasHeight=0;
var aspectRatio=0;

let resizeTimer;
function initResizeCanvas(event) {
canvasLogger.debug("initResizeCanvas");
if(event){
event.stopPropagation();
event.preventDefault();
}
var container=$("canvas-container");
var containerWidth=container.clientWidth;
var containerHeight=container.clientHeight;

if (
containerWidth<minCanvasSizeWidth||
containerHeight<minCanvasSizeHeight
) {
return;
}

if (resizeTimer) {
clearTimeout(resizeTimer);
}
resizeTimer=setTimeout(function () {
// 空ページの案内文はloadBookSize()の中で出す。ここで重ねて呼ぶと出す場所が2か所に散る
loadBookSize(210,297,false);
},15);
}

// 原稿の物理サイズ(mm)。キャンバスのピクセルサイズはウィンドウ依存のため、
// 出力解像度はこの値とDPIから決める
const DEFAULT_PAGE_WIDTH_MM=148;
const DEFAULT_PAGE_HEIGHT_MM=210;
var hasProjectPageSize=true;

function getPageSizeMm(){
var widthInput=$("pageWidthMm");
var heightInput=$("pageHeightMm");
var width=widthInput ? parseFloat(widthInput.value) : NaN;
var height=heightInput ? parseFloat(heightInput.value) : NaN;
if(!(width>0)||!(height>0)){
return {width:DEFAULT_PAGE_WIDTH_MM,height:DEFAULT_PAGE_HEIGHT_MM};
}
return {width:width,height:height};
}

function setPageSizeMm(width,height){
if(!(width>0)||!(height>0)){
return;
}
var widthInput=$("pageWidthMm");
var heightInput=$("pageHeightMm");
if(widthInput){widthInput.value=width;}
if(heightInput){heightInput.value=height;}
}

// 空のページに出す案内文（initMessage）の唯一の入口。
// 空のページに出す案内文の入り口。保存対象から外す指定は initMessage()（fabric-util.js）が
// オブジェクト定義側で持つ（excludeFromExport）
function showEmptyPageMessage(){
initMessage();
}

// 原稿サイズ(mm)はページのピクセル寸法から決める。ピクセル寸法はウィンドウの
// 大きさで変わるため絶対値には意味が無く、比率だけを使う。
// 長辺をA4の長辺(297mm)に合わせると「縦ページ」(210:297)は従来どおり210×297mmになり、
// getCropAndDownloadLink()のmultiplier=Math.max(横倍率,縦倍率)が縦横で一致するため、
// 原稿サイズがそのまま出力サイズになる（mmが出力の下限にしかならない状態を避ける）
const PAGE_LONG_SIDE_MM=297;

function derivePageSizeMm(pixelWidth,pixelHeight){
var width=parseFloat(pixelWidth);
var height=parseFloat(pixelHeight);
if(!(width>0)||!(height>0)){
return null;
}
// 入力欄の刻み(step=1)に合わせて整数mmへ丸める。丸めた分だけ比率がずれるが、
// ずれは最大0.5mm/297mm=0.17%で、その分だけ出力が大きくなる
if(width>=height){
return {width:PAGE_LONG_SIDE_MM,height:Math.round(PAGE_LONG_SIDE_MM*height/width)};
}
return {width:Math.round(PAGE_LONG_SIDE_MM*width/height),height:PAGE_LONG_SIDE_MM};
}

// プロジェクト読み込み時に原稿サイズを復元する。未記録の旧プロジェクトは
// 従来どおりA5換算で出力するが、その旨を出力時に明示する
function applyPageSizeMm(canvasInfo){
if(canvasInfo&&canvasInfo.pageWidthMm>0&&canvasInfo.pageHeightMm>0){
setPageSizeMm(canvasInfo.pageWidthMm,canvasInfo.pageHeightMm);
hasProjectPageSize=true;
return;
}
setPageSizeMm(DEFAULT_PAGE_WIDTH_MM,DEFAULT_PAGE_HEIGHT_MM);
hasProjectPageSize=false;
}

function resizeCanvasByNum(newWidth,newHeight) {
canvas.setWidth(newWidth);
canvas.setHeight(newHeight);
initialCanvasWidth=canvas.getWidth();
initialCanvasHeight=canvas.getHeight();
aspectRatio=initialCanvasWidth/initialCanvasHeight;
canvas.renderAll();
}

function resizeCanvas(newWidth,newHeight) {
if(!newWidth||!newHeight||isNaN(newWidth)||isNaN(newHeight)){
return;
}
canvas.setDimensions({width: newWidth,height: newHeight});
// キャンバスの再フィットは表示上の追従であり編集操作ではないため履歴に残さない
withoutHistory(function(){
canvas.getObjects().forEach((obj)=>{

var scaleX=newWidth/obj.initial.canvasWidth;
var scaleY=newHeight/obj.initial.canvasHeight;

obj.set({
scaleX: obj.initial.scaleX*scaleX,
scaleY: obj.initial.scaleY*scaleY,
left: obj.initial.left*scaleX,
top: obj.initial.top*scaleY,
strokeWidth: obj.initial.strokeWidth*scaleX,
});

if (obj.clipPath) {
scaleX=newWidth/obj.clipPath.initial.canvasWidth;
scaleY=newHeight/obj.clipPath.initial.canvasHeight;
const clipPath=obj.clipPath;
clipPath.set({
scaleX: obj.clipPath.initial.scaleX*scaleX,
scaleY: obj.clipPath.initial.scaleY*scaleY,
left: obj.clipPath.initial.left*scaleX,
top: obj.clipPath.initial.top*scaleY,
});
clipPath.setCoords();
}
// initialは再フィットの基準点。ここで更新すると基準が毎回ずれて誤差が蓄積するため更新しない
obj.setCoords();
});
});
canvas.renderAll();
}

function forcedAdjustCanvasSize() {
adjustCanvasSize(true);
}


//forced = 強制
function adjustCanvasSize(forced) {
var container=$("canvas-container");
var windowWidth=container.clientWidth;
var windowHeight=container.clientHeight;
if(!windowWidth||!windowHeight||!aspectRatio||isNaN(aspectRatio)){
return;
}
const windowAspectRatio=windowWidth/windowHeight;
let newWidth,newHeight;
if (windowAspectRatio>aspectRatio) {
newHeight=windowHeight;
newWidth=windowHeight*aspectRatio;
} else {
newWidth=windowWidth;
newHeight=windowWidth/aspectRatio;
}

if (forced) {
//next
} else if (newWidth==canvas.getWidth()&&newHeight==canvas.getHeight()) {
return;
}

resizeCanvas(newWidth,newHeight);
}

window.addEventListener("resize",adjustCanvasSize);

function adjustCanvasSizeWithContainer(windowWidth,windowHeight) {
const windowAspectRatio=windowWidth/windowHeight;
let newWidth,newHeight;
if (windowAspectRatio>aspectRatio) {
newHeight=windowHeight;
newWidth=windowHeight*aspectRatio;
} else {
newWidth=windowWidth;
newHeight=windowWidth/aspectRatio;
}
resizeCanvas(newWidth,newHeight);
}

function addInitialImageToCanvas(img) {
var container=$("canvas-container");
var containerWidth=container.clientWidth;
var containerHeight=container.clientHeight;
resizeCanvasByNum(img.width,img.height);
initialPutImage(img);
adjustCanvasSizeWithContainer(containerWidth,containerHeight);
}


function resizeCanvasToObject(objectWidth,objectHeight) {
var container=$("canvas-container");
var containerWidth=container.clientWidth;
var containerHeight=container.clientHeight;
if(!containerWidth||!containerHeight||!objectWidth||!objectHeight){
return;
}

// ページを作る入口（縦/横ページ・カスタムページ・ひな形・ボトムバーの＋）は
// すべてここを通る。原稿サイズの更新をこの1か所に寄せることで、
// 入口ごとに更新したりしなかったりする状態をなくす。
// プロジェクト読み込みはresizeCanvasByNum()を通るのでここには来ない
// （読み込んだ原稿サイズはapplyPageSizeMm()が復元する）
var pageSize=derivePageSizeMm(objectWidth,objectHeight);
if(pageSize){
setPageSizeMm(pageSize.width,pageSize.height);
hasProjectPageSize=true;
}

var objectAspectRatio=objectWidth/objectHeight;
var containerAspectRatio=containerWidth/containerHeight;

if (objectAspectRatio>containerAspectRatio) {
var newHeight=containerWidth/objectAspectRatio;
canvas.setDimensions({width: containerWidth,height: newHeight});
initialCanvasWidth=containerWidth;
initialCanvasHeight=newHeight;
aspectRatio=initialCanvasWidth/initialCanvasHeight;
} else {
var newWidth=containerHeight*objectAspectRatio;
canvas.setDimensions({width: newWidth,height: containerHeight});
initialCanvasWidth=newWidth;
initialCanvasHeight=containerHeight;
aspectRatio=initialCanvasWidth/initialCanvasHeight;
}

canvas.renderAll();

}

// スクロールするのは #resizable-container（overflow:auto）。
// 拡大対象の #canvas-container は overflow:hidden なので
// scrollLeft/scrollTop を代入しても何も起きない
var resizableContainer=null;

function getScrollContainer(){
if(!resizableContainer){
resizableContainer=$('resizable-container');
}
return resizableContainer;
}

document.addEventListener('DOMContentLoaded',function() {
resizableContainer=$('resizable-container');
$('bg-color').addEventListener('input',function (event) {
var color=event.target.value;
canvas.setBackgroundColor(color,canvas.renderAll.bind(canvas));
commitHistoryDebounced();
});
['pageWidthMm','pageHeightMm'].forEach(function(id){
var input=$(id);
if(input){
input.addEventListener('input',function(){hasProjectPageSize=true;});
}
});
updateCanvasZoomDisplay();
// 割り当てキーだけを記号で出す。ここに英単語を置くと言語切替で
// 追従できない文言が増えるため、動作はアイコンに任せる
var zoomShortcutKeys={zoomIn:'8',zoomOut:'9',zoomFit:'0'};
Object.keys(zoomShortcutKeys).forEach(function(id){
var button=$(id);
if(button){
button.title=(isMacOs?'⌘+':'Ctrl+')+zoomShortcutKeys[id];
}
});
});


let canvasContinerScale=1;
const CANVAS_ZOOM_STEP=0.1;
const CANVAS_ZOOM_MIN=0.1;
const CANVAS_ZOOM_MAX=8;

// transform-origin を top left にしてあるため、拡大分は右下方向にだけ広がる。
// 中央基準だと左と上にはみ出した分がスクロールで到達できず、端まで表示できない
function applyCanvasZoom(nextScale){
const container=getScrollContainer();
if(!container){
return;
}
nextScale=Math.min(Math.max(nextScale,CANVAS_ZOOM_MIN),CANVAS_ZOOM_MAX);
const previousScale=canvasContinerScale;
if(nextScale===previousScale){
return;
}

// 拡大前に画面中央にあった位置を、拡大後も画面中央に保つ
const viewCenterX=container.scrollLeft+container.clientWidth/2;
const viewCenterY=container.scrollTop+container.clientHeight/2;
const ratio=nextScale/previousScale;

canvasContinerScale=nextScale;
$('canvas-container').style.transform=`scale(${canvasContinerScale})`;

container.scrollLeft=Math.max(0,viewCenterX*ratio-container.clientWidth/2);
container.scrollTop=Math.max(0,viewCenterY*ratio-container.clientHeight/2);

forcedAdjustCanvasSize();
updateObjectMenuPosition();
updateCanvasZoomDisplay();
}

// 今の倍率を画面に出す。倍率が分からないと、拡大したまま作業しているのか
// 等倍なのかが読めない。上限・下限で止まったときもここで分かる
function updateCanvasZoomDisplay(){
const display=$('zoom-level');
if(!display){
return;
}
display.textContent=Math.round(canvasContinerScale*100)+"%";
}

function zoomIn() {
applyCanvasZoom(canvasContinerScale+CANVAS_ZOOM_STEP);
}

function zoomFit() {
applyCanvasZoom(1.0);
const container=getScrollContainer();
if(container){
container.scrollLeft=0;
container.scrollTop=0;
}
}

function zoomOut() {
applyCanvasZoom(canvasContinerScale-CANVAS_ZOOM_STEP);
}


function inputImageFile() {
$('imageInput').click();
}

document.addEventListener('DOMContentLoaded',function() {
$('imageInput').addEventListener('change',function(e) {
var files=e.target.files;
for (var i=0;i<files.length;i++) {
(function(file) {
var reader=new FileReader();
reader.onload=function(f) {
var data=f.target.result;
fabric.Image.fromURL(data,function(img) {

if (stateStack.length>2) {
canvasLogger.debug("imageInput stateStack.length > 2");
var scaleFactor=Math.min(canvas.width/img.width,canvas.height/img.height);
img.scale(scaleFactor);
canvas.add(img);
canvas.renderAll();
}else{
canvasLogger.debug("imageInput resizeCanvasByNum ");
addInitialImageToCanvas(img);
}
});
};
reader.readAsDataURL(file);
})(files[i]);
}
});
});



function changeView(elementId,isVisible) {
var element=$(elementId);
if (isVisible) {
element.style.display="block";
} else {
element.style.display="none";
}
adjustCanvasSize();
}