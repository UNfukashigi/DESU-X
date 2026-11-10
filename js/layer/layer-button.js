
function putActionButton(container,icon,labelKey,onclick,requiredRole){
if(requiredRole&&hasNotRole(requiredRole)){return;}
var button=document.createElement("button");
button.className="layer-action-btn";
var label=document.createElement("span");
label.setAttribute("data-i18n",labelKey);
label.textContent=i18next.t(labelKey);
button.appendChild(label);
button.onclick=function(e){e.stopPropagation();onclick();};
container.appendChild(button);
}

function putActionBarSeparator(container){
var sep=document.createElement("span");
sep.className="layer-action-sep";
container.appendChild(sep);
}

function putCropImageDownloadButton(buttonsDiv,layer,index) {
var button=document.createElement("button");
button.innerHTML='<i class="material-icons">download</i>';

button.onclick=function (e) {
e.stopPropagation();

imageObject2DataURLByCrop(layer)
.then((croppedDataURL)=>{
if (croppedDataURL) {
link=getLink(croppedDataURL);
link.click();
} else {
layerLogger.warn("No valid activeObject");
}
})
.catch((err)=>{
layerLogger.error("Error cropping image:",err);
});
};

addTooltipByElement(button,"imageCropDownloadButton");
buttonsDiv.appendChild(button);
}


function putRembgButton(buttonsDiv,layer,index) {

if(hasNotRole(AI_ROLES.RemoveBG)){return;}

var button=document.createElement("button");
button.innerHTML='<i class="material-icons">wallpaper</i>';

button.onclick=function (e) {
e.stopPropagation();
var spinner=createSpinner(getGUID(layer),'BG');
aiRembg(layer,spinner);
};

addTooltipByElement(button,"rembg");
buttonsDiv.appendChild(button);
}

function putTempButton(buttonsDiv,layer,index) {
if(hasNotRole(AI_ROLES.Temp)){return;}

var button=document.createElement("button");
button.innerHTML='<i class="material-icons">pets</i>';

button.onclick=function (e) {
e.stopPropagation();
var spinner=createSpinner(getGUID(layer),'BG');
sdWebUI_RembgProcessQueue(layer,spinner.id);
};

buttonsDiv.appendChild(button);
}



function putImageDownloadButton(buttonsDiv,layer,index) {
var button=document.createElement("button");
button.innerHTML='<i class="material-icons">download</i>';

button.onclick=function (e) {
e.stopPropagation();
dataURL=imageObject2DataURL(layer);
link=getLink(dataURL);
link.click();
};

addTooltipByElement(button,"imageDownloadButton");
buttonsDiv.appendChild(button);
}


function putInterrogateDanbooruButtons(buttonsDiv,layer,index) {
if(hasNotRole(AI_ROLES.Image2Prompt_DEEPDOORU)){return;}

var deepDooruButton=document.createElement("button");
deepDooruButton.innerHTML="📦";
deepDooruButton.onclick=function (e) {
e.stopPropagation();
var spinner=createSpinnerSuccess(getGUID(layer),'TAG');
sdwebuiInterrogate(layer,"deepdanbooru",spinner.id);
};
addTooltipByElement(deepDooruButton,"deepDooruButton");
buttonsDiv.appendChild(deepDooruButton);
}


function putInterrogateClipButtons(buttonsDiv,layer,index) {
if(hasNotRole(AI_ROLES.Image2Prompt_CLIP)){return;}

var clipButton=document.createElement("button");
clipButton.innerHTML="📎";

clipButton.onclick=function (e) {
e.stopPropagation();
var spinner=createSpinnerSuccess(getGUID(layer),'TAG');
sdwebuiInterrogate(layer,"clip",spinner.id);
};
addTooltipByElement(clipButton,"clipButton");

buttonsDiv.appendChild(clipButton);
}


