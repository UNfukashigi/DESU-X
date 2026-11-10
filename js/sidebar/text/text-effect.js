var neonIntensity=2;
var isNeonEnabled=false;

// 選択中のテキストの値をサイドバーに反映する。
// 反映しないと、表示されている値と実際の値が食い違い、
// スライダーを少し動かしただけで別の値に飛ぶ
function setColorPickerValue(id,color){
var picker=$(id);
if(!picker||!color||typeof color!=='string'){
return;
}
if(picker.jscolor){
picker.jscolor.fromString(color);
}else{
picker.value=rgbToHex(color);
}
}

function updateTextControls(object) {
if(!isText(object)&&!isVerticalText(object)){
return;
}

setColorPickerValue('textColorPicker',object.fill);
setColorPickerValue('textOutlineColorPicker',object.stroke);
setColorPickerValue('textBgColorPicker',isVerticalText(object)?object.textBackgroundColor:object.backgroundColor);

var fontSizeSlider=$('fontSizeSlider');
if(fontSizeSlider&&object.fontSize){
fontSizeSlider.value=object.fontSize;
}
var strokeWidthSlider=$('fontStrokeWidthSlider');
if(strokeWidthSlider&&object.strokeWidth!==undefined){
strokeWidthSlider.value=object.strokeWidth;
}

updateTextAlignUI(object);

if (object.fontFamily) {
var fmDisplay=$("fm-selected-font-fontSelector");
if(fmDisplay) fmDisplay.textContent=object.fontFamily;
}
updateBoldToggleUI();
// 見本を今のフォントで描くため、フォント表示を入れ替えた後に呼ぶ
textDecorSyncPanel(object);
}

// 縦書きでは同じ3ボタンが上/中央/下として働く。
// アイコンと説明を実際の意味に合わせて差し替える入口をここ1か所にする
var TEXT_ALIGN_ICONS={
horizontal:{left:'format_align_left',center:'format_align_center',right:'format_align_right'},
vertical:{left:'vertical_align_top',center:'vertical_align_center',right:'vertical_align_bottom'}
};
var TEXT_ALIGN_TIPS={
horizontal:{left:'tipAlignLeft',center:'tipAlignCenter',right:'tipAlignRight'},
vertical:{left:'tipAlignTop',center:'tipAlignMiddle',right:'tipAlignBottom'}
};

function updateTextAlignUI(object){
var vertical=isVerticalText(object);
var alignment=vertical
?{top:'left',middle:'center',bottom:'right'}[object.verticalAlign]
:object.textAlign;
var mode=vertical?'vertical':'horizontal';
['left','center','right'].forEach(function(value){
var button=$('align-'+value);
if(!button){
return;
}
var icon=button.querySelector('i');
if(icon)icon.textContent=TEXT_ALIGN_ICONS[mode][value];
button.dataset.tip=TEXT_ALIGN_TIPS[mode][value];
var tipText=getText(TEXT_ALIGN_TIPS[mode][value]);
button.setAttribute('aria-label',tipText);
button.title=tipText;
if(button._tippy)button._tippy.setContent(tipText);
if(!alignment){
return;
}
if(value===alignment){
button.classList.add('selected');
}else{
button.classList.remove('selected');
}
});
}

function applyCSSTextEffect() {
var firstTextEffectColorPicker=$('firstTextEffectColorPicker').value;
var secondTextEffectColorPicker=$('secondTextEffectColorPicker').value;

const activeObject=canvas.getActiveObject();
if (isText(activeObject)) {
if (!activeObject.shadow) {
// Apply a shadow using the first color picker's value
activeObject.set("shadow",firstTextEffectColorPicker+" 5px 5px 10px");
} else {
// Toggle shadow off
activeObject.set("shadow",null);
}
canvas.renderAll();
commitHistory();
}
}


function applyVividGradientEffect() {
const activeObject=canvas.getActiveObject();
if (isText(activeObject)) {
var firstTextEffectColorPicker=$('firstTextEffectColorPicker').value;
var secondTextEffectColorPicker=$('secondTextEffectColorPicker').value;

const gradient=new fabric.Gradient({
type: "linear",
gradientUnits: "pixels",
coords: {x1: 0,y1: activeObject.height/2,x2: activeObject.width,y2: activeObject.height/2},
colorStops: [
{offset: 0,color: firstTextEffectColorPicker},
{offset: 0.5,color: secondTextEffectColorPicker,opacity: 0.5},
{offset: 1,color: firstTextEffectColorPicker}
]
});

if (isVerticalText(activeObject)) {
activeObject.set("fill",gradient);
canvas.renderAll();
} else {
activeObject.set("fill",gradient);
canvas.renderAll();
}
commitHistory();
}
}



