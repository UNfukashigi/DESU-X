// 設定資料をこの場で作る。
//
// 素材を外で用意してから読み込む流れだと、資料を1枚足すためにアプリを離れることになる。
// コマの生成に使っているT2Iの割り当てをそのまま呼び、出来た絵を共通の資料へ足す。
//
// **ここだけ別のサービスを選べるようにしない。** 資料とコマで生成サービスが変わると絵柄がずれる。
// コマに置かない生成（executeDetachedT2I）に対応していないサービスのときは、
// 黙って別のサービスへ回さず、対応していないことをその場に出す
var ReferenceGenerator=(function(){
// 比率はコマと同じSDXLの学習解像度から選ぶ。自前で数値を持つと、
// コマ側のバケット（pickPanelSDXLBucket）を直したときにここだけ古い値が残る
const RATIOS=[
{id:'square',w:1,h:1,labelKey:'refGenRatioSquare'},
{id:'portrait',w:3,h:4,labelKey:'refGenRatioPortrait'},
{id:'tall',w:2,h:3,labelKey:'refGenRatioTall'},
{id:'landscape',w:4,h:3,labelKey:'refGenRatioLandscape'},
{id:'wide',w:3,h:2,labelKey:'refGenRatioWide'}
];
var formOpen=false;
var runningTaskId=null;
function title(){
return i18next.t('refWindowTitle');
}
function isRunning(){
return!!runningTaskId;
}
// 使えるかどうかと、使えない理由。ボタンを消すだけだと理由が分からず操作ミスに見える
function availability(){
var provider=typeof getDetachedT2IProvider==='function'?getDetachedT2IProvider():null;
if(!provider)return{ok:false,message:i18next.t('refGenNoProvider')};
if(!provider.supportsDetachedT2I())return{ok:false,message:i18next.t('refGenUnsupported',{provider:provider.name})};
return{ok:true,provider:provider};
}
function sizeForRatio(ratioId){
var ratio=RATIOS.filter(function(item){return item.id===ratioId;})[0]||RATIOS[0];
return pickPanelSDXLBucket(ratio.w,ratio.h);
}
function toggleForm(){
formOpen=!formOpen;
syncForm();
if(formOpen)$('rsGenPrompt').focus();
}
function fillRatioOptions(){
var select=$('rsGenRatio');
// 言語を切り替えても文言が付いてくるよう、毎回書き直す。値は保持する
var current=select.value;
select.textContent='';
RATIOS.forEach(function(ratio){
var option=document.createElement('option');
option.value=ratio.id;
option.textContent=i18next.t(ratio.labelKey);
select.appendChild(option);
});
if(current)select.value=current;
}
// 生成中の行は、レイヤーパネルの進行表示と同じ組み立てにする。
// data-ai-task-idを付けておくとrefreshAiTaskIndicator()がステップ数まで書き換える
function buildRunningRow(taskId){
var row=document.createElement('span');
row.className='ai-task-indicator ai-task-running';
row.setAttribute('data-ai-task-id',taskId);
var dot=document.createElement('span');
dot.className='ai-task-dot';
row.appendChild(dot);
var text=document.createElement('span');
text.className='ai-task-text';
text.textContent=i18next.t('refGenRunning');
row.appendChild(text);
var cancel=document.createElement('span');
cancel.className='ai-task-cancel';
cancel.textContent='✕';
cancel.title=getText('aiCancelTask');
cancel.onclick=function(){cancelAiTask(taskId);};
row.appendChild(cancel);
return row;
}
// 画面の状態を1か所で作り直す。呼び出し側それぞれで出し入れすると、
// 生成中なのにボタンが押せる、といったずれが残る
function syncForm(){
var form=$('rsGenForm');
if(!form)return;
var toggle=$('rsGenToggle');
form.style.display=formOpen?'block':'none';
toggle.classList.toggle('is-open',formOpen);
if(!formOpen)return;
fillRatioOptions();
$('rsGenPrompt').placeholder=i18next.t('refGenPromptPlaceholder');
$('rsGenName').placeholder=i18next.t('refNamePlaceholder');
$('rsGenTarget').textContent=i18next.t('refGenTarget',{category:currentCategoryLabel()});
var state=availability();
var notice=$('rsGenNotice');
notice.textContent=state.ok?'':state.message;
notice.style.display=state.ok?'none':'block';
var status=$('rsGenStatus');
status.textContent='';
if(runningTaskId)status.appendChild(buildRunningRow(runningTaskId));
$('rsGenRun').disabled=!state.ok||isRunning();
}
function currentCategoryLabel(){
var category=referenceSheetWindow.getActiveCategory();
var found=ReferenceSheetStore.CATEGORIES.filter(function(item){return item.id===category;})[0];
return found?i18next.t(found.labelKey):'';
}
// 出来た絵は共通の資料へ入れる。作品をまたいで使い回せる場所に置き、
// コマに付けた時点でプロジェクトへ複製される（画像ファイルを足したときと同じ）
async function run(){
if(isRunning())return;
var state=availability();
if(!state.ok){
createToastError(title(),state.message,5000);
return;
}
var prompt=$('rsGenPrompt').value.trim();
if(!prompt){
createToastError(title(),i18next.t('refGenNoPrompt'),4000);
return;
}
var size=sizeForRatio($('rsGenRatio').value);
var category=referenceSheetWindow.getActiveCategory();
var name=$('rsGenName').value.trim();
var spinner=createSpinner(null,'T2I');
runningTaskId=spinner.id;
syncForm();
var dataUrl=null;
try{
dataUrl=await T2IDetached({prompt:prompt,width:size.width,height:size.height},spinner);
}catch(e){
createToastError(title(),e.message||'',6000);
}finally{
runningTaskId=null;
}
// 失敗と取消はプロバイダー側が理由を出す。ここで重ねて出すと取消でもエラーが並ぶ
if(!dataUrl){
syncForm();
return;
}
try{
await ReferenceSheetStore.addToBase({name:name,category:category,dataUrl:dataUrl});
createToast(title(),i18next.t('refGenDone'),2500);
}catch(e){
createToastError(title(),e.message||'',6000);
}
// タグは残す。同じ指定で何枚か作って選ぶ使い方をするため
referenceSheetWindow.refresh();
}
return{
RATIOS:RATIOS,
isRunning:isRunning,
availability:availability,
toggleForm:toggleForm,
syncForm:syncForm,
run:run
};
})();
