var t2_text=null;
var t2_fontSize=null;
var t2_lineHeight=null;
var t2_letterSpacing=null;
var t2_shadow1Size=null;
var t2_shadow1Opacity=null;
var t2_shadow1Color=null;
var t2_shadow2Size=null;
var t2_shadow2Opacity=null;
var t2_shadow2Color=null;
var t2_fillColor=null;
var t2_fillOpacity=null;
var t2_align_l=null;
var t2_align_c=null;
var t2_align_r=null;
var t2_orientation_v=null;
var t2_orientation_l=null;

let elementsT2=[];
let buttonElementsT2=[];

let nowText2=null;

// 種類を跨いでも同じ意味を持つ設定。種類を変えたときはこれだけ引き継ぐ。
// 引き継がないと入力中の文字が新しい種類の記憶値に戻り、
// 「同じ文字のまま見た目だけ変える」ができない
const T2_COMMON_SETTINGS=["Text","FontSize","LineHeight","LetterSpacing","TextColor","FillOpacity"];

// 挿入位置。同じ座標に重ねると増えたことが見た目で分からないため押すたびにずらす
const T2_INSERT_LEFT=50;
const T2_INSERT_TOP=100;
const T2_INSERT_STEP=20;
const T2_INSERT_WRAP=8;
let t2InsertCount=0;

// 種類ごとの入口をひとつの表にまとめる。
// create/update/delete/選択中の出し入れ/固有UI をswitch文に分けると
// 種類を足すたびに5か所へ書き足すことになり、書き漏らしたところだけが動かなくなる。
//
// ここに載るのは1種類1ファイルで書かれた旧実装だけ。
// 新しい種類は text-effect-presets.js に1件足せば t2GetEffect() が拾う
const T2_LEGACY_EFFECTS={
shadow:{
create:function(left,top){t2_shadow_createSvg(left,top);},
update:function(){t2_shadow_updateAll();},
clear:function(){t2_shadow_deleteSvg();},
setCurrent:function(obj){t2_shadow_setCurrent(obj);},
getCurrent:function(){return nowT2ShadowStr;},
controls:function(type){
var html='';
html+=addSlider(type+'-ShadowSize1','ShadowSize1',0,3,sidebarValueMap.getOrDefault(type+'-ShadowSize1',1));
html+=addSlider(type+'-ShadowOpacity1','ShadowOpacity1',0,1,sidebarValueMap.getOrDefault(type+'-ShadowOpacity1',1),0.1);
html+=addColor(type+'-ShadowColor1','ShadowColor1',sidebarValueMap.getOrDefault(type+'-ShadowColor1','#ebe7e0'));
html+=addSlider(type+'-ShadowSize2','ShadowSize2',0,5,sidebarValueMap.getOrDefault(type+'-ShadowSize2',5));
html+=addSlider(type+'-ShadowOpacity2','ShadowOpacity2',0,1,sidebarValueMap.getOrDefault(type+'-ShadowOpacity2',1),0.1);
html+=addColor(type+'-ShadowColor2','ShadowColor2',sidebarValueMap.getOrDefault(type+'-ShadowColor2','#35322a'));
return html;
},
elements:function(type){
t2_shadow1Size=$(type+'-ShadowSize1');
t2_shadow1Opacity=$(type+'-ShadowOpacity1');
t2_shadow1Color=$(type+'-ShadowColor1');
t2_shadow2Size=$(type+'-ShadowSize2');
t2_shadow2Opacity=$(type+'-ShadowOpacity2');
t2_shadow2Color=$(type+'-ShadowColor2');
return [t2_shadow1Size,t2_shadow1Opacity,t2_shadow1Color,
t2_shadow2Size,t2_shadow2Opacity,t2_shadow2Color];
}
},
broken:{
create:function(left,top){t2_broken_createSvg(left,top);},
update:function(){t2_broken_updateAll();},
clear:function(){t2_broken_deleteSvg();},
setCurrent:function(obj){t2_broken_setCurrent(obj);},
getCurrent:function(){return nowT2BrokenStr;}
},
cloud:{
create:function(left,top){t2_cloud_createSvg(left,top);},
update:function(){t2_cloud_updateAll();},
clear:function(){t2_cloud_deleteSvg();},
setCurrent:function(obj){t2_cloud_setCurrent(obj);},
getCurrent:function(){return nowT2CloudStr;}
},
layered:{
create:function(left,top){t2_layered_createSvg(left,top);},
update:function(){t2_layered_updateAll();},
clear:function(){t2_layered_deleteSvg();},
setCurrent:function(obj){t2_layered_setCurrent(obj);},
getCurrent:function(){return nowT2LayeredStr;}
},
mesh:{
create:function(left,top){t2_mesh_createSvg(left,top);},
update:function(){t2_mesh_updateAll();},
clear:function(){t2_mesh_deleteSvg();},
setCurrent:function(obj){t2_mesh_setCurrent(obj);},
getCurrent:function(){return nowT2MeshStr;}
},
scratch:{
create:function(left,top){t2_scratch_createSvg(left,top);},
update:function(){t2_scratch_updateAll();},
clear:function(){t2_scratch_deleteSvg();},
setCurrent:function(obj){t2_scratch_setCurrent(obj);},
getCurrent:function(){return nowT2ScratchStr;}
},
thrill:{
create:function(left,top){t2_thrill_createSvg(left,top);},
update:function(){t2_thrill_updateAll();},
clear:function(){t2_thrill_deleteSvg();},
setCurrent:function(obj){t2_thrill_setCurrent(obj);},
getCurrent:function(){return nowT2ThrillStr;}
},
wild:{
create:function(left,top){t2_wild_createSvg(left,top);},
update:function(){t2_wild_updateAll();},
clear:function(){t2_wild_deleteSvg();},
setCurrent:function(obj){t2_wild_setCurrent(obj);},
getCurrent:function(){return nowT2WildStr;}
},
zebra:{
create:function(left,top){t2_zebra_createSvg(left,top);},
update:function(){t2_zebra_updateAll();},
clear:function(){t2_zebra_deleteSvg();},
setCurrent:function(obj){t2_zebra_setCurrent(obj);},
getCurrent:function(){return nowT2ZebraStr;}
}
};

