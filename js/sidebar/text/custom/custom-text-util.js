let svgHttp="http://www.w3.org/2000/svg";

// 画像テキストのfont-family。組み立て中の各実装はこれを読むだけにして、
// 書き換えるのはt2ApplySelectedFont()の1か所に限る。
// 種類ごとにフォントの取得を書くと、直しが1種類にしか入らない
var baseStylesDefault="";

// フォント選択の置き場。#text-area2-settingsの外にあるため
// switchText2Ui()の作り直しでは消えない
const T2_FONT_SELECTOR_ID="fontT2Selector";
// 未選択のときにドロップダウンへ出す名前。テキストパネル側の既定と揃える
const T2_FONT_DEFAULT="Arial";
// imageTextParamsに載せるときのキー。DOMのidではないので
// restoreT2SettingValues()の対象にはならない（復元はsyncImageTextControls()が行う）
const T2_FONT_PARAM_KEY="imageTextFont";

function t2GetSelectedFontName(){
var display=$("fm-selected-font-"+T2_FONT_SELECTOR_ID);
if(!display){
textLogger.error("image text font selector not initialized");
return "";
}
return display.textContent;
}

function t2SetSelectedFontName(fontName){
var display=$("fm-selected-font-"+T2_FONT_SELECTOR_ID);
if(!display||!fontName){
return;
}
display.textContent=fontName;
display.className="fm-font-"+fontName.replace(/[\s-]/g,"_");
t2ApplySelectedFont();
}

// 画像テキストはSVGを<img>で読み込んでラスタライズする。<img>のSVGは別ドキュメント
// 扱いで、document.fontsに足したFontFaceも外部URLのフォントも見えない。
// OSに入っているフォントだけが名前で解決できる
function t2FontIsRasterizable(fontName){
var userFonts=fmFontData.UserFont.fonts;
for(var i=0;i<userFonts.length;i++){
if(userFonts[i].name===fontName){
return userFonts[i].type==="local";
}
}
return true;
}

