// Fal.aiクラウドAIプロバイダー: Queue APIで非同期実行（T2I/I2I/Upscale/RemoveBG）
// キュー投入・結果の配置はCloudImageProviderに寄せてある
class FalAIProvider extends CloudImageProvider{
constructor(){
super('falai','Fal.ai');
this._modelCache=null;
}
getQueue(){
return falaiQueue;
}
getQueueName(){
return'falai';
}
getSupportedRoles(){
return[
AI_ROLES.Text2Image,
AI_ROLES.Image2Image,
AI_ROLES.Upscaler,
AI_ROLES.RemoveBG
];
}
needsApiKey(){
return true;
}
getApiKey(){
var el=$('falaiApiKey');
return el?el.value:'';
}
getEndpointUrl(){
return'https://fal.run';
}
_getModelId(role){
var map={
t2i:'falaiModelT2I',
i2i:'falaiModelI2I',
upscale:'falaiModelUpscale',
rembg:'falaiModelRembg'
};
var id=map[role];
if(!id)return'';
var el=$(id);
return el?el.value:'';
}
async fetchModelsIfNeeded(){
var apiKey=this.getApiKey();
if(!apiKey){
this._enableSelects(false);
return;
}
if(this._modelCache){
this._applyCache();
return;
}
return this.fetchModels();
}
async fetchModels(){
var apiKey=this.getApiKey();
if(!apiKey){
this._enableSelects(false);
return;
}
this._showFetchingState();
var queries={
falaiModelT2I:'category=text-to-image&status=active&limit=50',
falaiModelI2I:'category=image-to-image&status=active&limit=50',
falaiModelUpscale:'q=upscale&status=active&limit=50',
falaiModelRembg:'q=background+removal&status=active&limit=50'
};
var headers={
'Authorization':'Key '+apiKey
};
var entries=Object.entries(queries);
var results=await Promise.allSettled(entries.map(function(entry){
return fetch('https://api.fal.ai/v1/models?'+entry[1],{headers:headers}).then(function(r){
if(!r.ok)throw new Error(r.status+'');
return r.json();
});
}));
var categoryFilter={
falaiModelT2I:'text-to-image',
falaiModelI2I:'image-to-image',
falaiModelUpscale:'image-to-image',
falaiModelRembg:'image-to-image'
};
var cache={};
var hasAny=false;
for(var i=0;i<entries.length;i++){
var selectId=entries[i][0];
var result=results[i];
if(result.status==='fulfilled'&&result.value&&result.value.models){
cache[selectId]={models:result.value.models,filter:categoryFilter[selectId]};
this._populateSelect(selectId,result.value.models,categoryFilter[selectId]);
hasAny=true;
}else{
this._populateSelect(selectId,[]);
}
}
if(hasAny)this._modelCache=cache;
}
clearModelCache(){
this._modelCache=null;
}
_showFetchingState(){
var ids=['falaiModelT2I','falaiModelI2I','falaiModelUpscale','falaiModelRembg'];
var msg=i18next.t('falaiFetchingModels');
for(var i=0;i<ids.length;i++){
var el=$(ids[i]);
if(!el)continue;
el.disabled=true;
el.innerHTML='<option value="">'+msg+'</option>';
}
}
_applyCache(){
var keys=Object.keys(this._modelCache);
for(var i=0;i<keys.length;i++){
var selectId=keys[i];
var cached=this._modelCache[selectId];
this._populateSelect(selectId,cached.models,cached.filter);
}
}
_enableSelects(enabled){
var labels={falaiModelT2I:'T2I',falaiModelI2I:'I2I',falaiModelUpscale:'Upscale',falaiModelRembg:'RemoveBG'};
var ids=Object.keys(labels);
for(var i=0;i<ids.length;i++){
var el=$(ids[i]);
if(!el)continue;
el.disabled=!enabled;
if(!enabled){
el.innerHTML='<option value="">'+labels[ids[i]]+'</option>';
}
}
}
_populateSelect(selectId,models,filterCategory){
var el=$(selectId);
if(!el)return;
var prev=el.value;
if(!prev){
var stored=localStorage.getItem('localSettingsData');
if(stored){
var data=JSON.parse(stored);
if(data[selectId])prev=data[selectId];
}
}
el.innerHTML='<option value="">-- select --</option>';
for(var i=0;i<models.length;i++){
var m=models[i];
var cat=m.metadata&&m.metadata.category||'';
if(filterCategory&&cat!==filterCategory)continue;
var opt=document.createElement('option');
opt.value=m.endpoint_id||'';
opt.textContent=m.metadata&&m.metadata.display_name?m.metadata.display_name:m.endpoint_id;
el.appendChild(opt);
}
if(prev){
el.value=prev;
}
el.disabled=false;
el.dispatchEvent(new Event('change'));
}
_authHeaders(){
var apiKey=this.getApiKey();
if(!apiKey)return{};
return{
'Authorization':'Key '+apiKey,
'Content-Type':'application/json'
};
}
async heartbeat(){
var apiKey=this.getApiKey();
if(!apiKey){
this._verifiedApiKey=null;
this._updateLabel(false);
return false;
}
if(this._verifiedApiKey===apiKey){
this._updateLabel(true);
return true;
}
try{
var response=await fetch('https://api.fal.ai/v1/models?limit=1',{
headers:{'Authorization':'Key '+apiKey}
});
if(response.ok){
this._verifiedApiKey=apiKey;
this._updateLabel(true);
return true;
}
this._verifiedApiKey=null;
this._updateLabel(false);
return false;
}catch(e){
this._verifiedApiKey=null;
this._updateLabel(false);
return false;
}
}
_updateLabel(isOn){
var labelfw=$('ExternalService_Heartbeat_Label_fw');
var text=this.name+(isOn?' ON':' OFF');
var color=isOn?'green':'red';
if(labelfw){
labelfw.innerHTML=text;
labelfw.style.color=color;
}
}
async _runSync(modelId,inputData){
var apiKey=this.getApiKey();
if(!apiKey)throw new Error('Fal.ai API Key is not set');
var url='https://fal.run/'+modelId;
var response=await fetch(url,{
method:'POST',
headers:this._authHeaders(),
body:JSON.stringify(inputData)
});
if(!response.ok){
var errorText=await response.text();
var err=new Error('Fal.ai failed: '+response.status+' '+errorText);
try{
var errorJson=JSON.parse(errorText);
if(errorJson.detail)err.detail=errorJson.detail;
}catch(e){}
throw err;
}
return response.json();
}
async _outputToFabricImage(output){
if(output.images&&output.images.length>0){
var img=output.images[0];
if(img.url)return this._imageUrlToFabric(img.url);
}
if(output.image&&output.image.url){
return this._imageUrlToFabric(output.image.url);
}
throw new Error('Fal.ai returned no images');
}
// 生成本体。キュー投入と結果の配置はCloudImageProvider._execute()が行う
async _generate(modelId,inputData){
var output=await this._runSync(modelId,inputData);
return this._outputToFabricImage(output);
}
// 残高切れとコンテンツポリシーはdetailでしか分からないため文言を差し替える
translateError(error){
var detail=typeof error.detail==='string'?error.detail:JSON.stringify(error.detail||'');
if(detail.indexOf('Exhausted balance')!==-1)return i18next.t('falaiBalanceExhausted');
if(detail.indexOf('content_policy_violation')!==-1)return i18next.t('falaiContentPolicy');
return error.message||'';
}
async executeT2I(layer,spinnerId){
var modelId=this._requireModelId('t2i',spinnerId,'T2I');
if(!modelId)return;
return this._execute(layer,spinnerId,'T2I',modelId,()=>{
var rd=baseRequestData(layer);
if(basePrompt.text2img_model!=''){
rd['model']=basePrompt.text2img_model;
}
return{
prompt:rd.prompt,
negative_prompt:rd.negative_prompt,
image_size:{width:rd.width,height:rd.height},
num_inference_steps:rd.steps,
guidance_scale:rd.cfg_scale,
seed:rd.seed>0?rd.seed:undefined
};
});
}
supportsDetachedT2I(){
return true;
}
// 設定資料をこの場で作る経路。コマに置かず画像だけ受け取る
async executeDetachedT2I(request,spinnerId){
var modelId=this._requireModelId('t2i',spinnerId,'T2I');
if(!modelId)return null;
return this._executeDetached(spinnerId,'T2I',modelId,()=>{
var rd=baseRequestData(detachedRequestLayer(request));
return{
prompt:rd.prompt,
negative_prompt:rd.negative_prompt,
image_size:{width:rd.width,height:rd.height},
num_inference_steps:rd.steps,
guidance_scale:rd.cfg_scale,
seed:rd.seed>0?rd.seed:undefined
};
});
}
async executeI2I(layer,spinnerId){
var modelId=this._requireModelId('i2i',spinnerId,'I2I');
if(!modelId)return;
return this._execute(layer,spinnerId,'I2I',modelId,()=>{
var rd=baseRequestData(layer);
var base64Image=imageObject2Base64ImageEffectKeep(layer);
return{
prompt:rd.prompt,
negative_prompt:rd.negative_prompt,
image_url:base64Image,
strength:layer.img2img_denoise||0.75,
image_size:{width:rd.width,height:rd.height},
num_inference_steps:rd.steps,
guidance_scale:rd.cfg_scale,
seed:rd.seed>0?rd.seed:undefined
};
});
}
async executeUpscale(layer,spinnerId){
var modelId=this._requireModelId('upscale',spinnerId,'Upscale');
if(!modelId)return;
return this._execute(layer,spinnerId,'Upscaler',modelId,()=>{
var base64Image=imageObject2Base64ImageEffectKeep(layer);
return{
image_url:base64Image
};
});
}
async executeRembg(layer,spinnerId){
var modelId=this._requireModelId('rembg',spinnerId,'RemoveBG');
if(!modelId)return;
return this._execute(layer,spinnerId,'Rembg',modelId,()=>{
var base64Image=imageObject2Base64ImageEffectKeep(layer);
return{
image_url:base64Image
};
});
}
}
