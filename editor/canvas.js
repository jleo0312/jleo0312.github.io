/* Slides-style selection, free positioning and plain-text editing. */
(function(){
'use strict';
let active;
const read=(object,path)=>path.split('.').reduce((value,key)=>value?.[key],object);
const write=(object,path,value)=>{const parts=path.split('.');if(parts.some(k=>['__proto__','constructor','prototype'].includes(k)))return;let target=object;parts.forEach((key,i)=>{if(i===parts.length-1)target[key]=value;else target=target[key]||=(/^\d+$/.test(parts[i+1])?[]:{});});};
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
function mount({data,key,settings,model,send}){
 active?.destroy();
 const objects=window.PortfolioObjects.current,{values,images,textNodes}=objects;
 const events=new AbortController(),on=(node,name,fn,options={})=>node?.addEventListener(name,fn,{...options,signal:events.signal});
 let selectedId='',selectedImage='',selectedText='',picked=null,gesture=null,editing=null,frame=0,cropping=false,suppressClick=false;
 const overlay=document.createElement('div');overlay.className='canvas-ui';overlay.contentEditable='false';document.body.append(overlay);
 const toolbar=document.createElement('div');toolbar.className='canvas-toolbar';toolbar.setAttribute('role','toolbar');toolbar.setAttribute('aria-label','Selected object');overlay.append(toolbar);
 const selection=document.createElement('div');selection.className='canvas-image-selection';selection.hidden=true;overlay.append(selection);
 const hint=document.createElement('div');hint.className='canvas-drop-hint';hint.hidden=true;overlay.append(hint);
 const guideV=document.createElement('div');guideV.className='canvas-smart-guide canvas-smart-guide-v';guideV.hidden=true;overlay.append(guideV);
 const guideH=document.createElement('div');guideH.className='canvas-smart-guide canvas-smart-guide-h';guideH.hidden=true;overlay.append(guideH);
 const gapX1=document.createElement('div');gapX1.className='canvas-gap-guide canvas-gap-guide-x';gapX1.hidden=true;overlay.append(gapX1);
 const gapX2=document.createElement('div');gapX2.className='canvas-gap-guide canvas-gap-guide-x';gapX2.hidden=true;overlay.append(gapX2);
 const gapY1=document.createElement('div');gapY1.className='canvas-gap-guide canvas-gap-guide-y';gapY1.hidden=true;overlay.append(gapY1);
 const gapY2=document.createElement('div');gapY2.className='canvas-gap-guide canvas-gap-guide-y';gapY2.hidden=true;overlay.append(gapY2);
 const gapLabel=document.createElement('div');gapLabel.className='canvas-gap-label';gapLabel.hidden=true;overlay.append(gapLabel);
 const input=document.createElement('input');input.type='file';input.hidden=true;overlay.append(input);
 const sectionNode=id=>[...document.querySelectorAll('[data-section-id]')].find(n=>n.dataset.sectionId===id);
 function hideSmartGuides(){for(const n of [guideV,guideH,gapX1,gapX2,gapY1,gapY2,gapLabel])n.hidden=true;}
 function line(node,left,top,width,height){node.hidden=false;Object.assign(node.style,{left:Math.round(left)+'px',top:Math.round(top)+'px',width:Math.max(1,Math.round(width))+'px',height:Math.max(1,Math.round(height))+'px'});}
 function peerRects(entry,scope){
  return objects.entries.filter(other=>other!==entry&&other.node.isConnected&&!other.node.closest('[inert]')&&!entry.node.contains(other.node)&&!other.node.contains(entry.node)).map(other=>({entry:other,rect:other.node.getBoundingClientRect()})).filter(({rect})=>{
   if(rect.width<2||rect.height<2)return false;
   const cx=(rect.left+rect.right)/2,cy=(rect.top+rect.bottom)/2;
   return cx>=scope.left-2&&cx<=scope.right+2&&cy>=scope.top-2&&cy<=scope.bottom+2;
  });
 }
 function snapMoveBox(left,top,width,height,g,scope,event){
  hideSmartGuides();if(event.altKey)return {left,top};
  const threshold=8,gapThreshold=14,peers=peerRects(g.entry,scope),right=()=>left+width,bottom=()=>top+height;
  const xTargets=[
   {v:scope.left,rect:scope},{v:(scope.left+scope.right)/2,rect:scope},{v:scope.right,rect:scope},
   ...peers.flatMap(p=>[{v:p.rect.left,rect:p.rect},{v:(p.rect.left+p.rect.right)/2,rect:p.rect},{v:p.rect.right,rect:p.rect}])
  ];
  const yTargets=[
   {v:scope.top,rect:scope},{v:(scope.top+scope.bottom)/2,rect:scope},{v:scope.bottom,rect:scope},
   ...peers.flatMap(p=>[{v:p.rect.top,rect:p.rect},{v:(p.rect.top+p.rect.bottom)/2,rect:p.rect},{v:p.rect.bottom,rect:p.rect}])
  ];
  let bestX=null;
  for(const moving of [left,left+width/2,left+width])for(const target of xTargets){const d=Math.abs(target.v-moving);if(d<=threshold&&(!bestX||d<bestX.d))bestX={d,delta:target.v-moving,target};}
  if(bestX){left+=bestX.delta;const r=bestX.target.rect;line(guideV,bestX.target.v,Math.min(top,r.top),1,Math.max(bottom(),r.bottom)-Math.min(top,r.top));}
  let bestY=null;
  for(const moving of [top,top+height/2,top+height])for(const target of yTargets){const d=Math.abs(target.v-moving);if(d<=threshold&&(!bestY||d<bestY.d))bestY={d,delta:target.v-moving,target};}
  if(bestY){top+=bestY.delta;const r=bestY.target.rect;line(guideH,Math.min(left,r.left),bestY.target.v,Math.max(right(),r.right)-Math.min(left,r.left),1);}

  if(!bestX){
   const overlapping=peers.filter(p=>Math.min(bottom(),p.rect.bottom)-Math.max(top,p.rect.top)>Math.min(height,p.rect.height)*.2);
   const leftPeer=overlapping.filter(p=>p.rect.right<=left+threshold).sort((a,b)=>b.rect.right-a.rect.right)[0];
   const rightPeer=overlapping.filter(p=>p.rect.left>=right()-threshold).sort((a,b)=>a.rect.left-b.rect.left)[0];
   if(leftPeer&&rightPeer){
    const gl=left-leftPeer.rect.right,gr=rightPeer.rect.left-right();
    if(gl>=0&&gr>=0&&Math.abs(gl-gr)<=gapThreshold){
     left+=(gr-gl)/2;const gap=Math.round((gl+gr)/2),mid=top+height/2;
     line(gapX1,leftPeer.rect.right,mid,left-leftPeer.rect.right,1);line(gapX2,right(),mid,rightPeer.rect.left-right(),1);
     gapLabel.hidden=false;gapLabel.textContent=gap+' px';gapLabel.style.left=Math.round(left+width/2-22)+'px';gapLabel.style.top=Math.round(mid-27)+'px';
    }
   }
  }
  if(!bestY){
   const overlapping=peers.filter(p=>Math.min(right(),p.rect.right)-Math.max(left,p.rect.left)>Math.min(width,p.rect.width)*.2);
   const above=overlapping.filter(p=>p.rect.bottom<=top+threshold).sort((a,b)=>b.rect.bottom-a.rect.bottom)[0];
   const below=overlapping.filter(p=>p.rect.top>=bottom()-threshold).sort((a,b)=>a.rect.top-b.rect.top)[0];
   if(above&&below){
    const gt=top-above.rect.bottom,gb=below.rect.top-bottom();
    if(gt>=0&&gb>=0&&Math.abs(gt-gb)<=gapThreshold){
     top+=(gb-gt)/2;const gap=Math.round((gt+gb)/2),mid=left+width/2;
     line(gapY1,mid,above.rect.bottom,1,top-above.rect.bottom);line(gapY2,mid,bottom(),1,below.rect.top-bottom());
     gapLabel.hidden=false;gapLabel.textContent=gap+' px';gapLabel.style.left=Math.round(mid+10)+'px';gapLabel.style.top=Math.round(top+height/2-12)+'px';
    }
   }
  }
  return {left,top};
 }
 for(const [path,nodes]of textNodes)for(const node of nodes){node.dataset.editPath=path;node.dataset.editLabel=node.dataset.objectLabel;node.contentEditable='false';node.spellcheck=true;node.tabIndex=0;node.setAttribute('role','textbox');node.setAttribute('aria-label',node.dataset.objectLabel);node.setAttribute('aria-multiline',String(node.dataset.singleLine!=='true'));}
 for(const item of images.values()){item.frame.dataset.canvasImage=item.path;item.frame.querySelectorAll('img,video').forEach(n=>n.draggable=false);}
 function button(label,action,value='',title=label){const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.canvasAction=action;b.dataset.value=value;b.title=title;b.setAttribute('aria-label',title);return b;}
 function selectControl(label,name,choices,value){const control=document.createElement('select');control.dataset.canvasControl=name;control.setAttribute('aria-label',label);for(const [v,text]of choices)control.add(new Option(text,v));control.value=String(value);return control;}
 function layoutValue(){return picked?objects.record(picked)||objects.capture(picked):null;}
 function widthControl(){const label=document.createElement('label');label.className='canvas-width';label.textContent='Width ';const slider=document.createElement('input');slider.type='range';slider.min=5;slider.max=100;slider.step=1;slider.value=Math.round(layoutValue()?.width||100);slider.dataset.canvasControl='object-width';slider.setAttribute('aria-label','Object width');label.append(slider);return label;}
 function buildToolbar(){
  toolbar.replaceChildren();const item=images.get(selectedImage),section=values.find(s=>s.id===selectedId);toolbar.hidden=!picked&&!section;if(toolbar.hidden)return;
  if(picked){
   const drag=button(picked.kind==='text'?'✥ Drag text':'✥ Drag photo','drag-object');drag.className='canvas-grab';toolbar.append(drag);
   if(picked.kind==='text'){
    toolbar.append(button(editing===picked.node?'Done typing':'Edit text','edit-text'));
    const size=Math.round(parseFloat(getComputedStyle(picked.node).fontSize)||18),sizes=[12,14,16,18,20,24,28,32,40,48,64,80,96];if(!sizes.includes(size))sizes.push(size);sizes.sort((a,b)=>a-b);
    toolbar.append(selectControl('Font size','font-size',sizes.map(s=>[s,s+' px']),size),selectControl('Text alignment','text-align',[['left','Left'],['center','Center'],['right','Right']],layoutValue()?.align||getComputedStyle(picked.node).textAlign||'left'));
   }
   toolbar.append(widthControl(),button('Reset position','reset-position'),button('Bring forward','front'),button('Send backward','back'));
   if(item){
    const isThumbnail=item.path.endsWith('.thumbnailStyle')&&!!item.frame.closest('[data-project]');
    if(isThumbnail){
     const previewPath=item.path.replace(/\.thumbnailStyle$/,'.previewVideo'),hasPreview=!!read(data,previewPath);
     toolbar.append(button('Thumbnail image','replace'),button(hasPreview?'Replace preview video':'Add preview video','preview-video'));
    }else toolbar.append(button('Replace','replace'));
    for(const [value,label]of [['left','Photo left'],['right','Photo right'],['above','Above text'],['below','Below text']])if(item.layoutPath)toolbar.append(button(label,'layout',value));
    toolbar.append(selectControl('Image proportions','aspect',[['auto','Original shape'],['square','Square'],['portrait','Portrait · 4:5'],['tall','Portrait · 3:4'],['landscape','Landscape'],['wide','Wide']],read(data,item.path+'.aspect')||'auto'));
    toolbar.append(button(read(data,item.path+'.fit')==='cover'?'Show whole photo':'Fill / crop','fit'),button(cropping?'Done cropping':'Move crop','crop'),button('Edit caption','caption'));
    if(item.caption?.textContent.trim())toolbar.append(button(read(data,item.visiblePath)===false?'Show caption':'Hide caption','caption-visibility'));
    if(item.frame.closest('[data-project]'))toolbar.append(button('✥ Reorder cards','reorder-cards'));
   }
   if(picked.kind==='text'&&section)toolbar.append(button('Duplicate text','duplicate-text'),button('Delete text','delete-text'));
   if(section)toolbar.append(button('+ Text box','add-text'));
   toolbar.append(button('More controls','details'));
  }else{
   const label=document.createElement('span');label.className='canvas-toolbar-label';label.textContent=model.types[section.type]||'Section';toolbar.append(label);
   const drag=button('✥ Move section','drag-section');drag.className='canvas-grab';toolbar.append(drag);
   for(const [label,action]of [['↑','up'],['↓','down'],['Duplicate','duplicate'],['Hide','hide'],['Delete','delete'],['+ Text box','add-text'],['+ Section','add'],['More controls','details']])toolbar.append(button(label,action));
  }
  if(!objects.active()){const note=document.createElement('span');note.className='canvas-toolbar-note';note.textContent='Mobile stacks automatically. Use Desktop to position boxes.';toolbar.append(note);}
 }
 function findText(path,id){const nodes=textNodes.get(path)||[];return nodes.find(n=>!n.closest('[inert]')&&n.closest('[data-section-id]')?.dataset.sectionId===id)||nodes.find(n=>!n.closest('[inert]'));}
 function select(id,imagePath='',textPath=''){
  if(editing&&editing.dataset.editPath!==textPath)stopText();
  selectedId=id||'';selectedImage=images.has(imagePath)?imagePath:'';selectedText=textNodes.has(textPath)?textPath:'';
  const node=selectedText?findText(selectedText,id):images.get(selectedImage)?.frame;picked=node?objects.byNode.get(node):null;
  document.querySelectorAll('.selected-section,.canvas-picked').forEach(n=>n.classList.remove('selected-section','canvas-picked'));sectionNode(selectedId)?.classList.add('selected-section');picked?.node.classList.add('canvas-picked');
  cropping=!!selectedImage&&cropping;buildToolbar();position();
 }
 function announce(entry){select(entry?.sectionId||'',entry?.kind==='image'?entry.path:'',entry?.kind==='text'?entry.path:'');send({action:'select',id:selectedId,imagePath:selectedImage,textPath:selectedText});}
 function position(){selection.hidden=!picked||editing===picked.node;if(!picked)return;const r=picked.node.getBoundingClientRect();Object.assign(selection.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});}
 function queuePosition(){cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{objects.refresh();position();});}
 for(const side of ['nw','n','ne','e','se','s','sw','w']){const b=button('','resize',side,'Drag to resize selected object');b.className='canvas-resize canvas-resize-'+side;selection.append(b);}
 for(const side of ['top','right','bottom','left']){const b=button('','drag-object','','Drag selected object');b.className='canvas-move-edge edge-'+side;selection.append(b);}
 function transaction(command,extra={}){send({action:'canvas-command',command,id:selectedId,imagePath:selectedImage,textPath:selectedText,...extra});}
 function objectStart(entry){send({action:'object-start',id:entry.sectionId,imagePath:entry.kind==='image'?entry.path:'',textPath:entry.kind==='text'?entry.path:''});}
 function objectSave(entry,value){const elements=objects.save(entry,value);send({action:'object-change',path:entry.layoutPath,elements});position();}
 function objectChange(change){if(!picked||!objects.active())return;const entry=picked;objectStart(entry);objectSave(entry,change===null?null:{...layoutValue(),...change});send({action:'object-end'});buildToolbar();}
 function capturePointer(event){try{event.target.setPointerCapture?.(event.pointerId);}catch{}}
 function beginObject(event,type,side=''){
  if(event.button!==0||!picked||!objects.active())return;event.preventDefault();event.stopPropagation();if(editing)stopText();capturePointer(event);
  const scope=objects.scopeFor(picked).getBoundingClientRect(),rect=picked.node.getBoundingClientRect();
  gesture={type,side,entry:picked,x:event.clientX,y:event.clientY,scrollY:window.scrollY,rect,scope,initial:objects.capture(picked),original:objects.record(picked)?model.clone(objects.record(picked)):null,changed:false};
 }
 function beginLegacy(event,type){if(event.button!==0)return;event.preventDefault();capturePointer(event);const item=images.get(selectedImage);gesture={type,item,id:selectedId,x:event.clientX,y:event.clientY,changed:false};if(type==='crop'){gesture.focalX=Number(read(data,item.path+'.focalX')??50);gesture.focalY=Number(read(data,item.path+'.focalY')??50);send({action:'resize-start',id:selectedId,path:item.path});}}
 function finishGesture(cancel=false){
  hideSmartGuides();if(!gesture)return;const g=gesture;gesture=null;document.body.classList.remove('canvas-dragging');hint.hidden=true;document.querySelectorAll('.canvas-drop-before,.canvas-drop-after').forEach(n=>n.classList.remove('canvas-drop-before','canvas-drop-after'));
  if(g.type==='move'||g.type==='size'){if(g.changed){if(cancel)objects.save(g.entry,g.original);send({action:'object-end',cancel});suppressClick=true;setTimeout(()=>suppressClick=false,0);}position();buildToolbar();return;}
  if(g.type==='slider'){if(cancel)objects.save(g.entry,g.original);send({action:'object-end',cancel});position();buildToolbar();return;}
  if(g.type==='crop'){send({action:'resize-end'});return;}
  if(!cancel&&g.changed&&g.drop){if(g.drop.kind==='project')transaction('move-project',g.drop);else transaction('move-to',g.drop);}
 }
 function moveObject(event,g){
  const dx=event.clientX-g.x,dy=event.clientY-g.y+(window.scrollY-g.scrollY);if(!g.changed&&Math.hypot(dx,dy)<3)return;
  if(!g.changed){objectStart(g.entry);g.changed=true;document.body.classList.add('canvas-dragging');}
  event.preventDefault();let scope=objects.scopeFor(g.entry,g.initial).getBoundingClientRect(),next={...g.initial};
  let left=g.rect.left+dx,top=g.rect.top+dy-(window.scrollY-g.scrollY),width=g.rect.width,height=g.rect.height;
  if(g.type==='move'){
   const target=document.elementFromPoint?.(event.clientX,event.clientY)?.closest('[data-section-id]');
   if(target&&g.entry.sectionId&&!g.entry.node.dataset.captionFor&&!g.entry.node.closest('.project-card,.hobby-card')){next.targetSection=target.dataset.sectionId;if(next.targetSection===g.entry.sectionId){delete next.targetSection;scope=g.entry.scope.getBoundingClientRect();}else scope=target.getBoundingClientRect();}
   if(event.shiftKey){if(Math.abs(dx)>Math.abs(dy))top=g.rect.top-(window.scrollY-g.scrollY);else left=g.rect.left;}
  }else{
   left=g.rect.left;top=g.rect.top-(window.scrollY-g.scrollY);
   if(g.side.includes('e'))width+=dx;if(g.side.includes('w')){width-=dx;left+=dx;}
   if(g.side.includes('s'))height+=dy;if(g.side.includes('n')){height-=dy;top+=dy;}
   if(g.entry.kind==='image'&&g.side.length===2&&!event.shiftKey){height=width*g.rect.height/Math.max(1,g.rect.width);if(g.side.includes('n'))top=g.rect.bottom-height;}
   width=clamp(width,Math.min(60,scope.width),scope.width);height=clamp(height,g.entry.kind==='text'?24:40,2400);next.height=height;
  }
  width=Math.min(width,scope.width);left=clamp(left,scope.left,scope.right-width);top=Math.max(scope.top,top);
  if(g.type==='move'){const snapped=snapMoveBox(left,top,width,height,g,scope,event);left=clamp(snapped.left,scope.left,scope.right-width);top=Math.max(scope.top,snapped.top);}else hideSmartGuides();
  next.x=(left-scope.left)/Math.max(1,scope.width)*100;next.y=(top-scope.top)/Math.max(1,scope.width)*100;next.width=width/Math.max(1,scope.width)*100;
  objectSave(g.entry,next);hint.hidden=false;hint.textContent=g.type==='size'?Math.round(width)+' × '+Math.round(height):Math.round(left-scope.left)+' , '+Math.round(top-scope.top);hint.style.left=clamp(event.clientX+18,8,window.innerWidth-150)+'px';hint.style.top=clamp(event.clientY+18,70,window.innerHeight-55)+'px';
  if(event.clientY<70)window.scrollBy(0,-12);else if(event.clientY>window.innerHeight-45)window.scrollBy(0,12);
 }
 on(document,'pointermove',event=>{
  const g=gesture;if(!g)return;if(g.type==='move'||g.type==='size'){moveObject(event,g);return;}
  if(g.type==='crop'){
   const r=g.item.frame.getBoundingClientRect(),x=clamp(Math.round(g.focalX-(event.clientX-g.x)/Math.max(1,r.width)*100),0,100),y=clamp(Math.round(g.focalY-(event.clientY-g.y)/Math.max(1,r.height)*100),0,100);
   g.item.frame.style.setProperty('--image-fit','cover');g.item.frame.style.setProperty('--image-x',x+'%');g.item.frame.style.setProperty('--image-y',y+'%');g.item.frame.querySelectorAll('img,video').forEach(n=>{n.style.objectFit='cover';n.style.objectPosition=x+'% '+y+'%';});send({action:'resize',path:g.item.path,focalX:x,focalY:y,fit:'cover'});return;
  }
  if(Math.hypot(event.clientX-g.x,event.clientY-g.y)<6&&!g.changed)return;g.changed=true;event.preventDefault();document.body.classList.add('canvas-dragging');
  const hit=document.elementFromPoint?.(event.clientX,event.clientY),target=hit?.closest('[data-section-id]'),card=hit?.closest('[data-project]'),source=g.item?.frame.closest('[data-project]');
  document.querySelectorAll('.canvas-drop-before,.canvas-drop-after').forEach(n=>n.classList.remove('canvas-drop-before','canvas-drop-after'));
  if(g.type==='cards'&&source&&card&&source!==card&&target?.dataset.sectionId===g.id){const r=card.getBoundingClientRect(),after=event.clientX>r.left+r.width/2;g.drop={kind:'project',slug:source.dataset.project,targetSlug:card.dataset.project,after};card.classList.add(after?'canvas-drop-after':'canvas-drop-before');}
  else if(target&&g.type==='section'){const r=target.getBoundingClientRect(),after=event.clientY>r.top+r.height/2;g.drop={targetId:target.dataset.sectionId,after};target.classList.add(after?'canvas-drop-after':'canvas-drop-before');}
 });
 on(document,'pointerup',()=>finishGesture());on(document,'pointercancel',()=>finishGesture(true));on(window,'blur',()=>finishGesture(true));
 on(selection,'pointerdown',event=>{const b=event.target.closest('button');if(b)beginObject(event,b.dataset.canvasAction==='resize'?'size':'move',b.dataset.value);});
 on(toolbar,'pointerdown',event=>{const b=event.target.closest('button');if(!b)return;const action=b.dataset.canvasAction;if(action==='drag-object')beginObject(event,'move');else if(action==='drag-section')beginLegacy(event,'section');else if(action==='reorder-cards')beginLegacy(event,'cards');else event.preventDefault();});
 on(toolbar,'click',event=>{
  const b=event.target.closest('button');if(!b)return;const action=b.dataset.canvasAction,item=images.get(selectedImage);
  if(action==='edit-text'){if(editing)stopText();else startText(picked.node);buildToolbar();}
  else if(action==='reset-position')objectChange(null);
  else if(action==='front'||action==='back')objectChange({layer:clamp((layoutValue()?.layer||1)+(action==='front'?1:-1),0,20)});
  else if(action==='replace'){const video=!item.srcPath.endsWith('.thumbnail')&&(item.srcPath.endsWith('.video')||item.frame.querySelector('video')||read(data,item.srcPath.replace(/\.src$/,'.type'))==='video');input.accept=video?'video/*,image/gif':'image/*,.heic,.heif';input.dataset.uploadPath=item.srcPath;input.value='';input.click();}
  else if(action==='preview-video'){input.accept='video/*,image/gif';input.dataset.uploadPath=item.path.replace(/\.thumbnailStyle$/,'.previewVideo');input.value='';input.click();}
  else if(action==='layout'){if(picked&&objects.record(picked))objectChange(null);transaction('image-layout',{position:b.dataset.value});}
  else if(action==='fit')transaction('image-fit',{fit:read(data,item.path+'.fit')==='cover'?'contain':'cover'});
  else if(action==='crop'){cropping=!cropping;buildToolbar();}
  else if(action==='caption'){item.caption.classList.remove('canvas-optional');item.caption.dataset.forceShow='true';startText(item.caption);}
  else if(action==='caption-visibility')transaction('caption-visibility',{visible:read(data,item.visiblePath)===false});
  else if(action==='details')send({action:'show-details',id:selectedId,imagePath:selectedImage,textPath:selectedText});
  else if(!['drag-object','drag-section','reorder-cards'].includes(action))transaction(action);
 });
 on(toolbar,'change',event=>{const type=event.target.dataset.canvasControl;if(type==='font-size')objectChange({fontSize:Number(event.target.value)});else if(type==='text-align')objectChange({align:event.target.value});else if(type==='aspect')transaction('image-aspect',{aspect:event.target.value});else if(type==='object-width'){if(gesture?.type==='slider'){gesture=null;send({action:'object-end'});}}});
 on(toolbar,'input',event=>{if(event.target.dataset.canvasControl!=='object-width'||!picked||!objects.active())return;if(!gesture){objectStart(picked);gesture={type:'slider',entry:picked,original:objects.record(picked)?model.clone(objects.record(picked)):null};}const width=Number(event.target.value),r=layoutValue();objectSave(picked,{...r,width,x:Math.min(r.x,100-width)});});
 on(input,'change',()=>{const item=images.get(selectedImage),file=input.files[0],path=input.dataset.uploadPath||item?.srcPath;if(item&&file&&path)send({action:'replace-file',id:selectedId,path,file});delete input.dataset.uploadPath;input.value='';});
 on(document,'pointerdown',event=>{
  if(overlay.contains(event.target)||event.target.closest('.carousel-controls,.preview-play'))return;
  const text=event.target.closest('[data-edit-path]');if(text&&text===editing)return;
  const image=event.target.closest('[data-canvas-image]'),node=text||image,entry=node&&objects.byNode.get(node);
  if(entry){announce(entry);if(image&&!text&&cropping)beginLegacy(event,'crop');else beginObject(event,'move');}
  else{const root=event.target.closest('[data-section-id]');if(root){stopText();select(root.dataset.sectionId);send({action:'select',id:selectedId,imagePath:'',textPath:''});}else stopText();}
 });
 on(document,'click',event=>{if(overlay.contains(event.target))return;if(event.target.closest('a'))event.preventDefault();if(suppressClick||editing||gesture)return;const node=event.target.closest('[data-edit-path],[data-canvas-image]');if(node&&objects.byNode.has(node))announce(objects.byNode.get(node));});
 on(document,'dblclick',event=>{const node=event.target.closest('[data-edit-path]');if(node){event.preventDefault();finishGesture();startText(node);}});
 on(document,'dragstart',event=>{if(event.target.closest('[data-edit-path],[data-canvas-image]'))event.preventDefault();});
 on(document,'dragover',event=>{if(event.dataTransfer?.types?.includes('Files'))event.preventDefault();});
 on(document,'drop',event=>{const node=event.target.closest('[data-canvas-image]'),file=event.dataTransfer?.files[0];if(node&&file){event.preventDefault();const item=images.get(node.dataset.canvasImage);send({action:'replace-file',id:item.sectionId,path:item.srcPath,file});}});
 function startText(node){
  if(!node||editing===node)return;stopText();announce(objects.byNode.get(node));editing=node;node.contentEditable='true';node.focus();send({action:'text-start',id:selectedId,path:node.dataset.editPath});
  const range=document.createRange();range.selectNodeContents(node);range.collapse(false);const sel=window.getSelection();sel.removeAllRanges();sel.addRange(range);buildToolbar();position();
 }
 function stopText(){if(!editing)return;const node=editing;editing=null;node.contentEditable='false';node.blur();send({action:'text-end',path:node.dataset.editPath});buildToolbar();position();}
 function changeText(node){
  const value=node.textContent.replace(/\r/g,'').replace(/\u00a0/g,' ');node.dataset.empty=String(!value.trim());write(data,node.dataset.editPath,value);for(const other of textNodes.get(node.dataset.editPath)||[])if(other!==node){other.textContent=value;other.dataset.empty=node.dataset.empty;}
  const row=node.closest('.section-row');if(row&&node.closest('.section-copy')&&value.trim()){row.classList.remove('photo-only');node.closest('.section-copy').classList.remove('canvas-empty-copy');}
  const image=images.get(node.dataset.captionFor);if(image){write(data,image.visiblePath,true);node.dataset.captionHidden='false';}send({action:'text-change',path:node.dataset.editPath,value,...(image?{visiblePath:image.visiblePath}:{})});queuePosition();
 }
 function insertText(node,text){const selection=window.getSelection();if(!selection.rangeCount)return;const range=selection.getRangeAt(0);if(!node.contains(range.commonAncestorContainer)&&range.commonAncestorContainer!==node)return;range.deleteContents();const added=document.createTextNode(text);range.insertNode(added);range.setStartAfter(added);range.collapse(true);selection.removeAllRanges();selection.addRange(range);changeText(node);}
 on(document,'input',event=>{const node=event.target.closest('[data-edit-path]');if(node)changeText(node);});
 on(document,'focusout',event=>{if(event.target===editing&&!overlay.contains(event.relatedTarget))stopText();});
 on(document,'paste',event=>{const node=event.target.closest('[data-edit-path]');if(node&&editing===node){event.preventDefault();insertText(node,(event.clipboardData?.getData('text/plain')||'').replace(/\r/g,'').replace(node.dataset.singleLine==='true'?/\n/g:/$^/g,' '));}});
 on(document,'keydown',event=>{
  if(overlay.contains(event.target))return;
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();stopText();transaction(event.shiftKey?'redo':'undo');return;}
  if(event.key==='Escape'){finishGesture(true);stopText();return;}
  if(editing){if(event.key==='Enter'){event.preventDefault();if(editing.dataset.singleLine==='true')stopText();else insertText(editing,'\n');}return;}
  if(!picked)return;
  if(picked.kind==='text'&&(event.key==='Delete'||event.key==='Backspace')){event.preventDefault();transaction('delete-text');return;}
  if(event.key.startsWith('Arrow')&&objects.active()){event.preventDefault();const r=layoutValue(),scope=objects.scopeFor(picked).getBoundingClientRect(),step=(event.shiftKey?10:1)/Math.max(1,scope.width)*100;objectChange({x:clamp(r.x+({ArrowLeft:-step,ArrowRight:step}[event.key]||0),0,100-r.width),y:Math.max(0,r.y+({ArrowUp:-step,ArrowDown:step}[event.key]||0))});return;}
  if(picked.kind==='text'&&(event.key==='Enter'||event.key==='F2')){event.preventDefault();startText(picked.node);return;}
  if(picked.kind==='text'&&event.key.length===1&&!event.ctrlKey&&!event.metaKey&&!event.altKey){event.preventDefault();const node=picked.node;startText(node);insertText(node,event.key);}
 });
 on(window,'scroll',()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(position);},{passive:true});on(window,'resize',queuePosition);
 const observer=new ResizeObserver(position);for(const entry of objects.entries)observer.observe(entry.node);
 document.body.classList.add('editing-preview','direct-editing-preview');
 const api={select,destroy(){events.abort();observer.disconnect();cancelAnimationFrame(frame);overlay.remove();document.body.classList.remove('canvas-dragging');}};active=api;return api;
}
window.PortfolioCanvas={mount,select:(...args)=>active?.select(...args),version:'slides-20260927-1'};
})();
