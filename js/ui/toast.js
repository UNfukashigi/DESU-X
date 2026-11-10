// createToast(NieR風): success/info, createToastError(DbD風): error/warning

// 右パネル下部（Width/Seed/Generate）を塞がないよう、同時に見せる数を絞る。
// 溢れたときは情報から先に閉じ、エラーは残す
const TOAST_MAX_VISIBLE=3;
const activeToasts=[];

function createToast(title,messages,time=4000) {
uiLogger.debug("createToast",time);

return showToast(title,messages,false,time);
}
function createToastError(title,messages,time=4000) {
uiLogger.debug("createToastError",time);

return showToast(title,messages,true,time);
}

function buildToastKey(title,messages,isError) {
const body=Array.isArray(messages)?messages.join('\n'):String(messages);
return `${isError?'e':'i'}|${title}|${body}`;
}

function dismissToast(toast) {
if(toast._toastTimer)clearInterval(toast._toastTimer);
unregisterToast(toast);
const inst=bootstrap.Toast.getInstance(toast);
if(inst)inst.hide();
else toast.remove();
}

function unregisterToast(toast) {
const index=activeToasts.indexOf(toast);
if(index>=0){
activeToasts.splice(index,1);
}
}

// 同じ内容が連打されたときは積まずに回数だけ増やし、表示時間を取り直す
function bumpToastRepeat(toast,time) {
toast._toastRepeat=(toast._toastRepeat||1)+1;
const badge=toast.querySelector('.toast-repeat');
if(badge){
badge.textContent=`×${toast._toastRepeat}`;
badge.hidden=false;
}
if(toast._toastTimer)clearInterval(toast._toastTimer);
startProgressBar(toast,toast._progressBarClass,time);
}

function enforceToastLimit() {
while(activeToasts.length>=TOAST_MAX_VISIBLE){
let target=activeToasts.find(t=>!t._toastIsError);
if(!target)target=activeToasts[0];
dismissToast(target);
}
}

function showToast(title,messages,isError,time) {
const container=$('sp-manga-toastContainer');
if (!container) {
uiLogger.error('Toast container not found');
return;
}

const toastKey=buildToastKey(title,messages,isError);
const duplicated=activeToasts.find(t=>t._toastKey===toastKey&&t.isConnected);
if(duplicated){
bumpToastRepeat(duplicated,time);
return duplicated;
}

enforceToastLimit();

const toastId=`sp-manga-toast-${Date.now()}`;
const toast=document.createElement('div');

var styleClass='toast-nier';
var progressBarClass='toast-progress-bar';

if(isError){
styleClass='toast-dbd';
progressBarClass='toast-progress-bar-error';
}

toast.className=`toast-achievement ${styleClass}`;
toast.innerHTML=`
        <button type="button" class="toast-close" aria-label="${getText('toastClose')}">✕</button>
        <div class="toast-title"></div>
        <div class="toast-message" id="sp-manga-toastMessageContainer"></div>
        <div class="progress" style="height: 5px; margin-top: 5px;">
            <div class="${progressBarClass}" role="progressbar" style="width: 100%;"></div>
        </div>
    `;
// タイトルは外部APIの応答が入ることがあるためHTMLとして解釈させない
const titleEl=toast.querySelector('.toast-title');
titleEl.textContent=title;
const repeatBadge=document.createElement('span');
repeatBadge.className='toast-repeat';
repeatBadge.hidden=true;
titleEl.appendChild(repeatBadge);
// エラーは支援技術にも割り込みで伝える
toast.setAttribute('role',isError?'alert':'status');
toast.setAttribute('aria-live',isError?'assertive':'polite');

toast.id=toastId;
toast.style.height='auto';
toast._toastKey=toastKey;
toast._toastIsError=isError;
toast._toastRepeat=1;
toast._progressBarClass=progressBarClass;

container.appendChild(toast);
activeToasts.push(toast);

const bsToast=new bootstrap.Toast(toast,{
autohide: false
});
bsToast.show();

const messageContainer=toast.querySelector('#sp-manga-toastMessageContainer');

if (typeof messages==='string') {
const messageLine=document.createElement('div');
messageLine.className='sp-manga-line';
// 外部サーバーの応答文がそのまま渡ることがあるためHTMLとして解釈させない
messageLine.textContent=messages;
messageContainer.appendChild(messageLine);
toast.style.height='auto';
startProgressBar(toast,progressBarClass,time);
} else if (Array.isArray(messages)) {
let messageIndex=0;
const messageInterval=50;

const showNextMessage=()=>{
if (messageIndex<messages.length) {
const messageLine=document.createElement('div');
messageLine.className='sp-manga-line';
messageLine.style.animationDelay='0s';
messageLine.textContent=messages[messageIndex];
messageContainer.appendChild(messageLine);
messageIndex++;
toast.style.height=`auto`;
setTimeout(showNextMessage,messageInterval);
} else {
startProgressBar(toast,progressBarClass,time);
}
};

showNextMessage();
} else {
const messageLine=document.createElement('div');
messageLine.className='sp-manga-line';
// 外部サーバーの応答文がそのまま渡ることがあるためHTMLとして解釈させない
messageLine.textContent=messages;
messageContainer.appendChild(messageLine);
toast.style.height='auto';
startProgressBar(toast,progressBarClass,time);
}

toast.querySelector('.toast-close').addEventListener('click',function(){
dismissToast(toast);
});

toast.addEventListener('hidden.bs.toast',function () {
unregisterToast(toast);
toast.style.animation='sp-manga-fade-out 1s forwards';
toast.remove();
});

return toast;
}

// 読んでいる最中に消えないよう、ポインタが乗っている間は減らさない。
// 入口をここ1か所にしているので全トーストに効く。
// 進捗を取り直しても二重に登録されないよう、待避先はトースト側に持たせる
function bindToastPause(toast) {
if(toast._toastPauseBound)return;
toast._toastPauseBound=true;
toast._toastPaused=false;
toast.addEventListener('mouseenter',function(){toast._toastPaused=true;});
toast.addEventListener('mouseleave',function(){toast._toastPaused=false;});
toast.addEventListener('focusin',function(){toast._toastPaused=true;});
toast.addEventListener('focusout',function(){toast._toastPaused=false;});
}

function startProgressBar(toast,progressBarClass,time=4000) {
const progressBar=toast.querySelector("."+progressBarClass);
const interval=10;
const totalDuration=time;
let width=100;
progressBar.style.width='100%';
bindToastPause(toast);
const timer=setInterval(()=>{
if(toast._toastPaused)return;
width-=(interval/totalDuration*100);
progressBar.style.width=`${width}%`;
if (width<=0) {
clearInterval(timer);
unregisterToast(toast);
const bsToast=bootstrap.Toast.getInstance(toast);
if(bsToast)bsToast.hide();
else toast.remove();
}
},interval);
toast._toastTimer=timer;
}

function checkActiveImage() {
let activeObject=canvas.getActiveObject();
if (activeObject) {
if(isImage(activeObject)){
return true;
}
}
let text=getText("nothingImage");
createToastError(text,"",2000);
return false;
}
function checkPanelImage() {
let activeObject=canvas.getActiveObject();
if (activeObject) {
if(isImage(activeObject)){
return true;
}
}
let text=getText("nothingPanel");
createToastError(text,"",2000);
return false;
}
