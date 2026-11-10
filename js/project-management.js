// Available api models
const apis={
A1111: "A1111",
COMFYUI: "comfyui",
RUNPOD_COMFYUI: "runpodComfyUI",
FAL_AI: "falai"
};


const getDataByName=(files,fileName)=>{
const file=files.find(file=>file.name===fileName);
return file ? file.data : null;
};



// Variable to keep track of selected api model to use
var apiMode=apis.COMFYUI;

document.addEventListener("DOMContentLoaded",function () {
var settingsSave=$("settingsSave");
settingsSave.addEventListener("click",function () {saveSettingsLocalStrage();});

var saveButton=$("projectSave");
var loadButton=$("projectLoad");

saveButton.addEventListener("click",async function () {
if (stateStack.length===0) {
createToastError("Save Error","Not Found.");
return;
}

const loading=OP_showLoading({icon: 'process',step: 'Step1',substep: 'Save Project',progress: 0});

btmSaveProjectFile(null,false).then(async ()=>{
OP_updateLoadingState(loading,{icon: 'process',step: 'Step2',substep: 'Process 1',progress: 20});

const lz4BlobList=Array.from(btmProjectsMap.values()).map(data=>data.blob);
if(lz4BlobList.some(blob=>!blob)){
throw new Error("Some pages have no saved data");
}
let mergeLz4Blob=await lz4Compressor.mergeLz4Blobs(lz4BlobList);

OP_updateLoadingState(loading,{icon: 'process',step: 'Step3',substep: 'Process 2',progress: 20});

var url=window.URL.createObjectURL(mergeLz4Blob);
var a=document.createElement("a");
a.href=url;
// 保存のたびに同じ名前だと、どれが最新か分からず上書きの警告も出ない
a.download="DESU-Project_"+getFormattedDateTime()+"_"+lz4BlobList.length+"p.lz4";

document.body.appendChild(a);
a.click();
document.body.removeChild(a);
window.URL.revokeObjectURL(url);
// ファイルへ保存しても自動保存データは消さない。
// 消すと、保存した後の作業がクラッシュで失われたときに戻せる場所が無くなる。
// 自動保存は次の周期で同じキーへ上書きされるため、残しても溜まり続けることはない
UnsavedGuard.markSaved();
})
.catch((error)=>{
projectLogger.error("error",error);
projectLogger.error("error json,",JSON.stringify(error));
createToastError("Save Error","Failed to save project.");
})
.finally(()=>{
OP_hideLoading(loading);
});
});



loadButton.addEventListener("click",function () {
var fileInput=document.createElement("input");
fileInput.type="file";
fileInput.style.display="none";
document.body.appendChild(fileInput);
fileInput.click();

fileInput.onchange=async function () {
var file=this.files[0];
if(!file){
document.body.removeChild(fileInput);
return;
}
var loadMode=await askProjectLoadMode();
if(!loadMode){
document.body.removeChild(fileInput);
return;
}

const loading=OP_showLoading({icon: 'process',step: 'Step1',substep: 'Load Project',progress: 0});

try {
if (file) {
const fileBuffer=await file.arrayBuffer();
const fileName=file.name.toLowerCase();
const isZip=fileName.endsWith('.zip');
const isLz4=fileName.endsWith('.lz4');
var firstLoadedGuid=null;

if (isZip) {
OP_updateLoadingState(loading,{icon: 'process',step: 'Step2',substep: 'UnZip',progress: 20});

const zip=await JSZip.loadAsync(file);
var hasNestedZip=false;
var fileCount=0;

zip.forEach(function (relativePath,zipEntry) {
fileCount++;
OP_updateLoadingState(loading,{icon: 'process',step: 'Step3',substep: 'UnZip file:'+fileCount,progress: 30});
if (zipEntry.name.toLowerCase().endsWith('.zip')) {
hasNestedZip=true;
}
});

// 展開に成功してから畳む。展開が失敗する可能性がある間に消すと、
// 読み込めなかったのに手元のページだけ失う
if(loadMode==='replace')clearAllProjectPages();

if (hasNestedZip) {
OP_updateLoadingState(loading,{icon: 'process',step: 'Step4',substep: 'UnZip:',progress: 40});
firstLoadedGuid=await processZip(zip);
document.body.removeChild(fileInput);
} else {
OP_updateLoadingState(loading,{icon: 'process',step: 'Step4',substep: 'UnZip:',progress: 40});
firstLoadedGuid=await multiLoadZip(zip);
}
} else if (isLz4) {
//fileList is {name, data}
OP_updateLoadingState(loading,{icon: 'process',step: 'Step2',substep: 'UnLz4',progress: 20});
let bufferFileLz4List=await lz4Compressor.unLz4FilesByBuffer(fileBuffer);

OP_updateLoadingState(loading,{icon: 'process',step: 'Step3',substep: 'UnLz4',progress: 25});
if(loadMode==='replace')clearAllProjectPages();
firstLoadedGuid=await multiLoadLz4(bufferFileLz4List);

OP_updateLoadingState(loading,{icon: 'process',step: 'Step4',substep: 'UnLz4',progress: 85});
} else {
let title=getText("unsupportedProjectFileFormat");
let message=getText("unsupportedProjectFileFormatMessage");
createToastError(title,message,4000);
}

if (firstLoadedGuid) {
OP_updateLoadingState(loading,{icon: 'process',step: 'Step5',substep: 'Open Page 1',progress: 90});
// 「後ろに追加する」のときだけ、読み込む前に開いていたページを一覧へ戻す。
// 「置き換える」で保存すると、消したはずのページが末尾に生き返る
if(loadMode==='append'&&btmShouldSaveCurrentPage()){
await btmSaveProjectFile(null,false);
}
await chengeCanvasByGuid(firstLoadedGuid);
btmUpdateHandleText();
// 読み込んだ直後はファイルと同じ内容なので、離脱警告の対象から外す
UnsavedGuard.markSaved();
}
}
} catch (error) {
projectLogger.error("error:",error);
createToastError("Load Error","Failed to load project.");
} finally {
OP_hideLoading(loading);
}
};
});
});


