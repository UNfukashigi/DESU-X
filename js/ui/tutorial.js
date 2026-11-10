var TutorialManager={
STORAGE_KEY:'manga_tutorial_state',
LANG_STORAGE_KEY:'tutorial_lang_selected',
state:null,
activeHint:null,
languages:[
{code:'ja',name:'日本語',flag:'jp'},
{code:'en',name:'English',flag:'us'},
{code:'ko',name:'한국어',flag:'kr'},
{code:'zh',name:'中文',flag:'cn'},
{code:'fr',name:'Français',flag:'fr'},
{code:'de',name:'Deutsch',flag:'de'},
{code:'es',name:'Español',flag:'es'},
{code:'ru',name:'Русский',flag:'ru'}
],
// 起動時のモーダルはここでは出さない。
// 出す順番は起動シーケンス（js/project-management.js の runBootSequence）が決める
init:function(){
this.loadState();
this.setupEventListeners();
},
// 起動シーケンスの1段目。言語が未選択なら選ばせ、選び終わるまで待たせる。
// 復元ダイアログより先にここを通すことで、以降の案内が選んだ言語で出る
startupLanguageStep:function(){
var self=this;
return new Promise(function(resolve){
if(localStorage.getItem(self.LANG_STORAGE_KEY)){
resolve();
return;
}
self.showLanguageSelection(resolve);
});
},
// 起動シーケンスの最終段。初回だけクイックスタートの案内を出す
startupTutorialStep:function(){
var self=this;
return new Promise(function(resolve){
if(self.state.quickStartCompleted){
resolve();
return;
}
self.showQuickStartPrompt(resolve);
});
},
loadState:function(){
try{
var saved=localStorage.getItem(this.STORAGE_KEY);
this.state=saved?JSON.parse(saved):{
quickStartCompleted:false,
hintsShown:{},
comfyUIGuideShown:false
};
}catch(e){
this.state={quickStartCompleted:false,hintsShown:{},comfyUIGuideShown:false};
}
},
saveState:function(){
try{
localStorage.setItem(this.STORAGE_KEY,JSON.stringify(this.state));
}catch(e){
tutorialLogger.error('Failed to save tutorial state');
}
},
resetState:function(){
this.state={quickStartCompleted:false,hintsShown:{},comfyUIGuideShown:false};
localStorage.removeItem(this.LANG_STORAGE_KEY);
this.saveState();
},
showLanguageSelection:function(onDone){
var self=this;
var overlay=document.createElement('div');
overlay.className='tutorial-overlay';
var langButtons='';
for(var i=0;i<this.languages.length;i++){
var lang=this.languages[i];
langButtons+='<button class="tutorial-lang-btn" data-lang="'+lang.code+'"><span class="flag-icon flag-icon-'+lang.flag+'"></span>'+lang.name+'</button>';
}
overlay.innerHTML='<div class="tutorial-prompt">'+
'<div class="tutorial-prompt-title">Select Language / 言語選択</div>'+
'<div class="tutorial-prompt-body">Choose your preferred language</div>'+
'<div class="tutorial-lang-grid">'+langButtons+'</div>'+
'</div>';
document.body.appendChild(overlay);
overlay.querySelectorAll('.tutorial-lang-btn').forEach(function(btn){
btn.addEventListener('click',function(){
var langCode=this.getAttribute('data-lang');
self.selectLanguage(langCode,overlay,onDone);
});
});
},
selectLanguage:function(langCode,overlay,onDone){
localStorage.setItem(this.LANG_STORAGE_KEY,'true');
if(typeof changeLanguage==='function'){
changeLanguage(langCode);
}else if(typeof i18next!=='undefined'){
i18next.changeLanguage(langCode);
}
overlay.remove();
// 翻訳の差し替えが終わってから次の案内を出す
setTimeout(function(){
if(onDone)onDone();
},300);
},
showQuickStartPrompt:function(onDone){
var self=this;
var overlay=document.createElement('div');
overlay.className='tutorial-overlay';
overlay.innerHTML='<div class="tutorial-prompt">'+
'<div class="tutorial-prompt-title">'+getText('tutorialWelcomeTitle')+'</div>'+
'<div class="tutorial-prompt-body">'+getText('tutorialWelcomeBody')+'</div>'+
'<div class="tutorial-prompt-buttons">'+
'<button class="tutorial-btn tutorial-btn-primary" id="tutorialStartBtn">'+getText('tutorialStart')+'</button>'+
'<button class="tutorial-btn tutorial-btn-secondary" id="tutorialSkipBtn">'+getText('tutorialSkip')+'</button>'+
'</div>'+
'</div>';
document.body.appendChild(overlay);
document.getElementById('tutorialStartBtn').addEventListener('click',function(){
overlay.remove();
if(onDone)onDone();
self.startQuickStart();
});
document.getElementById('tutorialSkipBtn').addEventListener('click',function(){
overlay.remove();
self.state.quickStartCompleted=true;
self.saveState();
self.notifyReopenPath();
if(onDone)onDone();
});
},
// 見送っても後から開けることを伝える。ここだけ案内が無いと二度と辿り着けない
notifyReopenPath:function(){
createToast(getText('Tutorial'),getText('tutorialReopenHint'),4000);
},
startQuickStart:function(){
var self=this;
var steps=[
{element:'#intro_svg-container-template',title:getText('tutorialStep1Title'),body:getText('tutorialStep1Body'),position:'right'},
{element:'#canvas-area',title:getText('tutorialStep2Title'),body:getText('tutorialStep2Body'),position:'left'},
{element:'#intro_speech-bubble-area1',title:getText('tutorialStep3Title'),body:getText('tutorialStep3Body'),position:'right'},
{element:'#intro_text-area',title:getText('tutorialStep4Title'),body:getText('tutorialStep4Body'),position:'right'},
{element:'#canvas-area',title:getText('tutorialStep5Title'),body:getText('tutorialStep5Body'),position:'left'},
// 右クリックにしか無い操作があることは、案内しないと辿り着けない（#31）
{element:'#canvas-area',title:getText('tutorialRightClickTitle'),body:getText('tutorialRightClickBody'),position:'left'}
];
this.runSteps(steps,0,function(){
self.state.quickStartCompleted=true;
self.saveState();
createToast(getText('tutorialCompleteTitle'),getText('tutorialCompleteBody'),3000);
});
},
runSteps:function(steps,index,onComplete){
var self=this;
if(index>=steps.length){
if(onComplete)onComplete();
return;
}
var step=steps[index];
this.showStepHighlight(step,index+1,steps.length,function(){
self.runSteps(steps,index+1,onComplete);
});
},
showStepHighlight:function(step,current,total,onNext){
var self=this;
this.removeActiveHint();
var targetEl=document.querySelector(step.element);
var rect=targetEl?targetEl.getBoundingClientRect():null;
// 対象が無い・畳まれていて大きさが取れないときに黙って飛ばすと、
// 5枚のはずの案内が3枚で終わり、何が省かれたのか分からなくなる。
// 枠は出せないが説明は画面中央に出し、その旨を本文に添える
var targetHidden=!rect||rect.width<=0||rect.height<=0;
if(targetHidden){
tutorialLogger.warn('Tutorial target not visible:',step.element);
}
var overlay=document.createElement('div');
overlay.className='tutorial-step-overlay';
var highlight=document.createElement('div');
highlight.className='tutorial-highlight';
if(!targetHidden){
highlight.style.top=(rect.top-6)+'px';
highlight.style.left=(rect.left-6)+'px';
highlight.style.width=(rect.width+12)+'px';
highlight.style.height=(rect.height+12)+'px';
}else{
highlight.style.display='none';
}
var tooltip=document.createElement('div');
// 枠を出せないときは吹き出しの向きも示せないため、三角は付けない
tooltip.className='tutorial-tooltip'+(targetHidden?'':' tutorial-tooltip-'+step.position);
var tooltipLeft,tooltipTop;
if(targetHidden){
tooltipLeft=Math.max(10,(window.innerWidth-340)/2);
tooltipTop=Math.max(10,(window.innerHeight-240)/2);
}else if(step.position==='right'){
tooltipLeft=rect.right+24;
tooltipTop=rect.top;
}else if(step.position==='left'){
tooltipLeft=rect.left-370;
tooltipTop=rect.top;
}else if(step.position==='bottom'){
tooltipLeft=rect.left;
tooltipTop=rect.bottom+24;
}else{
tooltipLeft=rect.left;
tooltipTop=rect.top-180;
}
tooltip.style.left=Math.max(10,tooltipLeft)+'px';
tooltip.style.top=Math.max(10,tooltipTop)+'px';
tooltip.innerHTML='<div class="tutorial-tooltip-header">'+
'<span class="tutorial-step-indicator">'+current+'/'+total+'</span>'+
'<span class="tutorial-tooltip-title">'+step.title+'</span>'+
'</div>'+
'<div class="tutorial-tooltip-body">'+step.body+
(targetHidden?'<div class="tutorial-tooltip-note">'+getText('tutorialTargetHidden')+'</div>':'')+
'</div>'+
'<div class="tutorial-tooltip-footer">'+
'<button class="tutorial-btn tutorial-btn-secondary tutorial-btn-sm" id="tutorialExitBtn">'+getText('tutorialExit')+'</button>'+
'<button class="tutorial-btn tutorial-btn-primary tutorial-btn-sm" id="tutorialNextBtn">'+(current<total?getText('tutorialNext'):getText('tutorialFinish'))+'</button>'+
'</div>';
overlay.appendChild(highlight);
overlay.appendChild(tooltip);
document.body.appendChild(overlay);
// 画面外へはみ出したら引き戻す。position:'right'を広い要素（#canvas-area等）に
// 指定すると右端の外へ出るため、ステップごとにpositionを検算しなくて済むよう
// 位置の後始末をこの1か所に置く。実寸で測るので幅を決め打ちしない
var box=tooltip.getBoundingClientRect();
var maxLeft=window.innerWidth-box.width-10;
var maxTop=window.innerHeight-box.height-10;
if(box.left>maxLeft)tooltip.style.left=Math.max(10,maxLeft)+'px';
if(box.top>maxTop)tooltip.style.top=Math.max(10,maxTop)+'px';
this.activeHint=overlay;
document.getElementById('tutorialNextBtn').addEventListener('click',function(){
self.removeActiveHint();
onNext();
});
document.getElementById('tutorialExitBtn').addEventListener('click',function(){
self.removeActiveHint();
self.state.quickStartCompleted=true;
self.saveState();
self.notifyReopenPath();
});
},
removeActiveHint:function(){
if(this.activeHint){
this.activeHint.remove();
this.activeHint=null;
}
},
showContextHint:function(hintId,element,title,body,position){
if(this.state.hintsShown[hintId])return;
var self=this;
var targetEl=typeof element==='string'?document.querySelector(element):element;
if(!targetEl)return;
this.removeActiveHint();
var rect=targetEl.getBoundingClientRect();
var overlay=document.createElement('div');
overlay.className='tutorial-context-overlay';
var tooltip=document.createElement('div');
tooltip.className='tutorial-tooltip tutorial-tooltip-context tutorial-tooltip-'+(position||'bottom');
var tooltipLeft,tooltipTop;
position=position||'bottom';
if(position==='right'){
tooltipLeft=rect.right+12;
tooltipTop=rect.top;
}else if(position==='left'){
tooltipLeft=rect.left-320;
tooltipTop=rect.top;
}else if(position==='top'){
tooltipLeft=rect.left;
tooltipTop=rect.top-150;
}else{
tooltipLeft=rect.left;
tooltipTop=rect.bottom+12;
}
tooltip.style.left=Math.max(10,tooltipLeft)+'px';
tooltip.style.top=Math.max(10,tooltipTop)+'px';
tooltip.innerHTML='<div class="tutorial-tooltip-header">'+
'<span class="tutorial-tooltip-title">'+title+'</span>'+
'<button class="tutorial-tooltip-close" id="tutorialCloseHint">&times;</button>'+
'</div>'+
'<div class="tutorial-tooltip-body">'+body+'</div>'+
'<div class="tutorial-tooltip-footer">'+
'<label class="tutorial-dont-show"><input type="checkbox" id="tutorialDontShow"> '+getText('tutorialDontShowAgain')+'</label>'+
'<button class="tutorial-btn tutorial-btn-primary tutorial-btn-sm" id="tutorialGotIt">'+getText('tutorialGotIt')+'</button>'+
'</div>';
overlay.appendChild(tooltip);
document.body.appendChild(overlay);
this.activeHint=overlay;
var closeHint=function(){
var dontShow=document.getElementById('tutorialDontShow');
if(dontShow&&dontShow.checked){
self.state.hintsShown[hintId]=true;
self.saveState();
}
self.removeActiveHint();
};
document.getElementById('tutorialCloseHint').addEventListener('click',closeHint);
document.getElementById('tutorialGotIt').addEventListener('click',function(){
self.state.hintsShown[hintId]=true;
self.saveState();
self.removeActiveHint();
});
overlay.addEventListener('click',function(e){
if(e.target===overlay)closeHint();
});
},
markHintShown:function(hintId){
this.state.hintsShown[hintId]=true;
this.saveState();
},
setupEventListeners:function(){
var self=this;
document.addEventListener('click',function(e){
var el=e.target.closest('#Intro_Tutorial');
if(el){
e.preventDefault();
self.startQuickStart();
}
});
this.blockKeysWhileStartupModal();
},
// 起動時のモーダル（言語選択・クイックスタートの案内）が出ている間、
// キー操作をアプリへ通さない。
// .tutorial-overlay が塞ぐのはポインタだけで、documentへ届くキー系はそのまま通るため、
// 言語を選ぶ前でも Ctrl+V での画像貼り付け・Delete・Ctrl+S が効いてしまっていた。
// 受け口は1つではない（ショートカットは hotkeys が document の keydown/keyup、
// 貼り付けは js/shortcut.js の paste、Shiftの一時解除は
// js/fabric/fabric-management.js の keydown/keyup）。個別に塞ぐと足し忘れるので、
// document より手前の window のキャプチャで一括して止める。
// window は伝播経路の document より先なので、登録順に左右されない。
// preventDefault はしないため、Tabでの移動やEnterでのボタン押下は従来どおり効く
blockKeysWhileStartupModal:function(){
['keydown','keyup','paste'].forEach(function(type){
window.addEventListener(type,function(e){
var overlay=document.querySelector('.tutorial-overlay');
if(!overlay)return;
// モーダルの中で起きたキー操作は通す（Tab移動・Enterでの決定）
if(e.target&&overlay.contains(e.target))return;
e.stopPropagation();
},true);
});
}
};
var ComfyUIGuide={
STORAGE_KEY:'comfyui_guide_state',
state:null,
init:function(){
this.loadState();
},
loadState:function(){
try{
var saved=localStorage.getItem(this.STORAGE_KEY);
this.state=saved?JSON.parse(saved):{
setupGuideShown:false,
testGenerateHintShown:false,
nodeErrorHintShown:false,
modelErrorHintShown:false
};
}catch(e){
this.state={setupGuideShown:false,testGenerateHintShown:false,nodeErrorHintShown:false,modelErrorHintShown:false};
}
},
saveState:function(){
try{
localStorage.setItem(this.STORAGE_KEY,JSON.stringify(this.state));
}catch(e){
tutorialLogger.error('Failed to save ComfyUI guide state');
}
},
resetState:function(){
this.state={setupGuideShown:false,testGenerateHintShown:false,nodeErrorHintShown:false,modelErrorHintShown:false};
this.saveState();
},
showSetupGuide:function(isOnline,forceShow){
if(this.state.setupGuideShown&&!forceShow)return;
var self=this;
var container=document.querySelector('.comfui-right-sidebar');
if(!container)return;
var existingGuide=container.querySelector('.comfyui-setup-guide');
if(existingGuide)existingGuide.remove();
var guide=document.createElement('div');
guide.className='comfyui-setup-guide'+(isOnline?'':' warning');
if(isOnline){
guide.innerHTML='<div class="guide-header">'+
'<span class="guide-icon" style="font-size:20px;">&#9989;</span>'+
'<span class="guide-title">'+getText('comfyGuideOnlineTitle')+'</span>'+
'<button class="guide-close">&times;</button>'+
'</div>'+
'<div class="guide-content">'+
'<div class="guide-step"><span class="step-num">1</span><span>'+getText('comfyGuideOnlineStep1')+'</span></div>'+
'<div class="guide-step"><span class="step-num">2</span><span>'+getText('comfyGuideOnlineStep2')+'</span></div>'+
'<div class="guide-step"><span class="step-num">3</span><span>'+getText('comfyGuideOnlineStep3')+'</span></div>'+
'</div>'+
'<div class="guide-footer">'+
'<label class="tutorial-dont-show"><input type="checkbox" id="comfyGuideDontShow"> '+getText('tutorialDontShowAgain')+'</label>'+
'<button class="tutorial-btn tutorial-btn-primary tutorial-btn-sm guide-got-it">'+getText('tutorialGotIt')+'</button>'+
'</div>';
}else{
guide.innerHTML='<div class="guide-header warning">'+
'<span class="guide-icon" style="font-size:20px;">&#9888;</span>'+
'<span class="guide-title">'+getText('comfyGuideOfflineTitle')+'</span>'+
'<button class="guide-close">&times;</button>'+
'</div>'+
'<div class="guide-content">'+
'<div class="guide-step"><span class="step-num warn">1</span><span>'+getText('comfyGuideOfflineStep1')+'</span></div>'+
'<div class="guide-step"><span class="step-num warn">2</span><span>'+getText('comfyGuideOfflineStep2')+'</span></div>'+
'<div class="guide-step highlight warn">'+getText('comfyGuideOfflineStep3')+'</div>'+
'</div>'+
'<div class="guide-footer">'+
'<label class="tutorial-dont-show"><input type="checkbox" id="comfyGuideDontShow"> '+getText('tutorialDontShowAgain')+'</label>'+
'<button class="tutorial-btn tutorial-btn-primary tutorial-btn-sm guide-got-it">'+getText('tutorialGotIt')+'</button>'+
'</div>';
}
container.insertBefore(guide,container.firstChild);
guide.querySelector('.guide-close').addEventListener('click',function(){
var dontShow=document.getElementById('comfyGuideDontShow');
if(dontShow&&dontShow.checked){
self.state.setupGuideShown=true;
self.saveState();
}
guide.remove();
});
guide.querySelector('.guide-got-it').addEventListener('click',function(){
var dontShow=document.getElementById('comfyGuideDontShow');
if(dontShow&&dontShow.checked){
self.state.setupGuideShown=true;
self.saveState();
}
guide.remove();
});
},
showNodeErrorGuide:function(missingNodes){
var container=document.querySelector('.comfui-right-sidebar');
if(!container)return;
var existingGuide=container.querySelector('.comfyui-error-guide');
if(existingGuide)existingGuide.remove();
var nodeList=missingNodes.filter(function(n){return n!=='---';}).join(', ');
var guide=document.createElement('div');
guide.className='comfyui-error-guide';
guide.innerHTML='<div class="guide-header error">'+
'<span class="guide-icon">&#10060;</span>'+
'<span class="guide-title">'+getText('comfyGuideNodeErrorTitle')+'</span>'+
'<button class="guide-close">&times;</button>'+
'</div>'+
'<div class="guide-content">'+
'<div class="guide-error-nodes">'+getText('comfyGuideNodeErrorMissing')+': <code>'+nodeList+'</code></div>'+
'<div class="guide-step"><span class="step-num">1</span>'+getText('comfyGuideNodeErrorStep1')+'</div>'+
'<div class="guide-step"><span class="step-num">2</span>'+getText('comfyGuideNodeErrorStep2')+'</div>'+
'<div class="guide-tip">'+getText('comfyGuideNodeErrorTip')+'</div>'+
'</div>';
container.insertBefore(guide,container.firstChild);
guide.querySelector('.guide-close').addEventListener('click',function(){
guide.remove();
});
},
// ノードは揃っているが、ワークフローが指す値（モデル名・sampler_name等）がComfyUI側に無い。
// カスタムノードの入れ直しでは直らないので、showNodeErrorGuideとは別の手順を出す
showValueErrorGuide:function(mismatchLines){
var container=document.querySelector('.comfui-right-sidebar');
if(!container)return;
var existingGuide=container.querySelector('.comfyui-error-guide');
if(existingGuide)existingGuide.remove();
var valueList=mismatchLines.filter(function(n){return n!=='---';}).join('<br>');
var guide=document.createElement('div');
guide.className='comfyui-error-guide';
guide.innerHTML='<div class="guide-header error">'+
'<span class="guide-icon">&#10060;</span>'+
'<span class="guide-title">'+getText('comfyGuideValueErrorTitle')+'</span>'+
'<button class="guide-close">&times;</button>'+
'</div>'+
'<div class="guide-content">'+
'<div class="guide-error-nodes">'+getText('comfyGuideValueErrorMissing')+': <code>'+valueList+'</code></div>'+
'<div class="guide-step"><span class="step-num">1</span>'+getText('comfyGuideValueErrorStep1')+'</div>'+
'<div class="guide-step"><span class="step-num">2</span>'+getText('comfyGuideValueErrorStep2')+'</div>'+
'<div class="guide-tip">'+getText('comfyGuideValueErrorTip')+'</div>'+
'</div>';
container.insertBefore(guide,container.firstChild);
guide.querySelector('.guide-close').addEventListener('click',function(){
guide.remove();
});
},
showGenerationErrorGuide:function(errorMessage){
var container=document.querySelector('.comfui-right-sidebar');
if(!container)return;
var existingGuide=container.querySelector('.comfyui-error-guide');
if(existingGuide)existingGuide.remove();
var guide=document.createElement('div');
guide.className='comfyui-error-guide';
guide.innerHTML='<div class="guide-header error">'+
'<span class="guide-icon">&#9888;</span>'+
'<span class="guide-title">'+getText('comfyGuideGenErrorTitle')+'</span>'+
'<button class="guide-close">&times;</button>'+
'</div>'+
'<div class="guide-content">'+
'<div class="guide-step"><span class="step-num">1</span>'+getText('comfyGuideGenErrorStep1')+'</div>'+
'<div class="guide-step"><span class="step-num">2</span>'+getText('comfyGuideGenErrorStep2')+'</div>'+
'<div class="guide-example">'+getText('comfyGuideGenErrorExample')+'</div>'+
'<div class="guide-step"><span class="step-num">3</span>'+getText('comfyGuideGenErrorStep3')+'</div>'+
'</div>';
container.insertBefore(guide,container.firstChild);
guide.querySelector('.guide-close').addEventListener('click',function(){
guide.remove();
});
}
};
document.addEventListener('DOMContentLoaded',function(){
// ここではモーダルを出さない。起動時に出す順番は
// js/project-management.js の runBootSequence が1か所で決めている
TutorialManager.init();
ComfyUIGuide.init();
});
