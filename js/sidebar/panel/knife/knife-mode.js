/**
 * knife-mode.js
 * ナイフモードの切替とUI管理
 */

/**
 * DOMContentLoadedイベントでボタンにイベントリスナーを設定
 */
document.addEventListener("DOMContentLoaded",function () {
$("knifeModeButton").addEventListener("click",function () {
changeKnifeMode();
});
});

/**
 * ナイフボタンの表示を状態に合わせて更新する唯一の入口。
 * button.textContent=… にすると中のアイコンとspanごと消えるため、必ずspanだけを書き換える。
 * data-i18nも張り替えて、言語切替時にupdateContent()が正しいキーで再描画できるようにする
 */
function setKnifeModeButtonState(on) {
var knifeModeButton=$("knifeModeButton");
if(!knifeModeButton)return;
var label=knifeModeButton.querySelector("span");
if(label){
var key=on?"knifeOn":"knifeOff";
label.setAttribute("data-i18n",key);
label.textContent=getText(key);
}
knifeModeButton.classList.toggle("selected",!!on);
}

/**
 * ナイフモードを切り替え。
 * 入り切りの実体は ModeManager が持つ。ここで isKnifeMode を直接書き換えていたため
 * ModeManager.change() を通らず、ナイフ中でも getCurrent() が 'select' を返していた（監査 #10）
 */
function changeKnifeMode() {
ModeManager.knife.toggle();
}

/**
 * isKnifeMode を直接書き換えた後の後始末に使う入口（speech-bubble-freehand.js が使う）。
 * 書き換えた結果の状態へ ModeManager を合わせる
 */
function updateKnifeMode() {
if (isKnifeMode) {
ModeManager.change(ModeManager.MODE.KNIFE);
} else {
// ナイフ「だけ」を畳む。ここで ModeManager.clearAll() を呼ぶと、
// 呼び出し元が直前に入れた currentMode（吹き出しの座標／自由／点移動／点削除）まで
// select へ戻され、ナイフから直接切り替えたときだけモードが入らなくなる
ModeManager.knife.disable();
}
}
