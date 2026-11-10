function generateRandomInt(maxValue) {
if(maxValue==0){
return 0;
}

const intMaxValue=parseInt(maxValue,10);
if (isNaN(intMaxValue)) {
return 0;
}
var result=parseInt(Math.floor(Math.random()*(intMaxValue+1)),10);
if(result===0){
return 1;
}
return result;
}

function getRandomNumber(min,max) {
return Math.floor(Math.random()*(max-min+1))+min;
}

// 描画を1回挟むための待ち。非表示タブではrequestAnimationFrameが一度も発火しないため、
// 直接awaitすると一括処理がそこで止まる。隠れている間は描画自体が不要なので次のタスクへ回す
const FRAME_WAIT_SAFETY_MS=100;
function waitNextFrame() {
if(document.visibilityState==='hidden'){
return yieldToNextTask();
}
return new Promise(function(resolve){
var settled=false;
var rafId=0;
var timer=0;
function finish(){
if(settled)return;
settled=true;
cancelAnimationFrame(rafId);
clearTimeout(timer);
document.removeEventListener('visibilitychange',onVisibilityChange);
resolve();
}
function onVisibilityChange(){
if(document.visibilityState==='hidden')finish();
}
document.addEventListener('visibilitychange',onVisibilityChange);
rafId=requestAnimationFrame(finish);
timer=setTimeout(finish,FRAME_WAIT_SAFETY_MS);
});
}

// 非表示タブのsetTimeoutは1秒〜1分に間引かれるが、MessageChannelのメッセージは間引かれない
function yieldToNextTask() {
return new Promise(function(resolve){
var channel=new MessageChannel();
channel.port1.onmessage=function(){
channel.port1.close();
resolve();
};
channel.port2.postMessage(0);
});
}

