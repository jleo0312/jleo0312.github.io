/* Shared data model for the portfolio, Pages CMS and the visual editor. */
(function (root) {
  'use strict';
  const clone = value => JSON.parse(JSON.stringify(value));
  const id = () => 'section-' + (root.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2));
  const types = { hero:'Homepage introduction', about:'About me', hobbies:'Hobbies', highlights:'Project highlights', galleryIntro:'Gallery introduction', galleryGrid:'Project gallery', projectIntro:'Project introduction', projectVideo:'Project video', projectPhoto:'Project photo', projectThumbnail:'Project cover photo', projectEnd:'Project footer', photoText:'Photo and text', text:'Text', heading:'Heading', video:'Video / GIF', spacer:'Spacer' };
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
      if(Array.isArray(target.sections))target.sections.forEach((section,i)=>{section.id ||= 'saved-section-'+i+'-'+hash(JSON.stringify(section));section.type ||= 'photoText';});
    }
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
  function makeSection(type='photoText') { return {id:id(),type,visible:true,...(type==='photoText'?{image:'',heading:'',text:'',caption:'',showCaption:true,imagePosition:'left',imageWidth:56,textWidth:44}:type==='heading'?{heading:'New heading'}:type==='text'?{text:''}:type==='video'?{video:'',caption:'',showCaption:true}:{})}; }
  function photoSource(data,key,section) {const project=pageInfo(data,key)?.project; return project?.photos?.find(p=>p.id===section.sourceId);}
  function deleteSection(data,key,index) {const values=sections(data,key,true),section=values[index];if(!section)return;const project=pageInfo(data,key)?.project;if(section.type==='projectPhoto'&&project)project.photos=project.photos.filter(p=>p.id!==section.sourceId);values.splice(index,1);}
  function duplicateSection(data,key,index) {const values=sections(data,key,true),section=clone(values[index]);section.id=id();if(section.type==='projectPhoto'){const photo=clone(photoSource(data,key,section));photo.id=id();pageInfo(data,key).project.photos.push(photo);section.sourceId=photo.id;}values.splice(index+1,0,section);return section;}
  function reorder(data,key,from,to) {const values=sections(data,key,true);if(from<0||to<0||from>=values.length||to>=values.length)return;const [value]=values.splice(from,1);values.splice(to,0,value);}
  function validate(data) {
    if(!data || typeof data!=='object' || !Array.isArray(data.projects))throw new Error('Choose a portfolio content file.');
    const seen=new Set();for(const project of data.projects){if(!project.slug||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(project.slug)||seen.has(project.slug))throw new Error('Every project needs a unique address using lowercase letters, numbers and dashes.');seen.add(project.slug);}
    const pageNames=new Set(['home','about','gallery']);for(const page of data.pages||[]){if(!page.slug||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(page.slug)||pageNames.has(page.slug))throw new Error('Every extra page needs a unique address.');pageNames.add(page.slug);}
    for(const info of pages(data)){const used=new Set();for(const section of sections(data,info.key)){if(!types[section.type])throw new Error('Unknown section type on '+info.title);if(used.has(section.id))throw new Error('Duplicate section on '+info.title);used.add(section.id);}}
    return true;
  }
  root.PortfolioModel={clone,id,types,numeric,upgrade,pageInfo,pages,container,defaults,sections,makeSection,photoSource,deleteSection,duplicateSection,reorder,validate};
})(typeof window==='undefined'?globalThis:window);