function t2ApplySelectedFont(){
var fontName=t2GetSelectedFontName();
// 字体に無い文字（欧文フォントで日本語を打つ等）は同じ字が出ないと困るため、
// 総称ファミリを後ろに残して字ごとに代替させる
baseStylesDefault=fontName ? '"'+fontName.replace(/"/g,"")+'",sans-serif' : "";
}

function createSvgElement(type) {
return document.createElementNS(svgHttp,type);
}
function setAttributes(element,attrs) {
Object.entries(attrs).forEach(([key,value])=>
element.setAttribute(key,value)
);
}

function createFilterOneElement(type,attrs,child=null){
const element=createSvgElement(type);
setAttributes(element,attrs);
if(child){
const childElement=createSvgElement(child.type);
setAttributes(childElement,child.attrs);
element.appendChild(childElement);
}
return element;
}
function createFilterElement(type,attrs,children=[]) {
const element=createSvgElement(type);
setAttributes(element,attrs);
children.forEach((child)=>{
const childElement=createSvgElement(child.type);
setAttributes(childElement,child.attrs);
element.appendChild(childElement);
});
return element;
}


function createMergeNode(inValue) {
const node=createSvgElement("feMergeNode");
setAttributes(node,{in: inValue});
return node;
}

function getFirstNCharsDefault(textarea) {
return getFirstNChars(textarea,20);
}

//画像テキストの更新は削除+再追加で行われるため、途中状態を履歴に残さず最終結果のみ1エントリ保存する
function t2_removeSvgImage(obj){
removeByNotSave(obj);
canvas.renderAll();
}

function t2_addSvgImage(svgNode,left,top,onCreated){
const svgString=new XMLSerializer().serializeToString(svgNode);
const reader=new FileReader();
reader.onload=({target})=>{
fabric.Image.fromURL(target.result,img=>{
Object.assign(img,{left,top});
img.text=getFirstNCharsDefault(t2_text);
onCreated(img);
changeDoNotSaveHistory();
canvas.add(img).setActiveObject(img).renderAll();
changeDoSaveHistory();
saveStateByManual();
},{crossOrigin:'anonymous'});
};
reader.readAsDataURL(new Blob([svgString],{type:"image/svg+xml;charset=utf-8"}));
}

function getFirstNChars(textarea,maxChars) {
if (!textarea.value) return '';
return textarea.value.replace(/\n/g,' ').slice(0,maxChars);
}
// 画像テキストはパラメータ変更のたびにオブジェクトを作り直すため、
// 変形・重ね順・GUIDを引き継がないと毎回最前面へ飛び拡大率も失われる
var t2PendingTransform=null;

function t2BeginReplace(oldObject){
if(!oldObject){
t2PendingTransform=null;
return {left:50,top:100};
}
var objects=canvas.getObjects();
t2PendingTransform={
left:oldObject.left,
top:oldObject.top,
scaleX:oldObject.scaleX,
scaleY:oldObject.scaleY,
angle:oldObject.angle,
flipX:oldObject.flipX,
flipY:oldObject.flipY,
opacity:oldObject.opacity,
guid:oldObject.guid,
index:objects.indexOf(oldObject)
};
withoutHistory(function(){
canvas.remove(oldObject);
});
canvas.renderAll();
return {left:t2PendingTransform.left,top:t2PendingTransform.top};
}

function t2PlaceImageTextObject(img,type,left,top){
var transform=t2PendingTransform;
t2PendingTransform=null;
img.set({left:left,top:top});
if(transform){
img.set({
left:transform.left,
top:transform.top,
scaleX:transform.scaleX,
scaleY:transform.scaleY,
angle:transform.angle,
flipX:transform.flipX,
flipY:transform.flipY,
opacity:transform.opacity
});
if(transform.guid){
img.guid=transform.guid;
}
}
img.imageTextType=type;
img.imageTextParams=t2CollectParams(type);
img.text=getFirstNCharsDefault(t2_text);
canvas.add(img);
if(transform&&transform.index>=0){
// 作り直すたびに最前面へ移動しないよう元の重ね順に戻す
img.moveTo(transform.index);
}
canvas.setActiveObject(img);
canvas.renderAll();
return img;
}

// サイドバーの入力値をオブジェクトに持たせて、あとから選び直しても編集できるようにする。
// 集める先はDOMの入力要素。sidebarValueMapは「利用者が触った項目」しか持たないため、
// そちらから集めると未変更の項目が欠け、別の画像テキストを選び直したときに
// 前のオブジェクトの値が画面に残る
function t2CollectParams(type){
var params={};
var host=$('text-area2-settings');
if(!host){
return params;
}
// setupSlider()が足す値表示のspanも同じ接頭辞のidを持つため、入力要素だけを見る
host.querySelectorAll('input[id],select[id],textarea[id]').forEach(function(element){
if(element.id.indexOf(type+'-')===0){
params[element.id]=element.value;
}
});
// フォントは入力要素ではなくドロップダウンの表示なので、上の走査では拾えない
params[T2_FONT_PARAM_KEY]=t2GetSelectedFontName();
return params;
}

// ---------------- 種類を問わず共通の組み立て ----------------
// 文字の並べ方（複数行・縦書き・揃え）は種類が変わっても同じ。
// 種類ごとにコピーすると縦書きの直しが1種類だけ入って残りが崩れるため、ここに1つだけ置く

function t2ReadCommonInputs(){
return {
text:t2_text.value,
fontFamily:baseStylesDefault,
fontSize:parseFloat(t2_fontSize.value),
lineHeight:parseFloat(t2_lineHeight.value),
letterSpacing:parseFloat(t2_letterSpacing.value),
fillColor:t2_fillColor.value,
fillOpacity:t2_fillOpacity.value,
vertical:getSelectedValueByGroup("orientation_group")==="vertical",
align:getSelectedValueByGroup("t2Align")
};
}

// fillには色のほかgradient/patternの url(#id) も渡せる
function t2ApplyTextContent(textElement,common,fill){
var paintFill=fill===undefined||fill===null ? common.fillColor : fill;
var boxAttrs=common.vertical ? {
"writing-mode":"vertical-rl",
"dominant-baseline":"ideographic",
"glyph-orientation-vertical":"0",
"text-orientation":"upright"
} : {
"dominant-baseline":"middle",
"text-anchor":common.align
};
setAttributes(textElement,Object.assign({},boxAttrs,{
"fill":paintFill,
"fill-opacity":common.fillOpacity,
"xml:space":"preserve"
}));

var baseStyles={
"font-family":common.fontFamily,
"font-size":common.fontSize+"px",
"letter-spacing":common.letterSpacing+"em"
};
var verticalStyles={
"writing-mode":"vertical-rl",
"text-orientation":"upright",
"glyph-orientation-vertical":"0",
"dominant-baseline":"ideographic"
};
var styles=common.vertical ? Object.assign({},baseStyles,verticalStyles) : baseStyles;
textElement.setAttribute("style",Object.keys(styles).map(function(key){
return key+":"+styles[key];
}).join(";"));

textElement.innerHTML="";
var totalHeight=0;
common.text.split("\n").forEach(function(line,index){
var tspan=createSvgElement("tspan");
tspan.textContent=line;
var position=common.vertical
? {"y":"0","x":(-totalHeight)+"px"}
: {"x":"0","dy":index===0 ? "0" : common.lineHeight+"em"};
setAttributes(tspan,Object.assign({},position,{
"fill":paintFill,
"fill-opacity":common.fillOpacity
}));
textElement.appendChild(tspan);
if(common.vertical){
totalHeight+=common.fontSize*common.lineHeight;
}
});
}

// 余白は文字サイズを基準に取る。文字数を基準にすると1行の長い文でだけ
// 上下の余白が過剰になり、逆に短い文の発光がはみ出して切れる
function t2FitSvgToText(svgElement,textElement,fontSize,paddingRatio){
var bbox=null;
try{
bbox=textElement.getBBox();
}catch(error){
textLogger.error("getBBox failed",error);
return null;
}
var padding=Math.max(20,fontSize*paddingRatio);
setAttributes(svgElement,{
viewBox:(bbox.x-padding)+" "+(bbox.y-padding)+" "+(bbox.width+padding*2)+" "+(bbox.height+padding*2),
width:bbox.width+padding*2,
height:bbox.height+padding*2
});
return bbox;
}

function t2RenderAndPlace(svgElement,type,left,top,onPlaced){
var svgString=new XMLSerializer().serializeToString(svgElement);
var reader=new FileReader();
reader.onload=function(event){
fabric.Image.fromURL(event.target.result,function(img){
onPlaced(t2PlaceImageTextObject(img,type,left,top));
},{crossOrigin:'anonymous'});
};
reader.readAsDataURL(new Blob([svgString],{type:"image/svg+xml;charset=utf-8"}));
}
