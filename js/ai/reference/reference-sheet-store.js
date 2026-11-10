// 設定資料の2層構造。
//
//   プロジェクト（正）: そのプロジェクトが実際に使うシート。メモリに持ち、
//                      保存時にページのblobへ同梱される。コマの割り当てが指す先はこれ
//   ベース（素材置き場）: 作品をまたいで使い回す元ネタ。IndexedDB（referenceRepository）
//
// ベースのシートをコマに付けるとプロジェクトへ**複製**される。idで参照し続けると、
// ベースを直したときに過去の巻の絵まで変わってしまうため
var ReferenceSheetStore=(function(){
// 長辺の上限。Gemini側は768x768のタイル単位でトークンを数えるため、
// これ以上大きくしても参照としての情報は増えずトークンだけ増える
const REFERENCE_MAX_EDGE=1024;
const REFERENCE_IMAGE_TYPE='image/webp';
const REFERENCE_IMAGE_QUALITY=0.9;
const REFERENCE_CATEGORIES=[
{id:'character',labelKey:'refCatCharacter'},
{id:'background',labelKey:'refCatBackground'},
{id:'prop',labelKey:'refCatProp'},
{id:'other',labelKey:'refCatOther'}
];
const REFERENCE_EXPORT_FORMAT='manga-editor-desu.reference-sheets';
const REFERENCE_EXPORT_VERSION=1;
// プロジェクト側。ページを読み込むたびに差し替える
var projectSheets=new Map();
// ベース側。IndexedDBの内容をそのまま持つ
var baseSheets=[];
var baseLoaded=false;
function isValidCategory(category){
return REFERENCE_CATEGORIES.some(function(c){return c.id===category;});
}
function newId(){
return'ref-'+generateGUID();
}
// dataURLのbase64部分の実バイト数。ペイロードの見積もりに使う
function dataUrlByteSize(dataUrl){
var comma=(dataUrl||'').indexOf(',');
if(comma===-1)return 0;
var base64=dataUrl.slice(comma+1);
var padding=0;
if(base64.endsWith('=='))padding=2;
else if(base64.endsWith('='))padding=1;
return Math.floor(base64.length*3/4)-padding;
}
// 参照用に縮小する。元が小さければ拡大はしない
async function normalizeImage(dataUrl){
var img=await new Promise(function(resolve,reject){
var el=new Image();
el.onload=function(){resolve(el);};
el.onerror=function(){reject(new Error('reference image load failed'));};
el.src=dataUrl;
});
var width=img.naturalWidth||img.width;
var height=img.naturalHeight||img.height;
if(!width||!height)throw new Error('reference image has no size');
var scale=Math.min(1,REFERENCE_MAX_EDGE/Math.max(width,height));
var outWidth=Math.max(1,Math.round(width*scale));
var outHeight=Math.max(1,Math.round(height*scale));
var offscreen=HtmlCanvasUtil.createOffscreenCanvas(outWidth,outHeight);
var ctx=offscreen.getContext('2d');
ctx.imageSmoothingEnabled=true;
ctx.imageSmoothingQuality='high';
ctx.drawImage(img,0,0,outWidth,outHeight);
var out=offscreen.toDataURL(REFERENCE_IMAGE_TYPE,REFERENCE_IMAGE_QUALITY);
// webp非対応の環境ではtoDataURLがpngを返す。何を送っているか分からなくなるので型は実物から取る
var mimeType=out.slice(5,out.indexOf(';'));
return{dataUrl:out,mimeType:mimeType,width:outWidth,height:outHeight,byteSize:dataUrlByteSize(out)};
}
function buildEntry(params,normalized){
return{
id:params.id||newId(),
name:params.name||'',
category:isValidCategory(params.category)?params.category:'other',
note:params.note||'',
dataUrl:normalized.dataUrl,
mimeType:normalized.mimeType,
width:normalized.width,
height:normalized.height,
byteSize:normalized.byteSize,
createdAt:params.createdAt||Date.now()
};
}
// ---- プロジェクト側 ----
function getProjectAll(){
return Array.from(projectSheets.values()).sort(function(a,b){
return(a.createdAt||0)-(b.createdAt||0);
});
}
function getProjectById(id){
return projectSheets.get(id)||null;
}
async function addToProject(params){
var entry=buildEntry(params,await normalizeImage(params.dataUrl));
projectSheets.set(entry.id,entry);
return entry;
}
// ベースからプロジェクトへ複製する。画像は縮小済みなので通し直さない
function copyBaseToProject(baseEntry){
var existing=getProjectAll().filter(function(entry){return entry.copiedFromBaseId===baseEntry.id;})[0];
if(existing)return existing;
var entry=Object.assign({},baseEntry,{id:newId(),copiedFromBaseId:baseEntry.id,createdAt:Date.now()});
projectSheets.set(entry.id,entry);
return entry;
}
function updateProject(id,patch){
var entry=projectSheets.get(id);
if(!entry)return null;
if(patch.name!==undefined)entry.name=patch.name;
if(patch.note!==undefined)entry.note=patch.note;
if(patch.category!==undefined&&isValidCategory(patch.category))entry.category=patch.category;
return entry;
}
function removeFromProject(id){
projectSheets.delete(id);
}
// ページ読み込み時に差し替える。プロジェクトファイルの内容が正
function setProjectData(list){
projectSheets=new Map();
(list||[]).forEach(function(entry){
if(entry&&entry.id)projectSheets.set(entry.id,entry);
});
}
// 保存時: そのページのコマが参照しているシートだけを返す。
// 全シートを毎ページ入れるとプロジェクトファイルが膨らむため（フォントと同じ考え方）
function buildProjectData(usedIds){
var list=[];
(usedIds||[]).forEach(function(id){
var entry=projectSheets.get(id);
if(entry&&list.indexOf(entry)===-1)list.push(entry);
});
return list;
}
// ---- ベース側 ----
async function loadBase(){
baseSheets=await referenceRepository.getAll();
baseLoaded=true;
return baseSheets;
}
async function getBaseAll(){
if(baseLoaded)return baseSheets;
return loadBase();
}
function getBaseCached(){
return baseSheets;
}
function isBaseLoaded(){
return baseLoaded;
}
async function addToBase(params){
var entry=buildEntry(params,await normalizeImage(params.dataUrl));
await referenceRepository.save(entry);
await loadBase();
return entry;
}
// プロジェクトのシートをベースへ登録する。画像は縮小済みなので通し直さない
async function registerProjectToBase(projectId){
var source=projectSheets.get(projectId);
if(!source)return null;
var entry=Object.assign({},source,{id:newId(),createdAt:Date.now()});
delete entry.copiedFromBaseId;
await referenceRepository.save(entry);
await loadBase();
// 以降ベース側と二重に出さないよう、複製元を覚えておく
source.copiedFromBaseId=entry.id;
return entry;
}
async function updateBase(id,patch){
var entry=baseSheets.filter(function(e){return e.id===id;})[0];
if(!entry)return null;
if(patch.name!==undefined)entry.name=patch.name;
if(patch.note!==undefined)entry.note=patch.note;
if(patch.category!==undefined&&isValidCategory(patch.category))entry.category=patch.category;
await referenceRepository.save(entry);
await loadBase();
return entry;
}
async function removeFromBase(id){
await referenceRepository.remove(id);
await loadBase();
}
// ---- ベースの書き出し・読み込み ----
// ブラウザのデータを消しても戻せるように、また他の人へ渡せるようにする
function exportBase(){
return JSON.stringify({
format:REFERENCE_EXPORT_FORMAT,
version:REFERENCE_EXPORT_VERSION,
sheets:getBaseCached()
});
}
// 読み込んだシートは既存を消さずに足す。idは振り直す（同じファイルを2回読んでも壊れないように）
async function importBase(text){
var data=JSON.parse(text);
if(!data||data.format!==REFERENCE_EXPORT_FORMAT||!Array.isArray(data.sheets)){
throw new Error(i18next.t('refErrorImportFormat'));
}
var added=0;
for(var i=0;i<data.sheets.length;i++){
var sheet=data.sheets[i];
if(!sheet||!sheet.dataUrl)continue;
var entry=Object.assign({},sheet,{id:newId(),createdAt:Date.now()});
delete entry.copiedFromBaseId;
await referenceRepository.save(entry);
added++;
}
await loadBase();
return added;
}
return{
CATEGORIES:REFERENCE_CATEGORIES,
MAX_EDGE:REFERENCE_MAX_EDGE,
normalizeImage:normalizeImage,
dataUrlByteSize:dataUrlByteSize,
getProjectAll:getProjectAll,
getProjectById:getProjectById,
addToProject:addToProject,
copyBaseToProject:copyBaseToProject,
updateProject:updateProject,
removeFromProject:removeFromProject,
setProjectData:setProjectData,
buildProjectData:buildProjectData,
loadBase:loadBase,
getBaseAll:getBaseAll,
getBaseCached:getBaseCached,
isBaseLoaded:isBaseLoaded,
addToBase:addToBase,
registerProjectToBase:registerProjectToBase,
updateBase:updateBase,
removeFromBase:removeFromBase,
exportBase:exportBase,
importBase:importBase
};
})();
