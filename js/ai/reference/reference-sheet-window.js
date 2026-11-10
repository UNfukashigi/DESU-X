// 設定資料のフローティングウインドウ。
//
// **暗幕を持たない。** コマ割りを作ってから何枚も割り当てる作業では、
// 1コマごとに開き直すことになるとまず終わらない。タイトルバーで移動、4辺と4隅で大きさを変え、
// 位置と大きさはlocalStorageに残す。開いたままキャンバスのコマを押せば対象が切り替わる。
// ロックしたコマは選択が付かないため、押した位置からコマを引いて対象にする（pickTargetFromClick）。
// 一覧のサムネイルをコマへ落として一手で付ける経路も別に持たせてある。
//
// 画面は2段に分ける。上の「送る順」は対象コマへ何が何番で入るかだけを見せ、
// 下の一覧はライブラリ。混ぜると枚数が増えたときに何が効いているのか読めなくなる。
//
// 一覧のカードは名前と説明の入力欄を**常に出す**。編集を開いたときだけ出す作りでは、
// 取り込んだ直後の「ファイル名のままのタイトル」を直すのに1枚ずつ2回押すことになる。
// 入力欄の壁になるのを避けるため、表示は3つから選べるようにしてある（大 / 小 / 一覧）。
//
// 一覧にはプロジェクトのシートとベースのシートを混ぜて出し、出どころをバッジで示す。
// ベースのシートを付けるとプロジェクトへ複製される（複製せずidで指すと、
// ベースを直したときに過去の巻の絵まで変わる）
var referenceSheetWindow=(function(){
const PLACEMENT_KEY='referenceSheetWindowPlacement';
const MIN_WIDTH=300;
const MIN_HEIGHT=220;
const VIEW_MODES=['grid','compact','list'];
// ベースはIndexedDBに書くため、打鍵ごとには書かない
const EDIT_WRITE_DELAY=400;
var overlayEl=null;
var activeCategory='character';
var targetLayer=null;
var searchText='';
var viewMode='grid';
var collapsed=false;
var preambleOpen=false;
var bound=false;
var dragDepth=0;
var draggingSheetId=null;
// 掴んだスロットがどの枠から来たか。同じ資料が別の枠にも入っていることがあるので、
// 「どこから抜くか」を持たないと隣の枠まで一緒に外れる
var draggingSheetFrom=-1;
// 一覧のサムネイルをコマへ落とすときの中身。ファイルのドラッグと見分けるために独自のtypeを持たせる
const CARD_DRAG_MIME='application/x-reference-sheet';
var draggingCard=null;
var editTimers={};
// 送る順の余白の受け口。中身は作り直しても入れ物は残るので、束縛は1度だけ
var slotAreaBound=false;
var placement=null;
// 今一覧に並んでいる顔ぶれ。同じなら作り直さない
var cardsSignature='';
// hostを渡すと対象コマも合わせる。ベースの読み込み後にrefreshTarget()が走るため、
// 開いた直後に外から対象を入れても選択中のものへ戻ってしまう
function open(host){
if(!overlayEl)overlayEl=$('referenceSheetOverlay');
applyPlacement();
overlayEl.classList.add('active');
bindEvents();
if(host)targetLayer=host;
ReferenceSheetStore.getBaseAll().then(function(){
if(host)setTargetHost(host);
else refreshTarget();
});
}
function close(){
if(!overlayEl)return;
overlayEl.classList.remove('active');
}
function isOpen(){
return!!(overlayEl&&overlayEl.classList.contains('active'));
}
// 開きっぱなしで使う作りなので、同じボタンで閉じられないと畳む以外に消す手が無い
function toggle(){
if(isOpen())close();
else open();
}
// ---- 置き場所（移動・リサイズ・畳む） ----
function defaultPlacement(){
var width=Math.round(Math.min(Math.max(window.innerWidth*0.34,MIN_WIDTH),620));
var height=Math.round(Math.min(Math.max(window.innerHeight*0.7,MIN_HEIGHT),900));
return{
left:Math.max(8,window.innerWidth-width-16),
top:Math.max(8,Math.round(window.innerHeight*0.12)),
width:width,
height:height
};
}
function loadPlacement(){
if(placement)return placement;
var stored=localStorage.getItem(PLACEMENT_KEY);
placement=defaultPlacement();
if(stored){
var saved=JSON.parse(stored);
['left','top','width','height'].forEach(function(key){
if(typeof saved[key]==='number')placement[key]=saved[key];
});
collapsed=!!saved.collapsed;
if(VIEW_MODES.indexOf(saved.view)!==-1)viewMode=saved.view;
}
return placement;
}
function savePlacement(){
localStorage.setItem(PLACEMENT_KEY,JSON.stringify({
left:placement.left,
top:placement.top,
width:placement.width,
height:placement.height,
collapsed:collapsed,
view:viewMode
}));
}
// 画面の外へ出た状態で覚えていると、次に開いたとき掴めない
function clampPlacement(){
placement.width=Math.min(Math.max(placement.width,MIN_WIDTH),window.innerWidth-16);
placement.height=Math.min(Math.max(placement.height,MIN_HEIGHT),window.innerHeight-16);
placement.left=Math.min(Math.max(placement.left,0),Math.max(0,window.innerWidth-placement.width));
placement.top=Math.min(Math.max(placement.top,0),Math.max(0,window.innerHeight-48));
}
function applyPlacement(){
loadPlacement();
clampPlacement();
overlayEl.style.left=placement.left+'px';
overlayEl.style.top=placement.top+'px';
overlayEl.style.width=placement.width+'px';
overlayEl.style.height=placement.height+'px';
overlayEl.classList.toggle('is-collapsed',collapsed);
var icon=$('rsCollapseBtn').querySelector('.material-icons');
icon.textContent=collapsed?'expand_more':'expand_less';
}
function toggleCollapse(){
collapsed=!collapsed;
applyPlacement();
savePlacement();
}
function bindDrag(){
var titlebar=$('rsTitlebar');
var startX=0;
var startY=0;
var startLeft=0;
var startTop=0;
function onMove(event){
placement.left=startLeft+(event.clientX-startX);
placement.top=startTop+(event.clientY-startY);
clampPlacement();
overlayEl.style.left=placement.left+'px';
overlayEl.style.top=placement.top+'px';
}
function onUp(){
document.removeEventListener('mousemove',onMove);
document.removeEventListener('mouseup',onUp);
overlayEl.classList.remove('is-dragging');
savePlacement();
}
titlebar.addEventListener('mousedown',function(event){
if(event.button!==0)return;
if(event.target.closest('button'))return;
event.preventDefault();
startX=event.clientX;
startY=event.clientY;
startLeft=placement.left;
startTop=placement.top;
overlayEl.classList.add('is-dragging');
document.addEventListener('mousemove',onMove);
document.addEventListener('mouseup',onUp);
});
}
// 右下だけだと、ウインドウを画面の右端や下端へ寄せたときに掴む場所が画面の外へ出る。
// 4辺と4隅の8か所から変えられるようにする
function bindResize(){
overlayEl.querySelectorAll('.rs-resize').forEach(function(handle){
bindResizeHandle(handle,handle.getAttribute('data-dir')||'se');
});
}
function bindResizeHandle(handle,dir){
var startX=0;
var startY=0;
var start=null;
function onMove(event){
var dx=event.clientX-startX;
var dy=event.clientY-startY;
var left=start.left;
var top=start.top;
var width=start.width;
var height=start.height;
// 右・下は画面からはみ出す手前で止める。はみ出したままにすると
// clampPlacement()が左上を動かして掴んでいない側の辺までずれる
if(dir.indexOf('e')!==-1)width=Math.min(Math.max(start.width+dx,MIN_WIDTH),window.innerWidth-left-8);
if(dir.indexOf('s')!==-1)height=Math.min(Math.max(start.height+dy,MIN_HEIGHT),window.innerHeight-top-8);
// 左・上を掴んだときは反対側の辺を動かさない。下限に当たった分だけ掴んだ辺を戻す
if(dir.indexOf('w')!==-1){
width=Math.max(start.width-dx,MIN_WIDTH);
left=start.left+start.width-width;
if(left<0){width+=left;left=0;}
}
if(dir.indexOf('n')!==-1){
height=Math.max(start.height-dy,MIN_HEIGHT);
top=start.top+start.height-height;
if(top<0){height+=top;top=0;}
}
placement.left=left;
placement.top=top;
placement.width=width;
placement.height=height;
clampPlacement();
overlayEl.style.left=placement.left+'px';
overlayEl.style.top=placement.top+'px';
overlayEl.style.width=placement.width+'px';
overlayEl.style.height=placement.height+'px';
}
function onUp(){
document.removeEventListener('mousemove',onMove);
document.removeEventListener('mouseup',onUp);
overlayEl.classList.remove('is-dragging');
savePlacement();
}
handle.addEventListener('mousedown',function(event){
if(event.button!==0)return;
event.preventDefault();
// 畳んだままでは高さを変えても見た目が変わらない（is-collapsedがheightを上書きする）
if(collapsed)toggleCollapse();
startX=event.clientX;
startY=event.clientY;
start={left:placement.left,top:placement.top,width:placement.width,height:placement.height};
overlayEl.classList.add('is-dragging');
document.addEventListener('mousemove',onMove);
document.addEventListener('mouseup',onUp);
});
}
// ---- 表示の切り替え ----
function switchTab(category){
activeCategory=category;
overlayEl.querySelectorAll('.rs-tab').forEach(function(tab){
tab.classList.toggle('active',tab.getAttribute('data-category')===category);
});
render();
}
function switchView(mode){
if(VIEW_MODES.indexOf(mode)===-1)return;
viewMode=mode;
syncViewButtons();
renderCards();
savePlacement();
}
function syncViewButtons(){
overlayEl.querySelectorAll('.rs-viewmode').forEach(function(button){
button.classList.toggle('active',button.getAttribute('data-view')===viewMode);
});
}
function onSearchInput(el){
searchText=el.value.trim().toLowerCase();
renderCards();
}
function togglePreamble(){
preambleOpen=!preambleOpen;
$('rsPreambleToggle').classList.toggle('is-open',preambleOpen);
$('rsPreamble').style.display=preambleOpen?'block':'none';
renderPreamble();
}
function onShowOnCanvasChange(el){
referenceCanvasOverlay.setEnabled(el.checked);
}
function openZoom(entry){
$('rsZoomImage').src=entry.dataUrl;
$('rsZoomCaption').textContent=(entry.name||i18next.t('refSlotUnnamed'))+'  '+entry.width+'x'+entry.height+'  '+formatBytes(entry.byteSize);
$('rsZoom').classList.add('active');
}
function closeZoom(){
$('rsZoom').classList.remove('active');
$('rsZoomImage').src='';
}
// 選択が変わったら対象コマを取り直す。表示と実際の書き込み先がずれないよう1か所で受ける
function bindEvents(){
if(bound)return;
bound=true;
['selection:created','selection:updated','selection:cleared'].forEach(function(name){
canvas.on(name,function(){
refreshTarget();
});
});
// ロックしたコマ（selectable=false）を押しても選択イベントは飛ばず、
// 代わりにselection:clearedで対象が外れる。選択だけを見ていると
// ロックしたコマは押しても「対象コマ」が空になり、送る順が読めない。
// fabricは選択を確定させたあとにmouse:downを流すため、ここで対象を入れ直せる
canvas.on('mouse:down',function(opt){
pickTargetFromClick(opt);
});
bindDrag();
bindResize();
bindFileDrop();
bindCanvasDrop();
window.addEventListener('resize',function(){
if(!isOpen())return;
clampPlacement();
applyPlacement();
});
}
function refreshTarget(){
targetLayer=canvas.getActiveObject()||null;
updateTriggerBadge();
if(isOpen())render();
}
// 選択が動いたクリックはselection:*が受ける。ここで拾うのは選択が付かなかった分だけ。
// コマの取り方はドロップと同じhitTestHost()に寄せる。押した場所と落とした場所で
// 別のコマが対象になると、どちらが正なのか読めなくなる
function pickTargetFromClick(opt){
if(canvas.isDrawingMode)return;
if(canvas.getActiveObject())return;
// absolutePointerはfabricが同じクリックの当たり判定に使った座標。タッチでも入っている
var point=opt.absolutePointer;
if(!point)return;
// 何も無い場所を押したときは外す。ロックしたコマを対象にしたあとだけ
// selection:clearedが飛ばず、外す手が無くなる
var host=hitTestHost(point);
if(host===getTargetHost())return;
setTargetHost(host);
}
// ロックしたコマは選択できないため、対象コマは選択と別に持つ。
// 選べるものは選択も合わせる（コマの枠が光らないと、どれが対象なのか読めない）
function setTargetHost(host){
targetLayer=host||null;
if(host&&host.selectable&&canvas.getActiveObject()!==host){
// selection:createdでrefreshTarget()が走り、そこでrender()まで来る
canvas.setActiveObject(host);
canvas.requestRenderAll();
return;
}
updateTriggerBadge();
if(isOpen())render();
else referenceCanvasOverlay.refresh();
}
function getTargetHost(){
if(!targetLayer)return null;
return ReferenceCollector.getReferenceHost(targetLayer);
}
// すでに絵が入っているコマはI2Iになり、その絵がImage 1として送られる。
// 枚数の表示と説明文の番号がずれないよう、両方でこの判定を使う
function hostHasSourceImage(host){
if(!host)return false;
if(isPanel(host))return!!ReferenceCollector.findPanelImage(host);
return host.type==='image';
}
function hasSourceImage(){
return hostHasSourceImage(getTargetHost());
}
function targetName(){
var host=getTargetHost();
if(!host)return'';
return host.name||(isPanel(host)?i18next.t('refTargetPanel'):i18next.t('refTargetLayer'));
}
// ---- 資料が本当に送られるのか ----
// **枚数を出す前にここを見る。** 参照画像に対応していないサービスでも
// 「送る画像 3 / 14」と出していると、送られていると読める。
// 生成しても資料は絵に出ないので、出さなければ最後まで気づけない
//
// 見るのは「このコマの生成で実際に呼ばれるロール」1つだけ。
// 絵が入っているコマはI2I、空のコマはT2Iになる（枚数と説明文の番号も同じ判定を使っている）
function activeRole(){
return hasSourceImage()?AI_ROLES.Image2Image:AI_ROLES.Text2Image;
}
// プロバイダー側のモデル欄のキー。ロール名とは別系統なのでここで移す
function activeRoleKey(){
return hasSourceImage()?'i2i':'t2i';
}
function activeRoleLabel(){
return i18next.t(hasSourceImage()?'roleImage2Image':'roleText2Image');
}
// 対応しているサービスの名前は数え上げる。文言に書き並べると、
// 対応が増えたときにここだけ古いまま残る
function supportedProviderNames(){
return providerRegistry.getAll().filter(function(provider){
return provider.supportsReferenceSheets();
}).map(function(provider){
return provider.name;
}).join(' / ');
}
function deliveryState(){
var provider=providerRegistry.getProviderForRole(activeRole());
var supported=supportedProviderNames();
if(!provider)return{ok:false,message:i18next.t('refNotSentNoRole',{role:activeRoleLabel(),supported:supported})};
if(!provider.supportsReferenceSheets())return{ok:false,message:i18next.t('refNotSentUnsupported',{role:activeRoleLabel(),provider:provider.name,supported:supported})};
return{ok:true,provider:provider};
}
function preview(){
var host=getTargetHost();
if(!host)return{count:0,knownBytes:0,knownTokens:0,entries:[],groups:[],preamble:'',missingIds:[]};
return ReferenceCollector.previewForLayer(targetLayer,hasSourceImage());
}
// 生成AI設定の並びに置いたボタンへ、今のコマの参照枚数を出す
function updateTriggerBadge(){
var badge=$('referenceSheetBadge');
if(!badge)return;
var count=preview().count;
badge.textContent=count?String(count):'';
badge.style.display=count?'inline-block':'none';
}
function formatBytes(bytes){
if(!bytes)return'';
if(bytes<1024*1024)return Math.round(bytes/1024)+' KB';
return(bytes/1024/1024).toFixed(2)+' MB';
}
// 出すのはトークン。**バイト数は課金にも上限にも直接効かない**（18MBの上限は
// 送信できるかどうかの内部チェックにだけ使う）。コマから取る画像は送るときに縮小するため
// ここでは大きさが分からない。分かっている分だけを出し、それ以外があることを「+」で示す
function formatTokens(tokens){
return'~'+String(tokens).replace(/\B(?=(\d\d\d)+$)/g,',');
}
function formatPreviewTokens(info){
if(!info.count)return'';
var unknown=info.entries.some(function(entry){return!entry.tokens;});
if(!info.knownTokens)return unknown?'+':'';
return formatTokens(info.knownTokens)+(unknown?' +':'');
}
function render(){
$('rsSearch').placeholder=i18next.t('refSearchPlaceholder');
referenceCanvasOverlay.syncCheckboxes();
syncViewButtons();
renderHeader();
renderHowto();
renderMissing();
renderSlots();
renderCards();
renderPreamble();
renderDeliveryNotice();
ReferenceGenerator.syncForm();
// バッジもここで更新する。付け外しのたびに呼び忘れると枚数の表示だけ古くなる
updateTriggerBadge();
referenceCanvasOverlay.update();
}
function renderHeader(){
var host=getTargetHost();
var label=$('rsTargetLabel');
if(host){
label.textContent=targetName();
label.classList.remove('rs-target-none');
}else{
label.textContent=i18next.t('refNoTarget');
label.classList.add('rs-target-none');
}
var info=preview();
var count=$('rsCount');
count.textContent=info.count+' / '+ReferenceCollector.MAX_IMAGES;
var size=$('rsSize');
size.textContent=formatPreviewTokens(info);
// バイト数は消さずにここへ落とす。送れるかどうかの目安として要る場面がある
size.title=i18next.t('refTokenTip',{size:formatBytes(info.knownBytes)||'-'});
// **送られない設定のときは数字を数字のまま出さない。**
// 枚数とトークンだけ出ていると、送られていると読める。理由はrsModelNoticeが出す
var undelivered=!!info.count&&!deliveryState().ok;
overlayEl.querySelector('.rs-bar').classList.toggle('is-undelivered',undelivered);
count.title=undelivered?i18next.t('refCountNotSent'):'';
}
// 「どうやって割り当てるのか」が分からないと、一覧を眺めたまま止まる。
// **手順の前に、何のための箱なのかを1行置く。** 手順だけ書いても、
// 資料を入れると何が変わるのかが分からないままタブを眺めて閉じることになる。
// 割り当て済みのコマでは出さない（用が済んだ案内を残すと本体が狭くなる）
function renderHowto(){
var row=$('rsHowto');
var host=getTargetHost();
var attached=host?ReferenceCollector.getAttachedIds(targetLayer).length:0;
if(host&&attached){
row.style.display='none';
return;
}
$('rsHowtoWhat').textContent=i18next.t('refHowtoWhat');
$('rsHowtoText').textContent=host
?i18next.t('refHowtoHasTarget',{name:targetName()})
:i18next.t('refHowtoNoTarget');
// 押して対象を選ぶ経路が読めなかった人のために、対象が無いときだけドラッグの手を出す。
// 対象が決まっている間は出さない（用が済んだ案内を残すと本体が狭くなる）
$('rsHowtoDrag').textContent=host?'':i18next.t('refHowtoDrag');
$('rsHowtoDrag').style.display=host?'none':'block';
row.style.display='flex';
}
// 実体の無い参照を黙って捨てない。別環境で開いたときにここで気づけるようにする
function renderMissing(){
var row=$('rsMissing');
row.textContent='';
var host=getTargetHost();
var missing=host?ReferenceCollector.resolveAttached(targetLayer).missingIds:[];
if(!missing.length){
row.style.display='none';
return;
}
var text=document.createElement('span');
text.textContent=i18next.t('refMissingSheets',{count:missing.length});
row.appendChild(text);
var button=document.createElement('button');
button.className='us-btn-s';
button.textContent=i18next.t('refMissingDrop');
button.addEventListener('click',function(){
ReferenceCollector.dropMissing(targetLayer);
commitHistoryDebounced();
render();
});
row.appendChild(button);
row.style.display='flex';
}
// ---- 送る順と関係（枠） ----
// **枠が関係そのもの。** 同じ枠に入れた資料どうしが関係し、枠の先頭が基準になる
// （「この刀はAさんのもの」）。送る順（Image N）は枠をまたいだ通し番号。
//
// 関係を別のセクションに分けると、同じサムネイルが上下2か所に並び、
// どちらを見て直せばいいのかが読めなくなる。順番も組もこの1か所で扱う
// 枠でもスロットでもない余白へ落としたぶんは、新しい枠として末尾へ。
// 「どこへ落とせばいいのか」を1px単位で当てさせない
function bindSlotAreaDrop(list){
if(slotAreaBound)return;
slotAreaBound=true;
list.addEventListener('dragover',function(event){
var payload=dragPayload();
if(!payload)return;
if(event.target!==list)return;
event.preventDefault();
event.dataTransfer.dropEffect=payload.type==='slot'?'move':'copy';
clearDropMarks();
// 行き先は「新しい枠」。受け口が光らないと、落ちたのか素通りしたのか分からない
var tile=list.querySelector('.rs-group-new');
if(tile)tile.classList.add('is-droptarget');
else list.classList.add('is-droptarget');
});
list.addEventListener('dragleave',function(event){
if(event.relatedTarget&&list.contains(event.relatedTarget))return;
clearDropMarks();
});
list.addEventListener('drop',function(event){
var payload=dragPayload();
if(!payload||event.target!==list)return;
event.preventDefault();
event.stopPropagation();
dropPayload(payload,-1,'');
});
}
function renderSlots(){
var list=$('rsSlots');
bindSlotAreaDrop(list);
list.textContent='';
var host=getTargetHost();
if(!host){
list.appendChild(buildSlotEmpty(i18next.t('refNoTarget')));
renderGroupNotice();
return;
}
var info=preview();
if(!info.count){
list.appendChild(buildSlotEmpty(i18next.t('refSlotsEmpty'),i18next.t('refSlotDropHint')));
renderGroupNotice();
return;
}
var positions={};
var entryById={};
info.entries.forEach(function(entry,index){
if(!entry.id)return;
positions[entry.id]=index+1;
entryById[entry.id]=entry;
});
// 元画像は枠に入れない。idを持たず、コマの中身そのものなので付け替えられない
var source=info.entries[0];
if(source&&source.role==='source')list.appendChild(buildSlot(source,1,'',false));
// 同じ資料を複数の枠で使うと、同じ番号のスロットが並ぶ。
// 何も言わないと「番号がずれている」と読まれるため、枠の数を数えて印を付ける
var shared={};
info.groups.forEach(function(group){
group.ids.forEach(function(id){
shared[id]=(shared[id]||0)+1;
});
});
info.groups.forEach(function(group,groupIndex){
list.appendChild(buildGroup(group,groupIndex,positions,entryById,shared));
});
// 1枚しか無いときに出しても、落として作る枠が今の枠と同じになる
if(Object.keys(entryById).length>1)list.appendChild(buildNewGroupTile());
renderGroupNotice();
}
// 空のときこそ受け口だと分かる必要がある。ここへ落として付けられることを、
// 空欄に文字で出す（ホバーしないと出ないツールチップでは気づけない）
function buildSlotEmpty(text,hint){
var el=document.createElement('div');
el.className='rs-slot-empty';
el.textContent=text;
if(!hint)return el;
var sub=document.createElement('span');
sub.className='rs-slot-empty-hint';
sub.textContent=hint;
el.appendChild(sub);
return el;
}
function slotLabel(entry){
if(entry.role==='source')return i18next.t('refSlotSource');
return entry.name||i18next.t('refSlotUnnamed');
}
// サムネイルが取れないときに枠だけ出すための1x1透明画像
const SLOT_PLACEHOLDER='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
function buildSlot(entry,position,sheetId,isAnchor,isShared){
var slot=document.createElement('div');
slot.className='rs-slot '+(sheetId?'is-draggable':'is-fixed')+(isAnchor?' is-anchor':'')+(isShared?' is-shared':'');
var tips=[slotLabel(entry)];
if(isAnchor)tips.push(i18next.t('refGroupAnchorTip'));
if(isShared)tips.push(i18next.t('refSlotShared'));
slot.title=tips.join('\n');
if(sheetId)slot.dataset.sheetId=sheetId;
var number=document.createElement('span');
number.className='rs-slot-index';
number.textContent=String(position);
slot.appendChild(number);
// 枠の中で誰に掛かるのかは基準の1枚で決まる。左端という位置だけでは、
// 枠が2つ並んだときにどちらの左端なのか読み違える
if(isAnchor){
var mark=document.createElement('span');
mark.className='rs-slot-anchor';
mark.textContent=i18next.t('refGroupAnchor');
slot.appendChild(mark);
}
var thumb=document.createElement('img');
thumb.className='rs-slot-thumb';
thumb.src=entry.thumbSrc||SLOT_PLACEHOLDER;
thumb.alt='';
// imgは既定でドラッグできる。掴んだのが画像だとスロットの並べ替えが始まらず、
// 代わりに画像そのもののドラッグ（ブラウザによってはファイル扱い）になる
thumb.draggable=false;
slot.appendChild(thumb);
if(!sheetId){
var label=document.createElement('span');
label.className='rs-slot-name is-fixed';
label.textContent=slotLabel(entry);
slot.appendChild(label);
return slot;
}
slot.appendChild(buildSlotName(slot,entry,sheetId));
var remove=document.createElement('button');
remove.className='rs-slot-remove';
remove.textContent='\u00d7';
remove.title=i18next.t('refSlotRemove');
// 抜くのは押した枠から。別の枠でも使っているときに全部消すと、
// 直したつもりのない枠まで変わる。どの枠にも無くなればコマから外れる
remove.addEventListener('click',function(){
ReferenceCollector.removeFromGroup(targetLayer,sheetId,groupIndexOfElement(slot));
commitHistoryDebounced();
render();
});
slot.appendChild(remove);
bindSlotDrag(slot,sheetId);
return slot;
}
// 取り込んだ直後の「ファイル名のままの名前」は、送る文面にそのまま載る。
// 直すために一覧まで目を移すことにならないよう、ここで直せるようにする
function buildSlotName(slot,entry,sheetId){
var name=document.createElement('input');
name.type='text';
name.className='rs-slot-name';
name.value=entry.name||'';
name.placeholder=i18next.t('refSlotUnnamed');
// **入力欄の上ではスロットのドラッグを止める。** 止めないと文字を選ぼうとしただけで
// ドラッグが始まり、名前を直せない（掴む場所はサムネイルと余白に残る）
name.addEventListener('mousedown',function(){
slot.draggable=false;
});
name.addEventListener('blur',function(){
slot.draggable=true;
});
name.addEventListener('input',function(){
applySlotName(sheetId,name.value);
});
return name;
}
// 名前を出している場所は作り直さずに当て直す（作り直すと打鍵中のフォーカスが飛ぶ）
function applySlotName(sheetId,value){
ReferenceSheetStore.updateProject(sheetId,{name:value});
var card=$('rsGrid').querySelector('.rs-card[data-id="'+sheetId+'"] [data-field="name"]');
if(card&&card!==document.activeElement)card.value=value;
renderPreamble();
referenceCanvasOverlay.refresh();
}
// 枠。2枚以上入っているときだけ関係として見せる（1枚だけの枠は「関係なし」）
function buildGroup(group,groupIndex,positions,entryById,shared){
var el=document.createElement('div');
var members=group.ids.filter(function(id){return entryById[id];});
var related=members.length>1;
el.className='rs-group'+(related?' is-linked':'');
el.dataset.groupIndex=String(groupIndex);
var slots=document.createElement('div');
slots.className='rs-group-slots';
members.forEach(function(id,index){
slots.appendChild(buildSlot(entryById[id],positions[id],id,related&&index===0,(shared[id]||0)>1));
});
el.appendChild(slots);
// プロンプトは関係のある枠だけに出す。1枚だけの枠にも出すと、
// 関係を付けていない資料の数だけ入力欄が並んで壁になる
if(related)el.appendChild(buildGroupPrompt(group,groupIndex,entryById[members[0]]));
bindGroupDrop(el,groupIndex);
return el;
}
// 枠の入力欄と、その枠から**実際に送られる1行**。
// 「同じ枠に入れた資料どうしが関係します」だけでは、関係を付けると何がどう変わるのかが読めない。
// 下端の「プロンプトに付く説明」は畳んであり、開くまで見えない。
// 組み立てはbuildPreamble()と同じgroupLineFor()を通す（別に作ると片方だけ直したときに食い違う）
function buildGroupPrompt(group,groupIndex,anchorEntry){
var wrap=document.createElement('div');
wrap.className='rs-group-foot';
var input=document.createElement('input');
input.type='text';
input.className='rs-group-prompt';
input.value=group.prompt||'';
input.placeholder=i18next.t('refGroupPromptPlaceholder',{name:slotLabel(anchorEntry)});
wrap.appendChild(input);
var line=document.createElement('div');
line.className='rs-group-line';
line.title=i18next.t('refGroupLineTip');
wrap.appendChild(line);
function syncLine(){
var info=preview();
line.textContent=ReferenceCollector.groupLineFor(info.entries,info.groups,groupIndex);
}
syncLine();
// 打鍵のたびに書き、**枠は作り直さない**（作り直すとフォーカスが飛ぶ）。
// 番号も並びも変わらないので、送る文面とキャンバス側だけ追従させる
input.addEventListener('input',function(){
ReferenceCollector.setGroupPrompt(targetLayer,groupIndex,input.value);
commitHistoryDebounced();
afterGroupPromptEdit();
syncLine();
});
return wrap;
}
// 空の枠は持てない（中身が0枚になった枠は畳まれる）ため、
// 「枠を作るボタン」ではなく「落とすと新しい枠になる受け口」を出す
function buildNewGroupTile(){
var tile=document.createElement('div');
tile.className='rs-group-new';
tile.textContent=i18next.t('refGroupNew');
tile.title=i18next.t('refGroupNewTip');
tile.addEventListener('dragover',function(event){
var payload=dragPayload();
if(!payload)return;
event.preventDefault();
event.dataTransfer.dropEffect=payload.type==='slot'?'move':'copy';
clearDropMarks();
tile.classList.add('is-droptarget');
});
tile.addEventListener('dragleave',function(){
tile.classList.remove('is-droptarget');
});
tile.addEventListener('drop',function(event){
var payload=dragPayload();
if(!payload)return;
event.preventDefault();
event.stopPropagation();
dropPayload(payload,-1,'');
});
return tile;
}
// 落とす先のしるしは1つだけ。消し忘れると、通り過ぎた枠が光ったまま残る
function clearDropMarks(){
var list=$('rsSlots');
list.classList.remove('is-droptarget');
list.querySelectorAll('.rs-slot,.rs-group,.rs-group-new').forEach(function(el){
el.classList.remove('is-dropbefore');
el.classList.remove('is-dropafter');
el.classList.remove('is-droptarget');
});
}
// 右半分に載せたら「その次」へ。左だけしか受けないと、
// 一番右へ足したいときに落とす場所が枠の細い余白しか無くなる
function isAfterHalf(event,el){
var rect=el.getBoundingClientRect();
return event.clientX>rect.left+rect.width/2;
}
function nextSlotId(slot){
var next=slot.nextElementSibling;
return next&&next.dataset?next.dataset.sheetId||'':'';
}
function groupIndexOfElement(el){
var group=el.closest('.rs-group');
return group?Number(group.dataset.groupIndex):-1;
}
// 一覧から直接落として付ける。**コマまで往復させない。**
// 付いていないものは付けてからその枠へ入れ、付いているものは枠を移すだけ
function dropCardIntoGroup(card,groupIndex,beforeId){
var host=getTargetHost();
if(!host){
createToastError(i18next.t('refWindowTitle'),i18next.t('refHowtoNoTarget'),4000);
return;
}
// 上限は複製する前に見る。複製してから止めると、どのコマにも付いていない複製だけが残る。
// ベースのカードはまだプロジェクトに無いので、必ず1枚増える
var attached=card.source==='project'&&ReferenceCollector.isAttached(targetLayer,card.entry.id);
var count=preview().count;
if(!attached&&count>=ReferenceCollector.MAX_IMAGES){
createToastError(i18next.t('refWindowTitle'),i18next.t('refErrorTooManyImages',{max:ReferenceCollector.MAX_IMAGES,count:count}),5000);
return;
}
var targetId=resolveTargetId(card);
ReferenceCollector.addToGroup(targetLayer,targetId,groupIndex,beforeId);
commitHistoryDebounced();
render();
}
// スロットの掴み直しと一覧からの持ち込みは、落とす先の受け口を共通にする。
// 別々に書くと、受け口を1つ足すたびに両方へ書き足すことになる
function dragPayload(){
if(draggingSheetId)return{type:'slot',id:draggingSheetId,from:draggingSheetFrom};
if(draggingCard)return{type:'card',card:draggingCard};
return null;
}
function dropPayload(payload,groupIndex,beforeId){
if(payload.type==='slot')dropIntoGroup(payload,groupIndex,beforeId);
else dropCardIntoGroup(payload.card,groupIndex,beforeId);
}
function dropIntoGroup(payload,groupIndex,beforeId){
// 落とした先で作り直すため、dragendが来ない場合に備えてここでも下ろす
draggingSheetId=null;
ReferenceCollector.moveToGroup(targetLayer,payload.id,payload.from,groupIndex,beforeId);
commitHistoryDebounced();
render();
}
// 掴んで動かす操作は1つだけ。**落とした先が意味を決める**
//   別のサムネイルの上 … その枠のその位置へ入る（左端へ落とせば基準になる）
//   枠の余白          … その枠の末尾へ入る
//   「新しい枠」      … 枠から出て1枚だけの枠になる
function bindSlotDrag(slot,sheetId){
slot.draggable=true;
slot.addEventListener('dragstart',function(event){
draggingSheetId=sheetId;
draggingSheetFrom=groupIndexOfElement(slot);
slot.classList.add('is-dragging');
event.dataTransfer.effectAllowed='move';
// 何かを入れないとFirefoxでドラッグが始まらない
event.dataTransfer.setData('text/plain',sheetId);
});
slot.addEventListener('dragend',function(){
draggingSheetId=null;
draggingSheetFrom=-1;
slot.classList.remove('is-dragging');
clearDropMarks();
});
function isSelf(payload){
return payload.type==='slot'&&payload.id===sheetId&&payload.from===groupIndexOfElement(slot);
}
slot.addEventListener('dragover',function(event){
var payload=dragPayload();
if(!payload||isSelf(payload))return;
event.preventDefault();
event.dataTransfer.dropEffect=payload.type==='slot'?'move':'copy';
clearDropMarks();
slot.classList.add(isAfterHalf(event,slot)?'is-dropafter':'is-dropbefore');
});
slot.addEventListener('dragleave',function(){
slot.classList.remove('is-dropbefore');
slot.classList.remove('is-dropafter');
});
slot.addEventListener('drop',function(event){
var payload=dragPayload();
if(!payload||isSelf(payload))return;
event.preventDefault();
// 枠側の受け口が続けて走ると、位置を指定したのに末尾へ入る
event.stopPropagation();
dropPayload(payload,groupIndexOfElement(slot),isAfterHalf(event,slot)?nextSlotId(slot):sheetId);
});
}
function bindGroupDrop(el,groupIndex){
el.addEventListener('dragover',function(event){
var payload=dragPayload();
if(!payload)return;
// サムネイルの上はスロット側が受ける（入る位置が変わる）
if(event.target.closest&&event.target.closest('.rs-slot'))return;
event.preventDefault();
event.dataTransfer.dropEffect=payload.type==='slot'?'move':'copy';
clearDropMarks();
el.classList.add('is-droptarget');
});
// dragleaveは中の要素をまたぐたびに飛ぶ。行き先が中なら消さない（消すと枠が点滅する）
el.addEventListener('dragleave',function(event){
if(event.relatedTarget&&el.contains(event.relatedTarget))return;
el.classList.remove('is-droptarget');
});
el.addEventListener('drop',function(event){
var payload=dragPayload();
if(!payload)return;
event.preventDefault();
event.stopPropagation();
dropPayload(payload,groupIndex,'');
});
}
// ---- 一覧 ----
// プロジェクトとベースを1つの一覧に混ぜる。ベースから複製済みのものは二重に出さない
function listEntries(){
var projectEntries=ReferenceSheetStore.getProjectAll().filter(function(entry){
return entry.category===activeCategory;
});
var copiedBaseIds=projectEntries.map(function(entry){return entry.copiedFromBaseId;}).filter(Boolean);
var baseEntries=ReferenceSheetStore.getBaseCached().filter(function(entry){
return entry.category===activeCategory&&copiedBaseIds.indexOf(entry.id)===-1;
});
var items=projectEntries.map(function(entry){
return{entry:entry,source:'project'};
}).concat(baseEntries.map(function(entry){
return{entry:entry,source:'base'};
}));
if(!searchText)return items;
return items.filter(function(item){
var haystack=((item.entry.name||'')+' '+(item.entry.note||'')).toLowerCase();
return haystack.indexOf(searchText)!==-1;
});
}
// 入力欄は常に出ているため、作り直しのたびに打鍵中のフォーカスが飛ぶ。
// 編集中かどうかをDOMに持たせず、idと項目名で取り直す
function captureFocus(){
var grid=$('rsGrid');
var el=document.activeElement;
if(!el||!grid.contains(el))return null;
var card=el.closest('.rs-card');
if(!card||!el.getAttribute('data-field'))return null;
return{
id:card.getAttribute('data-id'),
field:el.getAttribute('data-field'),
start:el.selectionStart,
end:el.selectionEnd
};
}
function restoreFocus(state){
if(!state)return;
var el=$('rsGrid').querySelector('.rs-card[data-id="'+state.id+'"] [data-field="'+state.field+'"]');
if(!el)return;
el.focus();
if(el.tagName==='INPUT'&&el.type==='text')el.setSelectionRange(state.start,state.end);
}
// 並んでいる顔ぶれが同じなら作り直さない。ウインドウは開きっぱなしで、
// キャンバスを1回押すたびにここへ来る。毎回作り直すとシートの枚数分だけ
// data:URLの画像を読み直すことになり、選択のたびに一覧がちらつく
function cardsSignatureOf(items){
return viewMode+'|'+activeCategory+'|'+searchText+'|'+items.map(function(item){
return item.source+':'+item.entry.id;
}).join(',');
}
function renderCards(){
var grid=$('rsGrid');
var items=listEntries();
var signature=cardsSignatureOf(items);
if(signature===cardsSignature){
updateCardStates(items);
return;
}
cardsSignature=signature;
var focusState=captureFocus();
grid.textContent='';
grid.classList.toggle('is-compact',viewMode==='compact');
grid.classList.toggle('is-list',viewMode==='list');
// 常に先頭へ置く。ドラッグを始める前に「ここに置ける」と分からないと気づけない
if(!searchText)grid.appendChild(buildAddTile(!items.length));
if(!items.length){
if(searchText)grid.appendChild(buildEmptyMessage());
return;
}
items.forEach(function(item){
grid.appendChild(buildCard(item));
});
updateCardStates(items);
restoreFocus(focusState);
}
// 付いているかどうかだけを当て直す。対象コマが変わるたびに走るのはここまで
function updateCardStates(items){
var grid=$('rsGrid');
var host=getTargetHost();
var attachedCount=preview().count;
items.forEach(function(item){
var card=grid.querySelector('.rs-card[data-id="'+item.entry.id+'"]');
if(card)applyCardState(card,item,host,attachedCount);
});
}
// 押せばファイル選択、ドロップ先でもある。一覧が空でも埋まっていても同じ場所に出す。
// 1枚も無いうちは一覧の幅いっぱいに広げる。カード1枚分の大きさのままだと、
// 開いた直後の広い空白の方が目に入り、そちらへ落として素通りする
function buildAddTile(wide){
var tile=document.createElement('div');
tile.className='rs-add-tile'+(wide?' is-wide':'');
tile.id='rsAddTile';
tile.setAttribute('role','button');
tile.tabIndex=0;
if(wide){
var lead=document.createElement('span');
lead.className='rs-add-lead';
lead.textContent=i18next.t('refEmptyCategory');
tile.appendChild(lead);
}
var icon=document.createElement('span');
icon.className='rs-add-icon';
icon.textContent='+';
tile.appendChild(icon);
var label=document.createElement('span');
label.className='rs-add-label';
label.textContent=i18next.t('refAddFromFile');
tile.appendChild(label);
var hint=document.createElement('span');
hint.className='rs-add-hint';
hint.textContent=i18next.t('refDropHere');
tile.appendChild(hint);
// 受け口はこのタイルだけではない。狙って当てるものだと思われないよう、
// 落とせる範囲を文字で出す
if(wide){
var sub=document.createElement('span');
sub.className='rs-add-sub';
sub.textContent=i18next.t('refDropAnywhere');
tile.appendChild(sub);
}
function pick(){$('rsFileInput').click();}
tile.addEventListener('click',pick);
tile.addEventListener('keydown',function(event){
if(event.key==='Enter'||event.key===' '){
event.preventDefault();
pick();
}
});
return tile;
}
// 絞り込んで0件のときだけ出す。絞り込みが無いときの空は追加タイル側が受け持つ
function buildEmptyMessage(){
var empty=document.createElement('div');
empty.className='rs-empty';
empty.textContent=i18next.t('refEmptySearch');
return empty;
}
function buildCard(item){
var card=document.createElement('div');
card.className='rs-card';
card.setAttribute('data-id',item.entry.id);
card.appendChild(buildThumbArea(item));
card.appendChild(buildCardBody(item));
return card;
}
// **ベースの資料を付けるとプロジェクトへ複製される。** idで参照し続けると、
// 共通のキャラ表を直したときに過去の巻の絵まで変わってしまうため。
// 黙って複製すると、共通側を直しても絵が変わらないのが不具合に見えるので、複製したことを出す。
// 複製の入口は3つ（カードのボタン・サムネイル・枠へのドロップ）あるので、ここ1か所へ集める
function resolveTargetId(item){
if(item.source==='project')return item.entry.id;
var copy=ReferenceSheetStore.copyBaseToProject(item.entry);
createToast(i18next.t('refWindowTitle'),i18next.t('refCopiedToProject',{name:item.entry.name||i18next.t('refSlotUnnamed')}),4000);
return copy.id;
}
// 付いているかどうかは押した時点で読み直す。組み立て時の値を持ち回ると、
// 作り直しをやめた分だけ古い状態のまま付け外しが走る
function currentAttached(item){
if(item.source!=='project')return false;
if(!getTargetHost())return false;
return ReferenceCollector.isAttached(targetLayer,item.entry.id);
}
// 付け外しはサムネイルとボタンの2か所から。ボタンは「何が起きるか」を文字で示すため、
// サムネイルは並べて何枚も付けるときに速いため。名前と説明の入力欄は当たり判定に入れない
function toggleAttach(item){
if(!getTargetHost())return;
var attached=currentAttached(item);
// 上限を超えて付けられないようにする。付けさせてから生成で失敗させるより手前で止める
if(!attached&&preview().count>=ReferenceCollector.MAX_IMAGES)return;
var targetId=resolveTargetId(item);
ReferenceCollector.toggleAttached(targetLayer,targetId,!attached);
commitHistoryDebounced();
render();
}
function buildThumbArea(item){
var entry=item.entry;
var wrap=document.createElement('div');
wrap.className='rs-thumb-wrap';
var thumb=document.createElement('img');
thumb.className='rs-thumb';
thumb.src=entry.dataUrl;
thumb.alt=entry.name||'';
// **imgの既定のドラッグを止める。** そのままだと掴んだのが画像そのものになり、
// Chromeはそれをファイルとして落とすためウインドウのドロップ口が反応して同じ絵が増える
thumb.draggable=false;
wrap.appendChild(thumb);
var badge=document.createElement('span');
badge.className='rs-source '+(item.source==='project'?'rs-source-project':'rs-source-base');
badge.textContent=i18next.t(item.source==='project'?'refSourceProject':'refSourceBase');
wrap.appendChild(badge);
var zoom=document.createElement('button');
zoom.className='rs-zoom';
zoom.innerHTML='<i class="material-icons">zoom_out_map</i>';
zoom.title=i18next.t('refZoom');
zoom.addEventListener('click',function(event){
event.stopPropagation();
openZoom(entry);
});
wrap.appendChild(zoom);
wrap.addEventListener('click',function(){
toggleAttach(item);
});
bindCardDrag(wrap,item);
return wrap;
}
// サムネイルをキャンバスのコマへ落として付けられるようにする。
// 対象コマを切り替えてからカードを押す2手を、落とすだけの1手にする経路。
// ロックしたコマ（selectable=false）は選択が付かないので、こちらも選択を通さず
// 落ちた位置からコマを引く（hitTestHost）。
// 掴めるのはサムネイルだけにする。カード全体をdraggableにすると、
// 常時出している名前・説明の入力欄で文字を選ぼうとしただけでドラッグが始まる
function bindCardDrag(wrap,item){
wrap.draggable=true;
wrap.addEventListener('dragstart',function(event){
draggingCard={entry:item.entry,source:item.source};
wrap.classList.add('is-dragging');
event.dataTransfer.effectAllowed='copy';
event.dataTransfer.setData(CARD_DRAG_MIME,item.entry.id);
// 何かを入れないとFirefoxでドラッグが始まらない
event.dataTransfer.setData('text/plain',item.entry.name||item.entry.id);
});
wrap.addEventListener('dragend',function(){
draggingCard=null;
wrap.classList.remove('is-dragging');
referenceCanvasOverlay.setDropHost(null);
});
}
function buildCardBody(item){
var entry=item.entry;
var isProject=item.source==='project';
var body=document.createElement('div');
body.className='rs-card-body';
body.appendChild(buildTextField('rs-card-name','name',entry.name,'refNamePlaceholder',isProject,entry.id));
body.appendChild(buildTextField('rs-card-note','note',entry.note,'refNotePlaceholder',isProject,entry.id));
body.appendChild(buildCardFoot(item));
body.appendChild(buildUseButton(item));
return body;
}
function buildTextField(className,field,value,placeholderKey,isProject,id){
var input=document.createElement('input');
input.type='text';
input.className=className;
input.setAttribute('data-field',field);
input.value=value||'';
input.placeholder=i18next.t(placeholderKey);
input.addEventListener('input',function(){
var patch={};
patch[field]=this.value;
applyEditLive(isProject,id,field,patch);
});
return input;
}
function buildCardFoot(item){
var entry=item.entry;
var isProject=item.source==='project';
var foot=document.createElement('div');
foot.className='rs-card-foot';
var select=document.createElement('select');
select.className='rs-card-cat';
select.title=i18next.t('refCategoryLabel');
ReferenceSheetStore.CATEGORIES.forEach(function(category){
var option=document.createElement('option');
option.value=category.id;
option.textContent=i18next.t(category.labelKey);
select.appendChild(option);
});
select.value=entry.category;
// 種類を変えると別のタブへ移る。一覧ごと作り直す
select.addEventListener('change',function(){
applyEdit(isProject,entry.id,{category:this.value});
});
foot.appendChild(select);
var meta=document.createElement('span');
meta.className='rs-card-meta';
meta.textContent=entry.width+'x'+entry.height+' '+formatTokens(ReferenceCollector.estimateImageTokens(entry.width,entry.height));
meta.title=i18next.t('refTokenTip',{size:formatBytes(entry.byteSize)||'-'});
foot.appendChild(meta);
var tools=document.createElement('span');
tools.className='rs-card-tools';
if(isProject&&!entry.copiedFromBaseId){
var toBase=document.createElement('button');
toBase.className='rs-icon-btn';
toBase.innerHTML='<i class="material-icons">library_add</i>';
toBase.title=i18next.t('refSendToBase');
toBase.addEventListener('click',function(){
ReferenceSheetStore.registerProjectToBase(entry.id).then(function(){
createToast(i18next.t('refWindowTitle'),i18next.t('refSentToBase'),3000);
render();
});
});
tools.appendChild(toBase);
}
var del=document.createElement('button');
del.className='rs-icon-btn';
del.innerHTML='<i class="material-icons">delete</i>';
del.title=i18next.t('refDelete');
del.addEventListener('click',function(){
if(isProject){
ReferenceSheetStore.removeFromProject(entry.id);
render();
}else{
ReferenceSheetStore.removeFromBase(entry.id).then(render);
}
});
tools.appendChild(del);
foot.appendChild(tools);
return foot;
}
// 割り当ての主操作。カード全体を当たり判定にすると、常時出している入力欄を
// 触っただけで付け外しが起きる。押す場所はサムネイルとこのボタンに限る
function buildUseButton(item){
var button=document.createElement('button');
button.className='rs-use-btn';
var icon=document.createElement('i');
icon.className='material-icons';
button.appendChild(icon);
button.appendChild(document.createElement('span'));
button.addEventListener('click',function(){
toggleAttach(item);
});
return button;
}
// 付いているかどうかで変わる見た目を1か所に集める。
// カードを作り直さずに済ませるため、組み立て側には状態を持たせない
function applyCardState(card,item,host,attachedCount){
var attached=!!(item.source==='project'&&host&&ReferenceCollector.isAttached(targetLayer,item.entry.id));
var blocked=!attached&&attachedCount>=ReferenceCollector.MAX_IMAGES;
card.classList.toggle('is-attached',attached);
card.classList.toggle('is-blocked',blocked);
var wrap=card.querySelector('.rs-thumb-wrap');
var mark=wrap.querySelector('.rs-check-mark');
if(attached&&!mark){
mark=document.createElement('span');
mark.className='rs-check-mark';
mark.textContent='✓';
wrap.appendChild(mark);
}else if(!attached&&mark){
mark.remove();
}
var disabledReason='';
if(!host)disabledReason=i18next.t('refHowtoNoTarget');
else if(blocked)disabledReason=i18next.t('refErrorTooManyImages',{max:ReferenceCollector.MAX_IMAGES,count:attachedCount});
var actionLabel=i18next.t(attached?'refRemoveFromPanel':'refUseInPanel');
wrap.title=disabledReason||actionLabel;
var button=card.querySelector('.rs-use-btn');
button.classList.toggle('is-on',attached);
button.disabled=!!disabledReason;
button.title=disabledReason||actionLabel;
button.querySelector('.material-icons').textContent=attached?'check_circle':'add_circle_outline';
button.querySelector('span').textContent=actionLabel;
}
// 名前・説明は打鍵のたびに書く。一覧は作り直さない（作り直すとフォーカスが飛ぶ）ので、
// 名前を出している「送る順」の帯とキャンバス側だけを追従させる
function applyEditLive(isProject,id,field,patch){
if(isProject)ReferenceSheetStore.updateProject(id,patch);
var key=id+':'+field;
if(editTimers[key])clearTimeout(editTimers[key]);
editTimers[key]=setTimeout(function(){
delete editTimers[key];
if(isProject){
afterEdit();
return;
}
ReferenceSheetStore.updateBase(id,patch).then(afterEdit);
},EDIT_WRITE_DELAY);
}
function afterEdit(){
renderSlots();
renderPreamble();
referenceCanvasOverlay.refresh();
}
// 枠のプロンプトを打っている最中は枠を作り直さない（作り直すとフォーカスが飛ぶ）。
// 番号も並びも変わらないので、実際に送る文面とキャンバス側だけを追従させる
function afterGroupPromptEdit(){
renderPreamble();
referenceCanvasOverlay.refresh();
}
function applyEdit(isProject,id,patch){
if(isProject){
ReferenceSheetStore.updateProject(id,patch);
render();
return;
}
ReferenceSheetStore.updateBase(id,patch).then(render);
}
// 実際に送る順番と同じ説明文を見せる。黙って足されるものを無くすため
function renderPreamble(){
if(!preambleOpen)return;
$('rsPreamble').value=preview().preamble;
}
// 説明文を切っていると関係は1文字も送られない。設定した本人には見えない差なので明示する
function renderGroupNotice(){
var notice=$('rsGroupNotice');
notice.textContent='';
var describe=$('referenceDescribeInPrompt');
if(!targetLayer||!ReferenceCollector.hasGroupRelations(targetLayer)||!describe||describe.checked){
notice.style.display='none';
return;
}
notice.textContent=i18next.t('refRelationDescribeOff');
notice.style.display='block';
}
function onDescribeChange(){
if(!isOpen())return;
renderGroupNotice();
renderPreamble();
}
// 付けた資料がどうなるのかを、コマを選んだ時点で出す。
// 出す理由は2段ある。**送られない**（対応していないサービス／ロールが未割り当て）と、
// **送られるが効かない**（選択中モデルが人物の一貫性に非対応など）。
// どちらも生成しても絵にも数字にも出ないため、出さなければ最後まで気づけない
function renderDeliveryNotice(){
var notice=$('rsModelNotice');
notice.textContent='';
notice.style.display='none';
var host=getTargetHost();
if(!host)return;
var attached=ReferenceCollector.resolveAttached(targetLayer).sheets;
if(!attached.length)return;
var messages=deliveryMessages(attached);
if(!messages.length)return;
messages.forEach(function(message){
var line=document.createElement('div');
line.textContent=message;
notice.appendChild(line);
});
notice.style.display='block';
}
function deliveryMessages(attached){
var delivery=deliveryState();
// 送られないのなら、モデルの対応まで言っても行き先が無い
if(!delivery.ok)return[delivery.message];
var provider=delivery.provider;
if(typeof provider.getModelId!=='function')return[];
var roleKey=activeRoleKey();
var modelId=provider.getModelId(roleKey);
if(!modelId)return[];
var support=provider.getReferenceSupport(roleKey);
if(support===null)return[i18next.t('refNoticeUnlistedModel',{model:modelId})];
var hasCharacter=attached.some(function(entry){return entry.category==='character';});
if(hasCharacter&&support.character===0)return[i18next.t('refNoticeNoCharacterRef',{model:modelId})];
return[];
}
// ---- ドラッグ&ドロップでの追加 ----
// dragenter/dragleaveは子要素をまたぐたびに飛ぶため、深さを数えないと点滅する
function categoryLabel(categoryId){
var category=ReferenceSheetStore.CATEGORIES.filter(function(c){return c.id===categoryId;})[0];
return category?i18next.t(category.labelKey):'';
}
function dropCategoryFor(event){
var tab=event.target&&event.target.closest?event.target.closest('.rs-tab'):null;
return tab?tab.getAttribute('data-category'):activeCategory;
}
function bindFileDrop(){
var window_=$('referenceSheetOverlay').querySelector('.rs-window');
var overlay=$('rsDropOverlay');
// ウインドウの中から始まったドラッグを追加として受けない。
// ブラウザは画像やカードのドラッグにもFilesを載せることがあり、
// それを取り込むと動かしただけで同じ絵が2枚になる
function isInternalDrag(event){
if(draggingCard||draggingSheetId)return true;
var types=event.dataTransfer&&event.dataTransfer.types;
return!!types&&Array.prototype.indexOf.call(types,CARD_DRAG_MIME)!==-1;
}
function hasFiles(event){
if(isInternalDrag(event))return false;
var types=event.dataTransfer&&event.dataTransfer.types;
return!!types&&Array.prototype.indexOf.call(types,'Files')!==-1;
}
// 何枚受け取るのかを落とす前に出す。まとめて掴めることが分からないと1枚ずつ入れることになる。
// dataTransfer.filesはdrop時まで読めないが、itemsの件数はdragover中でも読める
function draggedFileCount(event){
var items=event.dataTransfer&&event.dataTransfer.items;
if(!items)return 0;
var count=0;
for(var i=0;i<items.length;i++){
if(items[i].kind==='file')count++;
}
return count;
}
function setOverlayLabel(event){
var category=categoryLabel(dropCategoryFor(event));
var count=draggedFileCount(event);
overlay.textContent=count>1
?i18next.t('refDropIntoCount',{count:count,category:category})
:i18next.t('refDropInto',{category:category});
}
window_.addEventListener('dragenter',function(event){
if(!hasFiles(event))return;
event.preventDefault();
dragDepth++;
setOverlayLabel(event);
overlay.classList.add('active');
var tile=$('rsAddTile');
if(tile)tile.classList.add('is-dropactive');
});
window_.addEventListener('dragover',function(event){
if(!hasFiles(event))return;
event.preventDefault();
event.dataTransfer.dropEffect='copy';
setOverlayLabel(event);
});
window_.addEventListener('dragleave',function(event){
if(!hasFiles(event))return;
dragDepth=Math.max(0,dragDepth-1);
if(dragDepth)return;
overlay.classList.remove('active');
var tile=$('rsAddTile');
if(tile)tile.classList.remove('is-dropactive');
});
window_.addEventListener('drop',function(event){
if(!hasFiles(event))return;
event.preventDefault();
dragDepth=0;
overlay.classList.remove('active');
var tile=$('rsAddTile');
if(tile)tile.classList.remove('is-dropactive');
// カテゴリタブへ落とした場合はそのカテゴリへ入れる
var category=dropCategoryFor(event);
if(category!==activeCategory)switchTab(category);
addFromFiles(event.dataTransfer.files);
});
// タブへ落とせることが分かるように、上に来たら色を変える
window_.querySelectorAll('.rs-tab').forEach(function(tab){
tab.addEventListener('dragenter',function(event){
if(hasFiles(event))tab.classList.add('is-droptarget');
});
tab.addEventListener('dragleave',function(){
tab.classList.remove('is-droptarget');
});
tab.addEventListener('drop',function(){
tab.classList.remove('is-droptarget');
});
});
}
// ---- コマへ落として割り当てる ----
// ロックしたコマはクリックで選べず、対象コマにできない。ロックを外して付けて掛け直す、では
// コマ割りを固めた後の割り当てが回らないため、選択を通さずに付けられる経路を用意する
function canvasPointFromEvent(event){
var element=canvas.getElement();
var rect=element.getBoundingClientRect();
// このアプリはviewportTransformではなくCSSのtransform:scale()で拡大している
var scale=typeof getCanvasDisplayScale==='function'?getCanvasDisplayScale():1;
if(!scale)scale=1;
return{x:(event.clientX-rect.left)/scale,y:(event.clientY-rect.top)/scale};
}
// polygonのcontainsPointは外接矩形での判定になる。斜めのコマや台形では
// 枠の外に落としても当たってしまうため、頂点で取り直す
function polygonPoints(object){
if(object.type!=='polygon'||!Array.isArray(object.points))return null;
var matrix=object.calcTransformMatrix();
var offset=object.pathOffset||{x:0,y:0};
return object.points.map(function(point){
return fabric.util.transformPoint({x:point.x-offset.x,y:point.y-offset.y},matrix);
});
}
function isInsidePolygon(points,point){
var inside=false;
for(var i=0,j=points.length-1;i<points.length;j=i++){
var yi=points[i].y;
var yj=points[j].y;
if((yi>point.y)===(yj>point.y))continue;
var x=(points[j].x-points[i].x)*(point.y-yi)/(yj-yi)+points[i].x;
if(point.x<x)inside=!inside;
}
return inside;
}
function hitTest(object,point){
if(!object.containsPoint)return false;
if(!object.containsPoint(new fabric.Point(point.x,point.y)))return false;
var polygon=polygonPoints(object);
return polygon?isInsidePolygon(polygon,point):true;
}
// コマの中に画像が入っていてもコマへ付ける。割り当てはコマ枠に持たせているので、
// 枠内の画像を差し替えても設定が残る
function hitTestHost(point){
var objects=canvas.getObjects();
var panel=null;
var other=null;
for(var i=objects.length-1;i>=0;i--){
var object=objects[i];
if(object.excludeFromExport||object.visible===false)continue;
if(!hitTest(object,point))continue;
if(isPanel(object)){
if(!panel)panel=object;
continue;
}
if(!other)other=object;
}
if(panel)return panel;
return other?ReferenceCollector.getReferenceHost(other):null;
}
function hostName(host){
if(!host)return'';
return host.name||(isPanel(host)?i18next.t('refTargetPanel'):i18next.t('refTargetLayer'));
}
function sheetName(entry){
return entry.name||i18next.t('refSlotUnnamed');
}
function dropCardOnHost(host,card){
if(!host){
createToastError(i18next.t('refWindowTitle'),i18next.t('refDropNoPanel'),4000);
return;
}
// ベースのカードは複製されるまでプロジェクトに無いので、付いていることはない
if(card.source==='project'&&ReferenceCollector.isAttached(host,card.entry.id)){
createToast(i18next.t('refWindowTitle'),i18next.t('refDropAlreadyAttached',{sheet:sheetName(card.entry),name:hostName(host)}),3000);
setTargetHost(host);
return;
}
// 上限は複製する前に見る。複製してから止めると、どのコマにも付いていない複製だけが残る
var count=ReferenceCollector.previewForLayer(host,hostHasSourceImage(host)).count;
if(count>=ReferenceCollector.MAX_IMAGES){
createToastError(i18next.t('refWindowTitle'),i18next.t('refErrorTooManyImages',{max:ReferenceCollector.MAX_IMAGES,count:count}),5000);
return;
}
var targetId=resolveTargetId(card);
ReferenceCollector.toggleAttached(host,targetId,true);
commitHistoryDebounced();
setTargetHost(host);
createToast(i18next.t('refWindowTitle'),i18next.t('refDropAttached',{sheet:sheetName(card.entry),name:hostName(host)}),3000);
}
function bindCanvasDrop(){
if(typeof canvas==='undefined'||!canvas||!canvas.wrapperEl)return;
var wrapper=canvas.wrapperEl;
wrapper.addEventListener('dragover',function(event){
if(!draggingCard)return;
event.preventDefault();
event.dataTransfer.dropEffect='copy';
referenceCanvasOverlay.setDropHost(hitTestHost(canvasPointFromEvent(event)));
});
// dragleaveは子要素へ移るたびに飛ぶ。行き先が中なら消さない（消すと枠が点滅する）
wrapper.addEventListener('dragleave',function(event){
if(!draggingCard)return;
if(event.relatedTarget&&wrapper.contains(event.relatedTarget))return;
referenceCanvasOverlay.setDropHost(null);
});
wrapper.addEventListener('drop',function(event){
if(!draggingCard)return;
event.preventDefault();
// #canvas-containerのdropは画像ファイルが来る前提で読む。ここで止めないと素通りする
event.stopPropagation();
var card=draggingCard;
draggingCard=null;
referenceCanvasOverlay.setDropHost(null);
dropCardOnHost(hitTestHost(canvasPointFromEvent(event)),card);
});
}
function readFileAsDataUrl(file){
return new Promise(function(resolve,reject){
var reader=new FileReader();
reader.onload=function(){resolve(reader.result);};
reader.onerror=function(){reject(new Error('file read failed'));};
reader.readAsDataURL(file);
});
}
function readFileAsText(file){
return new Promise(function(resolve,reject){
var reader=new FileReader();
reader.onload=function(){resolve(reader.result);};
reader.onerror=function(){reject(new Error('file read failed'));};
reader.readAsText(file);
});
}
// 追加先はベース。作品をまたいで使い回せる場所へ置き、コマに付けた時点でプロジェクトへ複製される
async function addFromFiles(files){
if(!files||!files.length)return;
var added=0;
for(var i=0;i<files.length;i++){
var file=files[i];
if(file.type&&file.type.indexOf('image/')!==0){
createToastError(i18next.t('refWindowTitle'),i18next.t('refErrorNotImage',{name:file.name}),6000);
continue;
}
try{
var dataUrl=await readFileAsDataUrl(file);
await ReferenceSheetStore.addToBase({
name:file.name.replace(/\.[^.]+$/,''),
category:activeCategory,
dataUrl:dataUrl
});
added++;
}catch(e){
createToastError(i18next.t('refWindowTitle'),file.name+': '+(e.message||''),6000);
}
}
if(added)createToast(i18next.t('refWindowTitle'),i18next.t('refAdded',{count:added}),2500);
render();
}
// 生成できたコマをそのままシートへ入れる経路。外で素材を用意しなくても回せるようにする
async function addFromSelectedLayer(){
var layer=canvas.getActiveObject();
var source=null;
if(layer&&isPanel(layer))source=ReferenceCollector.findPanelImage(layer);
else if(layer&&layer.type==='image')source=layer;
if(!source){
createToastError(i18next.t('refWindowTitle'),i18next.t('refErrorNoLayerImage'),5000);
return;
}
try{
await ReferenceSheetStore.addToBase({
name:source.name||'',
category:activeCategory,
dataUrl:imageObject2Base64ImageEffectKeep(source)
});
createToast(i18next.t('refWindowTitle'),i18next.t('refAdded',{count:1}),2500);
render();
}catch(e){
createToastError(i18next.t('refWindowTitle'),e.message||'',6000);
}
}
// ベースはブラウザ側にしかないため、書き出せないと初期化で消える
function exportBase(){
var blob=new Blob([ReferenceSheetStore.exportBase()],{type:'application/json'});
var url=URL.createObjectURL(blob);
var a=document.createElement('a');
a.href=url;
a.download='DESU-ReferenceSheets.json';
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
URL.revokeObjectURL(url);
}
async function importBase(files){
if(!files||!files.length)return;
try{
var added=await ReferenceSheetStore.importBase(await readFileAsText(files[0]));
createToast(i18next.t('refWindowTitle'),i18next.t('refImported',{count:added}),3000);
render();
}catch(e){
createToastError(i18next.t('refWindowTitle'),e.message||'',6000);
}
}
// ウインドウを開かなくてもボタンの枚数バッジが動くよう、起動時から選択を見張る
document.addEventListener('DOMContentLoaded',function(){
overlayEl=$('referenceSheetOverlay');
loadPlacement();
bindEvents();
ReferenceSheetStore.getBaseAll().then(refreshTarget);
// 言語切替のあと、案内文・スロット・カードが前の言語のまま残っていた。
// updateContent()は[data-i18n]の付いた静的な要素しか見ないため、
// ここでJSが組み立てた文言をまとめて作り直す。
// 個々の代入にdata-i18nを撒くと文言を足すたびに書き漏れるので、入口はこの1か所に置く
i18next.on('languageChanged',function(){
// 顔ぶれが同じでもカードの文言は変わる。作り直しの判定を捨ててから描き直す
cardsSignature='';
if(isOpen())render();
});
});
return{
open:open,
close:close,
toggle:toggle,
refresh:render,
getActiveCategory:function(){return activeCategory;},
isOpen:isOpen,
switchTab:switchTab,
switchView:switchView,
onSearchInput:onSearchInput,
toggleCollapse:toggleCollapse,
togglePreamble:togglePreamble,
onShowOnCanvasChange:onShowOnCanvasChange,
closeZoom:closeZoom,
refreshTarget:refreshTarget,
setTargetHost:setTargetHost,
onDescribeChange:onDescribeChange,
addFromFiles:addFromFiles,
addFromSelectedLayer:addFromSelectedLayer,
exportBase:exportBase,
importBase:importBase
};
})();
