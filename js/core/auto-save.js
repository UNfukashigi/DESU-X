// 自動保存機能：IndexedDBへの定期保存と起動時の復元
var AutoSaveManager=(function(){
var store=localforage.createInstance({name:'autoSaveStorage',storeName:'projectAutoSave'});
var timerId=null;
var isSaving=false;
var enabled=true;
var intervalSeconds=60;
var lastSavedHash=null;
var lastSavedGuid=null;
// 復元ダイアログに出すサムネイル。btmProjectsMapのimageLinkは
// 保存のたびに新しいURLになるため、URL文字列をキーにすれば
// 中身が変わったページだけ作り直せる（毎回全ページ描き直すと保存が重くなる）
var thumbCache=new Map();
var THUMB_MAX_PX=112;

function computeStateHash(){
if(typeof stateStack==='undefined'||typeof currentStateIndex==='undefined')return null;
if(currentStateIndex<0||currentStateIndex>=stateStack.length)return null;
var str=stateStack[currentStateIndex];
if(!str)return null;
var h=5381;
for(var i=0,len=str.length;i<len;i++){
h=((h<<5)+h)+str.charCodeAt(i);
h|=0;
}
return h+':'+str.length;
}

function loadSettings(){
var stored=localStorage.getItem('localSettingsData');
if(!stored)return;
var data=JSON.parse(stored);
if(data.autoSaveEnabled!==undefined)enabled=data.autoSaveEnabled;
if(data.autoSaveInterval!==undefined){
var val=parseInt(data.autoSaveInterval);
if(val>=10&&val<=600)intervalSeconds=val;
}
}

function start(){
stop();
if(!enabled)return;
timerId=setInterval(function(){
if(typeof requestIdleCallback==='function'){
requestIdleCallback(function(){save();});
}else{
save();
}
},intervalSeconds*1000);
autoSaveLogger.info("Timer started, interval="+intervalSeconds+"sec");
}

function stop(){
if(timerId){
clearInterval(timerId);
timerId=null;
autoSaveLogger.info("Timer stopped");
}
}

function restart(){
loadSettings();
start();
}

// data:はatobでそのままばらす。file://でも動くことがプロジェクト読み込み
// （project-compression.jsのmultiLoadLz4）で既に確認できている経路。
// blob:（ファイルから読み込んだページのプレビュー）は実体を取り出す手が
// fetchしかないため、失敗したときは呼び出し側でサムネイル無しとして扱う
function dataUrlToBlob(dataUrl){
var head=dataUrl.substring(0,dataUrl.indexOf(';base64,'));
var mime=head.substring(5);
var binary=atob(dataUrl.substring(dataUrl.indexOf(';base64,')+8));
var bytes=new Uint8Array(binary.length);
for(var i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
return new Blob([bytes],{type:mime});
}

async function hrefToBlob(href){
if(href.indexOf('data:')===0&&href.indexOf(';base64,')>0)return dataUrlToBlob(href);
var res=await fetch(href);
return await res.blob();
}

// ページのプレビュー画像を復元ダイアログ用の小さなJPEGへ縮める。
// プレビューはキャンバス原寸のJPEGなので、そのままIndexedDBへ入れると
// ページ数ぶんだけ数百KBが積み上がる。
// <img>を経由せずblobから作ったImageBitmapを描く。
// file://ではドキュメントのoriginが不定で、<img>経由だとキャンバスが
// 汚染されてtoDataURL()が落ちる可能性がある
async function makeThumbnail(href){
var blob=await hrefToBlob(href);
var bitmap=await createImageBitmap(blob);
try{
var scale=Math.min(1,THUMB_MAX_PX/Math.max(bitmap.width,bitmap.height));
var w=Math.max(1,Math.round(bitmap.width*scale));
var h=Math.max(1,Math.round(bitmap.height*scale));
var cv=document.createElement('canvas');
cv.width=w;
cv.height=h;
cv.getContext('2d').drawImage(bitmap,0,0,w,h);
return {thumb:cv.toDataURL('image/jpeg',0.7),width:bitmap.width,height:bitmap.height};
}finally{
bitmap.close();
}
}

// 復元前に「どのプロジェクトだったか」を見せるための情報。
// blobを開かずに分かるものだけを持つ（開くとlz4の展開が全ページぶん走る）。
// サムネイルが作れなかったページはthumb=nullのままにする。
// 別ページの絵を代わりに出すと、復元後の中身と食い違う
async function buildPageInfo(order){
var nextCache=new Map();
var list=[];
for(var i=0;i<order.length;i++){
var guid=order[i];
var data=btmProjectsMap.get(guid);
var href=(data&&data.imageLink)?data.imageLink.href:null;
var info=href?thumbCache.get(href):null;
if(href&&!info){
try{
info=await makeThumbnail(href);
}catch(e){
autoSaveLogger.warn("Thumbnail failed: page="+(i+1),e);
info=null;
}
}
if(href&&info)nextCache.set(href,info);
list.push({
guid:guid,
thumb:info?info.thumb:null,
width:info?info.width:0,
height:info?info.height:0,
bytes:(data&&data.blob)?data.blob.size:0
});
}
thumbCache=nextCache;
return list;
}

async function save(){
if(isSaving)return;
// ページ切り替え中に保存すると、読み込み途中のキャンバスを現在ページに上書きしてしまう
if(typeof isProjectBusy==='function'&&isProjectBusy()){
autoSaveLogger.debug("Skip auto-save: project is loading");
return;
}
// 空白ページ1枚だけの状態では保存しない。
// 履歴件数で判定すると、キャンバスのリサイズ等で履歴が積まれた空白ページが登録されてしまう。
// btmShouldSaveCurrentPage()は登録済みなら常にtrueを返し、ページは作られた時点で
// 登録されるようになった（btmRegisterCurrentPage）ため、この判定には使えない。
// 2ページ以上あるときは、今のキャンバスが空でも他ページに中身がありうるので保存する
if(btmGetGuidsSize()<=1&&getContentObjectCount()===0)return;
var guid=getCanvasGUID();
var hash=computeStateHash();
if(hash!==null&&hash===lastSavedHash&&guid===lastSavedGuid){
autoSaveLogger.debug("Skip auto-save: no changes");
return;
}
isSaving=true;
autoSaveLogger.info("Auto-save starting...");
try{
if(btmShouldSaveCurrentPage()){
await btmSaveProjectFile(null,false);
}
lastSavedHash=computeStateHash();
lastSavedGuid=guid;
var pages=[];
btmProjectsMap.forEach(function(data,guid){
pages.push({guid:guid,blob:data.blob});
});
await store.setItem('pages',pages);
var order=btmGetGuids();
await store.setItem('metadata',{
timestamp:Date.now(),
currentPageGuid:getCanvasGUID(),
pageOrder:order,
pageInfo:await buildPageInfo(order)
});
autoSaveLogger.info("Auto-save complete, pages="+pages.length);
lastSavedTime=Date.now();
updateLastSavedLabel();
}catch(e){
autoSaveLogger.error("Auto-save failed:",e);
// 失敗を黙って握りつぶすと、保存されている前提で作業が続いてしまう
createToastError(getText('autoSaveFailedTitle'),getText('autoSaveFailedBody'),8000);
}finally{
isSaving=false;
}
}

var lastSavedTime=null;

// 自動保存が効いているかを画面から読めるようにする。
// 設定パネルの自動保存欄に最終保存時刻を出すだけで、トーストは出さない
// （60秒ごとに通知が出ると作業の邪魔になるため）
function updateLastSavedLabel(){
var el=document.getElementById('autoSaveLastSavedLabel');
if(!el)return;
if(!lastSavedTime){
el.textContent='';
return;
}
el.textContent=i18next.t('autoSaveLastSaved',{time:new Date(lastSavedTime).toLocaleTimeString()});
}

async function clearAutoSave(){
try{
await store.removeItem('pages');
await store.removeItem('metadata');
autoSaveLogger.info("Auto-save data cleared");
}catch(e){
autoSaveLogger.error("Failed to clear auto-save data:",e);
}
}

function setEnabled(val){
enabled=!!val;
if(enabled)start();
else stop();
}

function setIntervalSeconds(val){
var v=parseInt(val);
if(v>=10&&v<=600)intervalSeconds=v;
if(enabled)start();
}

// 起動シーケンス（js/project-management.js の runBootSequence）から呼ばれる。
// 復元したときだけ true を返す
async function checkRecovery(){
try{
var metadata=await store.getItem('metadata');
if(!metadata)return false;
var pages=await store.getItem('pages');
if(!pages||pages.length===0){
await clearAutoSave();
return false;
}
return await showRecoveryDialog(metadata,pages);
}catch(e){
autoSaveLogger.error("Recovery check failed:",e);
return false;
}
}

function formatBytes(bytes){
if(bytes>=1048576)return (bytes/1048576).toFixed(1)+' MB';
if(bytes>=1024)return Math.round(bytes/1024)+' KB';
return bytes+' B';
}

// 日時だけだと「これは自分が失った作業か」を判断しにくいため経過時間を添える
function formatElapsed(ms){
var minutes=Math.floor(ms/60000);
if(minutes<1)return i18next.t('autoSaveRecoveryAgoNow');
if(minutes<60)return i18next.t('autoSaveRecoveryAgoMinutes',{n:minutes});
var hours=Math.floor(minutes/60);
if(hours<24)return i18next.t('autoSaveRecoveryAgoHours',{n:hours});
return i18next.t('autoSaveRecoveryAgoDays',{n:Math.floor(hours/24)});
}

function buildSummaryRow(labelKey,value){
var row=document.createElement('div');
row.className='recovery-summary-row';
var label=document.createElement('span');
label.className='recovery-summary-label';
label.textContent=getText(labelKey);
var val=document.createElement('span');
val.className='recovery-summary-value';
val.textContent=value;
row.appendChild(label);
row.appendChild(val);
return row;
}

function buildThumbItem(info,index,isCurrent){
var item=document.createElement('div');
item.className='recovery-thumb'+(isCurrent?' is-current':'');
var frame=document.createElement('div');
frame.className='recovery-thumb-frame';
if(info.thumb){
var img=document.createElement('img');
img.src=info.thumb;
img.alt='';
frame.appendChild(img);
}else{
// サムネイルを作れなかったページ。空欄にすると中身の無いページに見える
var none=document.createElement('span');
none.className='recovery-thumb-none';
none.textContent=getText('autoSaveRecoveryNoThumb');
frame.appendChild(none);
}
item.appendChild(frame);
var caption=document.createElement('div');
caption.className='recovery-thumb-caption';
var num=document.createElement('span');
num.className='recovery-thumb-number';
num.textContent=String(index+1);
caption.appendChild(num);
if(info.width&&info.height){
var size=document.createElement('span');
size.className='recovery-thumb-size';
size.textContent=info.width+'×'+info.height;
caption.appendChild(size);
}
item.appendChild(caption);
if(isCurrent){
var badge=document.createElement('span');
badge.className='recovery-thumb-badge';
badge.textContent=getText('autoSaveRecoveryOpenPage');
item.appendChild(badge);
}
return item;
}

// 復元する前に中身を見せる。日時・ページ数・容量だけでは
// どのプロジェクトだったかが分からず、消すか戻すかを決められない。
// 古い自動保存データにはpageInfoが無いので、そのときはサムネイルを出さない。
// 数字だけでも判断材料にはなる
function buildRecoverySummary(metadata,pages){
var box=document.createElement('div');
box.className='recovery-summary';

var totalBytes=0;
for(var i=0;i<pages.length;i++){
if(pages[i].blob)totalBytes+=pages[i].blob.size;
}
box.appendChild(buildSummaryRow('autoSaveRecoverySavedAtLabel',
new Date(metadata.timestamp).toLocaleString()+' ('+formatElapsed(Date.now()-metadata.timestamp)+')'));
box.appendChild(buildSummaryRow('autoSaveRecoveryPagesLabel',
i18next.t('autoSaveRecoveryPagesValue',{n:pages.length})));
box.appendChild(buildSummaryRow('autoSaveRecoverySizeLabel',formatBytes(totalBytes)));

var pageInfo=metadata.pageInfo;
if(pageInfo&&pageInfo.length){
var strip=document.createElement('div');
strip.className='recovery-thumbs';
for(var j=0;j<pageInfo.length;j++){
strip.appendChild(buildThumbItem(pageInfo[j],j,pageInfo[j].guid===metadata.currentPageGuid));
}
box.appendChild(strip);
}
return box;
}

// 復元の可否は共通の確認ダイアログで聞く。
// 「復元しない」で自動保存データをその場で消していたが、押し間違いを取り消せない。
// 消すのは「削除する」を選び、さらに確認を通したときだけにする
async function showRecoveryDialog(metadata,pages){
var msg=getText('autoSaveRecoveryMessage')+'\n'+getText('autoSaveRecoveryKeepNote');
var answer=await showConfirmDialog({
titleKey:'autoSaveRecoveryTitle',
message:msg,
content:buildRecoverySummary(metadata,pages),
wide:true,
cancelKey:'autoSaveRecoveryLater',
choices:[
{key:'delete',textKey:'autoSaveRecoveryDelete',secondary:true,danger:true},
{key:'recover',textKey:'autoSaveRecover'}
]
});
if(answer==='recover'){
await recoverPages(metadata,pages);
return true;
}
if(answer==='delete'){
var sure=await showConfirmDialog({
titleKey:'autoSaveRecoveryDeleteConfirmTitle',
messageKey:'autoSaveRecoveryDeleteConfirmBody',
okKey:'autoSaveRecoveryDelete',
danger:true
});
if(sure)await clearAutoSave();
}
return false;
}

async function recoverPages(metadata,pages){
autoSaveLogger.info("Recovering "+pages.length+" pages...");
try{
clearAllProjectPages();
var pageBlobs={};
for(var i=0;i<pages.length;i++){
pageBlobs[pages[i].guid]=pages[i].blob;
}
var bufferList=[];
for(var j=0;j<metadata.pageOrder.length;j++){
var g=metadata.pageOrder[j];
if(pageBlobs[g]){
var ab=await pageBlobs[g].arrayBuffer();
bufferList.push({name:g,data:new Uint8Array(ab)});
}
}
await multiLoadLz4(bufferList);
var targetGuid=metadata.currentPageGuid||metadata.pageOrder[0];
if(!btmProjectsMap.has(targetGuid))targetGuid=btmProjectsMap.keys().next().value;
await loadLz4BlobProjectFile(btmProjectsMap.get(targetGuid).blob,targetGuid);
autoSaveLogger.info("Recovery complete");
createToast(getText('autoSaveRecoveryTitle')||'Recovery','OK',2000);
}catch(e){
autoSaveLogger.error("Recovery failed:",e);
createToastError('Recovery Error',e.message||'Failed',3000);
}
}

// 復元の確認はここではなく起動シーケンス側で checkRecovery() を呼ぶ。
// 言語選択より先に復元ダイアログが出てしまうのを防ぐため、順番の決定を1か所に寄せている
async function init(){
loadSettings();
lastSavedHash=computeStateHash();
lastSavedGuid=(typeof getCanvasGUID==='function')?getCanvasGUID():null;
start();
var chk=$('autoSaveCheckbox');
if(chk){
chk.addEventListener('change',function(){
setEnabled(this.checked);
});
}
var intInput=$('autoSaveInterval');
if(intInput){
intInput.addEventListener('change',function(){
setIntervalSeconds(this.value);
});
}
}

return{
init:init,
start:start,
stop:stop,
restart:restart,
save:save,
clearAutoSave:clearAutoSave,
setEnabled:setEnabled,
setInterval:setIntervalSeconds,
checkRecovery:checkRecovery
};
})();
