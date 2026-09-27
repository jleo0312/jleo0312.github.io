/* Direct, plain-text editing and responsive image placement for the portfolio preview. */
(function(){
'use strict';
let active;
const read=(object,path)=>path.split('.').reduce((value,key)=>value?.[key],object);
const write=(object,path,value)=>{const parts=path.split('.');if(parts.some(key=>['__proto__','constructor','prototype'].includes(key)))return;let target=object;parts.forEach((key,i)=>{if(i===parts.length-1)target[key]=value;else target=target[key]||= /^\d+$/.test(parts[i+1])?[]:{};});};
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
function mount({data,key,settings,model,send}){
 active?.destroy();
 const events=new AbortController(),on=(node,name,fn,options={})=>node?.addEventListener(name,fn,{...options,signal:events.signal});
 const info=model.pageInfo(data,key),values=model.sections(data,key),images=new Map(),textNodes=new Map();
 let selectedId='',selectedImage='',gesture=null,drop=null,focusPath='',startedText=false,positionFrame,cropping=false;
 const overlay=document.createElement('div');overlay.className='canvas-ui';overlay.setAttribute('contenteditable','false');document.body.append(overlay);
 const toolbar=document.createElement('div');toolbar.className='canvas-toolbar';toolbar.setAttribute('role','toolbar');toolbar.setAttribute('aria-label','Selected content controls');overlay.append(toolbar);
 const selection=document.createElement('div');selection.className='canvas-image-selection';selection.hidden=true;overlay.append(selection);
 const divider=document.createElement('button');divider.type='button';divider.className='canvas-column-resize';divider.textContent='↔';divider.title='Drag to change the photo and text column widths';divider.setAttribute('aria-label',divider.title);divider.hidden=true;overlay.append(divider);
 const hint=document.createElement('div');hint.className='canvas-drop-hint';hint.hidden=true;overlay.append(hint);
 const input=document.createElement('input');input.type='file';input.hidden=true;overlay.append(input);
 const sectionNode=id=>[...document.querySelectorAll('[data-section-id]')].find(node=>node.dataset.sectionId===id);
 const sectionBase=index=>info.project?`projects.${data.projects.indexOf(info.project)}.sections.${index}`:info.page?`pages.${data.pages.indexOf(info.page)}.sections.${index}`:`pageLayouts.${key}.sections.${index}`;
 function bind(node,path,label,{single=false}={}){
  if(!node)return;
  node.dataset.editPath=path;node.dataset.editLabel=label;node.dataset.singleLine=String(single);node.contentEditable='true';node.spellcheck=true;node.setAttribute('role','textbox');node.setAttribute('aria-label',label);node.setAttribute('aria-multiline',String(!single));node.setAttribute('tabindex','0');
  // Text nodes and line breaks stay plain text; pasted HTML never becomes website code.
  const value=read(data,path);if(value!=null)node.textContent=String(value);else{const copy=node.cloneNode(true);copy.querySelectorAll('br').forEach(br=>br.replaceWith('\n'));node.textContent=copy.textContent;}
  node.dataset.empty=String(!node.textContent.trim());
  if(!textNodes.has(path))textNodes.set(path,[]);textNodes.get(path).push(node);
 }
 function field(root,selector,path,label,{parent,tag='p',className='',optional=false,single=false,prepend=false}={}){
  let node=root.querySelector(selector);
  if(!node&&parent){node=document.createElement(tag);node.className=className;if(prepend)parent.prepend(node);else parent.append(node);}
  if(node){if(optional&&!node.textContent.trim())node.classList.add('canvas-optional');bind(node,path,label,{single});}
  return node;
 }
 const shell=[['.brand','website.identity.brand','Website name'],['[data-nav="about"]','website.navigation.about','About navigation'],['[data-nav="gallery"]','website.navigation.gallery','Gallery navigation'],['.footer-inner > :first-child','website.footer.left','Left footer text'],['.footer-inner > :last-child','website.footer.right','Right footer text']];
 for(const [selector,path,label]of shell){const node=document.querySelector(selector);if(node){node.hidden=false;bind(node,path,label,{single:!path.includes('footer')});}}
 document.querySelector('footer').hidden=false;
 document.querySelectorAll('[data-custom-nav]').forEach(node=>{const i=(data.pages||[]).findIndex(page=>page.slug===node.dataset.customNav);if(i>=0)bind(node,`pages.${i}.title`,'Page navigation title',{single:true});});
 for(const [index,section]of values.entries()){
  const root=sectionNode(section.id);if(!root)continue;const base=sectionBase(index),projectBase=info.project?`projects.${data.projects.indexOf(info.project)}`:'';
  root.dataset.canvasIndex=index;
  switch(section.type){
   case 'hero':{
    const copy=root.querySelector('.hero-copy');field(root,'.eyebrow','website.home.eyebrow','Small heading',{parent:copy,className:'eyebrow',prepend:true,optional:true});
    let heading=copy.querySelector('h1');if(!heading){heading=document.createElement('h1');copy.append(heading);}
    heading.replaceChildren();const first=document.createElement('span'),second=document.createElement('span');first.className='canvas-hero-first';first.textContent=settings.home.headline;second.textContent=settings.home.subheadline;heading.append(first,document.createElement('br'),second);bind(first,'website.home.headline','Main heading');bind(second,'website.home.subheadline','Second heading line');
    field(root,'.pill','website.home.button','Button text',{parent:copy,tag:'a',className:'pill',optional:true,single:true});break;
   }
   case 'about':field(root,'h2','website.home.aboutTitle','About section heading',{parent:root.querySelector('.about-portrait-column'),tag:'h2',prepend:true});field(root,'.about-copy p','bio','About me',{parent:root.querySelector('.about-copy')});break;
   case 'hobbies':{
    const content=root.querySelector('.hobbies-section');field(root,'h2','website.home.hobbiesTitle','Hobbies heading',{parent:content,tag:'h2',prepend:true});
    let intro=root.querySelector('.hobbies-intro');if(!intro){intro=document.createElement('p');intro.className='hobbies-intro canvas-optional';content.querySelector('h2').after(intro);}bind(intro,'hobbiesIntro','Add an introduction under Hobbies');
    root.querySelectorAll('.hobby-card').forEach((card,i)=>{const copy=card.querySelector('.hobby-copy');field(card,'h3',`hobbies.${i}.title`,'Hobby title',{parent:copy,tag:'h3',prepend:true});field(card,'.hobby-copy p',`hobbies.${i}.text`,'Write about this hobby',{parent:copy});});break;
   }
   case 'highlights':field(root,'.section-heading h2','website.home.highlightsTitle','Highlights heading',{parent:root.querySelector('.section-heading'),tag:'h2',prepend:true});field(root,'.section-heading .text-link','website.home.galleryLink','Gallery link text',{single:true});break;
   case 'galleryIntro':{const wrap=root.querySelector('.gallery-intro');field(root,'.eyebrow','website.gallery.eyebrow','Small gallery heading',{parent:wrap,className:'eyebrow',prepend:true});field(root,'h1','website.gallery.headline','Gallery heading',{parent:wrap,tag:'h1'});field(root,'.page-subtitle','website.gallery.subtitle','Gallery description',{parent:wrap,className:'page-subtitle'});break;}
   case 'galleryGrid':field(root,'.gallery-meta > :first-child','website.gallery.allProjects','Gallery list label');break;
   case 'projectIntro':field(root,'.back','website.project.back','Back link',{single:true});field(root,'h1',projectBase+'.title','Project title',{single:true});field(root,'.project-description',projectBase+'.description','Project description',{parent:root.querySelector('.detail-heading'),className:'page-subtitle project-description'});break;
   case 'projectEnd':field(root,'.project-end > span','website.project.endText','Project footer text');field(root,'.project-end .pill','website.project.galleryButton','Gallery button',{single:true});break;
   case 'projectPhoto':case 'projectThumbnail':case 'photoText':{
    const photo=section.type==='projectPhoto'?model.photoSource(data,key,section):null;
    const path=photo?`${projectBase}.photos.${info.project.photos.indexOf(photo)}`:base;
    const row=root.querySelector('.section-row');let copy=root.querySelector('.section-copy');if(!copy){copy=document.createElement('div');copy.className='section-copy canvas-empty-copy';row?.append(copy);}
    field(root,'.section-copy h2',path+(photo?'.title':'.heading'),'Add a heading beside this photo',{parent:copy,tag:'h2',optional:true,prepend:true});
    const text=field(root,'.section-copy p',path+'.text','Click to write beside this photo',{parent:copy,optional:true});if(photo?.text==null&&photo?.caption){text.textContent=photo.caption;text.dataset.empty='false';}
    break;
   }
   case 'text':case 'heading':{
    const wrap=root.querySelector('.text-section');field(root,'h1,h2,h3',base+'.heading','Add a heading',{parent:wrap,tag:section.headingLevel||'h2',optional:true,prepend:true});if(section.type==='text')field(root,'.text-section > p',base+'.text','Click to write',{parent:wrap});break;
   }
   case 'video':{const wrap=root.querySelector('.content-section');field(root,'h2',base+'.heading','Video heading',{parent:wrap,tag:'h2',optional:true,prepend:true});field(root,'.content-section > p',base+'.text','Write about this video',{parent:wrap,optional:true});break;}
  }
  root.querySelectorAll('.project-card[data-project]').forEach(card=>{const i=data.projects.findIndex(p=>p.slug===card.dataset.project);if(i<0)return;bind(card.querySelector('h3'),`projects.${i}.title`,'Project title',{single:true});bind(card.querySelector('.cover-type'),`projects.${i}.coverText`,'Project cover text');bind(card.querySelector('.cover-label'),'website.project.coverLabel','Cover label',{single:true});bind(card.querySelector('.cover-bottom'),'website.project.coverMark','Cover mark',{single:true});});
  root.querySelectorAll('[data-image-style]').forEach(frame=>{
   const path=frame.dataset.imageStyle;if(!path)return;let srcPath='',captionPath=path+'.caption',visiblePath=path+'.showCaption',layoutPath=base+'.imagePosition',scope=frame.closest('.section-row,.hero-with-photo,.about-grid')||frame.parentElement;
   if(path==='heroImage')srcPath='heroPhoto';
   else if(path==='portraitImage'){srcPath='portrait';captionPath='personal';}
   else if(/^hobbies\.\d+\.imageStyle$/.test(path)){srcPath=path.replace('.imageStyle','.photo');layoutPath=path+'.position';scope=frame.closest('.hobby-card');}
   else if(path.includes('.photos.')){srcPath=path.replace(/\.imageStyle$/,'.src');captionPath=path.replace(/\.imageStyle$/,'.shortCaption');visiblePath=path.replace(/\.imageStyle$/,'.showCaption');}
   else if(path.endsWith('.thumbnailStyle')){srcPath=path.replace(/\.thumbnailStyle$/,'.thumbnail');if(frame.closest('.project-card')){layoutPath=path+'.position';scope=frame.closest('.project-link');}}
   else if(path.endsWith('.videoStyle')){srcPath=path.replace(/\.videoStyle$/,'.video');layoutPath='';}
   else if(path.includes('.sections.')){srcPath=path.replace(/\.imageStyle$/,section.type==='video'?'.video':'.image');captionPath=path.replace(/\.imageStyle$/,'.caption');visiblePath=path.replace(/\.imageStyle$/,'.showCaption');if(section.type==='video')layoutPath='';}
   let caption=frame.querySelector('figcaption')||frame.parentElement.querySelector(':scope > .image-caption');
   if(!caption){caption=document.createElement(frame.tagName==='FIGURE'?'figcaption':'p');caption.className='image-caption canvas-optional';if(frame.classList.contains('thumbnail'))frame.after(caption);else frame.append(caption);}
   bind(caption,captionPath,'Click to add a caption');caption.dataset.captionFor=path;caption.dataset.captionHidden=String(read(data,visiblePath)===false);
   const item={frame,path,srcPath,captionPath,visiblePath,layoutPath,scope,sectionId:section.id,caption};
   if(!images.has(path)||!frame.closest('[inert]'))images.set(path,item);
   frame.dataset.canvasImage=path;frame.querySelectorAll('img,video').forEach(node=>{node.draggable=false;node.setAttribute('draggable','false');});
  });
 }
 function button(label,action,value='',title=label){const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.canvasAction=action;b.dataset.value=value;b.title=title;b.setAttribute('aria-label',title);return b;}
 function buildToolbar(){
  toolbar.replaceChildren();const item=images.get(selectedImage),section=values.find(s=>s.id===selectedId);
  toolbar.hidden=!item&&!section;
  if(item){
   const move=button('✥ Drag photo','drag-photo','','Drag the photo to change its position');move.className='canvas-grab';toolbar.append(move,button('Replace','replace'));
   for(const [value,label]of [['left','Photo left'],['right','Photo right'],['above','Above text'],['below','Below text']])if(item.layoutPath){const b=button(label,'layout',value);b.setAttribute('aria-pressed',String(read(data,item.layoutPath)===value));toolbar.append(b);}
   const align=document.createElement('select');align.dataset.canvasControl='align';align.setAttribute('aria-label','Image alignment');for(const [v,t]of [['left','Align left'],['center','Align center'],['right','Align right']])align.add(new Option(t,v));align.value=read(data,item.path+'.align')||'center';toolbar.append(align);
   const aspect=document.createElement('select');aspect.dataset.canvasControl='aspect';aspect.setAttribute('aria-label','Image proportions');for(const [v,t]of [['auto','Original shape'],['square','Square'],['portrait','Portrait'],['landscape','Landscape'],['wide','Wide']])aspect.add(new Option(t,v));aspect.value=read(data,item.path+'.aspect')||'auto';toolbar.append(aspect);
   const label=document.createElement('label');label.className='canvas-width';label.textContent='Width ';const slider=document.createElement('input');slider.type='range';slider.min='10';slider.max='100';slider.value=read(data,item.path+'.width')||'100';slider.dataset.canvasControl='width';slider.setAttribute('aria-label','Image width');label.append(slider);toolbar.append(label);
   const fit=button(read(data,item.path+'.fit')==='cover'?'Show whole photo':'Fill / crop','fit');toolbar.append(fit,button(cropping?'Done cropping':'Move crop','crop'),button('Edit caption','caption'));
   if(item.caption.textContent.trim())toolbar.append(button(read(data,item.visiblePath)===false?'Show caption':'Hide caption','caption-visibility'));
   toolbar.append(button('More controls','details'));
  }else if(section){
   const label=document.createElement('span');label.className='canvas-toolbar-label';label.textContent=model.types[section.type]||'Section';toolbar.append(label);
   const move=button('✥ Move section','drag-section','','Drag to reorder this section');move.className='canvas-grab';toolbar.append(move);
   for(const [label,action]of [['↑','up'],['↓','down'],['Duplicate','duplicate'],['Hide','hide'],['Delete','delete'],['+ Section','add'],['More controls','details']])toolbar.append(button(label,action));
  }
 }
 function select(id,path=''){
  if(path!==selectedImage)cropping=false;
  selectedId=id||'';selectedImage=images.has(path)?path:'';
  document.querySelectorAll('.selected-section').forEach(node=>node.classList.remove('selected-section'));sectionNode(selectedId)?.classList.add('selected-section');
  document.querySelectorAll('.canvas-selected-image').forEach(node=>node.classList.remove('canvas-selected-image'));images.get(selectedImage)?.frame.classList.add('canvas-selected-image');
  buildToolbar();position();
 }
 function announce(id,path=''){select(id,path);send({action:'select',id,imagePath:path});}
 function position(){
  const item=images.get(selectedImage);selection.hidden=!item;divider.hidden=true;if(!item)return;
  const box=item.frame.querySelector('.image-box,video')||item.frame,r=box.getBoundingClientRect();
  Object.assign(selection.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});
  const copy=item.scope.querySelector('.section-copy,.hero-copy,.about-copy');
  if(copy&&item.layoutPath.endsWith('.imagePosition')&&getComputedStyle(item.scope).display==='grid'&&window.innerWidth>650){
   const text=copy.getBoundingClientRect(),pane=(item.frame.closest('.photo-pane,.about-portrait-column')||item.frame).getBoundingClientRect();
   const left=pane.left>text.left?(text.right+pane.left)/2:(pane.right+text.left)/2;
   divider.hidden=false;divider.style.left=left-14+'px';divider.style.top=clamp(r.top+r.height/2,90,window.innerHeight-50)+'px';
  }
 }
 for(const side of ['nw','n','ne','e','se','s','sw','w']){const handle=button('','resize',side,side==='e'||side==='w'?'Drag to change image width':side==='n'||side==='s'?'Drag to change image height':'Drag to resize image');handle.className='canvas-resize canvas-resize-'+side;selection.append(handle);}
 function applySize(item,width,height){
  item.frame.classList.add(item.frame.classList.contains('thumbnail')?'thumbnail-custom':item.frame.classList.contains('video-frame')?'video-custom':'image-custom');
  item.frame.style.setProperty('--image-width',width+'%');item.frame.style.width=width+'%';item.frame.style.maxWidth='100%';
  if(height!=null){item.frame.style.setProperty('--image-height',height?height+'px':'auto');item.frame.style.setProperty('--image-ratio','auto');}
  position();
 }
 function transaction(action,values={}){send({action:'canvas-command',command:action,id:selectedId,imagePath:selectedImage,...values});}
 function beginResize(event,side){
  const item=images.get(selectedImage);if(!item)return;event.preventDefault();event.stopPropagation();const frame=item.frame.getBoundingClientRect(),box=(item.frame.querySelector('.image-box,video')||item.frame).getBoundingClientRect(),parent=item.frame.parentElement.getBoundingClientRect();
  gesture={type:'resize',side,item,x:event.clientX,y:event.clientY,width:frame.width,height:box.height,parentWidth:parent.width,changed:false};
  send({action:'resize-start',id:item.sectionId,path:item.path});document.body.classList.add('canvas-dragging');
 }
 function capture(event){try{event.target.setPointerCapture?.(event.pointerId);}catch{}}
 function beginMove(event,type,item){if(event.button!==0||event.target.closest('[data-edit-path]'))return;capture(event);gesture={type,item,id:selectedId,x:event.clientX,y:event.clientY,changed:false};if(type==='image'&&cropping){gesture.type='crop';gesture.focalX=Number(read(data,item.path+'.focalX')??50);gesture.focalY=Number(read(data,item.path+'.focalY')??50);send({action:'resize-start',id:selectedId,path:item.path});}}
 function finishGesture(cancel=false){
  if(!gesture)return;const g=gesture;gesture=null;document.body.classList.remove('canvas-dragging');hint.hidden=true;document.querySelectorAll('.canvas-drop-before,.canvas-drop-after').forEach(n=>n.classList.remove('canvas-drop-before','canvas-drop-after'));
  if(['resize','columns','crop'].includes(g.type)){send({action:'resize-end'});return;}
  if(!cancel&&g.changed&&drop){if(drop.type==='section')transaction('move-to',{targetId:drop.id,after:drop.after});else if(drop.type==='project')transaction('move-project',{slug:drop.slug,targetSlug:drop.targetSlug,after:drop.after});else if(drop.type==='layout')transaction('image-layout',{path:g.item.layoutPath,position:drop.value});else transaction('image-align',{align:drop.value});}
  drop=null;
 }
 function updateDrop(event,g){
  const hit=document.elementFromPoint(event.clientX,event.clientY),target=hit?.closest('[data-section-id]'),targetCard=hit?.closest('[data-project]'),sourceCard=g.item?.frame.closest('[data-project]');
  document.querySelectorAll('.canvas-drop-before,.canvas-drop-after').forEach(n=>n.classList.remove('canvas-drop-before','canvas-drop-after'));
  if(g.type==='image'&&sourceCard&&targetCard&&sourceCard.dataset.project!==targetCard.dataset.project&&target?.dataset.sectionId===g.id){
   const bounds=targetCard.getBoundingClientRect(),after=event.clientX>bounds.left+bounds.width/2;drop={type:'project',slug:sourceCard.dataset.project,targetSlug:targetCard.dataset.project,after};targetCard.classList.add(after?'canvas-drop-after':'canvas-drop-before');hint.textContent=after?'Move project after this one':'Move project before this one';
  }else if(target&&(g.type==='section'||target.dataset.sectionId!==g.id)){
   const bounds=target.getBoundingClientRect(),after=event.clientY>bounds.top+bounds.height/2;drop={type:'section',id:target.dataset.sectionId,after};target.classList.add(after?'canvas-drop-after':'canvas-drop-before');hint.textContent=after?'Move section below':'Move section above';
  }else if(g.item){
   const r=g.item.scope.getBoundingClientRect(),x=(event.clientX-r.left)/Math.max(1,r.width),y=(event.clientY-r.top)/Math.max(1,r.height);
   if(g.item.layoutPath&&g.item.scope.querySelector('.section-copy,.hero-copy,.about-copy,.hobby-copy,.card-heading')){const value=y<.23?'above':y>.77?'below':x<.5?'left':'right';drop={type:'layout',value};hint.textContent={above:'Photo above text',below:'Photo below text',left:'Photo left · text right',right:'Photo right · text left'}[value];}
   else{const value=x<.33?'left':x>.67?'right':'center';drop={type:'align',value};hint.textContent='Align '+value;}
  }else drop=null;
  hint.hidden=!drop;hint.style.left=clamp(event.clientX+16,8,window.innerWidth-230)+'px';hint.style.top=clamp(event.clientY+18,75,window.innerHeight-55)+'px';
 }
 on(document,'pointermove',event=>{
  if(!gesture)return;const g=gesture;
  if(g.type==='crop'){
   event.preventDefault();const r=g.item.frame.getBoundingClientRect(),x=clamp(Math.round(g.focalX-(event.clientX-g.x)/Math.max(1,r.width)*100),0,100),y=clamp(Math.round(g.focalY-(event.clientY-g.y)/Math.max(1,r.height)*100),0,100);
   g.item.frame.style.setProperty('--image-fit','cover');g.item.frame.style.setProperty('--image-x',x+'%');g.item.frame.style.setProperty('--image-y',y+'%');
   g.item.frame.querySelectorAll('img,video').forEach(node=>{node.style.objectFit='cover';node.style.objectPosition=x+'% '+y+'%';});
   send({action:'resize',path:g.item.path,focalX:x,focalY:y,fit:'cover'});return;
  }
  if(g.type==='columns'){
   event.preventDefault();const width=clamp(Math.round((g.width+(event.clientX-g.x)*(g.right?-1:1))/g.total*100),10,90),other=100-width;
   g.item.scope.style.gridTemplateColumns=g.right?`minmax(0,${other}fr) minmax(0,${width}fr)`:`minmax(0,${width}fr) minmax(0,${other}fr)`;
   applySize(g.item,100);send({action:'columns-change',id:g.item.sectionId,path:g.item.path,imageWidth:width,textWidth:other,position:g.right?'right':'left'});return;
  }
  if(g.type==='resize'){
   event.preventDefault();const dx=event.clientX-g.x,dy=event.clientY-g.y;let width=clamp(Math.round((g.width+(g.side.includes('w')?-dx:dx))/Math.max(1,g.parentWidth)*100),10,100),height;
   if(g.side==='n'||g.side==='s'){width=clamp(Math.round(g.width/Math.max(1,g.parentWidth)*100),10,100);height=clamp(Math.round(g.height+(g.side==='n'?-dy:dy)),40,1200);}else if(g.side.length===2&&read(data,g.item.path+'.height'))height=clamp(Math.round(g.height*(width/100*g.parentWidth)/g.width),40,1200);
   g.changed=true;applySize(g.item,width,height);write(data,g.item.path+'.width',width);if(height!=null)write(data,g.item.path+'.height',height);send({action:'resize',path:g.item.path,width,...(height==null?{}:{height})});return;
  }
  if(Math.hypot(event.clientX-g.x,event.clientY-g.y)<6&&!g.changed)return;
  event.preventDefault();g.changed=true;document.body.classList.add('canvas-dragging');updateDrop(event,g);
  if(event.clientY<90)window.scrollBy(0,-14);else if(event.clientY>window.innerHeight-50)window.scrollBy(0,14);
 },{passive:false});
 on(document,'pointerup',()=>finishGesture());on(document,'pointercancel',()=>finishGesture(true));on(window,'blur',()=>finishGesture(true));
 on(selection,'pointerdown',event=>{const handle=event.target.closest('[data-value]');if(handle){capture(event);beginResize(event,handle.dataset.value);}});
 on(divider,'pointerdown',event=>{
  event.preventDefault();capture(event);const item=images.get(selectedImage),copy=item.scope.querySelector('.section-copy,.hero-copy,.about-copy');if(!copy)return;
  const pane=(item.frame.closest('.photo-pane,.about-portrait-column')||item.frame).getBoundingClientRect(),text=copy.getBoundingClientRect();
  gesture={type:'columns',item,x:event.clientX,width:pane.width,total:Math.max(1,pane.width+text.width),right:pane.left>text.left};send({action:'resize-start',id:item.sectionId,path:item.path});document.body.classList.add('canvas-dragging');
 });
 on(toolbar,'pointerdown',event=>{const b=event.target.closest('button');if(!b)return;if(b.dataset.canvasAction==='drag-photo')beginMove(event,'image',images.get(selectedImage));else if(b.dataset.canvasAction==='drag-section')beginMove(event,'section');else event.preventDefault();});
 on(toolbar,'click',event=>{
  const b=event.target.closest('button');if(!b)return;const action=b.dataset.canvasAction,item=images.get(selectedImage);
  if(action==='layout')transaction('image-layout',{path:item.layoutPath,position:b.dataset.value});
  else if(action==='replace'){input.accept=item.srcPath.endsWith('.video')?'video/*,image/gif':'image/*';input.value='';input.click();}
  else if(action==='fit')transaction('image-fit',{fit:read(data,item.path+'.fit')==='cover'?'contain':'cover'});
  else if(action==='crop'){cropping=!cropping;buildToolbar();hint.textContent='Drag inside the photo to move its crop';hint.style.left='16px';hint.style.top=toolbar.getBoundingClientRect().bottom+10+'px';hint.hidden=!cropping;}
  else if(action==='caption'){item.caption.classList.remove('canvas-optional');item.caption.dataset.forceShow='true';item.caption.focus();}
  else if(action==='caption-visibility')transaction('caption-visibility',{visible:read(data,item.visiblePath)===false});
  else if(action==='details')send({action:'show-details',id:selectedId,imagePath:selectedImage});
  else if(!action.startsWith('drag-'))transaction(action);
 });
 on(toolbar,'change',event=>{if(event.target.dataset.canvasControl==='align')transaction('image-align',{align:event.target.value});if(event.target.dataset.canvasControl==='aspect')transaction('image-aspect',{aspect:event.target.value});if(event.target.dataset.canvasControl==='width')send({action:'resize-end'});});
 on(toolbar,'pointerdown',event=>{if(event.target.dataset.canvasControl==='width')send({action:'resize-start',id:selectedId,path:selectedImage});});
 on(toolbar,'keydown',event=>{if(event.target.dataset.canvasControl==='width'&&event.key.startsWith('Arrow'))send({action:'resize-start',id:selectedId,path:selectedImage});});
 on(toolbar,'input',event=>{if(event.target.dataset.canvasControl==='width'){const item=images.get(selectedImage),width=Number(event.target.value);applySize(item,width);write(data,item.path+'.width',width);send({action:'resize',path:item.path,width});}});
 on(input,'change',()=>{const item=images.get(selectedImage);if(item&&input.files[0])send({action:'replace-file',id:selectedId,path:item.srcPath,file:input.files[0]});});
 on(document,'pointerdown',event=>{
  if(overlay.contains(event.target)||event.target.closest('[data-edit-path]'))return;
  const frame=event.target.closest('[data-canvas-image]'),root=event.target.closest('[data-section-id]');
  if(frame&&images.has(frame.dataset.canvasImage)){event.preventDefault();announce(root.dataset.sectionId,frame.dataset.canvasImage);beginMove(event,'image',images.get(selectedImage));}
  else if(root)announce(root.dataset.sectionId);
 });
 on(document,'click',event=>{
  if(overlay.contains(event.target))return;
  if(event.target.closest('a'))event.preventDefault();
  if(event.target.closest('[data-edit-path],.carousel-controls'))return;
  const frame=event.target.closest('[data-canvas-image]'),root=event.target.closest('[data-section-id]');if(root&&!gesture)announce(root.dataset.sectionId,frame?.dataset.canvasImage||'');
 });
 on(document,'dragstart',event=>{if(event.target.closest('[data-canvas-image]'))event.preventDefault();});
 on(document,'dragover',event=>{if(event.dataTransfer?.types?.includes('Files'))event.preventDefault();});
 on(document,'drop',event=>{const frame=event.target.closest('[data-canvas-image]'),file=event.dataTransfer?.files[0];if(frame&&file){event.preventDefault();const item=images.get(frame.dataset.canvasImage);send({action:'replace-file',id:item.sectionId,path:item.srcPath,file});}});
 function startText(node){if(focusPath===node.dataset.editPath&&startedText)return;focusPath=node.dataset.editPath;startedText=true;const root=node.closest('[data-section-id]');announce(root?.dataset.sectionId||'');send({action:'text-start',id:root?.dataset.sectionId||'',path:focusPath});}
 function changeText(node){startText(node);const value=node.textContent.replace(/\r/g,'').replace(/\u00a0/g,' ');node.dataset.empty=String(!value.trim());write(data,node.dataset.editPath,value);for(const other of textNodes.get(node.dataset.editPath)||[])if(other!==node){other.textContent=value;other.dataset.empty=node.dataset.empty;}
  const row=node.closest('.section-row');if(row&&node.closest('.section-copy')&&value.trim()){row.classList.remove('photo-only');node.closest('.section-copy').classList.remove('canvas-empty-copy');}
  const image=images.get(node.dataset.captionFor);if(image){write(data,image.visiblePath,true);node.dataset.captionHidden='false';}send({action:'text-change',path:node.dataset.editPath,value,...(image?{visiblePath:image.visiblePath}:{})});position();
 }
 function insertText(node,text){const selection=window.getSelection();if(!selection.rangeCount)return;const range=selection.getRangeAt(0);if(!node.contains(range.commonAncestorContainer)&&range.commonAncestorContainer!==node)return;range.deleteContents();const added=document.createTextNode(text);range.insertNode(added);range.setStartAfter(added);range.collapse(true);selection.removeAllRanges();selection.addRange(range);changeText(node);}
 on(document,'focusin',event=>{const node=event.target.closest('[data-edit-path]');if(node)startText(node);});
 on(document,'input',event=>{const node=event.target.closest('[data-edit-path]');if(node)changeText(node);});
 on(document,'focusout',event=>{const node=event.target.closest('[data-edit-path]');if(node){startedText=false;send({action:'text-end',path:node.dataset.editPath});}});
 on(document,'paste',event=>{const node=event.target.closest('[data-edit-path]');if(node){event.preventDefault();insertText(node,(event.clipboardData?.getData('text/plain')||'').replace(/\r/g,'').replace(node.dataset.singleLine==='true'?/\n/g:/$^/g,' '));}});
 on(document,'keydown',event=>{
  const node=event.target.closest('[data-edit-path]');
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();send({action:'canvas-command',command:event.shiftKey?'redo':'undo'});return;}
  if(event.key==='Escape'){finishGesture(true);node?.blur();return;}
  if(node&&event.key==='Enter'){event.preventDefault();if(node.dataset.singleLine==='true')node.blur();else insertText(node,'\n');}
 });
 on(window,'scroll',()=>{cancelAnimationFrame(positionFrame);positionFrame=requestAnimationFrame(position);},{passive:true});on(window,'resize',position);
 const observer=new ResizeObserver(position);for(const item of images.values())observer.observe(item.frame);
 for(const image of document.images)on(image,'load',position);
 document.body.classList.add('editing-preview','direct-editing-preview');
 const api={select,destroy(){events.abort();observer.disconnect();cancelAnimationFrame(positionFrame);overlay.remove();document.body.classList.remove('canvas-dragging');}};active=api;return api;
}
window.PortfolioCanvas={mount,select:(...args)=>active?.select(...args),version:'direct-20260926-1'};
})();
