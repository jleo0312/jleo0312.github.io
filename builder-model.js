/* Shared data model for the portfolio, Pages CMS and the visual editor. */
(function (root) {
  'use strict';
  const clone = value => JSON.parse(JSON.stringify(value));
  const id = () => 'section-' + (root.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2));
  const types = { hero:'Homepage introduction', about:'About me', hobbies:'Hobbies', highlights:'Project highlights', galleryIntro:'Gallery introduction', galleryGrid:'Project gallery', projectIntro:'Project introduction', projectVideo:'Project video', projectPhoto:'Project photo', projectThumbnail:'Project cover photo', projectEnd:'Project footer', photoText:'Photo and text', text:'Text', heading:'Heading', video:'Video / GIF', videoText:'Video + text', mediaPair:'Media row', mediaCarousel:'Photo / video carousel', spacer:'Spacer' };
  const numeric = (value, fallback, min, max) => value != null && value !== '' && Number.isFinite(Number(value)) ? Math.max(min, Math.min(max, Number(value))) : fallback;
  const hash = text => [...String(text)].reduce((n,c)=>((n*31+c.charCodeAt(0))>>>0),0).toString(36);
  function upgrade(input) {
    const data = clone(input || {});
    data.projects = Array.isArray(data.projects) ? data.projects : [];
    if (!data.visualEditorVersion) {
      const truck = data.projects.find(p => p.slug === 'toyota-engine-swap');
      if (truck) {
        truck.photos = Array.isArray(truck.photos) ? truck.photos : [];
        // Keep the cover that the original project page displayed as its only photo.
        if (!truck.photos.length && !truck.video && truck.thumbnail) truck.photos.push({src:truck.thumbnail, alt:truck.title});
        if (!truck.photos.some(p => ['/truck-engine-swap-work.png','/media/truck-engine-swap-work.png'].includes(p.src))) truck.photos.push({src:'/truck-engine-swap-work.png',alt:'Working on the Toyota pickup with an engine hoist.'});
      }
      data.visualEditorVersion = 1;
    }
    data.projects.forEach(project => (Array.isArray(project.photos) ? project.photos : []).forEach((photo,i) => {
      // The installation stores this supplied photo beside the homepage. Keep older drafts working.
      if (photo.src === '/media/truck-engine-swap-work.png') photo.src = '/truck-engine-swap-work.png';
      photo.id ||= 'photo-' + i + '-' + hash(photo.src);
    }));
    for(const target of [...Object.values(data.pageLayouts||{}),...data.projects,...(data.pages||[])]) {
      if(Array.isArray(target.sections))target.sections.forEach((section,i)=>{section.id ||= 'saved-section-'+i+'-'+hash(JSON.stringify(section));section.type ||= 'photoText';if(Array.isArray(section.textBoxes))section.textBoxes.forEach((box,j)=>{box.id ||= 'text-'+j+'-'+hash(box.text||'');});});
    }
    ensureFutureGallery(data);
    return data;
  }
  function pageInfo(data,key) {
    if (['home','about','gallery'].includes(key)) return {key,kind:key,title:{home:'Homepage',about:'About page',gallery:'Gallery'}[key],url:key==='home'?'/' : key==='gallery'?'/?view=gallery':'/?page=about'};
    if (key.startsWith('project:')) { const project=data.projects.find(p=>p.slug===key.slice(8)); if(project)return {key,kind:'project',title:project.title,project,url:'/?project='+encodeURIComponent(project.slug)}; }
    if (key.startsWith('page:')) { const page=(data.pages||[]).find(p=>p.slug===key.slice(5));if(page)return {key,kind:'page',title:page.title,page,url:'/?page='+encodeURIComponent(page.slug)}; }
    return null;
  }
  function pages(data) { return ['home','about','gallery',...data.projects.map(p=>'project:'+p.slug),...(data.pages||[]).map(p=>'page:'+p.slug)].map(key=>pageInfo(data,key)); }
  function container(data,key,create=false) {
    const info=pageInfo(data,key); if(!info)return null;
    if(info.project)return info.project;
    if(info.page)return info.page;
    if(create) { data.pageLayouts ||= {};data.pageLayouts[key] ||= {}; }
    return data.pageLayouts?.[key] || null;
  }
  function defaults(data,key) {
    const info=pageInfo(data,key);if(!info)return [];
    let result=[];
    if(info.kind==='home') result=['hero','about','hobbies','highlights'];
    if(info.kind==='about') result=['about','hobbies'];
    if(info.kind==='gallery') result=['galleryIntro','galleryGrid'];
    if(info.project) {
      result=['projectIntro','projectVideo',...(info.project.photos||[]).map(photo=>({type:'projectPhoto',sourceId:photo.id,id:'legacy-'+photo.id})),...(!(info.project.photos||[]).length&&!info.project.video&&info.project.thumbnail?['projectThumbnail']:[]),'projectEnd'];
    }
    if(info.page) result=[{type:'heading',heading:info.page.title}];
    return result.map((value,i)=>typeof value==='string'?{id:'original-'+value,type:value,visible:true}:{visible:true,id:'original-'+i,...value});
  }
  function sections(data,key,materialize=false) {
    const target=container(data,key,materialize),info=pageInfo(data,key);
    const stored=Array.isArray(target?.sections)?target.sections:[];
    const custom=Array.isArray(target?.sections)&&(target.useSections===true||(info?.page&&stored.length>0));
    let values=custom?stored:defaults(data,key);
    // Adding a first section in Pages CMS extends the original page until the visual editor takes over its order.
    if(!custom&&stored.length){values=values.slice();const end=values.findIndex(s=>s.type==='projectEnd');values.splice(end<0?values.length:end,0,...stored);}
    // Photos added later through the original CMS fields also appear in custom layouts.
    if(info?.project && custom) {
      const missing=(info.project.photos||[]).filter(photo=>!values.some(s=>s.type==='projectPhoto'&&s.sourceId===photo.id));
      if(missing.length) {values=values.slice();const end=values.findIndex(s=>s.type==='projectEnd');values.splice(end<0?values.length:end,0,...missing.map(photo=>({id:'legacy-'+photo.id,type:'projectPhoto',sourceId:photo.id,visible:true})));}
    }
    if(materialize){target.sections=values;target.useSections=true;}
    return values;
  }
  function makeCarouselItem(){return {id:id(),type:'image',src:'',alt:'',imageStyle:{fit:'cover',aspect:'square'}};}
  function makeSection(type='photoText') {
    if(type==='mediaCarousel')return {id:id(),type,visible:true,heading:'Photo / video carousel',autoplay:true,seconds:3,items:Array.from({length:6},makeCarouselItem)};
    if(['mediaPair','mediaPair2','mediaPair3'].includes(type))return {id:id(),type:'mediaPair',visible:true,items:Array.from({length:type==='mediaPair3'?3:2},makeCarouselItem),text:''};
    return {id:id(),type,visible:true,...(type==='photoText'?{image:'',heading:'',text:'',caption:'',showCaption:true,imagePosition:'left',imageWidth:56,textWidth:44}:type==='heading'?{heading:'New heading'}:type==='text'?{text:''}:type==='video'?{video:'',caption:'',showCaption:true}:{})};
  }
  function photoSource(data,key,section) {const project=pageInfo(data,key)?.project; return project?.photos?.find(p=>p.id===section.sourceId);}
  const mediaLayouts=[['photoText','Photo and text'],['mediaPair2','Double media + text'],['mediaPair3','Triple media + text'],['mediaCarousel','Photo / video carousel']];
  function layoutOptions(section) {
    if(['photoText','mediaPair','mediaCarousel','video','videoText'].includes(section?.type))return mediaLayouts;
    if(['text','heading'].includes(section?.type))return [['text','Text'],['heading','Heading']];
    return [];
  }
  function layoutType(section) {return section?.type==='mediaPair'?'mediaPair'+(section.items?.length===3?3:2):['video','videoText'].includes(section?.type)?'photoText':section?.type;}
  // Keep source files, captions and crop settings when moving media between presets.
  function sectionMedia(section) {
    if(['mediaPair','mediaCarousel'].includes(section.type))return clone(section.items||[]);
    const video=['video','videoText'].includes(section.type),style=clone(section.imageStyle||{});
    if(section.caption!=null)style.caption=section.caption;
    if(section.showCaption!=null)style.showCaption=section.showCaption;
    if(video){if(section.loop!=null)style.loop=section.loop;if(section.muted!=null)style.muted=section.muted;}
    return [{type:video?'video':'image',src:(video?section.video:section.image)||'',alt:section.alt||'',imageStyle:style,...(video?{poster:section.poster||'',gifLike:section.gifLike===true}:{})}];
  }
  function hasMedia(item) {return !!(item.src||item.poster||item.imageStyle?.poster||item.imageStyle?.previewVideo||item.imageStyle?.caption||item.alt);}
  function hasAttachedMedia(item) {return !!(item.src||item.poster||item.imageStyle?.poster||item.imageStyle?.previewVideo);}
  function singleMedia(item,sectionId=id()) {
    const video=item.type==='video',style=clone(item.imageStyle||{});
    return {id:sectionId,type:video?'videoText':'photoText',visible:true,heading:'',text:'',alt:item.alt||'',imageStyle:style,caption:style.caption||'',showCaption:style.showCaption!==false,...(video?{video:item.src||'',poster:item.poster||'',gifLike:item.gifLike===true,videoPosition:'left'}:{image:item.src||'',imagePosition:'left',imageWidth:56,textWidth:44})};
  }
  function layoutPlan(section,target) {
    if(!layoutOptions(section).some(([value])=>value===target))throw new Error('Choose a compatible section layout.');
    let media=sectionMedia(section);const slots=target==='mediaCarousel'?Math.max(6,media.length):target==='mediaPair3'?3:target==='mediaPair2'?2:target==='photoText'?1:0;
    // Empty cards can still have captions or alt text. Keep real media first
    // when shrinking, so an empty middle card cannot displace a later photo.
    if(media.length>slots)media=[...media.filter(hasAttachedMedia),...media.filter(item=>!hasAttachedMedia(item)&&hasMedia(item))];
    const overflow=media.slice(slots).filter(hasMedia),occupied=media.filter(hasMedia);
    const photos=occupied.every(item=>item.type!=='video'&&!item.imageStyle?.previewVideo);
    return {slots,media,overflow,count:occupied.length,kind:photos?'photo':'media item'};
  }
  function changeLayout(data,key,index,target) {
    const values=sections(data,key,true),original=values[index];
    if(!original)throw new Error('This section is no longer available.');
    const plan=layoutPlan(original,target),media=plan.media;
    const common=clone(original);
    for(const name of ['type','items','image','video','poster','alt','imageStyle','caption','showCaption','gifLike','loop','muted'])delete common[name];
    // A new preset uses its own placement; keep layouts for manually added text boxes.
    common.elements=(common.elements||[]).filter(element=>element.id.includes('/textBoxes/'));
    let changed;
    if(target.startsWith('mediaPair')){
      changed={...common,type:'mediaPair',items:media.slice(0,plan.slots),text:original.text||''};
      while(changed.items.length<plan.slots)changed.items.push(makeSection('mediaPair2').items[0]);
      if(original.heading){changed.textBoxes||=[];changed.textBoxes.unshift({id:id(),text:original.heading});delete changed.heading;}
    }else if(target==='mediaCarousel'){
      changed={...common,type:'mediaCarousel',autoplay:original.autoplay??true,seconds:original.seconds??3,items:media.map(item=>({...item,id:item.id||id()}))};
      while(changed.items.length<plan.slots)changed.items.push(makeCarouselItem());
      if(original.text){changed.textBoxes||=[];changed.textBoxes.push({id:id(),text:original.text});delete changed.text;}
    }else if(target==='photoText'){
      const item=media[0]||{type:'image',src:'',imageStyle:{}};
      changed={...singleMedia(item,original.id),...common};
    }else changed={...common,type:target};
    values.splice(index,1,changed,...plan.overflow.map(item=>({...singleMedia(item),visible:original.visible,contentWidth:original.contentWidth,panelStyle:original.panelStyle?clone(original.panelStyle):undefined})));
    return changed;
  }
  function projectPlacement(project) {return project.gallerySection==='future'?'future':'main';}
  function galleryProjects(data,placement='main') {return data.projects.filter(project=>project.showInGallery!==false&&projectPlacement(project)===placement);}
  function futureHeading(section) {return section.projectSection==='future'||['more-projects','future-projects'].includes(section.id)||/^(more|future)\s+projects$/i.test(String(section.heading||'').trim());}
  function legacyProjectEntries(data) {
    const result=[];let future=false;
    for(const section of sections(data,'gallery')) {
      if(futureHeading(section)){future=true;continue;}
      if(['heading','galleryIntro'].includes(section.type)||section.type==='text'&&section.heading)future=false;
      if(!future||!['mediaPair','mediaCarousel','photoText','video','videoText'].includes(section.type))continue;
      const items=sectionMedia(section),seen=new Map();
      items.forEach((item,index)=>{
        if(!hasMedia(item))return;
        const title=String(item.imageStyle?.caption||item.alt||section.heading||'Untitled project').trim().split('\n')[0];
        const identity=item.id||hash(JSON.stringify(item)),occurrence=seen.get(identity)||0;seen.set(identity,occurrence+1);
        result.push({id:'media:'+section.id+':'+identity+':'+occurrence,kind:'media',title,placement:'future',sectionId:section.id,itemIndex:index,visible:section.visible!==false,thumbnail:item.type==='video'?item.poster||item.imageStyle?.poster||'':item.src||item.imageStyle?.poster||'',item});
      });
    }
    return result;
  }
  function projectEntries(data) {
    return [...data.projects.map(project=>({id:'project:'+project.slug,kind:'project',title:project.title,slug:project.slug,placement:projectPlacement(project),visible:project.showInGallery!==false,thumbnail:project.thumbnail||'',project})),...legacyProjectEntries(data)];
  }
  function ensureFutureGallery(data) {
    if(!data.projects.some(project=>projectPlacement(project)==='future'))return;
    const values=sections(data,'gallery',true);
    if(values.some(section=>section.type==='galleryGrid'&&section.projectSection==='future'))return;
    let heading=values.findIndex(futureHeading);
    if(heading<0){heading=values.length;values.push({id:id(),type:'heading',projectSection:'future',heading:'Future Projects',visible:true,textAlign:'center',spacingTop:72,spacingBottom:24});}
    let end=heading+1;
    while(end<values.length&&!(['heading','galleryIntro'].includes(values[end].type)||values[end].type==='text'&&values[end].heading))end++;
    values.splice(end,0,{id:id(),type:'galleryGrid',projectSection:'future',visible:true});
  }
  function setProjectPlacement(data,entryId,placement) {
    if(!['main','future'].includes(placement))throw new Error('Choose Main gallery or Future projects.');
    const entry=projectEntries(data).find(value=>value.id===entryId);
    if(!entry)throw new Error('This project is no longer available.');
    let project=entry.project;
    if(!project){
      // Convert an old standalone gallery card only when it is moved.
      // Its complete media record also lives on its new project page.
      const item=clone(entry.item),stem=entry.title.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'project';
      let slug=stem,suffix=2;while(data.projects.some(value=>value.slug===slug))slug=stem+'-'+suffix++;
      const style=clone(item.imageStyle||{}),video=item.type==='video';
      project={title:entry.title,slug,gallerySection:placement,showInGallery:entry.visible,featuredOnHomepage:false,photos:[],thumbnail:entry.thumbnail,thumbnailAlt:item.alt||entry.title,thumbnailStyle:style,previewVideo:video?item.src||'':style.previewVideo||'',thumbnailMotion:video?(item.gifLike?'loop':'controls'):style.previewBehavior||'hover',previewStyle:clone(style.previewStyle||{}),useSections:true,sections:[{id:id(),type:'projectIntro',visible:true},{id:id(),type:'mediaPair',visible:true,items:[item],text:''},{id:id(),type:'projectEnd',visible:true}]};
      data.projects.push(project);
      const values=sections(data,'gallery',true),section=values.find(value=>value.id===entry.sectionId);
      if(Array.isArray(section.items)){
        section.items.splice(entry.itemIndex,1);
        // Re-indexed cards get the preset layout; retain free text-box placement.
        section.elements=(section.elements||[]).filter(element=>element.id.includes('/textBoxes/'));
        if(!section.items.length){section.type='text';delete section.items;}
      }else{
        for(const name of ['image','video','poster','alt','imageStyle','caption','showCaption','gifLike','loop','muted'])delete section[name];
        section.type='text';
        section.elements=(section.elements||[]).filter(element=>element.id.includes('/textBoxes/'));
      }
    }
    project.gallerySection=placement;ensureFutureGallery(data);
    return project;
  }
  // Every media slot keeps its original source field; optional previews live with its image style.
  function mediaPaths(data,path) {
    const read=p=>p.split('.').reduce((value,key)=>value?.[key],data);
    const ownerPath=path.replace(/\.(?:imageStyle|videoStyle|thumbnailStyle)$/,''),owner=read(ownerPath)||{};
    const card=path.endsWith('.thumbnailStyle'),primaryVideo=path.endsWith('.videoStyle')||path.endsWith('.imageStyle')&&['video','videoText'].includes(owner.type);
    let srcPath='';
    if(path==='heroImage')srcPath='heroPhoto';
    else if(path==='portraitImage')srcPath='portrait';
    else if(/^hobbies\.\d+\.imageStyle$/.test(path))srcPath=ownerPath+'.photo';
    else if(card)srcPath=ownerPath+'.thumbnail';
    else if(path.endsWith('.videoStyle'))srcPath=ownerPath+'.video';
    else if(path.includes('.photos.')||path.includes('.items.'))srcPath=ownerPath+'.src';
    else srcPath=ownerPath+(primaryVideo?'.video':'.image');
    const fallbackImage=primaryVideo?(path.endsWith('.videoStyle')?owner.thumbnail:owner.poster)||'':'';
    const defaultFit=card?(owner.thumbnailFit==='contain'?'contain':'cover'):primaryVideo||path.includes('.photos.')||owner.type==='photoText'?'contain':'cover';
    return {basePath:path,srcPath,primaryVideo,imageSrcPath:primaryVideo?path+'.poster':srcPath,videoSrcPath:primaryVideo?srcPath:card?ownerPath+'.previewVideo':path+'.previewVideo',previewPath:card?ownerPath+'.previewStyle':path+'.previewStyle',motionPath:card?ownerPath+'.thumbnailMotion':path+'.previewBehavior',fallbackImage,defaultFit,defaultMotion:primaryVideo?(owner.gifLike?'loop':'controls'):'hover'};
  }
  function deleteSection(data,key,index) {const values=sections(data,key,true),section=values[index];if(!section)return;const project=pageInfo(data,key)?.project;if(section.type==='projectPhoto'&&project)project.photos=project.photos.filter(p=>p.id!==section.sourceId);values.splice(index,1);}
  function duplicateSection(data,key,index) {
    const values=sections(data,key,true),section=clone(values[index]),oldId=section.id,replacements=new Map();section.id=id();replacements.set(oldId,section.id);
    if(section.type==='projectPhoto'){const source=photoSource(data,key,section);if(source){const photo=clone(source);photo.id=id();replacements.set(source.id,photo.id);pageInfo(data,key).project.photos.push(photo);section.sourceId=photo.id;}}
    for(const element of section.elements||[]){element.id=element.id.split('/').map(part=>replacements.get(part)||part).join('/');if(element.targetSection===oldId)element.targetSection=section.id;}
    values.splice(index+1,0,section);return section;
  }
  function reorder(data,key,from,to) {const values=sections(data,key,true);if(from<0||to<0||from>=values.length||to>=values.length)return;const [value]=values.splice(from,1);values.splice(to,0,value);}
  function validate(data) {
    if(!data || typeof data!=='object' || !Array.isArray(data.projects))throw new Error('Choose a portfolio content file.');
    const seen=new Set();for(const project of data.projects){if(!project.slug||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(project.slug)||seen.has(project.slug))throw new Error('Every project needs a unique address using lowercase letters, numbers and dashes.');seen.add(project.slug);}
    const pageNames=new Set(['home','about','gallery']);for(const page of data.pages||[]){if(!page.slug||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(page.slug)||pageNames.has(page.slug))throw new Error('Every extra page needs a unique address.');pageNames.add(page.slug);}
    for(const info of pages(data)){const used=new Set();for(const section of sections(data,info.key)){if(!types[section.type])throw new Error('Unknown section type on '+info.title);if(used.has(section.id))throw new Error('Duplicate section on '+info.title);used.add(section.id);}}
    return true;
  }
  root.PortfolioModel={clone,id,types,makeCarouselItem,numeric,upgrade,pageInfo,pages,container,defaults,sections,makeSection,photoSource,layoutOptions,layoutType,layoutPlan,changeLayout,projectPlacement,galleryProjects,projectEntries,ensureFutureGallery,setProjectPlacement,mediaPaths,deleteSection,duplicateSection,reorder,validate};
})(typeof window==='undefined'?globalThis:window);