// 開いているページを全て畳む。btmProjectsMapとボトムバーのDOMは対で消さないと、
// 一覧に残った見出しから消えたページを開こうとして落ちる
function clearAllProjectPages(){
btmProjectsMap.clear();
var container=$("btm-image-container");
if(container)container.innerHTML='';
}

// 読み込んだページを今のページと入れ替えるのか、後ろに足すのかを先に聞く。
// 黙って後ろに足すと、別プロジェクトのページが混ざったまま保存されてしまう
async function askProjectLoadMode(){
// 起動直後の空ページ1枚は「失うもの」ではないので選ばせない。
// ページは作られた時点で一覧へ登録されるため（btmRegisterCurrentPage）、
// 件数が0か、今のページだけかで判断する。
// btmShouldSaveCurrentPage()は登録済みなら常にtrueを返すのでここには使えない。
// このとき'append'にすると空のページ1が先頭に残ったままになるため'replace'を返す
var pageCount=btmGetGuidsSize();
var onlyCurrentPage=(pageCount===0)||(pageCount===1&&btmProjectsMap.has(getCanvasGUID()));
if(onlyCurrentPage&&getContentObjectCount()===0)return 'replace';
var message=getText('projectLoadModeBody');
if(UnsavedGuard.isDirty()){
message+='\n'+getText('projectLoadModeUnsaved');
}
return await showConfirmDialog({
titleKey:'projectLoadModeTitle',
message:message,
cancelKey:'projectLoadModeCancel',
choices:[
{key:'replace',textKey:'projectLoadModeReplace',secondary:true,danger:true},
{key:'append',textKey:'projectLoadModeAppend'}
]
});
}

function findCanvasGuid(obj) {
if (typeof obj==='string') {
try {
obj=JSON.parse(obj);
} catch (error) {
return null;
}
}
if (typeof obj!=='object'||obj===null) {
return null;
}

if (obj.canvasGuid) {
return obj.canvasGuid;
}

for (let key in obj) {
if (typeof obj[key]==='object') {
const result=findCanvasGuid(obj[key]);
if (result) return result;
}
}
return null;
}

var localSettingsData=null;

