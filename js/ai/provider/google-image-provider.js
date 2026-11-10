// Google Nano Bananaプロバイダー: Gemini APIのInteractions（POST /v1beta/interactions）で画像生成・画像編集
// 出力サイズは画素数ではなくアスペクト比＋解像度指定のため、コマの寸法から一番近い比率を選んで送る
const GOOGLE_IMAGE_API_BASE='https://generativelanguage.googleapis.com/v1beta';
// Nano Banana 4モデルに共通で用意されている比率（公式ドキュメント記載）
const GOOGLE_IMAGE_ASPECT_RATIOS=[
{value:'21:9',ratio:21/9},
{value:'16:9',ratio:16/9},
{value:'3:2',ratio:3/2},
{value:'4:3',ratio:4/3},
{value:'5:4',ratio:5/4},
{value:'1:1',ratio:1},
{value:'4:5',ratio:4/5},
{value:'3:4',ratio:3/4},
{value:'2:3',ratio:2/3},
{value:'9:16',ratio:9/16}
];
// 公式ドキュメントのリファレンス対応表。表に載っていないモデルはnullで持つ。
// 「非対応」と「記載なし」を混ぜないため、数値を作って埋めない
const GOOGLE_IMAGE_MODEL_REFERENCE={
'gemini-3.1-flash-lite-image':{object:14,character:0,style:0},
'gemini-3.1-flash-image':{object:10,character:4,style:0},
'gemini-3-pro-image':{object:6,character:5,style:3},
'gemini-2.5-flash-image':null
};
class GoogleImageProvider extends CloudImageProvider{
constructor(){
super('googleImage','Google Nano Banana');
}
getQueue(){
return googleImageQueue;
}
getQueueName(){
return'googleImage';
}
getSupportedRoles(){
return[
AI_ROLES.Text2Image,
AI_ROLES.Image2Image
];
}
needsApiKey(){
return true;
}
getApiKey(){
var el=$('googleImageApiKey');
return el?el.value.trim():'';
}
getEndpointUrl(){
return GOOGLE_IMAGE_API_BASE;
}
getModelsUrl(){
return GOOGLE_IMAGE_API_BASE+'/models?pageSize=1';
}
getNoticeElementId(){
return'googleImageConnNotice';
}
getHelpUrl(){
return'https://ai.google.dev/gemini-api/docs/image-generation';
}
_listHeaders(){
var apiKey=this.getApiKey();
if(!apiKey)return{};
return{'x-goog-api-key':apiKey};
}
_requestHeaders(){
var apiKey=this.getApiKey();
if(!apiKey){
throw new Error(this.name+': '+i18next.t('llmErrorNoApiKey'));
}
return{
'x-goog-api-key':apiKey,
'Content-Type':'application/json'
};
}
async heartbeat(){
return this.checkModelsEndpointHeartbeat();
}
_getModelId(role){
var map={
t2i:'googleImageModelT2I',
i2i:'googleImageModelI2I'
};
var el=$(map[role]);
return el?el.value:'';
}
getModelId(role){
return this._getModelId(role);
}
// コマの生成へ参照画像を混ぜられるのは今のところこのサービスだけ。
// 他のサービスは input に画像を1枚（Inpaintのみマスク込みで2枚）しか載せられない
supportsReferenceSheets(){
return true;
}
// 選択中モデルのリファレンス対応。表に無いモデルはnullを返す（呼び出し側で「記載なし」と出す）
getReferenceSupport(role){
var modelId=this._getModelId(role);
if(!modelId)return null;
if(!(modelId in GOOGLE_IMAGE_MODEL_REFERENCE))return null;
return GOOGLE_IMAGE_MODEL_REFERENCE[modelId];
}
_describeReferencesInPrompt(){
var el=$('referenceDescribeInPrompt');
return el?el.checked:true;
}
// 参照画像の説明はプロンプトの先頭に置く。送る順とImage Nの番号を必ず合わせる
_composePrompt(preamble,prompt){
if(!preamble||!this._describeReferencesInPrompt())return prompt;
return preamble+'\n\n'+prompt;
}
_getImageSize(){
var el=$('googleImageSize');
return el?el.value:'';
}
// 対数比で比べる。縦横どちらに寄っていても同じ尺度で近い比率を選ぶため
_pickAspectRatio(width,height){
if(!(width>0)||!(height>0))return'';
var target=width/height;
var best='';
var bestDiff=Infinity;
for(var i=0;i<GOOGLE_IMAGE_ASPECT_RATIOS.length;i++){
var diff=Math.abs(Math.log(GOOGLE_IMAGE_ASPECT_RATIOS[i].ratio/target));
if(diff<bestDiff){
bestDiff=diff;
best=GOOGLE_IMAGE_ASPECT_RATIOS[i].value;
}
}
return best;
}
_buildResponseFormat(width,height){
var format={type:'image'};
var aspectRatio=this._pickAspectRatio(width,height);
if(aspectRatio)format.aspect_ratio=aspectRatio;
var imageSize=this._getImageSize();
if(imageSize)format.image_size=imageSize;
return format;
}
_splitDataUrl(dataUrl){
var match=/^data:([^;,]+);base64,(.*)$/.exec(dataUrl||'');
if(!match)throw new Error(this.name+': '+i18next.t('googleImageSourceReadFailed'));
return{mimeType:match[1],base64:match[2]};
}
_apiErrorMessage(text){
try{
var json=JSON.parse(text);
if(json&&json.error&&json.error.message)return json.error.message;
}catch(e){}
return text.slice(0,300);
}
// 途中経過のthoughtステップにも画像が入るため、最終出力のmodel_outputだけを見る
_outputToFabricImage(data){
var steps=(data&&data.steps)||[];
var image=null;
for(var i=0;i<steps.length;i++){
if(steps[i].type!=='model_output')continue;
var content=steps[i].content||[];
for(var j=0;j<content.length;j++){
if(content[j].type==='image'&&content[j].data)image=content[j];
}
}
if(!image)throw new Error(this._noImageMessage(steps));
return this._dataUrlToFabricImage('data:'+(image.mime_type||'image/png')+';base64,'+image.data);
}
// 生成拒否のときはテキストで理由が返る。握り潰すと原因が分からなくなるため文面に載せる
_noImageMessage(steps){
var texts=[];
for(var i=0;i<steps.length;i++){
if(steps[i].type!=='model_output')continue;
var content=steps[i].content||[];
for(var j=0;j<content.length;j++){
if(content[j].type==='text'&&content[j].text)texts.push(content[j].text);
}
}
var reason=texts.join(' ').trim();
var message=i18next.t('googleImageNoImage');
return reason?message+': '+reason.slice(0,300):message;
}
async _generate(modelId,inputData){
var body=Object.assign({model:modelId},inputData);
var response=await fetch(GOOGLE_IMAGE_API_BASE+'/interactions',{
method:'POST',
headers:this._requestHeaders(),
body:JSON.stringify(body)
});
if(!response.ok){
var errorText=await response.text();
throw new Error('HTTP '+response.status+': '+this._apiErrorMessage(errorText));
}
return this._outputToFabricImage(await response.json());
}
async executeT2I(layer,spinnerId){
var modelId=this._requireModelId('t2i',spinnerId,'T2I');
if(!modelId)return;
return this._execute(layer,spinnerId,'T2I',modelId,async()=>{
var rd=baseRequestData(layer);
var refs=await ReferenceCollector.collectForLayer(layer,{});
return{
input:[{type:'text',text:this._composePrompt(refs.preamble,rd.prompt)}].concat(refs.blocks),
response_format:this._buildResponseFormat(rd.width,rd.height)
};
});
}
supportsDetachedT2I(){
return true;
}
// 設定資料をこの場で作る経路。作ろうとしている絵そのものが参照なので、参照画像は付けない
async executeDetachedT2I(request,spinnerId){
var modelId=this._requireModelId('t2i',spinnerId,'T2I');
if(!modelId)return null;
return this._executeDetached(spinnerId,'T2I',modelId,async()=>{
var rd=baseRequestData(detachedRequestLayer(request));
return{
input:[{type:'text',text:rd.prompt}],
response_format:this._buildResponseFormat(rd.width,rd.height)
};
});
}
async executeI2I(layer,spinnerId){
var modelId=this._requireModelId('i2i',spinnerId,'I2I');
if(!modelId)return;
return this._execute(layer,spinnerId,'I2I',modelId,async()=>{
var rd=baseRequestData(layer);
var refs=await ReferenceCollector.collectForLayer(layer,{
sourceDataUrl:imageObject2Base64ImageEffectKeep(layer)
});
return{
input:[{type:'text',text:this._composePrompt(refs.preamble,rd.prompt)}].concat(refs.blocks),
response_format:this._buildResponseFormat(rd.width,rd.height)
};
});
}
}
