// ベースリファレンスの永続化（IndexedDB）。
// ここは作品をまたいで使い回す「素材置き場」であって、プロジェクトの正ではない。
// プロジェクトが実際に使うシートはプロジェクトファイル側に入る（reference-sheet-store.js）
const referenceRepository={
store: null,
init() {
this.store=localforage.createInstance({
name: 'MangaEditor_Reference',
storeName: 'baseReferenceSheets'
});
},
async getAll() {
const list=[];
try{
await this.store.iterate(function(value){
if(value&&value.id)list.push(value);
});
list.sort(function(a,b){return(a.createdAt||0)-(b.createdAt||0);});
return list;
}catch(error){
dbLogger.error('Failed to read base references:',error);
return[];
}
},
async save(entry) {
try{
await this.store.setItem(entry.id,entry);
return true;
}catch(error){
dbLogger.error('Failed to save base reference:',error);
return false;
}
},
async remove(id) {
try{
await this.store.removeItem(id);
return true;
}catch(error){
dbLogger.error('Failed to remove base reference:',error);
return false;
}
}
};
referenceRepository.init();
