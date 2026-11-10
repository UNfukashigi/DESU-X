// LLMプロバイダー基底クラス: OpenAI互換のchat/completionsを共通実装（Grok / Ollama）
const LLM_REQUEST_TIMEOUT_MS=180000;

class LLMProvider extends AIProvider{
constructor(id,name){
super(id,name);
}
getSupportedRoles(){
return[
AI_ROLES.Text2Prompt,
AI_ROLES.Image2Prompt_LLM
];
}
getBaseUrl(){
return'';
}
getChatUrl(){
return this.getBaseUrl()+'/chat/completions';
}
getModelsUrl(){
return this.getBaseUrl()+'/models';
}
getModelSelectIds(){
return{text:'',vision:''};
}
getHelpUrl(){
return'html/API_Help/llm_settings.html';
}
// 接続情報（APIキー or エンドポイント）が入力済みか
isConfigured(){
if(this.needsApiKey())return!!this.getApiKey();
return!!this.getEndpointUrl();
}
getModelId(kind){
var ids=this.getModelSelectIds();
var el=$(ids[kind||'text']);
return el?el.value:'';
}
_requestHeaders(){
return{'Content-Type':'application/json'};
}
async chat(messages,options){
var opts=options||{};
var kind=opts.vision?'vision':'text';
var modelId=this.getModelId(kind);
if(!modelId){
throw new Error(this.name+': '+i18next.t('llmErrorNoModel'));
}
var body={
model:modelId,
messages:messages,
stream:false
};
if(opts.temperature!==undefined)body.temperature=opts.temperature;
if(opts.maxTokens!==undefined)body.max_tokens=opts.maxTokens;
if(opts.jsonObject)body.response_format={type:'json_object'};
var headers=this._requestHeaders();
var controller=new AbortController();
var timer=setTimeout(function(){controller.abort();},LLM_REQUEST_TIMEOUT_MS);
var response;
var failure=null;
try{
response=await fetch(this.getChatUrl(),{
method:'POST',
headers:headers,
body:JSON.stringify(body),
signal:controller.signal
});
}catch(e){
failure=e;
}finally{
clearTimeout(timer);
}
if(failure){
if(failure.name==='AbortError'){
throw new Error(this.name+': '+i18next.t('llmErrorTimeout'));
}
var kind=await this.classifyFailure();
this.setConnectionNotice(kind);
throw new Error(this.name+': '+i18next.t(kind==='cors'?'llmErrorCors':'llmErrorUnreachable'));
}
this.setConnectionNotice(null);
if(!response.ok){
var detail=await response.text();
llmLogger.error(this.id+' chat failed: '+response.status+' '+detail);
throw new Error(this.name+' HTTP '+response.status+': '+detail.slice(0,300));
}
var data=await response.json();
this._recordUsage(modelId,data&&data.usage);
var choice=data&&data.choices&&data.choices[0];
var content=choice&&choice.message?choice.message.content:'';
if(typeof content!=='string'||!content.trim()){
throw new Error(this.name+': '+i18next.t('llmErrorEmptyResponse'));
}
return content.trim();
}
// 1トークンあたりのUSD単価。取得できない項目はnullを返す（推定単価で埋めない）
async getTokenPrices(modelId,promptTokens){
return null;
}
// chat()の1か所からだけ呼ぶ。呼び出し側を巻き込まないようawaitせず、例外は内部で握って握り潰さずログに出す
async _recordUsage(modelId,usage){
try{
if(!this.needsApiKey())return;
if(!usage)return;
var promptTokens=usage.prompt_tokens||0;
var completionTokens=usage.completion_tokens||0;
if(!promptTokens&&!completionTokens)return;
var details=usage.prompt_tokens_details||{};
var cachedTokens=details.cached_tokens||0;
var imageTokens=details.image_tokens||0;
var textTokens=Math.max(0,promptTokens-cachedTokens-imageTokens);
var prices=await this.getTokenPrices(modelId,promptTokens);
await ApiCostStorage.recordUsage({
providerId:this.id,
providerName:this.name,
modelId:modelId,
promptTokens:promptTokens,
cachedTokens:cachedTokens,
imageTokens:imageTokens,
completionTokens:completionTokens,
costUsd:this._calcCostUsd(prices,{
text:textTokens,
cached:cachedTokens,
image:imageTokens,
completion:completionTokens
})
});
}catch(e){
llmLogger.error(this.id+' usage record failed: '+(e instanceof Error?e.name+' '+e.message:e));
}
}
// トークンが発生している項目の単価が1つでも欠けていたらnull（＝単価不明）を返す
_calcCostUsd(prices,tokens){
if(!prices)return null;
var pairs=[
[tokens.text,prices.prompt],
[tokens.cached,prices.cachedPrompt],
[tokens.image,prices.promptImage],
[tokens.completion,prices.completion]
];
var total=0;
for(var i=0;i<pairs.length;i++){
var count=pairs[i][0];
var price=pairs[i][1];
if(!count)continue;
if(price===null||price===undefined)return null;
total+=count*price;
}
return total;
}
buildTextMessages(systemPrompt,userPrompt){
var messages=[];
if(systemPrompt)messages.push({role:'system',content:systemPrompt});
messages.push({role:'user',content:userPrompt});
return messages;
}
buildVisionMessages(systemPrompt,userPrompt,imageDataUrl){
var messages=[];
if(systemPrompt)messages.push({role:'system',content:systemPrompt});
messages.push({
role:'user',
content:[
{type:'text',text:userPrompt},
{type:'image_url',image_url:{url:imageDataUrl}}
]
});
return messages;
}
// options.silent: 自動取得。失敗しても画面内の警告だけにしてトーストは出さない
async fetchModels(options){
var silent=!!(options&&options.silent);
this._showFetchingState();
var response;
try{
response=await fetch(this.getModelsUrl(),{headers:this._listHeaders()});
}catch(e){
llmLogger.error(this.id+' fetchModels network error: '+e.message);
this._populateSelects([]);
var kind=await this.classifyFailure();
this.setConnectionNotice(kind);
if(!silent)createToastError(this.name,i18next.t(kind==='cors'?'llmErrorCors':'llmErrorUnreachable'),1000*10);
return;
}
if(!response.ok){
var detail=await response.text();
llmLogger.error(this.id+' fetchModels failed: '+response.status+' '+detail);
this._populateSelects([]);
this.setConnectionNotice('http',response.status);
if(!silent)createToastError(this.name,'HTTP '+response.status+': '+detail.slice(0,200),1000*10);
return;
}
this.setConnectionNotice(null);
var data=await response.json();
var list=data&&data.data?data.data:[];
var modelIds=list.map(function(m){return m.id;}).filter(Boolean).sort();
this._populateSelects(modelIds);
llmLogger.info(this.id+' models fetched: '+modelIds.length);
}
// 取得中表示でoptionを差し替えると選択値が消えるため、再取得後に戻せるよう退避する
_showFetchingState(){
var ids=this.getModelSelectIds();
var msg=i18next.t('llmFetchingModels');
var self=this;
this._pendingValues={};
Object.keys(ids).forEach(function(kind){
var el=$(ids[kind]);
if(!el)return;
self._pendingValues[ids[kind]]=el.value;
el.disabled=true;
el.innerHTML='<option value="">'+msg+'</option>';
});
}
_populateSelects(modelIds){
var ids=this.getModelSelectIds();
var self=this;
Object.keys(ids).forEach(function(kind){
self._populateSelect(ids[kind],modelIds);
});
this._pendingValues=null;
this._modelsLoaded=modelIds.length>0;
}
_populateSelect(selectId,modelIds){
var el=$(selectId);
if(!el)return;
var prev=el.value||(this._pendingValues?this._pendingValues[selectId]:'');
if(!prev){
var stored=localStorage.getItem('localSettingsData');
if(stored){
var data=JSON.parse(stored);
if(data[selectId])prev=data[selectId];
}
}
el.innerHTML='';
var placeholder=document.createElement('option');
placeholder.value='';
placeholder.textContent=i18next.t('llmSelectModel');
el.appendChild(placeholder);
for(var i=0;i<modelIds.length;i++){
var opt=document.createElement('option');
opt.value=modelIds[i];
opt.textContent=modelIds[i];
el.appendChild(opt);
}
// 取得に失敗した場合も選択値を保持する。空にすると設定の自動保存で保存値まで消えるため
if(prev)applySettingValue(el,prev);
el.disabled=modelIds.length===0;
}
async heartbeat(){
return this.checkModelsEndpointHeartbeat();
}
// 保持している選択値のoptionが残るため、option数では判定せず取得成否で判定する
hasLoadedModels(){
return!!this._modelsLoaded;
}
}
