// コマに紐づく参照画像を集める。
// Gemini側に「どの画像が何なのか」を伝えるフィールドは無く、公式の作例も
// 「the first image」「the second image」と順番でプロンプトから指している。
// そのため、送る順とプロンプトに付ける説明の順を必ず一致させる
var ReferenceCollector=(function(){
// Gemini 3画像モデルが混ぜられるリファレンスの上限。編集元画像も1枚として数える
const REFERENCE_MAX_IMAGES=14;
// リクエスト全体で20MBが上限。プロンプトとJSONの分を残して手前で止める
const REFERENCE_MAX_PAYLOAD_BYTES=18*1024*1024;
// 画像入力のトークン。Geminiのドキュメントの数え方に合わせてある
// （384px以下は258、それ以上はfloor(短辺/1.5)のタイルに割って1枚258）。
// **ドキュメント自身が「roughly」と書いており、境界の丸め方は公開されていない。**
// そのため画面には目安として出す（バイト数を出しても、課金も上限もトークンで決まる）
const REFERENCE_TOKENS_PER_TILE=258;
const REFERENCE_SMALL_EDGE=384;
// 説明文に使う役割名。タグではなく画像の役割を示す構造的なラベル
const REFERENCE_ROLE_LABELS={
source:'base image to edit',
character:'character reference',
background:'background and location reference',
prop:'object reference',
other:'reference'
};
function estimateImageTokens(width,height){
if(!width||!height)return 0;
if(width<=REFERENCE_SMALL_EDGE&&height<=REFERENCE_SMALL_EDGE)return REFERENCE_TOKENS_PER_TILE;
var unit=Math.floor(Math.min(width,height)/1.5);
if(unit<1)return REFERENCE_TOKENS_PER_TILE;
return Math.ceil(width/unit)*Math.ceil(height/unit)*REFERENCE_TOKENS_PER_TILE;
}
// コマ枠に置く。枠内の画像を差し替えても設定が残るようにするため
function getReferenceHost(layer){
if(!layer)return null;
if(isPanel(layer))return layer;
if(layer.relatedPoly)return layer.relatedPoly;
return layer;
}
// ---- 割り当てと関係（枠） ----
// **同じ枠に入れた資料どうしが関係する。** 枠は`[{ids:[...],prompt:''},...]`。
// 枠の先頭が基準で、残りはそれに掛かる（「この刀はAさんのもの」）。
//
// **送る順も枠の並びが正。** 枠をまたいで前から数えたものが説明文のImage Nになる。
// 順番と組を別々に持つと、片方だけ直したときに食い違って原因が追えなくなるため、
// `referenceIds`は枠から作り直す（保存とレイヤーパネルの枚数はこれを見る）
function getAttachedIds(layer){
return flattenGroups(getGroups(layer));
}
function flattenGroups(groups){
var ids=[];
groups.forEach(function(group){
group.ids.forEach(function(id){
if(ids.indexOf(id)===-1)ids.push(id);
});
});
return ids;
}
// 保存されている生のid。**ここで存在チェックをしない。**
// シートの読み込みが終わる前にフィルタすると、付け外しの書き戻しで他の割り当てまで消える
function storedIds(host){
if(!host||!Array.isArray(host.referenceIds))return[];
return host.referenceIds.slice();
}
// 枠に入っていないidは1枚だけの枠にする（付けた資料は必ずどこかの枠にある）。
// 枠に残っている「もう付いていないid」は落とす。空になった枠は残さない。
//
// **同じ資料を複数の枠に入れられる。** 「Aさんとラーメン」「Bさんとラーメン」を
// 別々に言えないと、人物ごとの持ち物を伝える手が無くなる。
// 同じ枠の中だけは重複させない（同じ組に同じ絵を2回入れても意味が増えない）
function normalizeGroups(raw,ids){
var covered={};
var out=[];
(raw||[]).forEach(function(group){
if(!group||!Array.isArray(group.ids))return;
var seen={};
var members=[];
group.ids.forEach(function(id){
if(!id||seen[id]||ids.indexOf(id)===-1)return;
seen[id]=true;
covered[id]=true;
members.push(id);
});
if(!members.length)return;
out.push({ids:members,prompt:typeof group.prompt==='string'?group.prompt:''});
});
ids.forEach(function(id){
if(covered[id])return;
covered[id]=true;
out.push({ids:[id],prompt:''});
});
return out;
}
// 枠を持たない古い保存を読み替える。関係先が同じものを1つの枠にまとめ、
// メモは枠のプロンプトへ移す。読み替えないと前に付けた関係が黙って消える
function groupsFromLinks(host,ids){
var links=host.referenceLinks&&typeof host.referenceLinks==='object'?host.referenceLinks:{};
var groupOf={};
var out=[];
ids.forEach(function(id){
var link=links[id];
var anchor=link&&link.to&&ids.indexOf(link.to)!==-1?link.to:id;
var group=groupOf[anchor];
if(!group){
group={ids:[anchor],prompt:''};
groupOf[anchor]=group;
out.push(group);
}
if(group.ids.indexOf(id)===-1)group.ids.push(id);
var note=link&&link.note?String(link.note).trim():'';
if(note&&!group.prompt)group.prompt=note;
});
return out;
}
function getGroups(layer){
var host=getReferenceHost(layer);
if(!host)return[];
var ids=storedIds(host);
var raw=Array.isArray(host.referenceGroups)?host.referenceGroups:groupsFromLinks(host,ids);
return normalizeGroups(raw,ids);
}
// **書き込みはここ1か所。** 枠・送る順・レイヤーパネルの枚数を同時に合わせる
function setGroups(layer,groups){
var host=getReferenceHost(layer);
if(!host)return;
var ids=[];
var next=[];
(groups||[]).forEach(function(group){
if(!group||!Array.isArray(group.ids))return;
var seen={};
var members=[];
group.ids.forEach(function(id){
if(!id||seen[id])return;
seen[id]=true;
members.push(id);
// **送る順は重複を持たない。** 同じ資料を2つの枠で使っても送る画像は1枚で、
// 説明文が「Image 3はImage 1と一緒」「Image 3はImage 2と一緒」の2行になる
if(ids.indexOf(id)===-1)ids.push(id);
});
// 空になった枠は残さない
if(!members.length)return;
// 1枚に減った枠の文面は捨てる。持ったままにすると入力欄から消えたまま残り、
// 次に別の資料を入れたときに前の関係の文が黙って付いてくる
var prompt=members.length>1&&typeof group.prompt==='string'?group.prompt:'';
next.push({ids:members,prompt:prompt});
});
host.referenceGroups=next;
host.referenceIds=ids;
// 読み替え済みの古い形は消す。残すと次に読んだとき古い関係が復活する
if(host.referenceLinks)delete host.referenceLinks;
// レイヤーパネルの枚数もここで更新する。付け外しの入口ごとに書くと足し忘れる
updateLayerPanel();
}
function copyGroups(groups){
return groups.map(function(group){
return{ids:group.ids.slice(),prompt:group.prompt};
});
}
function getGroupIndexOf(layer,id){
var groups=getGroups(layer);
for(var i=0;i<groups.length;i++){
if(groups[i].ids.indexOf(id)!==-1)return i;
}
return-1;
}
// beforeIdの手前に入れ、beforeIdが無ければ末尾。groupIndexが-1なら新しい枠を末尾に作る
function insertIntoGroup(groups,id,groupIndex,beforeId){
var target=groupIndex>=0&&groupIndex<groups.length?groups[groupIndex]:null;
if(!target){
groups.push({ids:[id],prompt:''});
return;
}
// 同じ枠に既に入っているなら位置を変えるだけ
var exist=target.ids.indexOf(id);
if(exist!==-1)target.ids.splice(exist,1);
var at=beforeId&&beforeId!==id?target.ids.indexOf(beforeId):-1;
if(at===-1)target.ids.push(id);
else target.ids.splice(at,0,id);
}
// スロットを掴んで**移す**とき。fromGroupIndexの枠からだけ抜く。
// 全部の枠から抜くと、同じ資料を使っている隣の枠まで一緒に壊れる
function moveToGroup(layer,id,fromGroupIndex,groupIndex,beforeId){
var groups=copyGroups(getGroups(layer));
if(fromGroupIndex>=0&&groups[fromGroupIndex]){
var at=groups[fromGroupIndex].ids.indexOf(id);
if(at!==-1)groups[fromGroupIndex].ids.splice(at,1);
}else{
groups.forEach(function(group){
var index=group.ids.indexOf(id);
if(index!==-1)group.ids.splice(index,1);
});
}
insertIntoGroup(groups,id,groupIndex,beforeId);
setGroups(layer,groups);
}
// 一覧から落として**足す**とき。他の枠からは外さない（同じ資料を複数の枠で使えるようにする）。
// まだ付いていない資料もここで付く（送る順は枠から作り直すため）
function addToGroup(layer,id,groupIndex,beforeId){
var groups=copyGroups(getGroups(layer));
insertIntoGroup(groups,id,groupIndex,beforeId);
setGroups(layer,groups);
}
// スロットの×。その枠から抜くだけ。どの枠にも無くなればコマから外れる
function removeFromGroup(layer,id,groupIndex){
var groups=copyGroups(getGroups(layer));
if(groupIndex>=0&&groups[groupIndex]){
var at=groups[groupIndex].ids.indexOf(id);
if(at!==-1)groups[groupIndex].ids.splice(at,1);
}
setGroups(layer,groups);
}
// いくつの枠で使われているか。2つ以上なら同じ番号のスロットが並ぶことになるので、
// 画面側でその旨を出す
function groupCountOf(layer,id){
return getGroups(layer).filter(function(group){
return group.ids.indexOf(id)!==-1;
}).length;
}
// 打鍵のたびに呼ぶ。枠の並びは変わらないので、送る順とレイヤーパネルは触らない
function setGroupPrompt(layer,groupIndex,text){
var host=getReferenceHost(layer);
if(!host)return;
if(!Array.isArray(host.referenceGroups))setGroups(layer,getGroups(layer));
var group=host.referenceGroups[groupIndex];
if(!group)return;
group.prompt=text||'';
}
// 1枚だけの枠は関係を持たない。説明文にも出ない
function hasGroupRelations(layer){
return getGroups(layer).some(function(group){return group.ids.length>1;});
}
// 生きているシートと、実体が見つからないidを分けて返す。
// 見つからないものを黙って捨てると、参照が抜けたまま課金して生成される
function resolveAttached(layer){
var sheets=[];
var missingIds=[];
getAttachedIds(layer).forEach(function(id){
var sheet=ReferenceSheetStore.getProjectById(id);
if(sheet)sheets.push(sheet);
else missingIds.push(id);
});
return{sheets:sheets,missingIds:missingIds};
}
function isAttached(layer,id){
return getAttachedIds(layer).indexOf(id)!==-1;
}
// 付けたものは1枚だけの新しい枠に入る。既存の枠へ勝手に混ぜると、
// 付けただけで関係が付いたことになる
function toggleAttached(layer,id,on){
var groups=copyGroups(getGroups(layer));
if(on){
if(getGroupIndexOf(layer,id)===-1)groups.push({ids:[id],prompt:''});
}else{
groups.forEach(function(group){
var at=group.ids.indexOf(id);
if(at!==-1)group.ids.splice(at,1);
});
}
setGroups(layer,groups);
}
function dropMissing(layer){
var resolved=resolveAttached(layer);
if(!resolved.missingIds.length)return 0;
var alive={};
resolved.sheets.forEach(function(sheet){alive[sheet.id]=true;});
setGroups(layer,getGroups(layer).map(function(group){
return{ids:group.ids.filter(function(id){return alive[id];}),prompt:group.prompt};
}));
return resolved.missingIds.length;
}
// コマ枠に入っている画像。差し替えを繰り返すと複数残ることがあるため最後のものを使う
function findPanelImage(panel){
if(!panel||!Array.isArray(panel.guids)||!panel.guids.length)return null;
var objects=canvas.getObjects();
var found=null;
for(var i=0;i<objects.length;i++){
var object=objects[i];
if(object.type!=='image')continue;
if(panel.guids.indexOf(object.guid)!==-1)found=object;
}
return found;
}
function describe(entry,position){
var role=REFERENCE_ROLE_LABELS[entry.role]||REFERENCE_ROLE_LABELS.other;
var line='Image '+position+': '+role;
var name=(entry.name||'').trim();
if(name)line+=' - '+name;
var note=(entry.note||'').trim();
if(note)line+=' ('+note+')';
return line;
}
// 枠の関係は画像ごとの行に混ぜず、1枠1行で後ろにまとめる。
// 画像ごとの行に入れると、3枚組では同じ関係が3回出て何が主語なのか読めなくなる。
// 指す先は番号（公式の作例が「the first image」と順番で指す方式のため）。
// 番号は組み立てのたびに数え直すので、並べ替えても指す先がずれない
function groupText(group,positions,names){
var members=group.ids.filter(function(id){return positions[id];});
// 1枚だけの枠は関係を持たない。送られない並びになっている分も番号を作らない
if(members.length<2)return'';
var anchor=members[0];
// 基準は「相手」として1回だけ出す。並びに基準を混ぜると同じ番号が2回出る
var text=members.slice(1).map(function(id){return'Image '+positions[id];}).join(', ')
+': shown together with Image '+positions[anchor];
var name=(names[anchor]||'').trim();
if(name)text+=' - '+name;
var prompt=(group.prompt||'').trim();
if(prompt)text+=' ('+prompt+')';
return text;
}
// 枠1つぶんの、実際に送られる行。**画面に出すのは組み立てたものそのもの。**
// 「関係します」とだけ書いても、関係を付けると何がどう送られるのかは読めない。
// buildPreamble()と同じgroupText()を通す（別に組み立てると、片方だけ直したときに食い違う）
function groupLineFor(entries,groups,groupIndex){
var group=(groups||[])[groupIndex];
if(!group)return'';
var positions={};
var names={};
(entries||[]).forEach(function(entry,i){
if(!entry.id)return;
positions[entry.id]=i+1;
names[entry.id]=(entry.name||'').trim();
});
return groupText(group,positions,names);
}
function buildPreamble(entries,groups){
var positions={};
var names={};
entries.forEach(function(entry,i){
if(!entry.id)return;
positions[entry.id]=i+1;
names[entry.id]=(entry.name||'').trim();
});
var lines=entries.map(function(entry,i){
return describe(entry,i+1);
});
(groups||[]).forEach(function(group){
var text=groupText(group,positions,names);
if(text)lines.push(text);
});
return lines.join('\n');
}
function splitDataUrl(dataUrl){
var match=/^data:([^;,]+);base64,(.*)$/.exec(dataUrl||'');
if(!match)return null;
return{mimeType:match[1],base64:match[2]};
}
// このコマが参照するシートのid。プロジェクトファイルへ同梱する対象を決めるのに使う
function collectUsedSheetIds(){
var ids=[];
canvas.getObjects().forEach(function(object){
if(!Array.isArray(object.referenceIds))return;
object.referenceIds.forEach(function(id){
if(ids.indexOf(id)===-1)ids.push(id);
});
});
return ids;
}
// 送信する画像を順番どおりに組み立てる。sourceDataUrlがあれば必ず1枚目に置く
async function collectForLayer(layer,options){
var opts=options||{};
var entries=[];
if(opts.sourceDataUrl){
entries.push({role:'source',dataUrl:opts.sourceDataUrl,name:'',note:''});
}
var resolved=resolveAttached(layer);
// 実体の無い参照を飛ばして生成しない。付けたつもりの参照が抜けた絵に課金させないため
if(resolved.missingIds.length){
throw new Error(i18next.t('refErrorMissingSheets',{count:resolved.missingIds.length}));
}
resolved.sheets.forEach(function(sheet){
entries.push({id:sheet.id,role:sheet.category,dataUrl:sheet.dataUrl,name:sheet.name,note:sheet.note,normalized:true});
});
var groups=getGroups(layer);
if(entries.length>REFERENCE_MAX_IMAGES){
throw new Error(i18next.t('refErrorTooManyImages',{max:REFERENCE_MAX_IMAGES,count:entries.length}));
}
var blocks=[];
var totalBytes=0;
for(var k=0;k<entries.length;k++){
var entry=entries[k];
// シート画像は登録時に縮小済み。コマから取った画像は原寸の2倍で出てくるためここで縮める
var dataUrl=entry.normalized?entry.dataUrl:(await ReferenceSheetStore.normalizeImage(entry.dataUrl)).dataUrl;
var parts=splitDataUrl(dataUrl);
if(!parts)throw new Error(i18next.t('googleImageSourceReadFailed'));
totalBytes+=ReferenceSheetStore.dataUrlByteSize(dataUrl);
blocks.push({type:'image',mime_type:parts.mimeType,data:parts.base64});
}
if(totalBytes>REFERENCE_MAX_PAYLOAD_BYTES){
throw new Error(i18next.t('refErrorPayloadTooLarge',{mb:(totalBytes/1024/1024).toFixed(1)}));
}
return{
blocks:blocks,
entries:entries,
preamble:buildPreamble(entries,groups),
totalBytes:totalBytes
};
}
// スロットに出す小さなサムネイル。fabricが持っている画像要素のsrcをそのまま使い、
// プレビューのために画像を作り直さない（描き直すと再描画のたびに重くなる）
function layerThumbSrc(imageObject){
return imageObject&&imageObject._element?imageObject._element.src:'';
}
// 設定ウインドウのプレビュー用。実際に送る画像は作らず、行数と説明だけを組み立てる
function previewForLayer(layer,hasSource){
var entries=[];
var host=getReferenceHost(layer);
if(hasSource){
var sourceImage=host&&isPanel(host)?findPanelImage(host):host;
entries.push({role:'source',name:'',note:'',thumbSrc:layerThumbSrc(sourceImage)});
}
var resolved=resolveAttached(layer);
resolved.sheets.forEach(function(sheet){
entries.push({id:sheet.id,role:sheet.category,name:sheet.name,note:sheet.note,byteSize:sheet.byteSize,
tokens:estimateImageTokens(sheet.width,sheet.height),thumbSrc:sheet.dataUrl});
});
var groups=getGroups(layer);
var bytes=entries.reduce(function(sum,entry){return sum+(entry.byteSize||0);},0);
// コマから取る画像は送るときに縮小するため、ここでは大きさが分からない。
// 分かっている分だけ足し、残りがあることは呼び出し側が「+」で示す
var tokens=entries.reduce(function(sum,entry){return sum+(entry.tokens||0);},0);
return{
entries:entries,
groups:groups,
preamble:buildPreamble(entries,groups),
count:entries.length,
knownBytes:bytes,
knownTokens:tokens,
missingIds:resolved.missingIds
};
}
return{
MAX_IMAGES:REFERENCE_MAX_IMAGES,
estimateImageTokens:estimateImageTokens,
getReferenceHost:getReferenceHost,
getAttachedIds:getAttachedIds,
resolveAttached:resolveAttached,
dropMissing:dropMissing,
isAttached:isAttached,
toggleAttached:toggleAttached,
getGroups:getGroups,
setGroups:setGroups,
getGroupIndexOf:getGroupIndexOf,
groupCountOf:groupCountOf,
moveToGroup:moveToGroup,
addToGroup:addToGroup,
removeFromGroup:removeFromGroup,
setGroupPrompt:setGroupPrompt,
hasGroupRelations:hasGroupRelations,
groupLineFor:groupLineFor,
findPanelImage:findPanelImage,
collectUsedSheetIds:collectUsedSheetIds,
collectForLayer:collectForLayer,
previewForLayer:previewForLayer
};
})();

// プロジェクトファイルとのやり取り。フォント（project-font.js）と同じ形にしてある
function buildProjectReferenceData(){
return ReferenceSheetStore.buildProjectData(ReferenceCollector.collectUsedSheetIds());
}
function setProjectReferenceData(list){
ReferenceSheetStore.setProjectData(list);
if(typeof referenceSheetWindow!=='undefined')referenceSheetWindow.refreshTarget();
}
