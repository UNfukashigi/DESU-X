// クラウド画像生成プロバイダーの共通処理。キュー投入・生成タスク登録・結果のキャンバス配置を1か所に置く。
// サービスごとに違うのはリクエストの組み立て（buildInput）と送信（_generate）だけ
class CloudImageProvider extends AIProvider{
// このプロバイダーが使うTaskQueue
getQueue(){
return null;
}
// spinner.jsの_getQueueByNameが引くキュー名。取消時にキューを特定するため一致させる
getQueueName(){
return this.id;
}
// リクエストを送り生成結果をfabric.Imageで返す
async _generate(modelId,inputData){
throw new Error(this.id+' does not implement _generate');
}
// サービス固有の失敗理由が分かるときだけ上書きする
translateError(error){
return error.message||'';
}
// モデル未選択のまま実行させない。選ばれていなければ空文字を返し呼び出し側で中断する
_requireModelId(role,spinnerId,label){
var modelId=this._getModelId(role);
if(modelId)return modelId;
removeSpinner(spinnerId);
createToastError(this.name,label+' model not selected',5000);
return'';
}
async _dataUrlToFabricImage(dataUrl){
return new Promise((resolve,reject)=>{
fabric.Image.fromURL(dataUrl,(img)=>{
if(img)resolve(img);
else reject(new Error('Failed to create fabric.Image'));
});
});
}
async _imageUrlToFabric(imageUrl){
var response=await fetch(imageUrl);
if(!response.ok)throw new Error('Image fetch failed: '+response.status);
var blob=await response.blob();
var dataUrl=await new Promise((resolve,reject)=>{
var reader=new FileReader();
reader.onload=function(){resolve(reader.result);};
reader.onerror=()=>reject(new Error('FileReader error'));
reader.readAsDataURL(blob);
});
return this._dataUrlToFabricImage(dataUrl);
}
_registerTask(layer){
var canvasGuid=getCanvasGUID();
var layerType='unknown';
var targetLayerGuid=null;
if(isPanel(layer)){
layerType='panel';
targetLayerGuid=getGUID(layer);
}else if(layer.clipPath){
layerType='clipPath';
targetLayerGuid=layer.relatedPoly?getGUID(layer.relatedPoly):getGUID(layer);
}else{
layerType='standalone';
}
var center=calculateCenter(layer);
registerGenerationTask(canvasGuid,{
layerGuid:getGUID(layer),
layerType:layerType,
centerX:center.centerX,
centerY:center.centerY,
targetLayerGuid:targetLayerGuid
});
return canvasGuid;
}
_placeResult(result,layer,canvasGuid,Type){
if(isPageChanged(canvasGuid)){
return applyGeneratedImageToOriginalPage(canvasGuid,result).then(applied=>{
if(!applied){
removeGenerationTask(canvasGuid);
this._placeOnCanvas(result,layer,Type);
}
});
}
removeGenerationTask(canvasGuid);
this._placeOnCanvas(result,layer,Type);
}
_placeOnCanvas(result,layer,Type){
if(isPanel(layer)){
var c=calculateCenter(layer);
putImageInFrame(result,c.centerX,c.centerY,false,false,true,layer);
}else if(layer.clipPath){
var c=calculateCenter(layer);
var targetParent=layer.relatedPoly||layer;
layer.saveHistory=false;
canvas.remove(layer);
putImageInFrame(result,c.centerX,c.centerY,false,false,true,targetParent);
}else{
layer.saveHistory=false;
canvas.remove(layer);
replaceImageObject(layer,result,Type);
}
}
// キャンバスへ置かずに画像だけ返す。コマもレイヤーも無いので、
// 生成タスクの登録（ページ復帰用）と配置は通らない。取消の入口だけ_execute()と同じにする
async _executeDetached(spinnerId,Type,modelId,buildInput){
var startTime=Date.now();
var p=this.getQueue().add(async()=>{
setCurrentAiTask(spinnerId);
return this._generate(modelId,await buildInput());
});
updateAiTaskCancelInfo(spinnerId,{queueName:this.getQueueName(),queueItemId:p._queueItemId});
return p
.then((result)=>{
if(!result)return null;
DashboardUI.recordGeneration(Type,Date.now()-startTime,'',modelId);
return imageObject2Base64ImageEffectKeep(result);
})
.catch((error)=>{
if(error.message==='Queue cancelled'||error.message==='Task cancelled'){
this._logger.debug("Detached generation cancelled by user");
return null;
}
DashboardUI.recordFailure(Type);
createToastError(this.name,this.translateError(error),8000);
this._logger.error(Type+' detached error:',error.message||'');
return null;
})
.finally(()=>{
removeSpinner(spinnerId);
});
}
async _execute(layer,spinnerId,Type,modelId,buildInput){
var startTime=Date.now();
var canvasGuid=this._registerTask(layer);
var p=this.getQueue().add(async()=>{
setCurrentAiTask(spinnerId);
// buildInput()はawaitする。参照画像の縮小が非同期のため
return this._generate(modelId,await buildInput());
});
updateAiTaskCancelInfo(spinnerId,{queueName:this.getQueueName(),queueItemId:p._queueItemId});
return p
.then(async(result)=>{
if(result){
DashboardUI.recordGeneration(Type,Date.now()-startTime,'',modelId);
this._placeResult(result,layer,canvasGuid,Type);
}
})
.catch((error)=>{
removeGenerationTask(canvasGuid);
if(error.message==='Queue cancelled'||error.message==='Task cancelled'){
this._logger.debug("Generation cancelled by user");
return;
}
DashboardUI.recordFailure(Type);
createToastError(this.name,this.translateError(error),8000);
this._logger.error(Type+' error:',error.message||'');
})
.finally(()=>{
removeSpinner(spinnerId);
});
}
}
