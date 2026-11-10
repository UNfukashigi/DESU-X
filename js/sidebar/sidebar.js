// 起動時は左のパネルをどれも開かない（左のボタンはふだん使わないため。以前は「ひな形」を開いていた）
document.addEventListener("DOMContentLoaded",function () {
adjustCanvasSize();
});

// サイドバーのパネル。表示されるのは常にこの中の1つだけ
var SIDEBAR_PANEL_IDS=[
"svg-container-template",
"panel-manager-area",
"auto-generate-area",
"prompt-manager-area",
"speech-bubble-area1",
"speech-bubble-area2",
"text-area",
"text-area2",
"tool-area",
"manga-tone-area",
"manga-effect-area",
"shape-area",
"control-area"
];

// 今開いているパネル。1つも開いていなければ null
function currentSidebarPanelId() {
var openId=null;
SIDEBAR_PANEL_IDS.forEach(function (panelId) {
var el=$(panelId);
if(el&&el.style.display!=="none"&&el.style.display!==""){
openId=panelId;
}
});
return openId;
}

function toggleVisibility(id) {
var element=$(id);
var wrappers=document.querySelectorAll('#sidebar .icon-wrapper[data-target]');
wrappers.forEach(function(wrapper){
var icon=wrapper.querySelector('i');
if(!icon)return;
if(wrapper.dataset.target===id){
icon.classList.toggle("active",element.style.display==="none");
}else{
icon.classList.remove("active");
}
});

if (element.style.display==="none") {
// 別のパネルへ切り替えるときは今のモードを解除する。
// ペンやトーンを選んだまま別パネルを開くと、そのモードが続いたままになる（監査 #24）。
// 同じパネルを閉じるだけのときは解除しない
var openId=currentSidebarPanelId();
if(openId&&openId!==id){
ModeManager.clearAll();
}
SIDEBAR_PANEL_IDS.forEach(function (panelId) {
var panel=$(panelId);
if(panel)panel.style.display="none";
});
element.style.display="block";
lazyLoadSvgData(id);
// 一括適用の退避が今のプロジェクトのものかは、開いているページのGUIDで判断する。
// 起動直後はページ未読込で判定できないため、パネルを開くたびに取り直す
if (id==="manga-effect-area") {
effectRefreshRestoreButton();
}
} else {
element.style.display="none";
}
adjustCanvasSize();
}

function switchTemplateOrientation(){
var checkbox=$("template-orientation-toggle");
var vertical=$("svg-preview-area-vertical");
var landscape=$("svg-preview-area-landscape");
var toggleLabel=document.querySelector(".template-toggle-label");
if(checkbox.checked){
vertical.style.display="none";
landscape.style.display="block";
toggleLabel.classList.add("landscape");
lazyLoadSvgData("svg-container-landscape");
}else{
vertical.style.display="block";
landscape.style.display="none";
toggleLabel.classList.remove("landscape");
lazyLoadSvgData("svg-container-vertical");
}
}