function toggleSettingsHighlight(enable){
var flag=(enable!==undefined)?enable:!DEBUG_FLAGS.settingsHighlight;
DEBUG_FLAGS.settingsHighlight=flag;
var styleId='settings-highlight-style';
var existingStyle=$(styleId);
if(flag){
if(!existingStyle){
var style=document.createElement('style');
style.id=styleId;
style.textContent='.settings-highlight{outline:3px solid #ff6b00 !important;box-shadow:0 0 10px #ff6b00 !important;animation:settings-pulse 1s ease-in-out infinite !important;}@keyframes settings-pulse{0%,100%{outline-color:#ff6b00;box-shadow:0 0 10px #ff6b00;}50%{outline-color:#ffaa00;box-shadow:0 0 20px #ffaa00;}}';
document.head.appendChild(style);
}
applyHighlightClass(true);
projectLogger.debug('Settings highlight: ON');
}else{
if(existingStyle)existingStyle.remove();
applyHighlightClass(false);
projectLogger.debug('Settings highlight: OFF');
}
return flag;
}

function applyHighlightClass(add){
var allIds=[];
Object.values(SETTINGS_SCHEMA).forEach(function(cfg){if(cfg.id)allIds.push(cfg.id);});
Object.values(BASEPROMPT_SCHEMA).forEach(function(cfg){if(cfg.id)allIds.push(cfg.id);});
allIds.forEach(function(id){
var el=$(id);
if(el){
if(add)el.classList.add('settings-highlight');
else el.classList.remove('settings-highlight');
}
});
}

