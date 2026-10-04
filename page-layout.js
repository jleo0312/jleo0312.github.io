/* Shared text and free-position layout for the public page and editing canvas. */
(function(){
'use strict';
const read=(object,path)=>path.split('.').reduce((value,key)=>value?.[key],object);
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const numeric=(value,fallback,min,max)=>Number.isFinite(Number(value))&&value!==''&&value!=null?clamp(Number(value),min,max):fallback;
function collect({data,key,settings,model,editing=false}){
 const info=model.pageInfo(data,key),values=model.sections(data,key),images=new Map(),textNodes=new Map();
 const sectionNode=id=>[...document.querySelectorAll('[data-section-id]')].find(node=>node.dataset.sectionId===id);
 const sectionBase=index=>info.project?`projects.${data.projects.indexOf(info.project)}.sections.${index}`:info.page?`pages.${data.pages.indexOf(info.page)}.sections.${index}`:`pageLayouts.${key}.sections.${index}`;
 function bind(node,path,label,{single=false}={}){
  if(!node)return;
  node.dataset.objectPath=path;node.dataset.objectLabel=label;node.dataset.singleLine=String(single);node.classList.add('portfolio-text');
  // Text nodes and line breaks stay plain text; pasted HTML never becomes website code.
  const value=read(data,path);if(value!=null)node.textContent=String(value);else{const copy=node.cloneNode(true);copy.querySelectorAll('br').forEach(br=>br.replaceWith('\n'));node.textContent=copy.textContent;}
  node.dataset.empty=String(!node.textContent.trim());
  if(!textNodes.has(path))textNodes.set(path,[]);textNodes.get(path).push(node);
 }
 function field(root,selector,path,label,{parent,tag='p',className='',optional=false,single=false,prepend=false}={}){
  let node=root.querySelector(selector);
  if(!node&&parent&&editing){node=document.createElement(tag);node.className=className;if(prepend)parent.prepend(node);else parent.append(node);}
  if(node){if(optional&&!node.textContent.trim())node.classList.add('canvas-optional');bind(node,path,label,{single});}
  return node;
 }
 const shell=[['.brand','website.identity.brand','Website name'],['[data-nav="about"]','website.navigation.about','About navigation'],['[data-nav="gallery"]','website.navigation.gallery','Gallery navigation'],['.footer-inner > :first-child','website.footer.left','Left footer text'],['.footer-inner > :last-child','website.footer.right','Right footer text']];
 for(const [selector,path,label]of shell){const node=document.querySelector(selector);if(node){bind(node,path,label,{single:path.includes('navigation')});}}
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
    let intro=root.querySelector('.hobbies-intro');if(!intro&&editing){intro=document.createElement('p');intro.className='hobbies-intro canvas-optional';content.querySelector('h2').after(intro);}bind(intro,'hobbiesIntro','Add an introduction under Hobbies');
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
    const row=root.querySelector('.section-row');let copy=root.querySelector('.section-copy');if(!copy&&editing){copy=document.createElement('div');copy.className='section-copy canvas-empty-copy';row?.append(copy);}
    field(root,'.section-copy h2',path+(photo?'.title':'.heading'),'Add a heading beside this photo',{parent:copy,tag:'h2',optional:true,prepend:true});
    const text=field(root,'.section-copy p',path+'.text','Click to write beside this photo',{parent:copy,optional:true});if(text&&photo?.text==null&&photo?.caption){text.textContent=photo.caption;text.dataset.empty='false';}
    break;
   }
   case 'text':case 'heading':{
    const wrap=root.querySelector('.text-section');field(root,'h1,h2,h3',base+'.heading','Add a heading',{parent:wrap,tag:section.headingLevel||'h2',optional:true,prepend:true});if(section.type==='text')field(root,'.text-section > p',base+'.text','Click to write',{parent:wrap});break;
   }
   case 'video':{const wrap=root.querySelector('.content-section');field(root,'h2',base+'.heading','Video heading',{parent:wrap,tag:'h2',optional:true,prepend:true});field(root,'.content-section > p',base+'.text','Write about this video',{parent:wrap,optional:true});break;}
  }
  if(Array.isArray(section.textBoxes)&&section.textBoxes.length){const layer=document.createElement('div');layer.className='wrap free-text-layer';root.append(layer);for(const [boxIndex,box]of section.textBoxes.entries()){const node=document.createElement('p');node.className='free-text-box';node.textContent=box.text||'';layer.append(node);bind(node,base+'.textBoxes.'+boxIndex+'.text','Text box');}}
  root.querySelectorAll('.project-card[data-project]').forEach(card=>{const i=data.projects.findIndex(p=>p.slug===card.dataset.project);if(i<0)return;bind(card.querySelector('h3'),`projects.${i}.title`,'Project title',{single:true});bind(card.querySelector('.cover-type'),`projects.${i}.coverText`,'Project cover text');bind(card.querySelector('.cover-label'),'website.project.coverLabel','Cover label',{single:true});bind(card.querySelector('.cover-bottom'),'website.project.coverMark','Cover mark',{single:true});});
  root.querySelectorAll('[data-image-style]').forEach(frame=>{
   const path=frame.dataset.imageStyle;if(!path)return;let srcPath='',captionPath=path+'.caption',visiblePath=path+'.showCaption',layoutPath=base+'.imagePosition',scope=frame.closest('.section-row,.hero-with-photo,.about-grid')||frame.parentElement;
   if(path==='heroImage')srcPath='heroPhoto';
   else if(path==='portraitImage'){srcPath='portrait';captionPath='personal';}
   else if(/^hobbies\.\d+\.imageStyle$/.test(path)){srcPath=path.replace('.imageStyle','.photo');layoutPath=path+'.position';scope=frame.closest('.hobby-card');}
   else if(path.includes('.photos.')){srcPath=path.replace(/\.imageStyle$/,'.src');captionPath=path.replace(/\.imageStyle$/,'.shortCaption');visiblePath=path.replace(/\.imageStyle$/,'.showCaption');}
   else if(path.endsWith('.thumbnailStyle')){srcPath=path.replace(/\.thumbnailStyle$/,'.thumbnail');if(frame.closest('.project-card')){layoutPath=path+'.position';scope=frame.closest('.project-link');}}
   else if(path.endsWith('.videoStyle')){srcPath=path.replace(/\.videoStyle$/,'.video');layoutPath='';}
   else if(path.includes('.items.')){srcPath=path.replace(/\.imageStyle$/,'.src');layoutPath='';}
   else if(path.includes('.sections.')){const video=section.type==='video'||section.type==='videoText';srcPath=path.replace(/\.imageStyle$/,video?'.video':'.image');captionPath=path.replace(/\.imageStyle$/,'.caption');visiblePath=path.replace(/\.imageStyle$/,'.showCaption');if(video)layoutPath='';}
   let caption=frame.querySelector('figcaption')||frame.parentElement.querySelector(':scope > .image-caption');
   if(!caption&&editing){caption=document.createElement(frame.tagName==='FIGURE'?'figcaption':'p');caption.className='image-caption canvas-optional';if(frame.classList.contains('thumbnail'))frame.after(caption);else frame.append(caption);}
   if(caption){bind(caption,captionPath,'Click to add a caption');caption.dataset.captionFor=path;caption.dataset.captionHidden=String(read(data,visiblePath)===false);}
   const item={frame,path,srcPath,captionPath,visiblePath,layoutPath,scope,sectionId:section.id,caption};
   if(!images.has(path)||!frame.closest('[inert]'))images.set(path,item);
   frame.dataset.objectImage=path;
  });
 }
 return {info,values,images,textNodes};
}
function stableKey(data,path){
 let value=data;return path.split('.').map(part=>{const next=value?.[part],key=Array.isArray(value)?String(next?.id||next?.slug||part):part;value=next;return key;}).join('/');
}
function clean(record={}){
 const result={id:String(record.id),x:numeric(record.x,0,0,100),y:numeric(record.y,0,0,500),width:numeric(record.width,100,5,100)};
 for(const [name,max]of [['height',2400],['fontSize',160],['layer',20]])if(record[name]!=null)result[name]=numeric(record[name],0,0,max);
 if(['left','center','right'].includes(record.align))result.align=record.align;
 if(typeof record.targetSection==='string'&&record.targetSection.length<200)result.targetSection=record.targetSection;
 return result;
}
function setArray(data,path,value){
 const parts=path.split('.');if(parts.some(p=>['__proto__','prototype','constructor'].includes(p)))return;
 let at=data;parts.forEach((p,i)=>{if(i===parts.length-1)at[p]=value;else at=at[p]||=(/^\d+$/.test(parts[i+1])?[]:{});});
}
function mount(options){
 const {data,key,model}=options,collection=collect(options),{info,values,textNodes,images}=collection;
 const entries=[],byNode=new Map(),originals=new Map(),grown=new Map(),events=new AbortController();let raf=0,busy=false;
 const sectionBase=i=>info.project?`projects.${data.projects.indexOf(info.project)}.sections.${i}`:info.page?`pages.${data.pages.indexOf(info.page)}.sections.${i}`:`pageLayouts.${key}.sections.${i}`;
 function describe(node,path,kind){
  const section=node.closest('[data-section-id]'),id=section?.dataset.sectionId||'',index=values.findIndex(s=>s.id===id),shell=node.closest('header')?'header':'footer';
  const layoutPath=index>=0?sectionBase(index)+'.elements':`website.elementLayouts.${shell}`;
  const scope=(kind==='text'&&node.closest('[data-object-image]'))||node.closest('.hobby-card,.project-card')||node.closest('.hero-with-photo,.about-grid,.section-row,.text-section,.gallery-intro,.gallery-meta,.project-end,.nav,.footer-inner')||section||node.parentElement;
  const entry={node,path,kind,sectionId:id,layoutPath,id:kind+':'+stableKey(data,path),scope,root:section||node.closest('header,footer')||scope};
  entry.node.dataset.objectKind=kind;entries.push(entry);byNode.set(node,entry);return entry;
 }
 for(const [path,nodes]of textNodes)for(const node of nodes)describe(node,path,'text');
 document.querySelectorAll('[data-object-image]').forEach(node=>describe(node,node.dataset.objectImage,'image'));
 const layoutRecords=entry=>{const value=read(data,entry.layoutPath);return Array.isArray(value)?value:[];};
 const record=entry=>layoutRecords(entry).find(item=>item?.id===entry.id);
 const scopeFor=(entry,r=record(entry))=>r?.targetSection&&!entry.node.dataset.captionFor?[...document.querySelectorAll('[data-section-id]')].find(n=>n.dataset.sectionId===r.targetSection)||entry.scope:entry.scope;
 const active=()=>window.innerWidth>650;
 function restore(){
  for(const [node,style]of originals){if(style===null)node.removeAttribute('style');else node.setAttribute('style',style);node.classList.remove('portfolio-positioned');}originals.clear();
  for(const [node,style]of grown){if(style===null)node.removeAttribute('style');else node.setAttribute('style',style);}grown.clear();
 }
 function refresh(){
  if(busy)return;busy=true;restore();
  if(!active()){busy=false;return;}
  const placed=[];
  for(const entry of entries){
   const saved=record(entry);if(!saved)continue;const r=clean(saved),scope=scopeFor(entry,r).getBoundingClientRect();if(scope.width<1)continue;
   const node=entry.node;originals.set(node,node.getAttribute('style'));node.classList.add('portfolio-positioned');
   node.style.setProperty('--object-width',scope.width*r.width/100+'px');node.style.setProperty('--object-x','0px');node.style.setProperty('--object-y','0px');
   if(r.fontSize&&entry.kind==='text')node.style.fontSize=r.fontSize+'px';
   if(r.align)node.style.setProperty('--object-align',r.align);
   if(r.height){if(entry.kind==='text')node.style.setProperty('--object-height',r.height+'px');else{const caption=node.querySelector('figcaption'),extra=caption?caption.getBoundingClientRect().height+12:0;node.style.setProperty('--object-media-height',Math.max(40,r.height-extra)+'px');}}
   node.style.setProperty('--object-layer',r.layer??1);placed.push({entry,r});
  }
  // Measure all normal-flow positions before translating any parent or child.
  const positions=placed.map(({entry,r})=>{const scope=scopeFor(entry,r).getBoundingClientRect(),box=entry.node.getBoundingClientRect();return {entry,r,scope,box};});
  for(const {entry,r,scope,box}of positions){
   const x=clamp(scope.width*r.x/100,0,Math.max(0,scope.width-box.width)),y=scope.width*r.y/100;
   entry.node.style.setProperty('--object-x',scope.left+x-box.left+'px');entry.node.style.setProperty('--object-y',scope.top+y-box.top+'px');
  }
  const roots=new Map();
  for(const {entry,r}of placed){const rootNode=r.targetSection?scopeFor(entry,r):entry.root,rect=entry.node.getBoundingClientRect(),root=rootNode.getBoundingClientRect();roots.set(rootNode,Math.max(roots.get(rootNode)||0,rect.bottom-root.bottom));}
  for(const [root,extra]of roots){if(extra<=0)continue;grown.set(root,root.getAttribute('style'));
   if(root.matches('header')){const nav=root.querySelector('.nav');if(nav){grown.set(nav,nav.getAttribute('style'));nav.style.height=nav.getBoundingClientRect().height+'px';}root.style.height=root.getBoundingClientRect().height+extra+16+'px';}
   else root.style.paddingBottom=(parseFloat(getComputedStyle(root).paddingBottom)||0)+extra+16+'px';
  }
  busy=false;
 }
 function schedule(){cancelAnimationFrame(raf);raf=requestAnimationFrame(refresh);}
 function capture(entry){
  const previous=record(entry),scope=scopeFor(entry).getBoundingClientRect(),box=entry.node.getBoundingClientRect();
  return clean({...previous,id:entry.id,x:(box.left-scope.left)/Math.max(1,scope.width)*100,y:(box.top-scope.top)/Math.max(1,scope.width)*100,width:box.width/Math.max(1,scope.width)*100});
 }
 function save(entry,value){
  const next=layoutRecords(entry).filter(item=>item?.id!==entry.id);if(value)next.push(clean({...value,id:entry.id}));setArray(data,entry.layoutPath,next);refresh();return next;
 }
 for(const image of document.images)image.addEventListener('load',schedule,{signal:events.signal});
 window.addEventListener('resize',schedule,{signal:events.signal});document.fonts?.ready.then(()=>{if(!events.signal.aborted)schedule();});
 const observer=new ResizeObserver(schedule);for(const node of new Set(entries.map(e=>e.scope)))observer.observe(node);
 refresh();
 const api={...collection,entries,byNode,record,scopeFor,capture,save,refresh,schedule,active,clean,destroy(){events.abort();observer.disconnect();cancelAnimationFrame(raf);restore();}};
 window.PortfolioObjects.current=api;return api;
}
window.PortfolioObjects={mount,stableKey,clean,current:null};
})();
