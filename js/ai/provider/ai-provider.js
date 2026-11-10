// AIプロバイダー基底クラス
class AIProvider{
constructor(id,name){
this.id=id;
this.name=name;
this._logger=new SimpleLogger('provider:'+id,LogLevel.DEBUG);
}
getSupportedRoles(){
return[];
}
supportsRole(role){
return this.getSupportedRoles().includes(role);
}
needsApiKey(){
return false;
}
getApiKey(){
return null;
}
getEndpointUrl(){
return'';
}
// 疎通確認に使うGETのURL。接続状態の通知を共通処理へ任せるプロバイダーだけが返す
getModelsUrl(){
return'';
}
getNoticeElementId(){
return'';
}
getHelpUrl(){
return'';
}
_listHeaders(){
return{};
}
async heartbeat(){
return false;
}
// モデル一覧のGETで疎通を見る。切れている理由を通知欄とチップのtitleで同じ文言にする
async checkModelsEndpointHeartbeat(){
if(this.needsApiKey()&&!this.getApiKey()){
this.setConnectionNotice('noApiKey');
return false;
}
var response;
try{
response=await fetch(this.getModelsUrl(),{headers:this._listHeaders()});
}catch(e){
this.setConnectionNotice(await this.classifyFailure());
return false;
}
if(!response.ok){
this.setConnectionNotice('http',response.status);
return false;
}
this.setConnectionNotice(null);
return true;
}
async _probeReachable(){
try{
await fetch(this.getModelsUrl(),{mode:'no-cors',cache:'no-store'});
return true;
}catch(e){
return false;
}
}
async classifyFailure(){
var reachable=await this._probeReachable();
return reachable?'cors':'unreachable';
}
_noticeMessageKeys(){
return{
cors:'llmNoticeCors',
unreachable:'llmNoticeUnreachable',
noApiKey:'llmNoticeNoApiKey',
http:'llmNoticeHttp'
};
}
getStatusReason(){
if(!this._lastNoticeKind)return'';
return i18next.t(this._noticeMessageKeys()[this._lastNoticeKind]);
}
setConnectionNotice(kind,statusCode){
this._lastNoticeKind=kind||null;
var el=$(this.getNoticeElementId());
if(!el)return;
if(!kind){
el.style.display='none';
el.textContent='';
return;
}
el.textContent='';
var text=document.createElement('span');
text.textContent=i18next.t(this._noticeMessageKeys()[kind])+(kind==='http'?' ('+statusCode+')':'');
el.appendChild(text);
var helpUrl=this.getHelpUrl();
if(helpUrl){
var link=document.createElement('a');
link.href=helpUrl;
link.target='_blank';
link.className='us-link-btn';
link.textContent=i18next.t('llmNoticeOpenHelp');
el.appendChild(link);
}
el.style.display='block';
}
async executeT2I(layer,spinnerId){
throw new Error(this.id+' does not support T2I');
}
// キャンバスへ置かずに画像だけ作る経路。設定資料をこの場で作るために使う。
// 対応していないプロバイダーは false のままにする。UI側はボタンを出さずに理由を表示する
supportsDetachedT2I(){
return false;
}
// request: {prompt,width,height} / 戻り値: dataURL。取消・失敗時はnull
async executeDetachedT2I(request,spinnerId){
throw new Error(this.id+' does not support detached T2I');
}
// 設定資料（参照画像）をコマの生成へ一緒に送れるか。**既定は送れない。**
// 送れないサービスでも枚数だけ出すと「送られている」と読めるため、
// 対応の有無はここ1か所で持ち、UI側はこれを見て送られないことを先に出す
supportsReferenceSheets(){
return false;
}
// 選択中モデルの参照対応。表に無いモデルはnullを返す（呼び出し側で「記載なし」と出す）。
// 戻り値は {character:0|1, style:0|1} を想定する
getReferenceSupport(role){
return null;
}
async executeI2I(layer,spinnerId){
throw new Error(this.id+' does not support I2I');
}
async executeRembg(layer,spinnerId){
throw new Error(this.id+' does not support Rembg');
}
async executeUpscale(layer,spinnerId){
throw new Error(this.id+' does not support Upscale');
}
async executeInpaint(layer,spinnerId){
throw new Error(this.id+' does not support Inpaint');
}
async executeAngle(layer,spinnerId,anglePrompt){
throw new Error(this.id+' does not support Angle');
}
async fetchModels(){
}
async fetchSamplers(){
}
async fetchUpscalers(){
}
async fetchDiffusionInformation(){
}
canUseInpaint(){
return this.supportsRole(AI_ROLES.Inpaint);
}
canUseAngle(){
return this.supportsRole(AI_ROLES.I2I_Angle);
}
}
