/* Local draft storage. Saving here never makes a GitHub request. */
(function(root){
'use strict';
let db=null,revision=0,busy=false,queued=null,blocked='';
const session=root.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2);
async function open(){
 const connection=await new Promise((resolve,reject)=>{
  const request=indexedDB.open('josh-portfolio-editor',1);
  request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('drafts'))request.result.createObjectStore('drafts');};
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error);
  request.onblocked=()=>reject(new Error('Close older editor tabs so this browser can open your drafts.'));
 });
 db=connection;db.onversionchange=()=>{db.close();db=null;};
 const record=await new Promise((resolve,reject)=>{
  const request=db.transaction('drafts').objectStore('drafts').get('portfolio');
  request.onsuccess=()=>resolve(request.result||null);
  request.onerror=()=>reject(request.error);
 });
 revision=Number(record?.revision)||0;
 return record;
}
function fail(batch,error){
 busy=false;batch.waiters.forEach(waiter=>waiter.reject(error));
 if(queued){queued.waiters.forEach(waiter=>waiter.reject(error));queued=null;}
}
function drain(){
 if(busy||!queued)return;
 const batch=queued;queued=null;busy=true;let tx,error;
 try{
  tx=db.transaction('drafts','readwrite');
  const store=tx.objectStore('drafts'),request=store.get('portfolio');
  request.onsuccess=()=>{
   if((Number(request.result?.revision)||0)!==revision){
    blocked='Another tab saved a newer draft. Download your changes, then reload this tab to continue.';
    error=new Error(blocked);tx.abort();return;
   }
   try{store.put({...batch.record,version:2,revision:revision+1,session},'portfolio');}catch(cause){error=cause;tx.abort();}
  };
  tx.oncomplete=()=>{
   revision++;busy=false;batch.waiters.forEach(waiter=>waiter.resolve(batch.record.time));drain();
  };
  tx.onabort=()=>fail(batch,error||tx.error||new Error('This browser could not save your draft.'));
 }catch(error){fail(batch,error);}
}
function save(record){
 if(blocked)return Promise.reject(new Error(blocked));
 if(!db)return Promise.reject(new Error('Draft storage is unavailable in this browser.'));
 return new Promise((resolve,reject)=>{
  // Coalesce quick keystrokes while a transaction is already saving.
  if(queued){queued.record=record;queued.waiters.push({resolve,reject});}
  else queued={record,waiters:[{resolve,reject}]};
  drain();
 });
}
root.PortfolioDraftStore={open,save,get pending(){return busy||!!queued;}};
})(window);