var SETTINGS_SCHEMA={
view_layers_checkbox:{id:'view_layers_checkbox',default:true,type:'checkbox'},
view_controls_checkbox:{id:'view_controls_checkbox',default:true,type:'checkbox'},
knifePanelSpaceSize:{id:'knifePanelSpaceSize',default:'20'},
canvasBgColor:{id:'bg-color',default:'#ffffff'},
canvasDpi:{id:'outputDpi',default:'450'},
canvasGridLineSize:{id:'gridSizeInput',default:'10'},
canvasMarginFromPanel:{id:'marginFromPanel',default:20},
sdWebUIPageUrl:{id:'sdWebUIPageUrl',default:'http://127.0.0.1:7860'},
comfyUIPageUrl:{id:'comfyUIPageUrl',default:'http://127.0.0.1:8188'},
runpodComfyUIUrl:{id:'runpodComfyUIUrl',default:''},
falaiApiKey:{id:'falaiApiKey',default:''},
falaiModelT2I:{id:'falaiModelT2I',default:''},
falaiModelI2I:{id:'falaiModelI2I',default:''},
falaiModelUpscale:{id:'falaiModelUpscale',default:''},
falaiModelRembg:{id:'falaiModelRembg',default:''},
falaiConcurrency:{id:'falaiConcurrency',default:'1'},
googleImageApiKey:{id:'googleImageApiKey',default:''},
googleImageModelT2I:{id:'googleImageModelT2I',default:'gemini-3.1-flash-lite-image'},
googleImageModelI2I:{id:'googleImageModelI2I',default:'gemini-3.1-flash-lite-image'},
googleImageSize:{id:'googleImageSize',default:'1K'},
googleImageConcurrency:{id:'googleImageConcurrency',default:'1'},
referenceDescribeInPrompt:{id:'referenceDescribeInPrompt',default:true,type:'checkbox'},
grokApiKey:{id:'grokApiKey',default:''},
grokModelText:{id:'grokModelText',default:''},
grokModelVision:{id:'grokModelVision',default:''},
ollamaUrl:{id:'ollamaUrl',default:'http://127.0.0.1:11434'},
ollamaModelText:{id:'ollamaModelText',default:''},
ollamaModelVision:{id:'ollamaModelVision',default:''},
grokConcurrency:{id:'grokConcurrency',default:'1'},
ollamaConcurrency:{id:'ollamaConcurrency',default:'1'},
apiHeartbeatCheckbox:{id:'apiHeartbeatCheckbox',default:true,type:'checkbox'},
autoSaveEnabled:{id:'autoSaveCheckbox',default:true,type:'checkbox'},
autoSaveInterval:{id:'autoSaveInterval',default:'60'},
settingsAutoSaveEnabled:{id:'settingsAutoSaveCheckbox',default:true,type:'checkbox'},
view_prompt_checkbox:{id:'view_prompt_checkbox',default:false,type:'checkbox'},
customPanelSizeX:{id:'customPanelSizeX',default:'1380'},
customPanelSizeY:{id:'customPanelSizeY',default:'4000'},
panelStrokeColor:{id:'panelStrokeColor',default:'rgba(0,0,0,1)'},
panelFillColor:{id:'panelFillColor',default:'rgba(255,255,255,1)'},
panelStrokeWidth:{id:'panelStrokeWidth',default:'2'},
panelOpacity:{id:'panelOpacity',default:'100'},
bubbleStrokeColor:{id:'bubbleStrokeColor',default:'rgba(0,0,0,1)'},
bubbleFillColor:{id:'bubbleFillColor',default:'rgba(255,255,255,1)'},
speechBubbleOpacity:{id:'speechBubbleOpacity',default:'100'},
bubbleStrokewidht:{id:'bubbleStrokewidht',default:'4.0'},
speechBubbleLineSizeSlider:{id:'speechBubbleLineSizeSlider',default:'3'},
sbStrokeColor:{id:'sbStrokeColor',default:'rgba(0,0,0,1)'},
sbFillColor:{id:'sbFillColor',default:'rgba(255,255,255,1)'},
sbSmoothing:{id:'sbSmoothing',default:true,type:'checkbox'},
sbStrokeWidth:{id:'sbStrokeWidth',default:'1'},
sbPointSpace:{id:'sbPointSpace',default:'4'},
sbFillOpacity:{id:'sbFillOpacity',default:'100'},
sbSornerRadius:{id:'sbSornerRadius',default:'2'},
sbFillOpacity2:{id:'sbFillOpacity2',default:'100'},
svg_icon_iconStyle:{id:'svg_icon_iconStyle',default:'filled'},
svg_icon_lineColor:{id:'svg_icon_lineColor',default:'rgba(0,0,0,1)'},
svg_icon_fillColor:{id:'svg_icon_fillColor',default:'rgba(255,255,255,1)'},
svg_icon_lineWidth:{id:'svg_icon_lineWidth',default:'1'},
svg_icon_fillOpacity:{id:'svg_icon_fillOpacity',default:'1'},
svg_icon_shadowColor:{id:'svg_icon_shadowColor',default:'rgba(255,255,255,1)'},
svg_icon_shadowBlur:{id:'svg_icon_shadowBlur',default:'3'},
svg_icon_shadowOffsetX:{id:'svg_icon_shadowOffsetX',default:'0'},
svg_icon_shadowOffsetY:{id:'svg_icon_shadowOffsetY',default:'0'},
InformationFPS:{id:'InformationFPS',default:true,type:'checkbox'},
InformationCoordinate:{id:'InformationCoordinate',default:true,type:'checkbox'},
AdetailerCheck:{id:'AdetailerCheck',default:false,type:'checkbox'},
AdetilerModelsPrompt:{id:'AdetilerModelsPrompt',default:''},
AdetilerModelsNegative:{id:'AdetilerModelsNegative',default:''},
pageCount:{id:'pageCount',default:'18'},
verticalRandomPanelCount:{id:'verticalRandomPanelCount',default:'2'},
horizontalRandomPanelCount:{id:'horizontalRandomPanelCount',default:'3'},
tiltRandom:{id:'tiltRandom',default:'6'},
cutChangeRate:{id:'cutChangeRate',default:'10'},
onePanelGenerateNumber:{id:'onePanelGenerateNumber',default:'1'},
inpaintBrushSize:{id:'inpaint-brush-size',default:'30'},
inpaintDenoise:{id:'inpaint-denoise',default:'0.75'},
dashboardDailyGoalInput:{id:'dashboardDailyGoalInput',default:''},
dashboardWeeklyGoalInput:{id:'dashboardWeeklyGoalInput',default:''},
textColorPicker:{id:'textColorPicker',default:'rgba(0,0,0,1)'},
textOutlineColorPicker:{id:'textOutlineColorPicker',default:'rgba(0,0,0,1)'},
textBgColorPicker:{id:'textBgColorPicker',default:'rgba(255,255,255,1)'},
fontSizeSlider:{id:'fontSizeSlider',default:'14'},
fontStrokeWidthSlider:{id:'fontStrokeWidthSlider',default:'0'},
storyComposition:{id:'storyComposition',default:'general'},
storyToneGuidance:{id:'storyToneGuidance',default:''},
storyFrameNegative:{id:'storyFrameNegative',default:''},
storyPanelSizeFromShape:{id:'storyPanelSizeFromShape',default:false,type:'checkbox'},
inpaintPrompt:{id:'inpaint-prompt',default:''},
inpaintNegative:{id:'inpaint-negative',default:''},
anglePrompt:{id:'angle-prompt',default:''}
};