function t2GetEffect(type){
if(T2_LEGACY_EFFECTS[type]){
return T2_LEGACY_EFFECTS[type];
}
if(T2_EFFECT_PRESETS[type]){
return t2GenericEffect(type);
}
textLogger.error("unknown image text type: "+type);
return null;
}

function t2HasEffect(type){
return!!T2_LEGACY_EFFECTS[type]||!!T2_EFFECT_PRESETS[type];
}

function t2CaptureCommonValues(type) {
var values={};
T2_COMMON_SETTINGS.forEach(function (name) {
var element=$(type+'-'+name);
if (element) {
values[name]=element.value;
}
});
return values;
}

function t2RestoreCommonValues(type,values) {
Object.keys(values).forEach(function (name) {
var element=$(type+'-'+name);
if (!element) {
return;
}
// jscolorのピッカーはvalue代入では見た目が変わらない
if (element.jscolor) {
element.jscolor.fromString(values[name]);
} else {
element.value=values[name];
}
sidebarValueMap.set(type+'-'+name,values[name]);
});
}

// キャンバスで選んでいる画像テキスト。種類を変えたときの差し替え対象になる
function t2GetSelectedImageText() {
var activeObject=canvas.getActiveObject();
if (activeObject&&activeObject.imageTextType) {
return activeObject;
}
return null;
}

// 種類を選ぶ。選択中の画像テキストがあればその現物を新しい種類へ差し替え、
// 無ければ設定を切り替えるだけ。キャンバスに増やすのはtext2Insert()だけが行う
function switchText2(type) {
if (type===nowText2) {
return;
}
// 知らない種類でnowText2を書き換えると、以降の更新も挿入も効かない状態になる
if (!t2HasEffect(type)) {
textLogger.error("unknown image text type: "+type);
return;
}

var editing=t2GetSelectedImageText();
var carried=nowText2 ? t2CaptureCommonValues(nowText2) : null;

if (editing) {
// 変形・重ね順・GUIDを退避してキャンバスから外す。
// 下のcreateText2()がこれを引き継いで同じ場所に作り直す
t2BeginReplace(editing);
}
if (nowText2) {
deleteText2();
clearT2Settings();
}

switchText2Ui(type);
nowText2=type;
if (carried) {
t2RestoreCommonValues(type,carried);
}
addT2EventListener();

if (editing) {
createText2(type);
}
}

