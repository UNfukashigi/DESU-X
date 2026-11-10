
document.addEventListener('DOMContentLoaded',function() {
openButton=$("verticalText");
openButton.addEventListener("click",function () {
var selectedFont=fontManager.getSelectedFont("fontSelector");;
var fontsize=$("fontSizeSlider").value
var fontStrokeWidth=$("fontStrokeWidthSlider").value


const selectedValue=getSelectedValueByGroup("align_group");
let style={
fontSize: parseInt(fontsize),
fontFamily: selectedFont,
fill: $("textColorPicker").value,
stroke: $("textOutlineColorPicker").value,
strokeWidth: parseInt(fontStrokeWidth),
textBackgroundColor: $("textBgColorPicker").value,
textAlign: selectedValue,

cornerSize: 8,
transparentCorners: false,
cornerStyle: 'circle',
borderScaleFactor: 2,
padding: 10,

};

const cjkText=new VerticalTextbox("new",style);
textDecorApplyToNew(cjkText);
placeNewObject(cjkText);
canvas.add(cjkText);
canvas.setActiveObject(cjkText);
canvas.renderAll();
});
});

fabric.VerticalTextbox=VerticalTextbox;