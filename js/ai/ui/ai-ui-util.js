function changeExternalAPI(button,showToast) {
changeSelected(button);

const selectedValue=getSelectedValueByGroup("externalApiGroup");

var helpTitle=getText("help_api_connect_settings");
if (selectedValue==="sdWebUIButton") {
apiMode=apis.A1111;
providerRegistry.syncFromApiMode(apiMode);
if(showToast)createToast("API CHANGE!","WebUI(A1111/Forge)",2000);
$('apiSettingsUrlHelpe').innerHTML=`<a href="html/API_Help/sd-api-guide.html" target="_blank" class="es-btn-small" title="${helpTitle}">?</a>`;
} else if (selectedValue==="comfyUIButton") {
apiMode=apis.COMFYUI;
providerRegistry.syncFromApiMode(apiMode);
if(showToast)createToast("API CHANGE!","COMFYUI",2000);
$('apiSettingsUrlHelpe').innerHTML=`<a href="html/API_Help/comfyui_settings.html" target="_blank" class="es-btn-small" title="${helpTitle}">?</a>`;
} else if (selectedValue==="runpodComfyUIButton") {
apiMode=apis.RUNPOD_COMFYUI;
providerRegistry.syncFromApiMode(apiMode);
if(showToast)createToast("API CHANGE!","RunPod ComfyUI",2000);
$('apiSettingsUrlHelpe').innerHTML='';
firstComfyConnection=true;
} else if (selectedValue==="falaiButton") {
apiMode=apis.FAL_AI;
providerRegistry.syncFromApiMode(apiMode);
if(showToast)createToast("API CHANGE!","Fal.ai",2000);
$('apiSettingsUrlHelpe').innerHTML='';
}

updateWorkflowType();
updateLayerPanel();
apiHeartbeat();
}

function changeAiModelType(button) {
changeSelected(button);
updateWorkflowType()

const generateModelGroup=getSelectedValueByGroup("generateModelGroup");
if (generateModelGroup==="Flux") {
if($("basePrompt_cfg_scale").value>3){
$("basePrompt_cfg_scale").value=1.5;
}
}
modelSettingsWindow.updateSdWebuiVisibility();
}


function changeWorkflowType(button) {
changeSelected(button);
updateWorkflowType();
modelSettingsWindow.updateSdWebuiVisibility();
}
function isComfyUIMode(groupValue){
return groupValue==="comfyUIButton"||groupValue==="runpodComfyUIButton";
}
function getExternalApiGroupFromRoles(){
var t2i=providerRegistry.getRoleAssignment(AI_ROLES.Text2Image);
var i2i=providerRegistry.getRoleAssignment(AI_ROLES.Image2Image);
var primary=t2i&&t2i!=='default'?t2i:i2i;
if(!primary||primary==='default')primary='localComfyUI';
var map={
localComfyUI:'comfyUIButton',
localSDWebUI:'sdWebUIButton',
runpodComfyUI:'runpodComfyUIButton',
falai:'falaiButton',
googleImage:'googleImageButton'
};
return map[primary]||'comfyUIButton';
}
function updateWorkflowType() {
const externalApiGroup=getExternalApiGroupFromRoles();

showById("prompt-A");
showById("prompt-E");
showById("prompt-F");

if (externalApiGroup==="falaiButton"){
hideById("comfyUIWorkflowId");
showById("negativeAreaId");
return;
}
// Nano Bananaにネガティブプロンプトの項目は無い。欄を残すと入力が効いているように見えるため隠す
if (externalApiGroup==="googleImageButton"){
hideById("comfyUIWorkflowId");
hideById("negativeAreaId");
return;
}
if (isComfyUIMode(externalApiGroup)){
showById("comfyUIWorkflowId");
showById("negativeAreaId");
return;
}
hideById("comfyUIWorkflowId");
const generateModelGroup=getSelectedValueByGroup("generateModelGroup");
if (generateModelGroup==="Flux") {
hideById("negativeAreaId");
} else {
showById("negativeAreaId");
}
}