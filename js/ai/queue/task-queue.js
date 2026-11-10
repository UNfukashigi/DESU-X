class TaskQueue {
constructor(concurrency) {
this.concurrency=concurrency;
this.queue=[];
this.activeCount=0;
this._nextItemId=0;
this._idleWaiters=[];
// 実行中アイテムのid→item。取消の入口を待機中と実行中で分けないために持つ
this._running=new Map();
}

// 空になるまで待つ。setTimeoutのポーリングは非表示タブで1分間隔まで間引かれるため、
// 待つ側がタイマーではなくキューの完了で起きられるようにする
whenIdle() {
if(this.getTotalCount()===0){
return Promise.resolve();
}
var self=this;
return new Promise(function(resolve){
self._idleWaiters.push(resolve);
});
}

// 件数が0になり得る箇所すべてから呼ぶ（完了・個別取消・全取消）
_notifyIdle() {
if(this.getTotalCount()>0||this._idleWaiters.length===0){
return;
}
var waiters=this._idleWaiters;
this._idleWaiters=[];
waiters.forEach(function(resolve){resolve();});
}

add(task) {
var itemId=++this._nextItemId;
var p=new Promise((resolve,reject)=>{
this.queue.push({
id:itemId,
execute:()=>task().then(resolve).catch(reject),
reject:reject
});
this.processQueue();
});
p._queueItemId=itemId;
return p;
}

removeItem(itemId) {
var idx=this.queue.findIndex(function(item){return item.id===itemId;});
if(idx===-1) return false;
var item=this.queue.splice(idx,1)[0];
try{
item.reject(new Error('Task cancelled'));
}catch(e){}
logger.debug("Queue item removed: "+itemId);
this._notifyIdle();
return true;
}

// 待機中と実行中のどちらでも取り消せる唯一の入口。
// 実行中はリモートの処理そのものは止まらないが、呼び出し側のPromiseを
// 'Task cancelled'で落とすので、既存のcatch分岐がそのまま効き、
// 結果の配置も実績記録も通らない
cancelItem(itemId) {
if(this.removeItem(itemId)) return true;
var item=this._running.get(itemId);
if(!item) return false;
this._running.delete(itemId);
try{
item.reject(new Error('Task cancelled'));
}catch(e){}
logger.debug("Queue item cancelled while running: "+itemId);
return true;
}

async processQueue() {
if (this.activeCount>=this.concurrency||this.queue.length===0) {
return;
}

const taskItem=this.queue.shift();
this.activeCount++;
this._running.set(taskItem.id,taskItem);

try {
logger.debug("task is run.");
await taskItem.execute();
} catch (error) {
logger.error("Task error:",error);
} finally {
this._running.delete(taskItem.id);
this.activeCount--;
this.processQueue();
this._notifyIdle();
}
}

getActiveCount() {
return this.activeCount;
}

getWaitingCount() {
return this.queue.length;
}

getTotalCount() {
return this.activeCount+this.queue.length;
}

getStatus() {
return {
active: this.getActiveCount(),
waiting: this.getWaitingCount(),
total: this.getTotalCount()
};
}

setConcurrency(n) {
this.concurrency=n;
this.processQueue();
}

clearQueue() {
const clearedCount=this.queue.length;
this.queue.forEach(taskItem=>{
try{
taskItem.reject(new Error('Queue cancelled'));
}catch(e){}
});
this.queue=[];
logger.debug(`Queue cleared: ${clearedCount} tasks removed`);
this._notifyIdle();
return clearedCount;
}
}