function putPromptButton(buttonsDiv,layer,index) {
if(hasNotRole(AI_ROLES.PutPrompt)){return;}

var promptButton=document.createElement("button");
promptButton.innerHTML='<i class="material-icons">text_snippet</i>';
promptButton.onclick=function (e) {
e.stopPropagation();
if (layer.tempPrompt) {
layer.text2img_prompt=layer.tempPrompt;
createToast("Apply Prompt",layer.text2img_prompt);
} else {
createToastError("Nothing Prompt","");
}
if (layer.tempNegative) {
layer.text2img_negative=layer.tempNegative;
createToast("Apply Negative Prompt",layer.text2img_negative);
} else {
createToastError("Nothing Negative Prompt","");
}
};

addTooltipByElement(promptButton,"promptButton");
buttonsDiv.appendChild(promptButton);
}


function putUpscalerButton(buttonsDiv,layer,index) {
if(hasNotRole(AI_ROLES.Upscaler)){return;}

var button=document.createElement("button");
button.innerHTML='<i class="material-icons">photo_size_select_large</i>';
button.onclick=function (e) {
e.stopPropagation();
var spinner=createSpinner(getGUID(layer),'UP');
aiUpscale(layer,spinner);
};

addTooltipByElement(button,"upscaleButton");
buttonsDiv.appendChild(button);
}




function visibleChange(obj){
obj.visible=!obj.visible;
// 見えなくしたものが選ばれたままだと、ハンドルだけが宙に残り、
// Deleteで何が消えるのかが画面から分からなくなる。表示を切り替えるこの1か所で選択と揃える。
// selectable/evented は触らない。fabricの当たり判定（_checkTarget）が
// visible を見ているため、非表示のものはそもそも掴めない
if(!obj.visible){
var activeObject=canvas.getActiveObject();
var inActiveSelection=activeObject&&activeObject.type==="activeSelection"&&activeObject.contains(obj);
if(activeObject===obj||inActiveSelection){
canvas.discardActiveObject();
}
}
updateLayerPanel();
canvas.requestRenderAll();
commitHistory();
}

// 右クリックにしか無い操作（表示制限の削除・切り抜き・複製・コマへ入れる・設定資料）へ
// レイヤーからも辿れるようにする。同じメニューをそのまま開くので入口が二重にならない
function putMoreMenuActionButton(actionBar,layer){
putActionButton(actionBar,"more_horiz","actMoreMenu",function(){
if(canvas.getActiveObject()!==layer){
canvas.setActiveObject(layer);
canvas.renderAll();
}
showObjectMenu('right');
});
}

// コマに付けた設定資料の枚数。ウインドウを開いて1コマずつ選び直さないと分からないと、
// 付け忘れたコマがそのまま生成へ流れる。実体が見つからないidも数に入れる
// （ここで存在チェックをすると、読み込みの途中で0件に見える）。
//
// **押せば、そのコマを対象にして開く。** 数だけ出して押せないと、
// 直したいコマが分かってからAI設定の並びまで目を戻すことになる
function putReferenceCountBadge(buttonsDiv,layer) {
if(!isPanel(layer)){return;}
var count=ReferenceCollector.getAttachedIds(layer).length;
if(count===0){return;}
var badge=document.createElement("button");
badge.className="layer-ref-count";
var icon=document.createElement("i");
icon.className="material-icons";
icon.textContent="photo_library";
var num=document.createElement("span");
num.textContent=count;
badge.appendChild(icon);
badge.appendChild(num);
badge.onclick=function(event){
event.stopPropagation();
referenceSheetWindow.open(layer);
};
addTooltipByElement(badge,"layerRefCountOpen");
buttonsDiv.appendChild(badge);
}

function putViewButton(buttonsDiv,layer,index) {
var viewButton=document.createElement("button");
viewButton.id="viewButton-"+index;
if(layer.visible){
viewButton.innerHTML='<i class="material-icons">visibility</i>';
}else{
viewButton.innerHTML='<i class="material-icons">visibility_off</i>';
}

viewButton.onclick=function (e) {
visibleChange(layer);
};

addTooltipByElement(viewButton,"viewButton");
buttonsDiv.appendChild(viewButton);
}


