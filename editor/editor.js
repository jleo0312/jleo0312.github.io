(function(){
'use strict';
const M=window.PortfolioModel,defaults=window.PortfolioDefaults,$=s=>document.querySelector(s),clone=M.clone;
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const REPO='jleo0312/jleo0312.github.io',API='https://api.github.com/repos/'+REPO;
let data,baseData,baseSha='',key='home',selected='',mode='section',imagePath='',textPath='',objectEditing=false,objectSnapshot=null,objectChanged=false,token='',dirty=false,ready=false,device=1200,saving=false,history=[],future=[],assets=new Map(),pendingUpload='',pendingMotionPath='',pendingMotion='',mediaTarget='',mediaTargetMotionPath='',newKind='page',draftRecord=null,draftTimer,previewTimer,fieldEditing=false,resizeEditing=false,inlineEditing=false,previewLoadTimer;
const get=(path,fallback='')=>{const value=path.split('.').reduce((o,k)=>o?.[k],data);return value??fallback;};
function set(path,value){const parts=path.split('.');if(parts.some(p=>['__proto__','prototype','constructor'].includes(p)))throw new Error('Invalid field.');let at=data;parts.forEach((p,i)=>{if(i===parts.length-1)at[p]=value;else{if(!at[p]||typeof at[p]!=='object')at[p]=/^\d+$/.test(parts[i+1])?[]:{};at=at[p];if(['heroImage','portraitImage','imageStyle','thumbnailStyle','videoStyle','previewStyle'].includes(p))at.enabled=true;}});}
function status(text){$('#status').textContent=text;}
function mark(refresh=true){dirty=true;status('Draft changes · not published');clearTimeout(draftTimer);draftTimer=setTimeout(saveDraft,500);clearTimeout(previewTimer);if(refresh&&!objectEditing)previewTimer=setTimeout(preview,120);updateUndo();}
function remember(){history.push(clone(data));if(history.length>60)history.shift();future=[];updateUndo();}
function updateUndo(){$('#undo').disabled=!history.length;$('#redo').disabled=!future.length;}
function mutate(fn){remember();fn();mark();renderAll();}
function sectionList(){return M.sections(data,key,true);}
function section(){return sectionList().find(s=>s.id===selected);}
function sectionLabel(s){return s.type==='mediaPair'&&[2,3].includes(s.items?.length)?(s.items.length===2?'Double media + text':'Triple media + text'):M.types[s.type]||'Section';}
let menuSection='',layoutSection='',layoutPage='';
function closeSectionMenu(restoreFocus=false){$('#section-menu').hidden=true;if(restoreFocus)outlineButton(menuSection)?.focus();}
function outlineButton(id){return [...$('#sections').querySelectorAll('[data-select]')].find(button=>button.dataset.select===id);}
function showSectionMenu(id,x,y){
 selectSection(id);menuSection=id;const menu=$('#section-menu'),canChange=M.layoutOptions(section()).length>1;
 $('#menu-layout').disabled=!canChange;$('#menu-layout').title=canChange?'Choose a preset layout':'This section uses the page’s built-in layout. Use Edit section for its controls.';
 menu.hidden=false;menu.style.left=Math.max(4,Math.min(x,innerWidth-menu.offsetWidth-4))+'px';menu.style.top=Math.max(4,Math.min(y,innerHeight-menu.offsetHeight-4))+'px';
 (canChange?$('#menu-layout'):$('#menu-controls')).focus();
}
function openLayout(id){
 closeSectionMenu();selectSection(id);const s=section(),options=M.layoutOptions(s);if(options.length<2)return;
 layoutSection=id;layoutPage=key;$('#layout-current').textContent='Current layout: '+sectionLabel(s);
 $('#layout-preset').innerHTML=options.map(([value,label])=>`<option value="${value}">${escape(label)}</option>`).join('');$('#layout-preset').value=M.layoutType(s);
 if(!$('#layout-preset').value)$('#layout-preset').value=options[0][0];
 updateLayoutWarning();$('#layout-dialog').showModal();$('#layout-preset').focus();
}
function updateLayoutWarning(){
 const s=M.sections(data,layoutPage).find(value=>value.id===layoutSection);if(!s)return;
 const target=$('#layout-preset').value,plan=M.layoutPlan(s,target),warning=$('#layout-warning');
 warning.hidden=!plan.overflow.length;
 warning.textContent=plan.overflow.length?`You have ${plan.count} ${plan.kind}${plan.count===1?'':'s'} in this section. This layout holds ${plan.slots}. The extra ${plan.overflow.length===1?plan.kind:plan.kind+'s'} will move to ${plan.overflow.length===1?'a new section':'new sections'} below.`:'';
 $('#apply-layout').disabled=target===M.layoutType(s);
}
function sectionPath(){const info=M.pageInfo(data,key),i=sectionList().findIndex(s=>s.id===selected);return info.project?`projects.${data.projects.indexOf(info.project)}.sections.${i}`:info.page?`pages.${data.pages.indexOf(info.page)}.sections.${i}`:`pageLayouts.${key}.sections.${i}`;}
function url(path){return assets.get(path)?.url||path||'';}
function plainField(label,path,type='text',fallback='',hint=''){
 const value=get(path,fallback),attr=`data-path="${escape(path)}"`;
 if(type==='checkbox')return `<label class="field checkbox"><input type="checkbox" ${attr} ${value?'checked':''}>${escape(label)}</label>`;
 return `<label class="field">${escape(label)}${type==='textarea'?`<textarea ${attr}>${escape(value)}</textarea>`:`<input type="${type}" ${attr} value="${escape(value)}">`}${hint?`<small>${escape(hint)}</small>`:''}</label>`;
}
function select(label,path,values,fallback){const value=get(path,fallback);return `<label class="field">${escape(label)}<select data-path="${escape(path)}">${values.map(item=>{const [k,name]=Array.isArray(item)?item:[item,item];return `<option value="${escape(k)}" ${String(k)===String(value)?'selected':''}>${escape(name)}</option>`;}).join('')}</select></label>`;}
function range(label,path,min,max,fallback,unit=''){const value=get(path,fallback);return `<label class="field"><span class="range-label">${escape(label)}<output>${value===0&&path.endsWith('.height')?'Auto':escape(value)+unit}</output></span><input type="range" min="${min}" max="${max}" step="1" data-path="${escape(path)}" data-number="true" data-unit="${unit}" value="${escape(value)}"></label>`;}
function mediaField(label,path,type='image',fallback='',clearLabel='Clear',motionPath=''){const value=get(path,fallback);return `<div class="media-field">${type==='image'&&value?`<img src="${escape(url(value))}" alt="${escape(label)}">`:''}${plainField(label,path,'text',fallback,type==='video'?'Video / GIF files up to 30 MB. You can also paste a video address.':'Photo files up to 30 MB. You can also paste an image address.')}<div class="button-row"><button data-upload="${escape(path)}" data-media-type="${type}" data-video-motion="${escape(motionPath)}">Upload ${type}</button><button data-library="${escape(path)}" data-media-type="${type}" data-video-motion="${escape(motionPath)}">Choose existing</button><button data-clear="${escape(path)}" ${clearLabel==='Remove thumbnail'&&!value?'disabled':''}>${clearLabel}</button></div></div>`;}
function mediaControls(path){const media=M.mediaPaths(data,path),hasThumbnail=!!get(media.imageSrcPath,media.fallbackImage),hasVideo=!!get(media.videoSrcPath);return `<details open><summary>Photo, video or GIF</summary>${mediaField('Photo / thumbnail',media.imageSrcPath,'image',media.fallbackImage,'Remove thumbnail')}<p class="help">${hasThumbnail?'A custom photo is used as the thumbnail. Remove it to use the video’s first frame.':hasVideo?'Using the video’s first frame as the thumbnail. Add a photo to override it.':'Videos use their first frame as the thumbnail unless you add a photo.'}</p>${mediaField('Video / GIF',media.videoSrcPath,'video','','Clear',media.motionPath)}${select('Media type',media.motionPath,[['still','Photo'],['controls','Video player'],['loop','GIF / animated video'],['hover','Hover preview']],hasVideo?media.defaultMotion:'still')}<p class="help">Video player shows playback controls. GIF / animated video loops automatically; Hover preview plays when pointed at. Select Crop video in the canvas toolbar to reframe it.</p></details>`;}
function imageControls(path,{caption=true,position=false}={}){
 return `<details open><summary>Image size and position</summary><div class="presets">${[['Small',40],['Medium',65],['Large',85],['Full width',100]].map(([label,value])=>`<button data-preset="${escape(path)}.width" data-value="${value}">${label}</button>`).join('')}</div>${range('Width',path+'.width',10,100,100,'%')}${range('Height',path+'.height',0,1200,0,' px')}${select('Aspect ratio',path+'.aspect',[['auto','Original proportions'],['square','Square'],['portrait','Portrait · 4:5'],['tall','Portrait · 3:4'],['landscape','Landscape · 4:3'],['wide','Wide · 16:9']],'auto')}${select('Image alignment',path+'.align',[['left','Left'],['center','Center'],['right','Right']],'center')}${position?select('Photo position',path+'.position',[['above','Photo above text'],['below','Photo below text'],['left','Photo left'],['right','Photo right']],'above'):''}${select('Fit',path+'.fit',[['contain','Show whole photo'],['cover','Fill and crop']],'contain')}${range('Crop focus · horizontal',path+'.focalX',0,100,50,'%')}${range('Crop focus · vertical',path+'.focalY',0,100,50,'%')}${range('Space around image',path+'.margin',0,120,0,' px')}${range('Padding inside frame',path+'.padding',0,80,0,' px')}</details>${caption?`<details><summary>Caption</summary>${plainField('Caption',path+'.caption','textarea')}${captionControls(path)}</details>`:''}`;
}
function captionControls(path,visibility=path+'.showCaption'){return `${plainField('Show caption',visibility,'checkbox',true)}${select('Caption position',path+'.captionPosition',[['below','Below photo'],['above','Above photo']],'below')}${select('Caption alignment',path+'.captionAlignment',[['left','Left'],['center','Center'],['right','Right']],'left')}`;}
function hasTextPanel(s){return s&&['text','heading','photoText','projectPhoto','projectThumbnail','mediaPair','videoText','video'].includes(s.type);}
function panelControls(s,path){
 if(!hasTextPanel(s))return '';
 const p=path+'.panelStyle',plain=s.type==='heading'||s.id==='more-projects';
 return `<details open data-background-controls><summary>Background and shape</summary>${plainField('Background color',p+'.color','color','#f3f1ec')}${plainField('Transparent background',p+'.transparent','checkbox',plain)}${plainField('Text color',p+'.textColor','color','#3f3f43')}${select('Background shape',p+'.shape',[['square','Rectangle'],['rounded','Rounded rectangle'],['pill','Pill / oval'],['custom','Custom corners']],plain?'square':'rounded')}${range('Custom corner radius',p+'.radius',0,120,16,' px')}<p class="help">Custom corner radius applies when Custom corners is selected.</p>${range('Padding inside background',p+'.padding',0,120,plain?0:32,' px')}<button data-reset-panel>Reset background</button></details>`;
}
function layoutControls(path,photo=true){return `<details open><summary>Section layout</summary>${photo?`${select('Photo placement',path+'.imagePosition',[['left','Photo left / text right'],['right','Photo right / text left'],['above','Photo above text'],['below','Photo below text']],'left')}${range('Photo column size',path+'.imageWidth',10,90,56,'%')}${range('Text column size',path+'.textWidth',10,90,44,'%')}`:''}${select('Content width',path+'.contentWidth',[['default','Default'],['narrow','Narrow'],['wide','Wide'],['full','Full width']],'default')}${select('Vertical alignment',path+'.alignment',[['start','Top'],['center','Center'],['end','Bottom']],'center')}${select('Text alignment',path+'.textAlign',[['left','Left'],['center','Center'],['right','Right']],'left')}${select('Text size',path+'.textSize',[['small','Small'],['normal','Medium'],['large','Large']],'normal')}${range('Gap between photo and text',path+'.gap',0,100,46,' px')}${range('Space above section',path+'.spacingTop',0,200,0,' px')}${range('Space below section',path+'.spacingBottom',0,200,0,' px')}${plainField('Show section',path+'.visible','checkbox',true)}</details>`;}
function projectFields(project){const p=`projects.${data.projects.indexOf(project)}`;return `${plainField('Project title',p+'.title')}${plainField('Project address',p+'.slug','text','','Lowercase letters, numbers and dashes. Changing this also changes its link.')}${plainField('Description',p+'.description','textarea')}${plainField('Show in gallery',p+'.showInGallery','checkbox',true)}${plainField('Feature on homepage',p+'.featuredOnHomepage','checkbox',true)}${select('Homepage order',p+'.homepageOrder',[['auto','Automatic'],...Array.from({length:9},(_,i)=>[String(i+1),String(i+1)])],'auto')}<p class="help">Project cards use the video’s first frame when no thumbnail photo is selected.</p>${mediaField('Thumbnail image',p+'.thumbnail','image','','Remove thumbnail')}${plainField('Image description',p+'.thumbnailAlt')}${imageControls(p+'.thumbnailStyle',{position:true})}${mediaField('Thumbnail preview video',p+'.previewVideo','video')}${select('Preview behavior',p+'.thumbnailMotion',[['hover','Play on hover / while visible'],['loop','Loop automatically'],['still','Thumbnail image only']],'hover')}${select('Thumbnail fit',p+'.thumbnailFit',[['cover','Fill frame'],['contain','Show entire video']],'cover')}${plainField('Cover text when no photo',p+'.coverText','textarea')}${select('Cover color',p+'.theme',[['silver','Silver'],['dark','Dark'],['blue','Blue']],'silver')}`;}
function inspector(){
 const panel=$('#inspector'),info=M.pageInfo(data,key);
 if(mode==='site'){
   panel.innerHTML=`<h2>Website settings</h2>${mediaField('Website icon','siteIcon')}${Object.entries(defaults).map(([group,fields])=>`<details ${group==='home'?'open':''}><summary>${{identity:'Name and browser titles',navigation:'Navigation',home:'Homepage text',gallery:'Gallery text',footer:'Footer',project:'Project labels',carousel:'Slideshow',messages:'Other messages'}[group]}</summary>${Object.entries(fields).filter(([name])=>name!=='siteIcon').map(([name,value])=>{const path=`website.${group}.${name}`,label=name.replace(/([A-Z])/g,' $1').replace(/^./,s=>s.toUpperCase());if(typeof value==='boolean')return plainField(label,path,'checkbox',value);if(name==='source')return select(label,path,[['selected','Selected projects'],['demo','Demo placeholders']],'selected');if(typeof value==='number')return range(label,path,1,30,value,' seconds');return plainField(label,path,'textarea',value);}).join('')}</details>`).join('')}`;return;
 }
 if(mode==='page'){
   panel.innerHTML=`<h2>${escape(info.title)}</h2>${info.project?projectFields(info.project):info.page?`${plainField('Page title',`pages.${data.pages.indexOf(info.page)}.title`)}${plainField('Page address',`pages.${data.pages.indexOf(info.page)}.slug`)}${plainField('Show in navigation',`pages.${data.pages.indexOf(info.page)}.showInNavigation`,'checkbox',false)}`:'<p>Choose a section to edit its content, or use Website settings for shared text and labels.</p>'}<hr><p class="help">The original editor fields remain available in Pages CMS.</p><button id="import-button">Import content backup</button>`;return;
 }
 if(textPath){panel.innerHTML=`<h2>Text box</h2>${plainField('Text',textPath,'textarea')}<p class="help">Drag the selected box or its border to move it. Use its handles to resize. Double-click to type. The toolbar changes font size and alignment.</p>${panelControls(section(),sectionPath())}<button data-back-section>Back to section</button>`;return;}
 const s=section();if(!s){panel.innerHTML='<h2>Choose a section</h2><p>Click a section in the preview or add a new one.</p>';return;}
 const p=sectionPath();let fields='';
 if(imagePath?.endsWith('.previewStyle')){const basePath=/^projects\.\d+\.previewStyle$/.test(imagePath)?imagePath.replace(/\.previewStyle$/,'.thumbnailStyle'):imagePath.replace(/\.previewStyle$/,''),style=get(basePath,{}),inherited=style.enabled===false?{}:style;panel.innerHTML=`<h2>Preview video crop</h2><p class="help">Drag the video in the preview to change its framing. This crop is separate from the thumbnail photo.</p>${select('Video fit',imagePath+'.fit',[['cover','Fill and crop'],['contain','Show entire video']],inherited.fit||M.mediaPaths(data,basePath).defaultFit)}${range('Video crop · horizontal',imagePath+'.focalX',0,100,inherited.focalX??50,'%')}${range('Video crop · vertical',imagePath+'.focalY',0,100,inherited.focalY??50,'%')}<button data-back-section>Back to section</button>`;return;}
 if(imagePath){const captionPath=imagePath==='portraitImage'?'personal':imagePath.includes('.photos.')?imagePath.replace(/\.imageStyle$/,'.shortCaption'):imagePath.includes('.items.')?imagePath+'.caption':imagePath.includes('.sections.')?imagePath.replace(/\.imageStyle$/,'.caption'):imagePath+'.caption';const visibility=imagePath.includes('.items.')?imagePath+'.showCaption':imagePath.includes('.sections.')?imagePath.replace(/\.imageStyle$/,'.showCaption'):imagePath.includes('.photos.')?imagePath.replace(/\.imageStyle$/,'.showCaption'):imagePath+'.showCaption';fields=`${mediaControls(imagePath)}<p class="help">Selected image</p>${imageControls(imagePath,{caption:false,position:imagePath.endsWith('thumbnailStyle')||imagePath.startsWith('hobbies.')})}${plainField('Caption',captionPath,'textarea')}${captionControls(imagePath,visibility)}<button data-back-section>Back to section</button>`;panel.innerHTML=`<h2>Image controls</h2>${fields}`;return;}
 switch(s.type){
  case 'hero':fields=plainField('Small heading','website.home.eyebrow','textarea',defaults.home.eyebrow)+plainField('Main heading','website.home.headline','textarea',defaults.home.headline)+plainField('Second heading line','website.home.subheadline','textarea',defaults.home.subheadline)+plainField('Button text','website.home.button','text',defaults.home.button)+plainField('Button destination','website.home.buttonLink','text','/?view=gallery')+mediaField('Homepage photo','heroPhoto')+plainField('Photo description','heroPhotoAlt')+imageControls('heroImage');break;
  case 'about':fields=plainField('Section heading','website.home.aboutTitle','text',defaults.home.aboutTitle)+plainField('About me','bio','textarea')+mediaField('About-me photo','portrait')+plainField('Photo description','portraitAlt')+plainField('Caption under the photo','personal','textarea')+captionControls('portraitImage')+imageControls('portraitImage',{caption:false});break;
  case 'hobbies':fields=plainField('Section heading','website.home.hobbiesTitle','text',defaults.home.hobbiesTitle)+plainField('Text under Hobbies','hobbiesIntro','textarea')+Array.from({length:3},(_,i)=>`<details ${i===0?'open':''}><summary>Hobby ${i+1}</summary>${mediaField('Photo',`hobbies.${i}.photo`)}${plainField('Title',`hobbies.${i}.title`)}${plainField('Text',`hobbies.${i}.text`,'textarea')}${imageControls(`hobbies.${i}.imageStyle`,{position:true})}</details>`).join('');break;
  case 'highlights':fields=plainField('Heading','website.home.highlightsTitle','text',defaults.home.highlightsTitle)+plainField('Gallery link text','website.home.galleryLink','text',defaults.home.galleryLink)+range('Seconds between slides','website.carousel.seconds',1,30,2.5,' seconds')+'<p class="help">Mobile shows one project at a time. Choose projects below.</p>'+data.projects.map((project,i)=>`<details><summary>${escape(project.title)}</summary>${plainField('Show in gallery',`projects.${i}.showInGallery`,'checkbox',true)}${plainField('Feature on homepage',`projects.${i}.featuredOnHomepage`,'checkbox',true)}${select('Homepage order',`projects.${i}.homepageOrder`,[['auto','Automatic'],...Array.from({length:9},(_,n)=>[String(n+1),String(n+1)])],'auto')}</details>`).join('');break;
  case 'galleryIntro':fields=plainField('Small heading','website.gallery.eyebrow','text',defaults.gallery.eyebrow)+plainField('Main heading','website.gallery.headline','textarea',defaults.gallery.headline)+plainField('Description','website.gallery.subtitle','textarea',defaults.gallery.subtitle);break;
  case 'galleryGrid':fields=plainField('List label','website.gallery.allProjects','text',defaults.gallery.allProjects)+plainField('Show count','website.gallery.showCount','checkbox',true)+data.projects.map(project=>`<details><summary>${escape(project.title)}</summary>${projectFields(project)}</details>`).join('');break;
  case 'projectIntro':fields=projectFields(info.project);break;
  case 'projectVideo':fields=mediaField('Project video',`projects.${data.projects.indexOf(info.project)}.video`,'video')+imageControls(`projects.${data.projects.indexOf(info.project)}.videoStyle`);break;
  case 'projectPhoto':{const photo=M.photoSource(data,key,s),path=`projects.${data.projects.indexOf(info.project)}.photos.${info.project.photos.indexOf(photo)}`;fields=mediaField('Photo',path+'.src')+plainField('Image description',path+'.alt')+plainField('Heading beside photo',path+'.title')+plainField('Text beside photo',path+'.text','textarea',photo.text??photo.caption??'')+plainField('Short caption under photo',path+'.shortCaption','textarea')+captionControls(path+'.imageStyle',path+'.showCaption')+imageControls(path+'.imageStyle',{caption:false});break;}
  case 'projectThumbnail':{const p=`projects.${data.projects.indexOf(info.project)}`;fields=mediaField('Project cover photo',p+'.thumbnail')+imageControls(p+'.thumbnailStyle',{position:true});break;}
  case 'projectEnd':fields=plainField('Footer text','website.project.endText','text',defaults.project.endText)+plainField('Gallery button','website.project.galleryButton','text',defaults.project.galleryButton);break;
  case 'photoText':fields=mediaField('Photo',p+'.image')+plainField('Image description',p+'.alt')+plainField('Heading',p+'.heading')+plainField('Text beside photo',p+'.text','textarea')+plainField('Caption',p+'.caption','textarea')+captionControls(p+'.imageStyle',p+'.showCaption')+imageControls(p+'.imageStyle',{caption:false});break;
  case 'mediaCarousel':fields=plainField('Heading',p+'.heading')+plainField('Play slideshow automatically',p+'.autoplay','checkbox',true)+range('Seconds between slides',p+'.seconds',1,30,3,' seconds')+'<p class="help">Three cards at a time on desktop; one on mobile. Use the arrows to reach the next group. Photos, videos and GIFs use the same media tools as other sections.</p>'+(s.items||[]).map((item,i)=>{const path=p+'.items.'+i;return `<details><summary>Card ${i+1}${item.alt?' · '+escape(item.alt):''}</summary><div class="button-row"><button data-carousel-item="up" data-item-index="${i}" ${i===0?'disabled':''}>Move left</button><button data-carousel-item="down" data-item-index="${i}" ${i===(s.items.length-1)?'disabled':''}>Move right</button><button data-carousel-item="delete" data-item-index="${i}">Remove card</button></div>${plainField('Image description',path+'.alt')}${mediaControls(path+'.imageStyle')}${imageControls(path+'.imageStyle')}</details>`;}).join('')+'<button data-carousel-item="add">+ Add photo / video card</button>';break;
  case 'mediaPair':fields=plainField('Text below photos',p+'.text','textarea')+(s.items||[]).slice(0,3).map((item,i)=>{const path=p+'.items.'+i,video=item.type==='video',label=(video?'Video ':'Photo ')+(i+1);return `<details ${i===0?'open':''}><summary>${label}</summary>${mediaField(label,path+'.src',video?'video':'image')}${plainField('Description',path+'.alt')}${imageControls(path+'.imageStyle')}</details>`;}).join('');break;
  case 'text':case 'heading':fields=plainField('Heading',p+'.heading')+select('Heading size',p+'.headingLevel',[['h1','Large heading'],['h2','Section heading'],['h3','Small heading']],'h2')+(s.type==='text'?plainField('Paragraphs',p+'.text','textarea'):'');break;
  case 'video':fields=plainField('Heading',p+'.heading')+mediaField('Video file',p+'.video','video')+mediaField('Poster image',p+'.poster')+plainField('Loop video',p+'.loop','checkbox',false)+plainField('Mute video',p+'.muted','checkbox',false)+plainField('Caption',p+'.caption','textarea')+plainField('Show caption',p+'.showCaption','checkbox',true)+plainField('Text',p+'.text','textarea')+imageControls(p+'.imageStyle',{caption:false});break;
  case 'spacer':fields=range('Height',p+'.height',0,200,40,' px');break;
 }
 panel.innerHTML=`<h2>${escape(sectionLabel(s))}</h2>${fields}${panelControls(s,p)}${layoutControls(p,['photoText','projectPhoto','projectThumbnail','hero','about'].includes(s.type))}`;
}
function renderOutline(){
 closeSectionMenu();
 $('#page-select').innerHTML=M.pages(data).map(info=>`<option value="${escape(info.key)}" ${info.key===key?'selected':''}>${escape(info.kind==='project'?'Project · '+info.title:info.title)}</option>`).join('');
 const values=sectionList();if(!values.some(s=>s.id===selected)&&!textPath)selected=values[0]?.id||'';
 $('#sections').innerHTML=values.map((s,i)=>`<div class="section-item ${s.id===selected?'selected':''} ${s.visible===false?'is-hidden':''}" draggable="true" data-index="${i}"><button class="section-select" data-select="${escape(s.id)}">${escape(s.heading||sectionLabel(s))}</button><div class="section-tools"><button data-action="up" data-index="${i}" aria-label="Move section up" ${i?'':'disabled'}>↑</button><button data-action="down" data-index="${i}" aria-label="Move section down" ${i===values.length-1?'disabled':''}>↓</button>${M.layoutOptions(s).length>1?`<button data-layout="${escape(s.id)}" aria-label="Change section layout">Layout…</button>`:''}<button data-action="duplicate" data-index="${i}">Duplicate</button><button data-action="hide" data-index="${i}">${s.visible===false?'Show':'Hide'}</button><button data-action="delete" data-index="${i}" class="danger">Delete</button></div></div>`).join('');
 $('#open-page').href=M.pageInfo(data,key).url;updateUndo();
}
function renderAll(){renderOutline();inspector();preview();}
function preview(){if(!data||!ready||inlineEditing||objectEditing)return;$('#preview').contentWindow.postMessage({portfolioEditor:true,action:'render',data,key,selected,imagePath,textPath,assets:Object.fromEntries([...assets].map(([path,item])=>[path,item.url]))},location.origin);}
function selectSection(id,path='',text=''){selected=id;imagePath=path;textPath=text;mode='section';renderOutline();inspector();$('#preview').contentWindow.postMessage({portfolioEditor:true,action:'select',id,imagePath:path,textPath:text},location.origin);}
function details(open=true){document.body.classList.toggle('details-open',open);$('#toggle-details').setAttribute('aria-pressed',String(open));fitPreview();}
function loadPreview(){
 ready=false;inlineEditing=false;resizeEditing=false;objectEditing=false;objectSnapshot=null;clearTimeout(previewLoadTimer);$('#preview-notice').hidden=false;$('#preview-notice').textContent='Loading the editable page…';
 const url=new URL('/portfolio-preview.html',location.origin);url.searchParams.set('editorPreview','1');url.searchParams.set('session',Date.now().toString(36));$('#preview').src=url.href;
 previewLoadTimer=setTimeout(()=>{if(!ready)$('#preview-notice').textContent='The preview has not loaded yet. Check that portfolio-preview.html and the editor files were uploaded, then click Reload preview.';},12000);
}
function fitPreview(){const pane=$('.preview-pane'),width=Math.max(240,pane.clientWidth-36),scale=Math.min(1,width/device),height=window.innerWidth<=800?650:Math.max(360,window.innerHeight-215);$('#preview-shell').style.width=device*scale+'px';$('#preview-shell').style.height=height+'px';$('#preview').style.width=device+'px';$('#preview').style.height=Math.ceil(height/scale)+'px';$('#preview').style.transform=`scale(${scale})`;$('#preview-size').textContent=device+' px';}
function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));return value;}
const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
function githubError(response,path,payload={},label='the request'){
 const errors=Array.isArray(payload.errors)?payload.errors:[],detail=[payload.message,...errors.map(error=>typeof error==='string'?error:error.message||[error.field,error.code].filter(Boolean).join(': '))].filter(Boolean).join(' · ');
 let message=`GitHub rejected ${label} (HTTP ${response.status}): ${detail||'No additional reason was returned.'}`;
 if(response.status===401)message='The GitHub token was not accepted. Reconnect GitHub and try again.';
 else if(response.status===403&&/rate limit|abuse|secondary|spam/i.test(detail))message='GitHub temporarily limited requests. Wait a few minutes, then try Publish again. '+detail;
 else if(response.status===403)message='GitHub denied '+label+'. This editor needs Repository permissions → Contents: Read and write. '+detail;
 if(response.status===413||/too large|size limit|exceeds.*size/i.test(detail))message+=' Compress or trim the file, then replace it and try again.';
 const error=new Error(message+' Your draft is still safe.');error.status=response.status;error.path=path;return error;
}
async function request(path,{method='GET',body,auth=token,label='the request'}={}){const response=await fetch(API+path,{method,cache:'no-store',headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',...(auth?{Authorization:'Bearer '+auth}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});if(!response.ok){let payload={};try{payload=await response.json();}catch{}throw githubError(response,path,payload,label);}return response.status===204?{}:response.json();}
function decode64(text){return new TextDecoder().decode(Uint8Array.from(atob(text.replace(/\s/g,'')),c=>c.charCodeAt(0)));}
function encode64(buffer){const bytes=new Uint8Array(buffer);let result='';for(let i=0;i<bytes.length;i+=32768)result+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(result);}
async function readRemote(auth='',ref='main'){const result=await request('/contents/content.json?ref='+encodeURIComponent(ref),{auth});return {data:JSON.parse(decode64(result.content)),sha:result.sha};}
function usedAssets(snapshot=data){const {videoPosters,...content}=snapshot;const references=JSON.stringify(content);let text=references;for(const [source,poster]of Object.entries(videoPosters||{}))if(references.includes(source))text+=' '+poster;return [...assets].filter(([path])=>text.includes(path));}
async function publishBase(expected){
 const head=await request('/git/ref/heads/main'),sha=head.object.sha;
 const [remote,commit]=await Promise.all([readRemote(token,sha),request('/git/commits/'+sha)]);
 if(!same(remote.data,expected))throw new Error('The content changed in another editor. Your draft is preserved. Download a backup before reloading the latest website.');
 return {sha,tree:commit.tree.sha};
}
async function savePublishedFiles(files,expected){
 let base=await publishBase(expected);
 for(let attempt=0;attempt<3;attempt++){
  const tree=await request('/git/trees',{method:'POST',body:{base_tree:base.tree,tree:files},label:'the page and media files'});
  const commit=await request('/git/commits',{method:'POST',body:{message:'Update portfolio from visual editor',tree:tree.sha,parents:[base.sha]},label:'the website save'});
  try{await request('/git/refs/heads/main',{method:'PATCH',body:{sha:commit.sha,force:false},label:'the website update'});return;}
  catch(error){
   if(error.path!=='/git/refs/heads/main'||![409,422].includes(error.status))throw error;
   const latest=await publishBase(expected);if(latest.sha===base.sha)throw error;
   if(attempt===2)throw new Error('The website kept changing during this save. Try Publish again. Your draft is still safe.');
   base=latest;status('The website changed during this save. Retrying…');
  }
 }
}
async function publish(){
 if(!token){$('#connect-dialog').showModal();return;}if(saving)return;
 try{M.validate(data);saving=true;$('#publish').disabled=true;status('Checking the latest saved content…');
 const snapshot=clone(data),expected=clone(baseData),pendingAssets=usedAssets(snapshot),tree=[{path:'content.json',mode:'100644',type:'blob',content:JSON.stringify(snapshot,null,2)+'\n'}];
 for(const [path,item]of pendingAssets)window.PortfolioMediaUpload.checkSize(item.blob,/^video\//.test(item.blob.type)||/\.(mp4|mov|webm|m4v|ogv|gif)$/i.test(path));
 await publishBase(expected);
 for(const [path,item] of pendingAssets){const name=path.split('/').pop(),size=(item.blob.size/1024/1024).toFixed(1);if(!item.sha){status('Uploading '+name+' ('+size+' MB)…');const blob=await request('/git/blobs',{method:'POST',body:{content:encode64(await item.blob.arrayBuffer()),encoding:'base64'},label:'the upload of '+name+' ('+size+' MB)'});item.sha=blob.sha;}tree.push({path:path.slice(1),mode:'100644',type:'blob',sha:item.sha});}
 status('Saving the page and media…');await savePublishedFiles(tree,expected);
 baseData=snapshot;baseSha='';dirty=!same(data,snapshot);await saveDraft();status(dirty?'Saved to GitHub. Newer draft edits are still unpublished.':'Saved to GitHub. The website will update after publishing finishes.');
 }catch(error){status(error.message);}finally{saving=false;$('#publish').disabled=false;}
}
async function database(){return new Promise((resolve,reject)=>{const req=indexedDB.open('josh-portfolio-editor',1);req.onupgradeneeded=()=>req.result.createObjectStore('drafts');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
async function saveDraft(){if(!data)return;try{const db=await database();await new Promise((resolve,reject)=>{const tx=db.transaction('drafts','readwrite');tx.objectStore('drafts').put({data:clone(data),baseData:clone(baseData),key,dirty,assets:[...assets].map(([path,item])=>({path,blob:item.blob})),time:Date.now()},'portfolio');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();}catch{status('Browser draft storage is unavailable. Use Download changes to keep a backup.');}}
async function loadDraft(){try{const db=await database();const value=await new Promise((resolve,reject)=>{const req=db.transaction('drafts').objectStore('drafts').get('portfolio');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});db.close();return value;}catch{return null;}}
// Small dependency-free ZIP writer. Files are stored without compression, preserving uploaded bytes.
function zip(files){const table=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});const crc=bytes=>{let n=0xffffffff;for(const b of bytes)n=table[(n^b)&255]^(n>>>8);return(n^0xffffffff)>>>0;};let offset=0;const local=[],central=[];for(const file of files){const name=new TextEncoder().encode(file.name),bytes=file.bytes,checksum=crc(bytes),header=new Uint8Array(30+name.length),v=new DataView(header.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint32(14,checksum,true);v.setUint32(18,bytes.length,true);v.setUint32(22,bytes.length,true);v.setUint16(26,name.length,true);header.set(name,30);local.push(header,bytes);const entry=new Uint8Array(46+name.length),c=new DataView(entry.buffer);c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x800,true);c.setUint32(16,checksum,true);c.setUint32(20,bytes.length,true);c.setUint32(24,bytes.length,true);c.setUint16(28,name.length,true);c.setUint32(42,offset,true);entry.set(name,46);central.push(entry);offset+=header.length+bytes.length;}const size=central.reduce((n,b)=>n+b.length,0),end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,files.length,true);v.setUint16(10,files.length,true);v.setUint32(12,size,true);v.setUint32(16,offset,true);return new Blob([...local,...central,end],{type:'application/zip'});}
function downloadBlob(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),30000);}
async function download(){try{M.validate(data);const files=[{name:'content.json',bytes:new TextEncoder().encode(JSON.stringify(data,null,2)+'\n')}];for(const [path,item]of usedAssets())files.push({name:path.slice(1),bytes:new Uint8Array(await item.blob.arrayBuffer())});files.push({name:'UPLOAD.txt',bytes:new TextEncoder().encode('Extract this ZIP to keep a backup. Use Publish in the portfolio editor to save all files, including videos up to 30 MB. GitHub browser uploads only support files up to 25 MB; for smaller files, upload content.json and the media folder to https://github.com/'+REPO+'/upload/main and commit to main. Keep a backup if you have also made changes in Pages CMS.\n')});downloadBlob(zip(files),'portfolio-content-changes.zip');status('Downloaded your changes. Use Publish to save your draft; GitHub browser uploads only support files up to 25 MB.');}catch(e){status(e.message);}}
async function upload(file){
 if(!file)return;
 const target=pendingUpload,motionPath=pendingMotionPath,motion=pendingMotion,video=/\.(video|previewVideo)$/.test(target)||get(target.replace(/\.src$/,'.type'))==='video';pendingMotionPath='';pendingMotion='';
 try{
  const result=await window.PortfolioMediaUpload.prepare(file,{video,onStatus:status});file=result.file;
  const name=file.name.toLowerCase().replace(/[^a-z0-9._-]/g,'-'),path='/media/'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7)+'-'+name;
  assets.set(path,{blob:file,url:URL.createObjectURL(file)});const posterPath=path+'-first-frame.jpg';if(result.poster)assets.set(posterPath,{blob:result.poster,url:URL.createObjectURL(result.poster)});
  mutate(()=>{set(target,path);if(result.poster){data.videoPosters||={};data.videoPosters[path]=posterPath;}if(motionPath)set(motionPath,file.type==='image/gif'||/\.gif$/i.test(file.name)?'loop':motion||'controls');});
  if(result.converted)status('Photo added to draft · HEIC converted to JPEG.');
  else if(result.posterUnavailable)status('Video added to draft. This browser could not create its thumbnail; add a Photo / thumbnail if the first frame looks blank.');
 }catch(e){status(e.message);}
}
async function mediaLibrary(path,type='image'){mediaTarget=path;$('#media-dialog').showModal();const found=new Set(),video=src=>/\.(mp4|webm|mov|m4v|ogv)(?:[?#].*)?$/i.test(src),matches=src=>type==='video'?video(src)||/\.gif(?:[?#].*)?$/i.test(src):!video(src);function walk(value){if(typeof value==='string'&&/\.(png|jpe?g|webp|gif|svg|ico|mp4|webm|mov|m4v|ogv)(?:[?#].*)?$/i.test(value))found.add(value);else if(value&&typeof value==='object')Object.values(value).forEach(walk);}walk(data);for(const path of assets.keys())found.add(path);function draw(){$('#media-grid').innerHTML=[...found].filter(matches).map(src=>`<button data-choose-media="${escape(src)}">${video(src)?'▶ Video':`<img src="${escape(url(src))}" alt="">`}${escape(src.split('/').pop())}</button>`).join('')||'<p>No matching media found. Upload a file instead.</p>';}
 draw();try{const tree=await request('/git/trees/main?recursive=1',{auth:token});for(const item of tree.tree||[])if(item.type==='blob'&&/\.(png|jpe?g|webp|gif|svg|ico|mp4|webm|mov)$/i.test(item.path))found.add('/'+item.path);draw();}catch{/* Content already referenced by the portfolio is still available. */}}
$('#inspector').addEventListener('focusin',e=>{if(e.target.dataset.path&&!fieldEditing){remember();fieldEditing=true;}});
$('#inspector').addEventListener('focusout',()=>{fieldEditing=false;});
$('#inspector').addEventListener('input',e=>{const control=e.target,path=control.dataset.path;if(!path)return;const previous=get(path);set(path,control.type==='checkbox'?control.checked:control.dataset.number?Number(control.value):control.value);if(path.endsWith('.panelStyle.color')){const transparentPath=path.replace(/\.color$/,'.transparent');set(transparentPath,false);const checkbox=$('#inspector').querySelector(`[data-path="${transparentPath}"]`);if(checkbox)checkbox.checked=false;}if(imagePath&&!imagePath.endsWith('.previewStyle')&&!previous&&control.value){const media=M.mediaPaths(data,imagePath);if(path===media.videoSrcPath)set(media.motionPath,/\.gif(?:[?#]|$)/i.test(control.value)?'loop':'controls');}if(control.type==='range')control.closest('label').querySelector('output').textContent=control.value==='0'&&path.endsWith('.height')?'Auto':control.value+(control.dataset.unit||'');mark();});
$('#inspector').addEventListener('change',e=>{const path=e.target.dataset.path;if(path?.endsWith('.slug')){const info=M.pageInfo(data,key);if(!info){const target=path.startsWith('projects.')?data.projects[Number(path.split('.')[1])]:data.pages[Number(path.split('.')[1])];key=(path.startsWith('projects.')?'project:':'page:')+target.slug;}renderOutline();}else if(path?.endsWith('.title'))renderOutline();});
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
 if(b.dataset.layout)openLayout(b.dataset.layout);
 if(b.dataset.close)$('#'+b.dataset.close).close();
 if(b.dataset.select)selectSection(b.dataset.select);
 if(b.dataset.carouselItem&&section()?.type==='mediaCarousel'){
  const action=b.dataset.carouselItem,index=Number(b.dataset.itemIndex);imagePath='';textPath='';
  mutate(()=>{const s=section();s.items||=[];if(action==='add')s.items.push(M.makeCarouselItem());else if(index>=0&&index<s.items.length){if(action==='delete')s.items.splice(index,1);else{const to=index+(action==='up'?-1:1);if(to>=0&&to<s.items.length){const [item]=s.items.splice(index,1);s.items.splice(to,0,item);}}}});
 }
 if(b.dataset.backSection!==undefined){imagePath='';textPath='';inspector();}
 if(b.dataset.resetPanel!==undefined&&section())mutate(()=>{delete section().panelStyle;});
 if(b.dataset.upload){pendingUpload=b.dataset.upload;pendingMotionPath=b.dataset.videoMotion||'';pendingMotion=pendingMotionPath?'controls':'';clearTimeout(previewTimer);$('#file-upload').accept=b.dataset.mediaType==='video'?'video/*,image/gif':'image/*,.heic,.heif';$('#file-upload').value='';$('#file-upload').click();}
 if(b.dataset.library){mediaTargetMotionPath=b.dataset.videoMotion||'';mediaLibrary(b.dataset.library,b.dataset.mediaType);}
 if(b.dataset.clear)mutate(()=>set(b.dataset.clear,''));
 if(b.dataset.preset)mutate(()=>set(b.dataset.preset,Number(b.dataset.value)));
 if(b.dataset.chooseMedia){mutate(()=>{set(mediaTarget,b.dataset.chooseMedia);if(mediaTargetMotionPath)set(mediaTargetMotionPath,/\.gif(?:[?#]|$)/i.test(b.dataset.chooseMedia)?'loop':'controls');});mediaTargetMotionPath='';$('#media-dialog').close();}
 if(b.dataset.device){device=Number(b.dataset.device);document.querySelectorAll('[data-device]').forEach(n=>n.setAttribute('aria-pressed',String(n===b)));fitPreview();}
 if(b.dataset.action){const index=Number(b.dataset.index),action=b.dataset.action;imagePath='';textPath='';mutate(()=>{if(action==='up'||action==='down')M.reorder(data,key,index,index+(action==='up'?-1:1));if(action==='duplicate')selected=M.duplicateSection(data,key,index).id;if(action==='delete')M.deleteSection(data,key,index);if(action==='hide')sectionList()[index].visible=sectionList()[index].visible===false;});}
 if(b.id==='import-button')$('#import-content').click();
});
$('#sections').addEventListener('contextmenu',e=>{const node=e.target.closest('.section-item');if(!node)return;e.preventDefault();showSectionMenu(node.querySelector('[data-select]').dataset.select,e.clientX,e.clientY);});
$('#sections').addEventListener('keydown',e=>{if(e.key!=='ContextMenu'&&!(e.shiftKey&&e.key==='F10'))return;const node=e.target.closest('.section-item');if(!node)return;e.preventDefault();const rect=node.getBoundingClientRect();showSectionMenu(node.querySelector('[data-select]').dataset.select,rect.left+20,rect.top+20);});
$('#section-menu').addEventListener('keydown',e=>{
 if(e.key==='Escape'){e.preventDefault();closeSectionMenu(true);return;}
 if(!['ArrowDown','ArrowUp','Home','End'].includes(e.key))return;e.preventDefault();
 const buttons=[...$('#section-menu').querySelectorAll('button:not(:disabled)')],index=buttons.indexOf(document.activeElement);
 buttons[e.key==='Home'?0:e.key==='End'?buttons.length-1:(index+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();
});
document.addEventListener('pointerdown',e=>{if(!e.target.closest('#section-menu'))closeSectionMenu();});
document.addEventListener('focusin',e=>{if(!e.target.closest('#section-menu'))closeSectionMenu();});
document.addEventListener('scroll',()=>closeSectionMenu(),true);window.addEventListener('resize',()=>closeSectionMenu());window.addEventListener('blur',()=>closeSectionMenu());
$('#menu-layout').onclick=()=>openLayout(menuSection);
$('#menu-controls').onclick=()=>{const id=menuSection;closeSectionMenu();selectSection(id);details();};
$('#layout-preset').onchange=updateLayoutWarning;
$('#layout-dialog').addEventListener('close',()=>outlineButton(layoutSection)?.focus());
$('#layout-form').onsubmit=e=>{
 e.preventDefault();if(key!==layoutPage)return;const index=sectionList().findIndex(value=>value.id===layoutSection);if(index<0)return;
 const target=$('#layout-preset').value;if(target===M.layoutType(sectionList()[index]))return;
 mutate(()=>{selected=M.changeLayout(data,key,index,target).id;imagePath='';textPath='';mode='section';});$('#layout-dialog').close();
};
let dragIndex=-1;$('#sections').addEventListener('dragstart',e=>{const node=e.target.closest('[data-index]');if(node){dragIndex=Number(node.dataset.index);e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',String(dragIndex));}});$('#sections').addEventListener('dragover',e=>e.preventDefault());$('#sections').addEventListener('drop',e=>{e.preventDefault();const node=e.target.closest('[data-index]');if(node&&dragIndex>=0){imagePath='';textPath='';mutate(()=>M.reorder(data,key,dragIndex,Number(node.dataset.index)));}dragIndex=-1;});
$('#add-section').onclick=()=>mutate(()=>{const s=M.makeSection($('#section-type').value),values=sectionList(),index=values.findIndex(v=>v.id===selected);values.splice(index<0?values.length:index+1,0,s);selected=s.id;imagePath='';textPath='';mode='section';});
$('#add-text-box').onclick=()=>canvasCommand({command:'add-text',id:selected||sectionList()[0]?.id});
$('#page-select').onchange=e=>{key=e.target.value;selected='';imagePath='';textPath='';mode='section';renderAll();};
$('#site-settings').onclick=()=>{mode='site';imagePath='';textPath='';inspector();details();};$('#page-settings').onclick=()=>{mode='page';imagePath='';textPath='';inspector();details();};
$('#toggle-details').onclick=()=>details(!document.body.classList.contains('details-open'));$('#reload-preview').onclick=loadPreview;
$('#undo').onclick=()=>{if(!history.length)return;future.push(clone(data));data=history.pop();if(!M.pageInfo(data,key))key='home';mark();renderAll();};$('#redo').onclick=()=>{if(!future.length)return;history.push(clone(data));data=future.pop();mark();renderAll();};
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!e.target.matches('input,textarea,[contenteditable]')){e.preventDefault();$(e.shiftKey?'#redo':'#undo').click();}});
$('#connection').onclick=()=>{if(token){token='';$('#connection').textContent='Connect GitHub';status('Disconnected. Your draft remains saved in this browser.');}else $('#connect-dialog').showModal();};
$('#connect-form').onsubmit=async e=>{e.preventDefault();const value=$('#token').value.trim();try{const repo=await request('',{auth:value});await readRemote(value);if(repo.permissions&&repo.permissions.push===false)throw new Error('This token can read the repository but cannot publish. Create a fine-grained token for jleo0312.github.io with Repository permissions → Contents: Read and write.');token=value;$('#token').value='';$('#connect-error').textContent='';$('#connect-dialog').close();$('#connection').textContent='Disconnect GitHub';status('Connected with repository write access. Use Publish to save your draft to GitHub.');}catch(error){$('#connect-error').textContent=error.message;}};
$('#publish').onclick=publish;$('#download').onclick=download;$('#file-upload').onchange=e=>upload(e.target.files[0]);
$('#import-content').onchange=async e=>{try{const imported=M.upgrade(JSON.parse(await e.target.files[0].text()));M.validate(imported);mutate(()=>{data=imported;key='home';selected='';});}catch(error){status(error.message);}};
function newDialog(kind){newKind=kind;$('#new-title').textContent=kind==='page'?'New page':'New project';$('#new-name').value='';$('#new-slug').value='';$('#new-error').textContent='';$('#new-dialog').showModal();}
$('#new-page').onclick=()=>newDialog('page');$('#new-project').onclick=()=>newDialog('project');$('#new-name').oninput=e=>{$('#new-slug').value=e.target.value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');};
$('#new-form').onsubmit=e=>{e.preventDefault();const title=$('#new-name').value.trim(),slug=$('#new-slug').value.trim();const trial=clone(data);if(newKind==='project')trial.projects.push({title,slug});else{trial.pages||=[];trial.pages.push({title,slug});}try{M.validate(trial);}catch(error){$('#new-error').textContent=error.message;return;}mutate(()=>{if(newKind==='project'){data.projects.push({title,slug,showInGallery:true,featuredOnHomepage:false,photos:[]});key='project:'+slug;}else{data.pages||=[];data.pages.push({title,slug,showInNavigation:false,sections:[{...M.makeSection('heading'),heading:title}]});key='page:'+slug;}selected='';imagePath='';textPath='';mode='section';});$('#new-dialog').close();};
function addTextBox(value='New text box',sourcePath=''){
 const target=section();if(!target)return;target.textBoxes=Array.isArray(target.textBoxes)?target.textBoxes:[];
 const box={id:M.id(),text:String(value)},sourceId=sourcePath?'text:'+window.PortfolioObjects.stableKey(data,sourcePath):'';
 const previous=(target.elements||[]).find(element=>element.id===sourceId);
 target.textBoxes.push(box);textPath=sectionPath()+'.textBoxes.'+(target.textBoxes.length-1)+'.text';imagePath='';
 if(previous){target.elements||=[];target.elements.push({...clone(previous),id:'text:'+window.PortfolioObjects.stableKey(data,textPath),x:Math.min(previous.x+2,100-previous.width),y:previous.y+3});}
}
function canvasCommand(msg){
 inlineEditing=false;
 if(msg.command==='add'){const control=$('#section-type');control.scrollIntoView({block:'center'});control.focus();status('Choose a section type, then click + Add Section.');return;}
 if(msg.command==='undo'||msg.command==='redo'){$('#'+msg.command).click();return;}
 const values=sectionList(),index=values.findIndex(s=>s.id===msg.id);if(index<0)return;
 selected=msg.id;if(typeof msg.imagePath==='string')imagePath=msg.imagePath;if(typeof msg.textPath==='string')textPath=msg.textPath;
 mutate(()=>{
  const action=msg.command;
  if(action==='add-text'){addTextBox();}
  else if(action==='duplicate-text'&&textPath){addTextBox(get(textPath),textPath);}
  else if(action==='delete-text'&&textPath){const oldId='text:'+window.PortfolioObjects.stableKey(data,textPath),match=textPath.match(/\.textBoxes\.(\d+)\.text$/);if(match)values[index].textBoxes.splice(Number(match[1]),1);else set(textPath,'');values[index].elements=(values[index].elements||[]).filter(e=>e.id!==oldId);textPath='';}
  else if(action==='up'||action==='down'){imagePath='';textPath='';M.reorder(data,key,index,index+(action==='up'?-1:1));}
  else if(action==='move-to'){
   const target=values.findIndex(s=>s.id===msg.targetId);if(target<0||target===index)return;
   let insertion=target+(msg.after?1:0);imagePath='';textPath='';const [moving]=values.splice(index,1);if(index<insertion)insertion--;values.splice(insertion,0,moving);
  }
  else if(action==='move-project'){
   const highlights=values[index].type==='highlights';
   const rank=value=>Number.isInteger(Number(value))&&Number(value)>=1&&Number(value)<=9?Number(value):10;
   const legacy=data.projects.some(p=>p.homepageHighlight!=null&&p.homepageHighlight!=='');
   const projects=highlights?data.projects.filter(p=>p.showInGallery!==false&&(typeof p.featuredOnHomepage==='boolean'?p.featuredOnHomepage:!legacy||rank(p.homepageHighlight)<=9)).slice().sort((a,b)=>rank(a.homepageOrder??a.homepageHighlight)-rank(b.homepageOrder??b.homepageHighlight)).slice(0,9):data.projects;
   const from=projects.findIndex(p=>p.slug===msg.slug),to=projects.findIndex(p=>p.slug===msg.targetSlug);if(from<0||to<0||from===to)return;
   let insertion=to+(msg.after?1:0);const [moving]=projects.splice(from,1);if(from<insertion)insertion--;projects.splice(insertion,0,moving);
   if(highlights)projects.forEach((p,i)=>{p.homepageOrder=String(i+1);});imagePath='';textPath='';
  }
  else if(action==='duplicate'){selected=M.duplicateSection(data,key,index).id;imagePath='';textPath='';}
  else if(action==='delete'){M.deleteSection(data,key,index);imagePath='';textPath='';}
  else if(action==='hide'){values[index].visible=false;imagePath='';textPath='';}
  else if(action==='add'){const next=M.makeSection('photoText');values.splice(index+1,0,next);selected=next.id;imagePath='';textPath='';}
  else if(imagePath&&action==='image-layout'&&['left','right','above','below'].includes(msg.position)){
   const inlineCard=/^hobbies\.\d+\.imageStyle$/.test(imagePath)||imagePath.endsWith('.thumbnailStyle')&&['galleryGrid','highlights'].includes(values[index].type);
   set(inlineCard?imagePath+'.position':sectionPath()+'.imagePosition',msg.position);
  }
  else if(imagePath&&action==='image-align'&&['left','center','right'].includes(msg.align))set(imagePath+'.align',msg.align);
  else if(imagePath&&action==='image-fit'&&['contain','cover'].includes(msg.fit))set(imagePath+'.fit',msg.fit);
  else if(imagePath&&action==='remove-video'){const media=M.mediaPaths(data,imagePath);if(msg.path===media.videoSrcPath){if(media.primaryVideo&&get(media.imageSrcPath,null)==null&&media.fallbackImage)set(media.imageSrcPath,media.fallbackImage);set(media.videoSrcPath,'');}}
  else if(imagePath&&action==='remove-thumbnail'){const media=M.mediaPaths(data,imagePath);if(msg.path===media.imageSrcPath)set(media.imageSrcPath,'');}
  else if(imagePath&&action==='video-behavior'&&['controls','hover','loop','still'].includes(msg.value))set(M.mediaPaths(data,imagePath).motionPath,msg.value);
  else if(imagePath&&action==='image-aspect'&&['auto','square','portrait','tall','landscape','wide'].includes(msg.aspect)){set(imagePath+'.aspect',msg.aspect);set(imagePath+'.height',0);}
  else if(imagePath&&action==='caption-visibility'){
   const path=imagePath.includes('.items.')?imagePath+'.showCaption':imagePath.includes('.sections.')||imagePath.includes('.photos.')?imagePath.replace(/\.imageStyle$/,'.showCaption'):imagePath+'.showCaption';set(path,!!msg.visible);
  }
 });
}
window.addEventListener('message',event=>{
 if(event.origin!==location.origin||event.source!==$('#preview').contentWindow||!event.data?.portfolioPreview)return;
 const msg=event.data;
 if(msg.action==='upload-start')clearTimeout(previewTimer);
 if(msg.action==='upload-cancel')preview();
 if(msg.action==='ready'&&msg.canvas){ready=true;clearTimeout(previewLoadTimer);$('#preview-notice').hidden=true;preview();}
 if(msg.action==='select'&&data)selectSection(msg.id,msg.imagePath||'',msg.textPath||'');
 if(msg.action==='show-details'){selectSection(msg.id,msg.imagePath||'',msg.textPath||'');details();}
 if(msg.action==='show-background'){selectSection(msg.id,'',msg.textPath||'');details();$('#inspector [data-background-controls]')?.scrollIntoView({block:'start'});}
 if(msg.action==='object-start'&&data){
  if(!objectEditing){objectSnapshot={data:clone(data),dirty,future:future.slice()};objectChanged=false;}objectEditing=true;clearTimeout(previewTimer);selected=msg.id||'';imagePath=msg.imagePath||'';textPath=msg.textPath||'';mode='section';renderOutline();
 }
 if(msg.action==='object-change'&&objectEditing&&Array.isArray(msg.elements)&&typeof msg.path==='string'){
  const allowed=/^(?:pageLayouts\.(?:home|about|gallery)|(?:projects|pages)\.\d+)\.sections\.\d+\.elements$|^website\.elementLayouts\.(?:header|footer)$/;
  if(allowed.test(msg.path)&&msg.elements.every(e=>e&&typeof e.id==='string'&&e.id.length<600)){
   if(!objectChanged){remember();objectChanged=true;}set(msg.path,msg.elements.map(window.PortfolioObjects.clean));dirty=true;
  }
 }
 if(msg.action==='object-end'&&objectEditing){
  objectEditing=false;if(msg.cancel&&objectSnapshot){data=objectSnapshot.data;dirty=objectSnapshot.dirty;if(objectChanged)history.pop();future=objectSnapshot.future;updateUndo();status(dirty?'Draft changes · not published':'Ready');saveDraft();preview();}else if(objectChanged)mark(false);
  objectSnapshot=null;objectChanged=false;inspector();
 }
 if(msg.action==='text-start'){if(!inlineEditing)remember();inlineEditing=true;clearTimeout(previewTimer);}
 if(msg.action==='text-change'&&typeof msg.path==='string'&&typeof msg.value==='string'){set(msg.path,msg.value);if(msg.visiblePath)set(msg.visiblePath,true);mark(false);}
 if(msg.action==='text-end'){inlineEditing=false;renderOutline();inspector();}
 if(msg.action==='resize-start'){if(!resizeEditing)remember();resizeEditing=true;clearTimeout(previewTimer);selected=msg.id;imagePath=msg.path;mode='section';renderOutline();}
 if(msg.action==='resize'&&typeof msg.path==='string'){
  if(msg.width!=null)set(msg.path+'.width',M.numeric(msg.width,100,10,100));if(msg.height!=null){set(msg.path+'.height',M.numeric(msg.height,0,0,1200));set(msg.path+'.aspect','auto');}
  if(msg.focalX!=null){set(msg.path+'.focalX',M.numeric(msg.focalX,50,0,100));set(msg.path+'.focalY',M.numeric(msg.focalY,50,0,100));set(msg.path+'.fit','cover');}dirty=true;
 }
 if(msg.action==='columns-change'&&typeof msg.path==='string'){
  const base=sectionPath();set(base+'.imageWidth',M.numeric(msg.imageWidth,50,10,90));set(base+'.textWidth',M.numeric(msg.textWidth,50,10,90));set(base+'.imagePosition',msg.position==='right'?'right':'left');set(msg.path+'.width',100);dirty=true;
 }
 if(msg.action==='resize-end'){resizeEditing=false;mark();inspector();}
 if(msg.action==='canvas-command')canvasCommand(msg);
 if(msg.action==='replace-file'&&msg.file&&typeof msg.path==='string'){pendingUpload=msg.path;pendingMotionPath=typeof msg.motionPath==='string'?msg.motionPath:'';pendingMotion=['controls','loop'].includes(msg.motion)?msg.motion:'';upload(msg.file);}
});
$('#preview').addEventListener('load',()=>{if($('#preview').getAttribute('src')!=='about:blank')$('#preview').contentWindow.postMessage({portfolioEditor:true,action:'ping'},location.origin);});new ResizeObserver(fitPreview).observe($('.preview-pane'));window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
$('#restore-draft').onclick=()=>{data=M.upgrade(draftRecord.data);baseData=draftRecord.baseData;key=M.pageInfo(data,draftRecord.key)?draftRecord.key:'home';for(const item of draftRecord.assets||[])assets.set(item.path,{blob:item.blob,url:URL.createObjectURL(item.blob)});dirty=true;$('#draft-dialog').close();renderAll();status('Draft restored · not published');};$('#discard-draft').onclick=()=>{$('#draft-dialog').close();saveDraft();};
loadPreview();
(async()=>{try{let remote;try{remote=await readRemote();}catch{const response=await fetch('/content.json?editor='+Date.now(),{cache:'no-store'});if(!response.ok)throw new Error('Could not load portfolio content.');remote={data:await response.json(),sha:''};}baseData=clone(remote.data);baseSha=remote.sha;data=M.upgrade(remote.data);renderAll();fitPreview();$('#preview').contentWindow.postMessage({portfolioEditor:true,action:'ping'},location.origin);status('Ready · drag to move, use handles to resize, double-click text to type');draftRecord=await loadDraft();if(draftRecord?.dirty&&!same(draftRecord.data,data))$('#draft-dialog').showModal();}catch(error){status(error.message);}})();
})();