var BASEPROMPT_SCHEMA={
basePrompt_text2img_prompt:{id:'basePrompt_prompt',key:'text2img_prompt'},
basePrompt_text2img_negative:{id:'basePrompt_negative',key:'text2img_negative'},
basePrompt_text2img_seed:{id:'basePrompt_seed',key:'text2img_seed'},
basePrompt_text2img_cfg_scale:{id:'basePrompt_cfg_scale',key:'text2img_cfg_scale'},
basePrompt_text2img_width:{id:'basePrompt_width',key:'text2img_width'},
basePrompt_text2img_height:{id:'basePrompt_height',key:'text2img_height'},
basePrompt_text2img_samplingMethod:{id:'basePrompt_samplingMethod',key:'text2img_samplingMethod'},
basePrompt_text2img_samplingSteps:{id:'basePrompt_samplingSteps',key:'text2img_samplingSteps'},
basePrompt_text2img_scheduler:{id:null,key:'text2img_scheduler'},
basePrompt_text2img_model:{id:'basePrompt_model',key:'text2img_model'},
basePrompt_text2img_hr_upscaler:{id:'text2img_hr_upscaler',key:'text2img_hr_upscaler'},
basePrompt_text2img_hr_scale:{id:'text2img_hr_scale',key:'text2img_hr_scale'},
basePrompt_text2img_hr_step:{id:'text2img_hr_step',key:'text2img_hr_step'},
basePrompt_text2img_hr_denoise:{id:'text2img_hr_denoise',key:'text2img_hr_denoise'}
};

// selectは復元時点でoptionが未生成のことがある（モデル一覧はAPI取得後に作られる）。
// そのままvalueを代入すると無言で''に落ち、設定の自動保存で保存値まで空で上書きされるため、
// 該当optionが無い場合は保存値のoptionを補ってから選択する
function applySettingValue(el,val){
if(el.tagName!=='SELECT'||val===''||val===undefined||val===null){
el.value=val;
return;
}
var text=String(val);
el.value=text;
if(el.value===text)return;
var opt=document.createElement('option');
opt.value=text;
opt.textContent=text;
el.appendChild(opt);
el.value=text;
}

// 保存された設定が無い初回でも、既定値をUIへ書き込むところまで必ず通す。
// 途中で return すると、UIは空欄なのに内部の basePrompt には既定値が入ったままになり、
// 画面に出ていない文字列・サイズで生成されてしまう。
// 既定値の出どころは js/core/settings.js の basePrompt と SETTINGS_SCHEMA の default だけとし、
// UIはそれを写したものにする（起動時のトーストは出さない。毎回出ると本当のエラーが埋もれる）
function loadSettingsLocalStrage(){
var stored=localStorage.getItem('localSettingsData');
var data=stored?JSON.parse(stored):{};
Object.keys(SETTINGS_SCHEMA).forEach(function(key){
var cfg=SETTINGS_SCHEMA[key];
var el=$(cfg.id);
if(!el)return;
var val=(data[key]!==undefined)?data[key]:cfg.default;
if(cfg.type==='checkbox')el.checked=val;
else applySettingValue(el,val);
});
var bgEl=$('bg-color');
bgEl.dispatchEvent(new Event('input',{bubbles:true,cancelable:true}));
svgPagging=(data.canvasMarginFromPanel!==undefined)?data.canvasMarginFromPanel:SETTINGS_SCHEMA.canvasMarginFromPanel.default;
Object.keys(BASEPROMPT_SCHEMA).forEach(function(key){
var cfg=BASEPROMPT_SCHEMA[key];
var val=(data[key]!==undefined)?data[key]:basePrompt[cfg.key];
if(cfg.id){
var el=$(cfg.id);
if(el)applySettingValue(el,val);
}
basePrompt[cfg.key]=val;
});
['basePrompt_height','basePrompt_width'].forEach(function(elId){
$(elId).addEventListener('blur',function(){
var v=parseInt(this.value);
if(v!==-1)this.value=Math.round(v/8)*8;
});
});
var mode=data.externalAI||apis.COMFYUI;
apiMode=mode;
providerRegistry.syncFromApiMode(apiMode);
if(data.roleAssignments){
providerRegistry.loadRoleAssignments(data.roleAssignments);
}
updateWorkflowType();
}