function putRunI2IButton(buttonsDiv,layer,index) {
if(hasNotRole(AI_ROLES.Image2Image)){return;}

var runButton=document.createElement("button");
runButton.id="runButton-"+index;
runButton.innerHTML='<i class="material-icons">directions_run</i>';
runButton.onclick=function (e) {
e.stopPropagation();
var spinner=createSpinner(getGUID(layer),'I2I');
I2I(layer,spinner);
};

addTooltipByElement(runButton,"runButton");

buttonsDiv.appendChild(runButton);
}



function putDeleteButton(buttonsDiv,layer,index) {
var deleteButton=document.createElement("button");
deleteButton.textContent="✕";
deleteButton.className="delete-layer-button";
deleteButton.onclick=function (e) {
e.stopPropagation();
removeLayer(layer);
};
addTooltipByElement(deleteButton,"deleteButton");
buttonsDiv.appendChild(deleteButton);
}

function putSeedButton(buttonsDiv,layer,index) {
if(hasNotRole(AI_ROLES.PutSeed)){return;}

var seedButton=document.createElement("button");
seedButton.innerHTML='<i class="material-icons">recycling</i>';
seedButton.onclick=function (e) {
e.stopPropagation();
if (layer.tempSeed) {
layer.text2img_seed=layer.tempSeed;
createToast("Recycling Seed",layer.text2img_seed);
} else {
createToastError("Nothing Seed","");
}
};

addTooltipByElement(seedButton,"seedButton");
buttonsDiv.appendChild(seedButton);
}

function putRunT2IButton(buttonsDiv,layer,index) {
if(hasNotRole(AI_ROLES.Text2Image)){return;}

var runButton=document.createElement("button");
runButton.id="runButton-"+index;
runButton.innerHTML='<i class="material-icons">directions_run</i>';
runButton.onclick=function (e) {
e.stopPropagation();
var spinner=createSpinner(getGUID(layer),'T2I');
T2I(layer,spinner);
};
addTooltipByElement(runButton,"runButton");
buttonsDiv.appendChild(runButton);
}



function AllRun(){
var objescts=getPanelObjectList();
objescts.forEach(layer=>{
var spinner=createSpinner(getGUID(layer),'T2I');
T2I(layer,spinner);
});
}




// 文字の入力中、fabric は selectable を一時的に false にし、元の値を _savedProps に退避する
// （exitEditing で戻す）。入力中にそのまま selectable を見ると、ロックを外した文字でも
// 「入力しようとするとロックされる」ように見える。入力中は退避した値をロックの状態とする
function isMoveLocked(obj){
if(obj.isEditing&&obj._savedProps){
return !obj._savedProps.selectable;
}
return !obj.selectable;
}

function moveLockChange(obj){
if(obj.isEditing&&obj._savedProps){
obj._savedProps.selectable=!obj._savedProps.selectable;
updateLayerPanel();
return;
}
obj.selectable=!obj.selectable;
// 外したらもう目立たせる必要はない
clearLockHint();
canvas.discardActiveObject();
canvas.renderAll();
updateLayerPanel();
commitHistory();
}

function putMoveLockButton(buttonsDiv,layer,index) {
var button=document.createElement("button");
button.id="moveLock-"+index;
if(isMoveLocked(layer)){
button.innerHTML='<i class="material-icons">lock</i>';
}else{
button.innerHTML='<i class="material-icons">control_camera</i>';
}
// キャンバスで押されたロック中のオブジェクトは、その鍵がどれかを示す
if(isMoveLocked(layer)&&isLockHintTarget(layer.guid)){
button.classList.add("layer-lock-hint");
}

button.onclick=function (e) {
e.stopPropagation();
moveLockChange(layer);
};
addTooltipByElement(button,"moveLockButton");
buttonsDiv.appendChild(button);
}