function drawNeonJitterEffect(textObject) {
const activeObject=canvas.getActiveObject();
if (isText(activeObject)) {
const gradient=new fabric.Gradient({
type: "linear",
gradientUnits: "pixels",
coords: {x1: 0,y1: 0,x2: canvas.width,y2: 0},
colorStops: [
{offset: 0,color: "red"},
{offset: 0.15,color: "orange"},
{offset: 0.3,color: "yellow"},
{offset: 0.5,color: "green"},
{offset: 0.65,color: "blue"},
{offset: 0.8,color: "indigo"},
{offset: 1,color: "violet"},
],
});
activeObject.set("fill",gradient);

// Jitter Effect
activeObject.initDimensions();
for (let i=0;i<10;i++) {
activeObject.clone(function (clonedText) {
clonedText.set({
shadow: `rgba(${255 * Math.random()}, ${255 * Math.random()}, ${255 * Math.random()
            }, 0.5) 10px 10px 10px`,
});
clonedText.set({
left: activeObject.left+Math.random()*5,
top: activeObject.top+Math.random()*5,
});
canvas.add(clonedText);
});
}
}
}



function applyInnerShadow() {
const activeObject=canvas.getActiveObject();
if (isText(activeObject)) {
activeObject.set({
shadow: {
color: "rgba(0, 0, 0, 0.8)",
blur: 10,
offsetX: 5,
offsetY: 5,
},
});
canvas.renderAll();
commitHistory();
}
}

function applyNeonEffect() {
const activeObject=canvas.getActiveObject();
if (isText(activeObject)) {

var firstTextEffectColorPicker=$('firstTextEffectColorPicker').value;
var secondTextEffectColorPicker=$('secondTextEffectColorPicker').value;

if (!activeObject.fill||!activeObject.shadow) {
activeObject.set({
fill: firstTextEffectColorPicker,
shadow: {
color: secondTextEffectColorPicker,
blur: 20,
},
});
}
canvas.renderAll();
commitHistory();
}
}

function alignText(alignment,button) {
var textAlignment=getSelectedValueByButton(button);
var activeObject=canvas.getActiveObject();

if(isVerticalText(activeObject)){
switch(alignment){
case "left":
textAlignment="top";
break
case "center":
textAlignment="middle";
break
case "right":
textAlignment="bottom";
break
}
activeObject.set('verticalAlign',textAlignment);
activeObject.set('dirty',true);
}else if(isText(activeObject)){
activeObject.set('textAlign',alignment);
}
canvas.renderAll();
commitHistory();

changeSelected(button);
}

// 新しく置いたものを見失わないための座標。左上固定だと大判のキャンバスでは
// 端に小さく出て気付けず、2回押すと完全に重なって増えたことも分からない。
// 選択中のコマがあればその中に置く（位置だけ。コマとのリンクは張らない）
const NEW_OBJECT_INSERT_STEP=24;
const NEW_OBJECT_INSERT_WRAP=8;
let newObjectInsertCount=0;

function getNewObjectArea() {
const activeObject=canvas.getActiveObject();
if(isPanel(activeObject)){
const rect=activeObject.getBoundingRect(true);
return {left: rect.left,top: rect.top,width: rect.width,height: rect.height};
}
return {left: 0,top: 0,width: canvas.getWidth(),height: canvas.getHeight()};
}

// canvas.add() の前に呼ぶこと。追加後に動かすと saveInitialState が
// 追加時点の座標を覚えたままになり、キャンバス再フィットでずれる
function placeNewObject(obj) {
const area=getNewObjectArea();
const offset=(newObjectInsertCount%NEW_OBJECT_INSERT_WRAP)*NEW_OBJECT_INSERT_STEP;
newObjectInsertCount++;
const width=obj.getScaledWidth();
const height=obj.getScaledHeight();
obj.set({
left: area.left+(area.width-width)/2+offset,
top: area.top+(area.height-height)/2+offset
});
obj.setCoords();
}

function createTextbox() {
var selectedFont=fontManager.getSelectedFont("fontSelector");
var fontsize=$("fontSizeSlider").value
var fontStrokeWidth=$("fontStrokeWidthSlider").value

textLogger.debug("selectedFont",selectedFont)
const selectedValue=getSelectedValueByGroup("align_group");
var textbox=new fabric.Textbox("New",{
fontSize: parseInt(fontsize),
fontFamily: selectedFont,
fill: $("textColorPicker").value,
stroke: $("textOutlineColorPicker").value,
strokeWidth: parseInt(fontStrokeWidth),
backgroundColor: $("textBgColorPicker").value,
textAlign: selectedValue,

cornerSize: 8,
transparentCorners: false,
cornerStyle: 'circle',
borderScaleFactor: 2,
padding: 10,
});

textbox.on('text:changed',function () {
textbox.set({fontFamily: selectedFont});
canvas.requestRenderAll();
});

textDecorApplyToNew(textbox);

placeNewObject(textbox);
canvas.add(textbox);
canvas.setActiveObject(textbox);
canvas.requestRenderAll();
// updateLayerPanel();
}

