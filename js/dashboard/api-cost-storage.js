// 外部API（APIキーが要るサービス）のトークン利用量と推定料金のlocalforage永続化
var ApiCostStorage=(function(){
var store=localforage.createInstance({
name:'MangaEditor_Performance',
storeName:'apiCostStats',
});
function getKey(providerId,modelId){
return'cost_'+providerId+'_'+modelId;
}
function getDefaultEntry(providerId,providerName,modelId){
return{
providerId:providerId,
providerName:providerName,
modelId:modelId,
calls:0,
promptTokens:0,
cachedTokens:0,
imageTokens:0,
completionTokens:0,
costUsd:0,
unpricedCalls:0,
lastUsed:null,
};
}
// costUsdがnullの呼び出しは単価が取得できなかったもの。0円として足し込まずunpricedCallsで数える
async function recordUsage(usage){
try{
if(!usage||!usage.providerId||!usage.modelId)return null;
var key=getKey(usage.providerId,usage.modelId);
var entry=(await store.getItem(key))||getDefaultEntry(usage.providerId,usage.providerName,usage.modelId);
entry.providerName=usage.providerName||entry.providerName;
entry.calls+=1;
entry.promptTokens+=usage.promptTokens||0;
entry.cachedTokens+=usage.cachedTokens||0;
entry.imageTokens+=usage.imageTokens||0;
entry.completionTokens+=usage.completionTokens||0;
if(usage.costUsd===null||usage.costUsd===undefined){
entry.unpricedCalls+=1;
}else{
entry.costUsd+=usage.costUsd;
}
entry.lastUsed=Date.now();
await store.setItem(key,entry);
return entry;
}catch(error){
apiCostLogger.error('Error recording api usage:',error);
return null;
}
}
async function getAll(){
try{
var list=[];
await store.iterate(function(value){
if(value&&value.providerId)list.push(value);
});
list.sort(function(a,b){return b.costUsd-a.costUsd;});
return list;
}catch(error){
apiCostLogger.error('Error getting api cost stats:',error);
return[];
}
}
async function getTotals(){
var list=await getAll();
var totals={
calls:0,
promptTokens:0,
completionTokens:0,
costUsd:0,
unpricedCalls:0,
};
list.forEach(function(entry){
totals.calls+=entry.calls;
totals.promptTokens+=entry.promptTokens;
totals.completionTokens+=entry.completionTokens;
totals.costUsd+=entry.costUsd;
totals.unpricedCalls+=entry.unpricedCalls;
});
return totals;
}
async function clearAll(){
try{
await store.clear();
return true;
}catch(error){
apiCostLogger.error('Error clearing api cost stats:',error);
return false;
}
}
return{
recordUsage:recordUsage,
getAll:getAll,
getTotals:getTotals,
clearAll:clearAll,
};
})();
