document.addEventListener('DOMContentLoaded',function() {
const sliders=document.querySelectorAll('.input-container input[type="range"]');
sliders.forEach(slider=>{
setupSlider(slider,'.input-container')
});
const sliders2=document.querySelectorAll('.input-container-leftSpace input[type="range"]');
sliders2.forEach(slider=>{
setupSlider(slider,'.input-container-leftSpace')
});
});


// ラベルの原文はi18n（updateContent / applyLabelTranslations）だけがdata-labelへ書く。
// 値の表示はdata-value-textへ分けて持ち、CSS側で連結する。
// 以前は「ラベル：値」をdata-labelへ上書きしていたため、言語切替後に
// 切替前の言語のラベルが焼き付いていた（英語のまま戻らない）。
const sliderLabelTargets=new WeakMap();
let sliderLabelObserver=null;

function refreshSliderAriaLabel(container) {
const entry=sliderLabelTargets.get(container);
if(!entry){
return;
}
const label=container.getAttribute('data-label');
if(label===null){
return;
}
entry.slider.setAttribute('aria-label',label);
if(entry.upButton){
entry.upButton.setAttribute('aria-label',label+' +');
}
if(entry.downButton){
entry.downButton.setAttribute('aria-label',label+' -');
}
}

// data-labelが書き換わる場所（言語切替・パネル生成）は複数あるため、
// 呼び出し側それぞれに手を入れず属性の変化1点で拾う。
function ensureSliderLabelObserver() {
if(sliderLabelObserver){
return;
}
sliderLabelObserver=new MutationObserver(function(records) {
records.forEach(record=>{
refreshSliderAriaLabel(record.target);
});
});
sliderLabelObserver.observe(document.documentElement,{
subtree:true,
attributes:true,
attributeFilter:['data-label']
});
}


function setupSlider(slider,classname,addButton=true){
if(slider.isSetupDone){
return;
}

const container=slider.closest(classname);
const sliderContainer=document.createElement('div');
sliderContainer.className='slider-container';

slider.setAttribute('aria-valuemin',slider.min);
slider.setAttribute('aria-valuemax',slider.max);
slider.setAttribute('aria-valuenow',slider.value);

const valueButtons=document.createElement('div');
valueButtons.className='slider-value-buttons';

let upButton=null;
let downButton=null;
if(addButton){
upButton=document.createElement('button');
upButton.className='slider-value-button';
upButton.textContent='△';
downButton=document.createElement('button');
downButton.className='slider-value-button';
downButton.textContent='▽';
valueButtons.appendChild(upButton);
valueButtons.appendChild(downButton);
}

sliderLabelTargets.set(container,{slider:slider,upButton:upButton,downButton:downButton});
ensureSliderLabelObserver();
refreshSliderAriaLabel(container);


container.appendChild(sliderContainer);
sliderContainer.appendChild(slider);
sliderContainer.appendChild(valueButtons);


const originalDescriptor=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');



Object.defineProperty(slider,'value',{
get: function() {
return originalDescriptor.get.call(this);
},
set: function(newValue) {
originalDescriptor.set.call(this,newValue);
updateLabel();
}
});

function updateLabel() {
const step=parseFloat(slider.step)||1;
const decimals=step<1?Math.max(1,String(step).split('.')[1]?.length||1):0;
const displayValue=decimals>0?parseFloat(slider.value).toFixed(decimals):slider.value;
container.setAttribute('data-value-text',`：${displayValue}`);
slider.setAttribute('aria-valuenow',slider.value);
}

function updateSlider(newValue) {
slider.value=newValue;
slider.dispatchEvent(new Event('input'));
}

slider.addEventListener('input',updateLabel);

if(addButton){
upButton.addEventListener('click',()=>{
const step=parseFloat(slider.step)||1;
const newValue=Math.min(parseFloat(slider.value)+step,slider.max);
updateSlider(newValue);
});

downButton.addEventListener('click',()=>{
const step=parseFloat(slider.step)||1;
const newValue=Math.max(parseFloat(slider.value)-step,slider.min);
updateSlider(newValue);
});
}

updateLabel();


slider.isSetupDone=true;
}