function toggleShadow() {
var activeObject=canvas.getActiveObject();
if (isText(activeObject)) {
var hasShadow=activeObject.shadow!=null;
activeObject.set(
"shadow",
hasShadow ? null : "rgba(0,0,0,0.3) 5px 5px 5px"
);
canvas.renderAll();
commitHistory();
}
}

function toggleBold() {
var activeObject=canvas.getActiveObject();
if(isText(activeObject)){
var isBold=activeObject.fontWeight==="bold";
activeObject.set("fontWeight",isBold ? "" : "bold");
canvas.renderAll();
commitHistory();
}
updateBoldToggleUI();
}

function toggleBoldWithUI(btn) {
toggleBold();
}

function updateBoldToggleUI() {
var btn=$("bold-toggle-btn");
if(!btn) return;
var activeObject=canvas.getActiveObject();
if(!activeObject||!isText(activeObject)) {
btn.classList.remove("selected");
return;
}
var isBold=activeObject.fontWeight==="bold";
if(isBold) btn.classList.add("selected");
else btn.classList.remove("selected");
}

function changeFontSize(size) {
var activeObject=canvas.getActiveObject();
if(isSpeechBubbleText(activeObject)){
activeObject.set("fontSize",parseInt(size));
let newSettings=mainSpeechBubbleObjectResize(activeObject);
const svgObj=activeObject.targetObject;
svgObj.set(newSettings);
updateShapeMetrics(svgObj);
}else if (isText(activeObject)) {
activeObject.set("fontSize",parseInt(size));
}
canvas.renderAll();
syncObjectControls();
commitHistoryDebounced();
}

function changeStrokeWidthSize(size) {
var activeObject=canvas.getActiveObject();
if (isText(activeObject)) {
activeObject.set("strokeWidth",parseInt(size));
refreshInitialStrokeWidth(activeObject);
canvas.renderAll();
}
commitHistoryDebounced();
}


function changeTextColor(color) {
var activeObject=canvas.getActiveObject();

if (isVerticalText(activeObject)) {
activeObject.set("fill",color);
canvas.renderAll();
} else if (isText(activeObject)) {
activeObject.set("fill",color);
canvas.renderAll();
}
commitHistoryDebounced();
}
function changeOutlineTextColor(color) {
var activeObject=canvas.getActiveObject();

if (isVerticalText(activeObject)) {
activeObject.set("stroke",color);
canvas.renderAll();
} else if (isText(activeObject)) {
activeObject.set("stroke",color);
canvas.renderAll();
}
commitHistoryDebounced();
}
function changeTextBgColor(color) {
var activeObject=canvas.getActiveObject();
var isTransparent=color==='rgba(0,0,0,0)';
if(isVerticalText(activeObject)){
activeObject.set("textBackgroundColor",isTransparent?'':color);
canvas.renderAll();
}else if(isText(activeObject)){
activeObject.set("backgroundColor",isTransparent?'':color);
canvas.renderAll();
}
commitHistoryDebounced();
}

function changeNeonColor(color) {
neonColor=color;
var activeObject=canvas.getActiveObject();
if (isText(activeObject)) {
updateNeonEffect(activeObject);
}
}

function changeNeonIntensity(intensity) {
neonIntensity=parseFloat(intensity);
var activeObject=canvas.getActiveObject();
if (isText(activeObject)) {
updateNeonEffect(activeObject);
}
}

function updateNeonEffect(activeObject) {
if (isText(activeObject)) {
if (!isNeonEnabled) {
activeObject.set("shadow",null);
activeObject.set("stroke",null);
} else {
var neonColor=$("firstTextEffectColorPicker").value;
activeObject.set(
"shadow",
new fabric.Shadow({
color: neonColor,
blur: neonIntensity,
offsetX: 0,
offsetY: 0,
affectStroke: false,
opacity: neonIntensity,
})
);
activeObject.set("stroke",neonColor);
activeObject.set("strokeWidth",2);
}
canvas.renderAll();
commitHistoryDebounced();
}
}



function changeFont(font) {
$("text-preview-area").style.fontFamily=font;
}



function isFontAvailableForLanguage(font,text) {
const canvas=document.createElement('canvas');
const context=canvas.getContext('2d');
context.font='72px monospace';
const baselineSize=context.measureText(text).width;
context.font=`72px ${font}, monospace`;
const newSize=context.measureText(text).width;
return newSize!==baselineSize;
}
