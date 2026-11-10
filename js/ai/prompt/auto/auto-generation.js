async function autoMultiGenerate() {
const loading=OP_showLoading({icon: 'process',step: 'Step1',substep: 'Multi Page',progress: 0},true);
await waitNextFrame();

try{
let onePanelNumber=$("onePanelGenerateNumber").value;

let guidList=btmGetGuids();
for (const [index,guid] of guidList.entries()) {

if(OP_isCancelled()){
OP_updateLoadingState(loading,{
icon: 'process',step: typeof getText==='function'?getText('op_cancelled'):'Cancelled',substep: '',progress: 100
});
break;
}

OP_updateLoadingState(loading,{
icon: 'process',step: 'Step2',substep: 'Page:'+(index+1)+'/'+guidList.length,progress: Math.round((index/guidList.length)*100)
});
await waitNextFrame();

await chengeCanvasByGuid(guid);

for (let i=0;i<onePanelNumber;i++) {

if(OP_isCancelled()){
break;
}

const promises=[];
let panelList=getPanelObjectList();

panelList.forEach((panel,panelIndex)=>{
var spinner=createSpinner(getGUID(panel),'T2I');
promises.push(T2I(panel,spinner));
});

await Promise.allSettled(promises);

if(OP_isCancelled()){
break;
}

while (true) {
if(OP_isCancelled()){
break;
}
if (existsWaitQueue()) {
await waitAllQueuesIdle();
continue;
} else {
break;
}
}

}

if(!OP_isCancelled()){
await btmSaveProjectFile();
}
}
}finally{
OP_hideLoading(loading);
}
}