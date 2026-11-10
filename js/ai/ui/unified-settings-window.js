var unifiedSettingsWindow=(function(){
var overlayEl=null;
// 他のダイアログ・ピッカーと閉じ方を揃えるため、Esc も FocusTrap 経由でここに寄せる
var focusTrap=null;
function open(){
if(!overlayEl)overlayEl=$('unifiedSettingsOverlay');
overlayEl.classList.add('active');
if(!focusTrap){
focusTrap=FocusTrap.create(overlayEl.querySelector('.us-window'),close);
FocusTrap.activate(focusTrap);
}
roleAssignmentUI.buildMatrix();
var falaiProvider=providerRegistry.get('falai');
if(falaiProvider&&falaiProvider.getApiKey()&&isProviderInUse('falai')){
falaiProvider.fetchModelsIfNeeded();
}
llmFetchModelsIfConfigured();
}
function close(){
if(!overlayEl)return;
if(focusTrap){
FocusTrap.deactivate(focusTrap);
focusTrap=null;
}
overlayEl.classList.remove('active');
}
function apply(){
close();
}
function switchTab(idx){
var tabs=overlayEl.querySelectorAll('.us-tab');
var contents=overlayEl.querySelectorAll('.us-tab-content');
tabs.forEach(function(t,i){
t.classList.toggle('active',i===idx);
});
contents.forEach(function(c,i){
c.classList.toggle('active',i===idx);
});
}
return{
open:open,
close:close,
apply:apply,
switchTab:switchTab
};
})();
