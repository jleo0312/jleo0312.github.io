/* Editor-only notepad. Notes stay in browser storage, separate from website content. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id),storageKey='josh-portfolio-editor:notes:v1';
 const panel=$('editor-notes'),input=$('notes-text'),open=$('open-notes'),close=$('close-notes'),download=$('download-notes'),status=$('notes-save-status');
 function message(text,error=false){status.textContent=text;status.dataset.error=String(error);}
 function updateDownload(){download.disabled=!input.value;}
 function save(){
  try{localStorage.setItem(storageKey,input.value);message('Saved in this browser');}
  catch{message('Could not save in this browser. Download your notes to keep a copy.',true);}
  updateDownload();
 }
 try{input.value=localStorage.getItem(storageKey)||'';}
 catch{message('Browser storage is unavailable. Download your notes to keep a copy.',true);}
 updateDownload();
 function show(){
  document.getElementById('section-menu').hidden=true;
  panel.hidden=false;document.body.classList.add('notes-open');open.setAttribute('aria-pressed','true');input.focus();
 }
 function hide(restoreFocus=false){
  panel.hidden=true;document.body.classList.remove('notes-open');open.setAttribute('aria-pressed','false');if(restoreFocus)open.focus();
 }
 open.addEventListener('click',show);close.addEventListener('click',()=>hide(true));input.addEventListener('input',save);
 // Sidebar actions return to the page being edited, preserving the notepad text.
 document.querySelector('.outline').addEventListener('click',event=>{if(!event.target.closest('#open-notes')&&event.target.closest('button'))hide();});
 $('page-select').addEventListener('change',()=>hide());
 download.addEventListener('click',()=>{
  const blob=new Blob([input.value],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download='portfolio-notes.txt';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
 });
})();