function saveSettingsLocalStrage(silent){
if(!silent)createToast('Settings Save',['Saving settings...','Save Completed!!'],1500);
var data={externalAI:apiMode};
Object.keys(SETTINGS_SCHEMA).forEach(function(key){
var cfg=SETTINGS_SCHEMA[key];
var el=$(cfg.id);
if(!el)return;
data[key]=(cfg.type==='checkbox')?el.checked:el.value;
});
Object.keys(BASEPROMPT_SCHEMA).forEach(function(key){
var cfg=BASEPROMPT_SCHEMA[key];
data[key]=basePrompt[cfg.key];
});
data.roleAssignments=providerRegistry.getAllRoleAssignments();
localStorage.setItem('localSettingsData',JSON.stringify(data));
}

function resetAllSettings(){
var items=[
getText('settingsResetItem1')||'API connection settings (URLs, API keys)',
getText('settingsResetItem2')||'AI image generation settings (prompts, models, etc.)',
getText('settingsResetItem3')||'Drawing tool & canvas settings',
getText('settingsResetItem4')||'Custom prompt sets',
getText('settingsResetItem5')||'UI settings (language, theme, sidebar, etc.)',
getText('settingsResetItem6')||'Tutorial progress'
];
var overlay=document.createElement('div');
overlay.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);display:flex;justify-content:center;align-items:center;z-index:var(--z-modal)';
var dialog=document.createElement('div');
dialog.style.cssText='background:var(--color-base);color:var(--color-text-primary);border-radius:8px;padding:24px;max-width:420px;width:90%;box-shadow:0 4px 24px rgba(0,0,0,0.5)';
var title=document.createElement('div');
title.style.cssText='font-size:16px;font-weight:bold;margin-bottom:12px';
title.textContent=getText('settingsResetConfirmTitle')||'The following data will be deleted:';
dialog.appendChild(title);
var list=document.createElement('ul');
list.style.cssText='margin:0 0 16px 0;padding-left:20px;line-height:1.8';
items.forEach(function(item){
var li=document.createElement('li');
li.textContent=item;
list.appendChild(li);
});
dialog.appendChild(list);
var btnRow=document.createElement('div');
btnRow.style.cssText='display:flex;justify-content:flex-end;gap:8px';
var cancelBtn=document.createElement('button');
cancelBtn.textContent=getText('settingsResetCancel')||'Cancel';
cancelBtn.style.cssText='padding:6px 16px;border:1px solid var(--color-text-secondary);border-radius:4px;background:var(--color-secondary);color:var(--color-text-primary);cursor:pointer';
var okBtn=document.createElement('button');
okBtn.textContent=getText('settingsResetOk')||'Reset';
okBtn.style.cssText='padding:6px 16px;border:none;border-radius:4px;background:var(--color-accent);color:#fff;cursor:pointer';
btnRow.appendChild(cancelBtn);
btnRow.appendChild(okBtn);
dialog.appendChild(btnRow);
overlay.appendChild(dialog);
document.body.appendChild(overlay);
cancelBtn.addEventListener('click',function(){overlay.remove();});
overlay.addEventListener('click',function(e){if(e.target===overlay)overlay.remove();});
okBtn.addEventListener('click',function(){
overlay.remove();
localStorage.clear();
sessionStorage.clear();
if('caches' in window){
caches.keys().then(function(names){
names.forEach(function(name){caches.delete(name);});
});
}
createToast('Settings Reset',['Clearing all data...','Reloading...'],1500);
setTimeout(function(){location.reload();},1500);
});
}

