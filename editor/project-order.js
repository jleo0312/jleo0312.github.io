(function(root){
'use strict';
function mount({list,dialog,announce,onMove}){
 let drag=null,frame=0;
 const rows=()=>[...list.querySelectorAll('[data-project-id]')];
 const say=message=>{announce.textContent=message;};
 function clearIndicator(){list.querySelectorAll('.project-drop-before,.project-drop-after').forEach(row=>row.classList.remove('project-drop-before','project-drop-after'));}
 function indicate(){
  clearIndicator();if(!drag?.active)return;
  const others=rows().filter(row=>row!==drag.row),next=others.find(row=>row.dataset.projectId===drag.beforeId);
  if(next)next.classList.add('project-drop-before');else others.at(-1)?.classList.add('project-drop-after');
 }
 function targetAt(y){
  const next=rows().filter(row=>row!==drag.row).find(row=>{const rect=row.getBoundingClientRect();return y<rect.top+rect.height/2;});
  drag.beforeId=next?.dataset.projectId||null;indicate();
 }
 function cancel(message=''){
  if(!drag)return;
  const current=drag;drag=null;cancelAnimationFrame(frame);frame=0;
  current.ghost?.remove();current.row.classList.remove('is-project-dragging');current.handle.setAttribute('aria-pressed','false');
  dialog.classList.remove('is-project-sorting');clearIndicator();
  if(current.pointerId!==undefined&&current.handle.hasPointerCapture(current.pointerId))current.handle.releasePointerCapture(current.pointerId);
  if(message)say(message);
 }
 function finish(){
  if(!drag)return;const {id,beforeId,active}=drag;cancel();if(active)onMove(id,beforeId);
 }
 function scroll(){
  if(!drag?.active||drag.keyboard)return;
  const rect=dialog.getBoundingClientRect(),edge=56;
  const speed=drag.y<rect.top+edge?-Math.min(20,(rect.top+edge-drag.y)/3):drag.y>rect.bottom-edge?Math.min(20,(drag.y-rect.bottom+edge)/3):0;
  if(speed)dialog.scrollTop+=speed;
  targetAt(drag.y);frame=requestAnimationFrame(scroll);
 }
 list.addEventListener('pointerdown',event=>{
  const handle=event.target.closest('[data-project-drag]');if(!handle||!event.isPrimary||event.button!==0)return;
  cancel();event.preventDefault();handle.focus({preventScroll:true});
  const row=handle.closest('[data-project-id]'),rect=row.getBoundingClientRect();
  drag={id:row.dataset.projectId,row,handle,pointerId:event.pointerId,x:event.clientX,y:event.clientY,startY:event.clientY,offsetY:event.clientY-rect.top,left:rect.left,width:rect.width,active:false};
  handle.setPointerCapture(event.pointerId);
 });
 list.addEventListener('pointermove',event=>{
  if(!drag||drag.keyboard||event.pointerId!==drag.pointerId)return;
  drag.y=event.clientY;
  if(!drag.active&&Math.hypot(event.clientX-drag.x,event.clientY-drag.startY)<5)return;
  event.preventDefault();
  if(!drag.active){
   drag.active=true;drag.handle.setAttribute('aria-pressed','true');drag.row.classList.add('is-project-dragging');dialog.classList.add('is-project-sorting');
   const ghost=drag.row.cloneNode(true);ghost.className='project-placement-row project-drag-ghost';ghost.removeAttribute('data-project-id');ghost.setAttribute('aria-hidden','true');ghost.inert=true;
   ghost.style.width=drag.width+'px';ghost.style.left=drag.left+'px';dialog.append(ghost);drag.ghost=ghost;
   say('Moving project. Release to drop, or press Escape to cancel.');frame=requestAnimationFrame(scroll);
  }
  drag.ghost.style.top=(event.clientY-drag.offsetY)+'px';targetAt(event.clientY);
 });
 list.addEventListener('pointerup',event=>{
  if(!drag||drag.keyboard||event.pointerId!==drag.pointerId)return;
  const rect=dialog.getBoundingClientRect();
  if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)cancel('Reorder canceled.');else finish();
 });
 list.addEventListener('pointercancel',()=>cancel('Reorder canceled.'));
 list.addEventListener('lostpointercapture',()=>{if(drag&&!drag.keyboard)cancel('Reorder canceled.');});
 list.addEventListener('dragstart',event=>event.preventDefault());
 list.addEventListener('keydown',event=>{
  const handle=event.target.closest('[data-project-drag]');if(!handle)return;
  const all=rows(),row=handle.closest('[data-project-id]');
  if(event.key===' '||event.key==='Enter'){
   event.preventDefault();if(drag?.keyboard){finish();return;}
   cancel();const index=all.indexOf(row);
   drag={id:row.dataset.projectId,row,handle,keyboard:true,active:true,index,beforeId:all[index+1]?.dataset.projectId||null};
   handle.setAttribute('aria-pressed','true');row.classList.add('is-project-dragging');indicate();
   say('Picked up project '+(index+1)+' of '+all.length+'. Use Up and Down, then Space to drop. Escape cancels.');
  }else if(drag?.keyboard&&['ArrowUp','ArrowDown','Home','End'].includes(event.key)){
   event.preventDefault();const others=all.filter(value=>value!==drag.row);
   drag.index=event.key==='Home'?0:event.key==='End'?others.length:Math.max(0,Math.min(others.length,drag.index+(event.key==='ArrowUp'?-1:1)));
   drag.beforeId=others[drag.index]?.dataset.projectId||null;indicate();
   (others[drag.index]||others.at(-1))?.scrollIntoView({block:'nearest'});
   say('Position '+(drag.index+1)+' of '+all.length+'. Space to drop. Escape cancels.');
  }
 });
 dialog.addEventListener('keydown',event=>{if(event.key==='Escape'&&drag){event.preventDefault();event.stopPropagation();cancel('Reorder canceled.');}});
 dialog.addEventListener('close',()=>cancel());
 return {cancel};
}
root.PortfolioProjectOrder={mount};
})(window);
