var comfyObjectInfoRepoProto={
async saveObjectInfo(objectInfo) {
if (!objectInfo||Object.keys(objectInfo).length===0) {
comfyuiLogger.error("有効なObjectInfoが指定されていません");
return false;
}

try {
await this.store.setItem("latestObjectInfo",{
data: objectInfo,
updatedAt: new Date().toISOString(),
});
return true;
} catch (error) {
comfyuiLogger.error("ObjectInfoの保存に失敗しました:",error);
return false;
}
},

async getObjectInfo() {
try {
const result=await this.store.getItem("latestObjectInfo");
return result ? result.data : null;
} catch (error) {
comfyuiLogger.error("ObjectInfoの取得に失敗しました:",error);
return null;
}
},

async getNodeNames() {
var data=await this.getObjectInfo();
return data ? Object.keys(data) : [];
},

async getLastUpdated() {
try {
const result=await this.store.getItem("latestObjectInfo");
return result ? result.updatedAt : null;
} catch (error) {
comfyuiLogger.error("最終更新日時の取得に失敗しました:",error);
return null;
}
},
};

// ObjectInfoの入力定義は2つの形で返ってくる。どちらも「選択肢の一覧」を意味する
//   旧: "ckpt_name":[["a.safetensors","b.safetensors"],{メタ}]
//   新: "model_name":["COMBO",{"multiselect":false,"options":["a.pth"]}]
// 実測（ComfyUI 0.27.0）では旧2434件・新448件が同居している
function comfyGetComboOptions(inputDef) {
if (!Array.isArray(inputDef)) return null;
if (Array.isArray(inputDef[0])) return inputDef[0];
var meta=comfyGetInputMeta(inputDef);
if (inputDef[0]==="COMBO"&&Array.isArray(meta.options)) return meta.options;
return null;
}

function comfyGetInputMeta(inputDef) {
if (!Array.isArray(inputDef)) return {};
return (inputDef[1]&&typeof inputDef[1]==="object") ? inputDef[1] : {};
}

// 選択肢はあるが、その中身が起動時には確定しない入力。
// アップロード系（LoadImage等）は実行時にアプリが差し込むファイル名が入るため、
// remoteはComfyUIのフロントが後から取りに行くため、どちらも照合できない
function comfyIsRuntimeSuppliedInput(inputDef) {
var meta=comfyGetInputMeta(inputDef);
return meta.image_upload===true||meta.file_upload===true
||meta.video_upload===true||meta.audio_upload===true
||meta.remote!==undefined;
}

// ワークフローが指す値のうち、ComfyUI側の選択肢に無いものを集める。
// 対象は「選択肢が列挙されている入力」だけ。数値・真偽・自由文字列は照合しない。
// class_typeが無いノードはノード欠落として別に報告されるのでここでは触らない
function comfyCollectValueMismatches(workflow,objectInfo) {
var mismatches=[];
if (!workflow||!objectInfo) return mismatches;
Object.entries(workflow).forEach(function(entry) {
var nodeId=entry[0];
var node=entry[1];
if (!node||!node.inputs) return;
var nodeDef=objectInfo[node.class_type];
if (!nodeDef||!nodeDef.input) return;
var defs=Object.assign({},nodeDef.input.required,nodeDef.input.optional);
Object.entries(node.inputs).forEach(function(inputEntry) {
var inputName=inputEntry[0];
var value=inputEntry[1];
// 配列は他ノードへの接続（[ノードID, 出力番号]）
if (Array.isArray(value)) return;
if (typeof value!=="string"&&typeof value!=="number") return;
// %prompt% などは実行時に差し込む。ここで照合すると必ず不一致になる
if (isPlaceholderValue(value)) return;
var inputDef=defs[inputName];
if (comfyIsRuntimeSuppliedInput(inputDef)) return;
var options=comfyGetComboOptions(inputDef);
if (options===null) return;
var hit=options.some(function(option) {
return option===value||String(option)===String(value);
});
if (hit) return;
mismatches.push({
nodeId: nodeId,
classType: node.class_type,
inputName: inputName,
value: value
});
});
});
return mismatches;
}

function comfyFormatValueMismatch(mismatch) {
return "#"+mismatch.nodeId+" "+mismatch.classType+"."+mismatch.inputName+" = "+mismatch.value;
}

function comfyValueMismatchKey(nodeId,inputName) {
return nodeId+"\u0000"+inputName;
}

function createComfyObjectInfoRepo(providerKey) {
var repo=Object.create(comfyObjectInfoRepoProto);
repo.store=localforage.createInstance({
name: "objectInfoStorage_"+providerKey,
storeName: "comfyObjectInfo",
});
return repo;
}

var comfyObjectInfoRepo_local=createComfyObjectInfoRepo('local');
var comfyObjectInfoRepo_runpod=createComfyObjectInfoRepo('runpod');
var comfyObjectInfoRepo=comfyObjectInfoRepo_local;