// 起動時に出るモーダルの順番はここ1か所で決める。
// 言語 → 自動保存の復元 → チュートリアルの案内。
// 各モーダルに「相手が出ていたら待つ」判定を持たせると、増やすたびに漏れるため、
// 待ち合わせは行わず、この並びだけを唯一の順序とする。
// 復元を先にすると、言語未選択のまま英語で「消すかどうか」を迫ることになる
async function runBootSequence(){
try{
// 自動保存の開始はダイアログを待たない。init()はもうダイアログを出さないので
// 順番に関係が無く、待たせると言語を選ぶまでの間だけ自動保存が止まる
// （オーバーレイはポインタを塞ぐがキー操作は通るため、その間も編集はできる）。
// 復元前にタイマーが回っても、白紙のキャンバスは
// btmShouldSaveCurrentPage()===false かつ btmGetGuidsSize()===0 で保存対象にならず、
// 復元中は isProjectBusy() で弾かれるため、復元データを上書きすることはない
await AutoSaveManager.init();
await TutorialManager.startupLanguageStep();
var recovered=await AutoSaveManager.checkRecovery();
// 前回の続きを戻した人に「はじめての漫画作成」を被せない。
// 見送った場合の再開先は Help メニューの Tutorial
if(!recovered)await TutorialManager.startupTutorialStep();
}catch(e){
projectLogger.error("Boot sequence failed:",e);
}
}

document.addEventListener('DOMContentLoaded',function() {
loadSettingsLocalStrage();
changeView("layer-panel",$('view_layers_checkbox').checked);
changeView("controls",$('view_controls_checkbox').checked);
if(DEBUG_FLAGS.settingsHighlight)toggleSettingsHighlight(true);
runBootSequence();
initSettingsAutoSave();
});

var settingsAutoSaveTimer=null;
// 「設定値自動保存」の可否はここで見る。呼び出し側ごとに判定を書くと、
// 呼び出しが増えるたびに書き漏らす（ロール割り当てだけ無条件に保存されていた）。
// 明示的な保存は saveSettingsLocalStrage() を直接呼ぶこと。この関数を通してはいけない
function debouncedSettingsSave(){
var chk=$('settingsAutoSaveCheckbox');
if(!chk||!chk.checked)return;
if(settingsAutoSaveTimer)clearTimeout(settingsAutoSaveTimer);
settingsAutoSaveTimer=setTimeout(function(){
saveSettingsLocalStrage(true);
},500);
}

function initSettingsAutoSave(){
var chk=$('settingsAutoSaveCheckbox');
if(!chk)return;
chk.addEventListener('change',function(){
saveSettingsLocalStrage(true);
});
var idSet={};
Object.keys(SETTINGS_SCHEMA).forEach(function(key){
var cfg=SETTINGS_SCHEMA[key];
if(cfg.id)idSet[cfg.id]=true;
});
Object.keys(BASEPROMPT_SCHEMA).forEach(function(key){
var cfg=BASEPROMPT_SCHEMA[key];
if(cfg.id)idSet[cfg.id]=true;
});
document.addEventListener('input',function(e){
if(!chk.checked||!e.target||!e.target.id)return;
if(e.target.id==='settingsAutoSaveCheckbox')return;
if(idSet[e.target.id])debouncedSettingsSave();
});
document.addEventListener('change',function(e){
if(!chk.checked||!e.target||!e.target.id)return;
if(e.target.id==='settingsAutoSaveCheckbox')return;
if(idSet[e.target.id])debouncedSettingsSave();
});
}

document.addEventListener('DOMContentLoaded',function() {
$('svgDownload').onclick=function () {
var svg=canvas.toSVG();
svgDownload('canvas.svg',svg);
};
});


function svgDownload(filename,content) {
var element=document.createElement('a');
element.setAttribute('href','data:image/svg+xml;charset=utf-8,'+encodeURIComponent(content));
element.setAttribute('download',filename);
element.style.display='none';
document.body.appendChild(element);
element.click();
document.body.removeChild(element);
}