// 「キャンバスに挿入」。今の種類・今の設定で1つ追加する
function text2Insert() {
if (!nowText2) {
createToastError(getText("imageTextSelectStyleFirst"),"",2000);
return;
}
var offset=(t2InsertCount%T2_INSERT_WRAP)*T2_INSERT_STEP;
t2InsertCount++;
createText2(nowText2,T2_INSERT_LEFT+offset,T2_INSERT_TOP+offset);
}

EventDelegator.register('insertImageText',function () {
text2Insert();
});

// FontSelectorはフォントを選ぶとtargetId名のCustomEventをdocumentへ投げる。
// 選択肢の一覧はfmFontDataで共通なので、画像テキストで使えないものはここで弾く
let t2LastUsableFont=T2_FONT_DEFAULT;
document.addEventListener(T2_FONT_SELECTOR_ID,function (event) {
var fontName=event.detail.fontName;
if (!t2FontIsRasterizable(fontName)) {
// 適用してしまうと選んだ字体と違う字体で描かれ、
// 何が起きたのか分からないまま出力まで通ってしまう
createToastError(getText("imageTextFontNotUsable"),fontName,4000);
t2SetSelectedFontName(t2LastUsableFont);
return;
}
t2LastUsableFont=fontName;
t2ApplySelectedFont();
updateText2();
});


function switchText2Ui(type) {
var effect=t2GetEffect(type);
if (!effect) {
return;
}
let settingsHTML='';

elementsT2.forEach(element=>{
if (element) {
element=null;
}
});

//Common settings.
var cName="";
cName="Text";
settingsHTML+=addTextArea(type+'-'+cName,cName,sidebarValueMap.getOrDefault(type+'-'+cName,'New Text'));
cName="FontSize";
settingsHTML+=addSlider(type+'-'+cName,cName,1,300,sidebarValueMap.getOrDefault(type+'-'+cName,40));
cName="LineHeight";
settingsHTML+=addSlider(type+'-'+cName,cName,0.1,5,sidebarValueMap.getOrDefault(type+'-'+cName,1.2),0.1);
cName="LetterSpacing";
settingsHTML+=addSlider(type+'-'+cName,cName,-0.5,2,sidebarValueMap.getOrDefault(type+'-'+cName,0.4),0.1);
settingsHTML+=addAlignTypeButton(type);
settingsHTML+=addOrientationButton(type);
cName="TextColor";
settingsHTML+=addColor(type+'-'+cName,cName,sidebarValueMap.getOrDefault(type+'-'+cName,'#35322a'));
cName="FillOpacity";
settingsHTML+=addSlider(type+'-'+cName,cName,0,1,sidebarValueMap.getOrDefault(type+'-'+cName,1),0.1);

// 種類ごとの設定。持たない種類は何も足さない
if (effect.controls) {
settingsHTML+=effect.controls(type);
}

$('text-area2-settings').innerHTML=settingsHTML;
jsColorSet();

t2_text=$(type+'-'+"Text");
// addTextArea()は翻訳された既定文しか埋め込めない（利用者の入力をHTMLに
// 埋めると</textarea>を含む文字でDOMが壊れる）。記憶した文字はここで代入する
var savedText=sidebarValueMap.get(type+'-'+"Text");
if (savedText!==undefined&&t2_text) {
t2_text.value=savedText;
}
t2_fontSize=$(type+'-'+"FontSize");
t2_fillColor=$(type+'-'+"TextColor");
t2_fillOpacity=$(type+'-'+"FillOpacity");
t2_lineHeight=$(type+'-'+"LineHeight");
t2_letterSpacing=$(type+'-'+"LetterSpacing");
t2_align_l=$("T2-align-left");
t2_align_c=$("T2-align-center");
t2_align_r=$("T2-align-right");
t2_orientation_v=$("T2-Orientation-vertical");
t2_orientation_l=$("T2-Orientation-horizontal");

elementsT2=[
t2_text,
t2_fontSize,
t2_lineHeight,
t2_letterSpacing,
t2_fillColor,
t2_fillOpacity
].concat(effect.elements ? effect.elements(type) : []);

buttonElementsT2=[
t2_align_l,
t2_align_c,
t2_align_r,
t2_orientation_v,
t2_orientation_l
];

const sliders2=document.querySelectorAll('.input-container-leftSpace input[type="range"]');
sliders2.forEach(slider=>{
setupSlider(slider,'.input-container-leftSpace')
});

// キャンバス上の画像テキストを選び直したときもここを通るため、
// カードは常に「今編集している種類」を指す
presetPanelSetActive('text2',type);
}

