function showT2IPrompts(layer) {
// console.log("showT2IPrompts layer.text2img_prompt:", layer.text2img_prompt);

var otherControlsMini=$("other-controls-mini");
otherControlsMini.innerHTML=`
<div class="control textarea-control">
    <div class="textarea-label-wrapper">
        <label class="textarea-label" for="textarea" data-i18n="apPrompt">${getText('apPrompt')}</label>
    </div>
    <textarea id="text2img_prompt" name="textarea" placeholder=" ">${
      layer.text2img_prompt || ""
    }</textarea>
</div>
<div class="control textarea-control">
    <div class="textarea-label-wrapper">
        <label class="textarea-label" for="textarea" data-i18n="apNegative">${getText('apNegative')}</label>
    </div>
    <textarea id="text2img_negative" name="textarea" placeholder=" ">${
      layer.text2img_negative || ""
    }</textarea>
</div>

<div class="dual-number-control">
    <div class="control">
        <input type="number" id="text2img_width" name="number-input-1" placeholder=" " value="${
          layer.text2img_width || 1024
        }">
        <span class="label" data-i18n="apWidth">${getText('apWidth')}</span>
    </div>
    <div class="control">
        <input type="number" id="text2img_height" name="number-input-1" placeholder=" " value="${
          layer.text2img_height || 1024
        }">
        <span class="label" data-i18n="apHeight">${getText('apHeight')}</span>
    </div>
</div>
<div class="control-note" data-i18n="apSizeNote">${getText('apSizeNote')}</div>

<div class="dual-number-control">
    <div class="control">
        <input type="number" id="text2img_seed" name="number-input-1" placeholder=" " value="${
          layer.text2img_seed || -2
        }">
        <span class="label" data-i18n="apSeed">${getText('apSeed')}</span>
    </div>
    <div class="control" style="visibility: hidden;">
        <select id="dummy202410130402" name="dropdown">
        </select>
        <span class="label">dummy</span>
    </div>
</div>
<div class="control-note" data-i18n="apSeedNote">${getText('apSeedNote')}</div>
<div class="dual-number-control">
    <div class="control">
        <button id="promptRun" data-i18n="apGenerate">${getText('apGenerate')}</button>
    </div>
    <div class="control">
        ${llmPromptButtonHtml()}
    </div>
</div>
    `;


$("promptRun").addEventListener("click",function () {
if (!layer) {
return;
}
var spinner=createSpinner(getGUID(layer),'T2I');
T2I(layer,spinner);
});

bindLLMPromptButton(layer);


$("text2img_prompt").addEventListener("input",function () {
layer.text2img_prompt=this.value;
});

$("text2img_negative").addEventListener("input",function () {
layer.text2img_negative=this.value;
});

$("text2img_seed").addEventListener("input",function () {
layer.text2img_seed=this.value;
});

$("text2img_height").addEventListener("blur",function () {
var value=parseInt(this.value);
if (value!==-1) {
this.value=Math.round(value/8)*8;
}
layer.text2img_height=this.value;
});
$("text2img_width").addEventListener("blur",function () {
var value=parseInt(this.value);
if (value!==-1) {
this.value=Math.round(value/8)*8;
}
layer.text2img_width=this.value;
});

setAutoSizeingControlMini();
}

function showI2IPrompts(layer) {
var otherControlsMini=$("other-controls-mini");
otherControlsMini.innerHTML=`
<div class="control textarea-control">
    <div class="textarea-label-wrapper">
        <label class="textarea-label" for="textarea" data-i18n="apPrompt">${getText('apPrompt')}</label>
    </div>
    <textarea id="text2img_prompt" name="textarea" placeholder=" ">${
      layer.text2img_prompt || ""
    }</textarea>
</div>
<div class="control textarea-control">
    <div class="textarea-label-wrapper">
        <label class="textarea-label" for="textarea" data-i18n="apNegative">${getText('apNegative')}</label>
    </div>
    <textarea id="text2img_negative" name="textarea" placeholder=" ">${
      layer.text2img_negative || ""
    }</textarea>
</div>

<div class="dual-number-control">
    <div class="control">
        <input type="number" id="text2img_seed" name="number-input-1" placeholder=" " value="${
          layer.text2img_seed || -2
        }">
        <span class="label" data-i18n="apSeed">${getText('apSeed')}</span>
    </div>
    <div class="control">
        <input type="number" id="img2imgScale" name="number-input-1" placeholder=" " step="0.1"  min="0.1" value="${
          layer.img2imgScale || 1.2
        }">
        <span class="label" data-i18n="apScale">${getText('apScale')}</span>
    </div>
</div>
<div class="control-note" data-i18n="apSeedNote">${getText('apSeedNote')}</div>

<div class="dual-number-control">
    <div class="control">
        <input type="number" id="img2img_denoise" name="number-input-1" placeholder=" " step="0.01"  max="1" min="0" value="${
          layer.img2img_denoise || 0.7
        }">
        <span class="label" data-i18n="apDenoise">${getText('apDenoise')}</span>
    </div>
    <div class="control" style="visibility: hidden;">
        <input type="number" id="dummy202410130418">
        <span class="label">dummy202410130418</span>
    </div>
</div>
<div class="dual-number-control">
    <div class="control">
        <button id="promptRun" data-i18n="apGenerate">${getText('apGenerate')}</button>
    </div>
    <div class="control">
        ${llmPromptButtonHtml()}
    </div>
</div>
  `;

$("promptRun").addEventListener("click",function () {
if (layer) {
return;
}
var spinner=createSpinner(getGUID(activeObject),'T2I');
T2I(activeObject,spinner);
});

bindLLMPromptButton(layer);


$("text2img_prompt").addEventListener("input",function () {
layer.text2img_prompt=this.value;
uiLogger.debug("layer.text2img_prompt:",layer.text2img_prompt);
});

$("text2img_negative").addEventListener("input",function () {
layer.text2img_negative=this.value;
});

$("text2img_seed").addEventListener("input",function () {
layer.text2img_seed=this.value;
});
$("img2imgScale").addEventListener("input",function () {
layer.img2imgScale=this.value;
});
$("img2img_denoise").addEventListener("input",function () {
layer.img2img_denoise=this.value;
});

setAutoSizeingControlMini();
}

function refreshPromptPanel(layer) {
if (!layer) {
return;
}
if (canvas.getActiveObject()!==layer) {
return;
}
if (isPanel(layer)) {
showT2IPrompts(layer);
} else if (isImage(layer)) {
showI2IPrompts(layer);
}
}

function adjustToMultipleOfEight(elementId) {
var inputElement=$(elementId);
var value=parseInt(inputElement.value);
if (value!==-1) {
inputElement.value=Math.round(value/8)*8;
}
}

function noShowPrompt() {
var otherControlsMini=$("other-controls-mini");
otherControlsMini.innerHTML=`<label data-i18n="apNoSelection">${getText('apNoSelection')}</label>`;
setAutoSizeingControlMini();
}