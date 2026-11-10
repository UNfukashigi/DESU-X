// confirm-dialog.js - 取り消せない操作の前に出す共通の確認ダイアログ
//
// 元に戻せない操作（ページ削除、履歴ごとの全消去など）の直前に必ず通す。
// 各所でモーダルをベタ書きすると閉じ方（×・Esc・背景クリック）が揃わないため、
// 入口をここ1か所にまとめている。
//
// 使い方（2択・戻り値は true / false）:
//   var ok=await showConfirmDialog({titleKey:'...',messageKey:'...',danger:true});
//   if(!ok)return;
//
// 3択以上（戻り値は選ばれた choice の key、取り消しは false）:
//   var r=await showConfirmDialog({titleKey:'...',messageKey:'...',choices:[
//     {key:'replace',textKey:'...',danger:true},
//     {key:'append',textKey:'...',secondary:true}
//   ]});
//   if(!r)return;              // ×・Esc・背景クリック・取り消し
//   if(r==='replace'){...}
// choices を渡さないときの戻り値・見た目は2択のときと同じ。
// 取り消しはどちらの形でも false なので、既存の if(!ok) 判定はそのまま使える
//
// 本文の下に図や一覧を出したいとき（自動保存の復元など）:
//   showConfirmDialog({titleKey:'...',message:'...',content:element,wide:true})
// content は呼び出し側が組み立てたDOM要素。文字列は受け取らない
// （HTML文字列を渡せるようにすると、翻訳文をそのまま差し込む使い方に流れるため）
function showConfirmDialog(options){
var opts=options||{};
return new Promise(function(resolve){
var title=opts.title||(opts.titleKey?getText(opts.titleKey):'');
var message=opts.message||(opts.messageKey?getText(opts.messageKey):'');
var okText=opts.okText||getText(opts.okKey||'confirmDialogOk');
var cancelText=opts.cancelText||getText(opts.cancelKey||'confirmDialogCancel');
var choices=(opts.choices&&opts.choices.length)?opts.choices:null;

var overlay=document.createElement('div');
overlay.className='confirm-dialog-overlay';

var dialog=document.createElement('div');
dialog.className='confirm-dialog'+(opts.wide?' is-wide':'');
dialog.setAttribute('role','alertdialog');
dialog.setAttribute('aria-modal','true');

var titleEl=document.createElement('h3');
titleEl.className='confirm-dialog-title';
titleEl.textContent=title;
dialog.appendChild(titleEl);

var msgEl=document.createElement('p');
msgEl.className='confirm-dialog-message';
msgEl.textContent=message;
dialog.appendChild(msgEl);

if(opts.content){
var contentEl=document.createElement('div');
contentEl.className='confirm-dialog-content';
contentEl.appendChild(opts.content);
dialog.appendChild(contentEl);
}

var closeBtn=document.createElement('button');
closeBtn.className='confirm-dialog-close';
closeBtn.textContent='✕';
closeBtn.setAttribute('aria-label',cancelText);
dialog.appendChild(closeBtn);

var btnWrap=document.createElement('div');
btnWrap.className='confirm-dialog-buttons';
var cancelBtn=document.createElement('button');
cancelBtn.className='confirm-dialog-cancel';
cancelBtn.textContent=cancelText;
btnWrap.appendChild(cancelBtn);
var choiceBtns=[];
if(choices){
choices.forEach(function(choice){
var btn=document.createElement('button');
btn.className=(choice.secondary?'confirm-dialog-cancel':'confirm-dialog-ok')+(choice.danger?' is-danger':'');
btn.textContent=choice.text||(choice.textKey?getText(choice.textKey):'');
btn.setAttribute('data-choice',choice.key);
btnWrap.appendChild(btn);
choiceBtns.push(btn);
});
}else{
var okBtn=document.createElement('button');
okBtn.className='confirm-dialog-ok'+(opts.danger?' is-danger':'');
okBtn.textContent=okText;
btnWrap.appendChild(okBtn);
}
dialog.appendChild(btnWrap);

// タイトルと本文を支援技術へ渡す
titleEl.id='confirm-dialog-title-'+Date.now();
msgEl.id='confirm-dialog-msg-'+Date.now();
dialog.setAttribute('aria-labelledby',titleEl.id);
dialog.setAttribute('aria-describedby',msgEl.id);

overlay.appendChild(dialog);
document.body.appendChild(overlay);

var trap=null;
var settled=false;
function finish(result){
if(settled)return;
settled=true;
if(trap)FocusTrap.deactivate(trap);
overlay.remove();
resolve(result);
}

// ×・Esc・背景クリック・キャンセルの4つをすべて「取り消し」に揃える
trap=FocusTrap.create(dialog,function(){finish(false);});
FocusTrap.activate(trap);
// 誤操作を防ぐため、初期フォーカスは取り消し側に置く
cancelBtn.focus();

cancelBtn.addEventListener('click',function(){finish(false);});
closeBtn.addEventListener('click',function(){finish(false);});
overlay.addEventListener('click',function(e){if(e.target===overlay)finish(false);});
if(choices){
choiceBtns.forEach(function(btn){
btn.addEventListener('click',function(){finish(btn.getAttribute('data-choice'));});
});
}else{
okBtn.addEventListener('click',function(){finish(true);});
}
});
}
