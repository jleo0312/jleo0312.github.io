/* Project media tray. Content and upload persistence are owned by editor.js. */
(function(){
'use strict';
const MIME='application/x-portfolio-media';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
window.PortfolioMediaPanel={mount({root,getItems,getTitle,getKey,url,place,receive,remove,upload,close}){
 let chosen='',uploading=false,message='';
 const list=root.querySelector('[data-media-items]'),note=root.querySelector('[data-media-message]'),input=root.querySelector('input[type=file]'),uploadButton=root.querySelector('[data-media-upload]');
 function render(){
  root.querySelector('[data-media-title]').textContent=getTitle();const items=getItems();
  list.innerHTML=items.map(item=>`<article class="media-tray-card ${chosen===item.src?'is-chosen':''}" draggable="true" data-media-src="${escape(item.src)}" tabindex="0" aria-label="${escape(item.name)}. Drag to a media box."><div class="media-tray-image">${item.type==='video'?'<span aria-hidden="true">▶</span>':`<img src="${escape(url(item.src))}" alt="" draggable="false" loading="lazy">`}</div><span class="media-tray-name" title="${escape(item.name)}">${escape(item.name)}</span><div class="media-tray-actions"><button type="button" data-media-place="${escape(item.src)}">Use</button><button type="button" data-media-remove="${escape(item.src)}" aria-label="Remove ${escape(item.name)} from media library">Remove</button></div></article>`).join('')||'<p class="media-tray-empty">Upload photos here, then drag them into a media box on the page.</p>';
  note.textContent=message;uploadButton.disabled=uploading;input.disabled=uploading;
 }
 function report(text){message=text;note.textContent=text;}
 async function add(files){if(uploading||!files.length)return;uploading=true;render();try{await upload(files,report);}finally{uploading=false;render();}}
 root.querySelector('[data-media-close]').onclick=close;
 uploadButton.onclick=()=>{input.value='';input.click();};
 input.onchange=()=>add([...input.files]);
 list.addEventListener('click',event=>{const card=event.target.closest('[data-media-src]');if(card){chosen=card.dataset.mediaSrc;list.querySelectorAll('.media-tray-card').forEach(node=>node.classList.toggle('is-chosen',node===card));}const use=event.target.closest('[data-media-place]'),trash=event.target.closest('[data-media-remove]');if(use)place(use.dataset.mediaPlace);if(trash)remove(trash.dataset.mediaRemove);});
 list.addEventListener('dragstart',event=>{const card=event.target.closest('[data-media-src]');if(!card)return;const payload={origin:'library',key:getKey(),src:card.dataset.mediaSrc};event.dataTransfer.setData(MIME,JSON.stringify(payload));event.dataTransfer.setData('text/plain',payload.src);event.dataTransfer.effectAllowed='copyMove';});
 function payload(event){try{return JSON.parse(event.dataTransfer.getData(MIME));}catch{return null;}}
 root.addEventListener('dragover',event=>{if(event.dataTransfer.types.includes(MIME)||event.dataTransfer.types.includes('Files')){event.preventDefault();root.classList.add('is-drag-over');const trash=event.target.closest('[data-media-trash]');root.querySelector('[data-media-trash]').classList.toggle('is-drag-over',!!trash);event.dataTransfer.dropEffect=event.dataTransfer.types.includes(MIME)?'move':'copy';}});
 root.addEventListener('dragleave',event=>{if(!root.contains(event.relatedTarget))root.classList.remove('is-drag-over');});
 root.addEventListener('drop',event=>{event.preventDefault();root.classList.remove('is-drag-over');root.querySelector('[data-media-trash]').classList.remove('is-drag-over');const item=payload(event),trash=!!event.target.closest('[data-media-trash]');if(item&&item.key===getKey()){if(item.origin==='canvas')receive(item,trash);else if(item.origin==='library'&&trash)remove(item.src);}else if(event.dataTransfer.files.length)add([...event.dataTransfer.files]);});
 root.addEventListener('keydown',event=>{if(event.key==='Escape'){close();return;}const card=event.target.closest('[data-media-src]');if(card&&event.target===card){if(event.key==='Enter'){event.preventDefault();place(card.dataset.mediaSrc);}if(event.key==='Delete'){event.preventDefault();remove(card.dataset.mediaSrc);}}});
 return {render,report};
}};
})();