function clearT2Settings() {
elementsT2.forEach(element=>{
if (element) {
element.removeEventListener("input",saveValueMap);
element=null;
}
});
buttonElementsT2.forEach(element=>{
if (element) {
element.removeEventListener("click",saveValueMap);
element=null;
}
});
}

function debounceCustomText(func,delay) {
let timeoutId;
return function (...args) {
clearTimeout(timeoutId);
timeoutId=setTimeout(()=>func.apply(this,args),delay);
};
}

const debouncedUpdate=debounceCustomText(()=>{
updateText2();
},50);

function addT2EventListener(){
elementsT2.forEach(element=>{
if (element) {
element.addEventListener('input',()=>{
saveValueMap(element);
debouncedUpdate();
});
}
});
buttonElementsT2.forEach(element=>{
if (element) {
element.addEventListener('click',()=>{
saveValueMap(element);
updateText2();
});
}
});
}

function updateText2(){
// 編集対象が無いときは何もしない。ここで作り直すと、挿入していないのに
// スライダーを触っただけでキャンバスに現れる
if(!t2GetCurrentObject()){
return;
}
var effect=t2GetEffect(nowText2);
if(effect){
// 1種類1ファイルの旧実装はbaseStylesDefaultを直接読む。
// SVGを組み立てる手前で必ず通るこことcreateText2()で最新にしておく
t2ApplySelectedFont();
effect.update();
}
}

// left/topを渡さないと各createSvgの既定位置になる。差し替え時は
// t2BeginReplace()が退避した変形が優先されるため位置は引き継がれる
function createText2(type,left,top){
var effect=t2GetEffect(type);
if(effect){
t2ApplySelectedFont();
effect.create(left,top);
}
}

function deleteText2(){
var effect=t2GetEffect(nowText2);
if(effect){
effect.clear();
}
}

function t2GetCurrentObject(){
if(!nowText2||!t2HasEffect(nowText2)){
return null;
}
return t2GetEffect(nowText2).getCurrent();
}

// キャンバス上の画像テキストを選び直したとき、サイドバーをその種類・値に戻し、
// 以降の編集がそのオブジェクトに向くようにする。
// これをしないと直前に作った1つしか編集できない
function syncImageTextControls(activeObject){
if(!activeObject||!activeObject.imageTextType){
return;
}
var type=activeObject.imageTextType;
if(!t2HasEffect(type)){
textLogger.error("unknown imageTextType: "+type);
return;
}
var params=activeObject.imageTextParams||{};
Object.keys(params).forEach(function(key){
sidebarValueMap.set(key,params[key]);
});
if(nowText2!==type){
clearT2Settings();
switchText2Ui(type);
nowText2=type;
addT2EventListener();
}
// 種類が同じでも必ず選び直した相手の値へ入れ替える。
// 入れ替えないと、アアアを選んだあとイイイを選んでもアアアの値が残る
restoreT2SettingValues(params);
// フォントは入力要素ではないためrestoreT2SettingValues()の対象外。
// この機能より前に作った画像テキストはキーを持たないので、その場合は今の選択を残す
if(params[T2_FONT_PARAM_KEY]){
t2SetSelectedFontName(params[T2_FONT_PARAM_KEY]);
t2LastUsableFont=params[T2_FONT_PARAM_KEY];
}
t2GetEffect(type).setCurrent(activeObject);
}

function restoreT2SettingValues(params){
if(!params){
return;
}
Object.keys(params).forEach(function(key){
var element=$(key);
if(!element){
return;
}
// jscolorのピッカーはvalue代入では見た目が変わらない
if(element.jscolor){
element.jscolor.fromString(params[key]);
}else{
element.value=params[key];
}
});
}
