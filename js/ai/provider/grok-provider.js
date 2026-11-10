// GrokプロバイダーxAI: OpenAI互換API（https://api.x.ai/v1）
// /v1/language-modelsの単価はUSDセント/1億トークンで返るためUSD/トークンへ換算する
const XAI_PRICE_UNIT_USD=1e-10;
class GrokProvider extends LLMProvider{
constructor(){
super('grok','Grok');
}
needsApiKey(){
return true;
}
getApiKey(){
var el=$('grokApiKey');
return el?el.value.trim():'';
}
getEndpointUrl(){
return'https://api.x.ai';
}
getBaseUrl(){
return'https://api.x.ai/v1';
}
getModelSelectIds(){
return{text:'grokModelText',vision:'grokModelVision'};
}
getNoticeElementId(){
return'grokConnNotice';
}
getHelpUrl(){
return'html/API_Help/llm_settings.html#grok';
}
_listHeaders(){
var apiKey=this.getApiKey();
if(!apiKey)return{};
return{'Authorization':'Bearer '+apiKey};
}
_requestHeaders(){
var apiKey=this.getApiKey();
if(!apiKey){
throw new Error(this.name+': '+i18next.t('llmErrorNoApiKey'));
}
return{
'Authorization':'Bearer '+apiKey,
'Content-Type':'application/json'
};
}
async fetchModels(options){
if(!this.getApiKey()){
this._populateSelects([]);
this.setConnectionNotice('noApiKey');
return;
}
this._priceMap=null;
this._pricingPromise=null;
return super.fetchModels(options);
}
getPricingUrl(){
return this.getBaseUrl()+'/language-models';
}
async _fetchPricing(){
var response=await fetch(this.getPricingUrl(),{headers:this._listHeaders()});
if(!response.ok){
throw new Error('HTTP '+response.status);
}
var data=await response.json();
var list=(data&&data.models)||[];
var map={};
list.forEach(function(model){
if(model.id)map[model.id]=model;
(model.aliases||[]).forEach(function(alias){map[alias]=model;});
});
this._priceMap=map;
llmLogger.info('grok pricing fetched: '+Object.keys(map).length);
}
async _getModelPricing(modelId){
if(!this._priceMap){
if(!this._pricingPromise){
var self=this;
this._pricingPromise=this._fetchPricing().catch(function(e){
self._pricingPromise=null;
llmLogger.warn('grok pricing fetch failed: '+(e instanceof Error?e.name+' '+e.message:e));
});
}
await this._pricingPromise;
}
if(!this._priceMap)return null;
return this._priceMap[modelId]||null;
}
async getTokenPrices(modelId,promptTokens){
var model=await this._getModelPricing(modelId);
if(!model)return null;
var useLong=!!(model.long_context_threshold&&promptTokens>model.long_context_threshold);
var prompt=useLong?model.prompt_text_token_price_long_context:model.prompt_text_token_price;
var cached=useLong?model.cached_prompt_text_token_price_long_context:model.cached_prompt_text_token_price;
var completion=useLong?model.completion_text_token_price_long_context:model.completion_text_token_price;
return{
prompt:this._toUsdPerToken(prompt),
cachedPrompt:this._toUsdPerToken(cached),
promptImage:this._toUsdPerToken(model.prompt_image_token_price),
completion:this._toUsdPerToken(completion)
};
}
_toUsdPerToken(price){
if(typeof price!=='number')return null;
return price*XAI_PRICE_UNIT_USD;
}
}
