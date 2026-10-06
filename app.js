const DEFAULT_SETTINGS = {
  "identity": {
    "brand": "Josh.",
    "homeTitle": "Josh — Mechanical Engineering",
    "galleryTitle": "Projects — Josh",
    "description": "Josh’s mechanical engineering portfolio. Automotive builds, fabrication, and composites projects at Washington State University.",
    "siteIcon": ""
  },
  "navigation": {
    "about": "About me",
    "gallery": "Gallery",
    "skip": "Skip to content"
  },
  "home": {
    "eyebrow": "MECHANICAL ENGINEERING · WASHINGTON STATE UNIVERSITY",
    "headline": "Hi, I’m Josh.",
    "subheadline": "I like to build things.",
    "button": "Explore my projects ↗",
    "buttonLink": "/?view=gallery",
    "aboutTitle": "A little about me.",
    "hobbiesTitle": "Hobbies",
    "highlightsTitle": "Things I’ve been working on.",
    "galleryLink": "View gallery ↗"
  },
  "gallery": {
    "eyebrow": "THE PROJECT GALLERY",
    "headline": "Ideas. Made real.",
    "subtitle": "A collection of builds, experiments, and work in progress.",
    "allProjects": "All projects",
    "showCount": true
  },
  "project": {
    "back": "← All projects",
    "endText": "Keep exploring.",
    "galleryButton": "Back to the gallery ↗",
    "coverLabel": "PROJECT",
    "coverMark": "↗",
    "showNumbers": true,
    "videoFallback": "Your browser cannot play this video.",
    "downloadVideo": "Download the video",
    "previewPlay": "Play preview",
    "previewPause": "Pause preview"
  },
  "carousel": {
    "source": "selected",
    "seconds": 2.5,
    "pause": "Pause",
    "play": "Play",
    "previous": "←",
    "next": "→",
    "showCount": true
  },
  "footer": {
    "left": "Josh · Mechanical Engineering",
    "right": "Washington State University · Pullman, WA"
  },
  "messages": {
    "notFound": "Nothing here yet.",
    "backToProjects": "Back to projects ↗",
    "loadError": "Couldn’t load the portfolio.",
    "retry": "Please refresh to try again."
  }
};
'use strict';

const app = document.querySelector('#app');
const galleryURL = '/?view=gallery';
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));
const paragraphs = value => esc(value).replace(/\n/g, '<br>');
const safeURL = value => {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value, location.origin);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
};
const safe = value => esc(safeURL(value));
const list = value => Array.isArray(value) ? value : [];
const textElement = (tag, className, value) => value ? `<${tag}${className ? ` class="${className}"` : ''}>${paragraphs(value)}</${tag}>` : '';
let settings;

function mergeSettings(saved = {}, edited = {}) {
  const sectionValues = (source, section) => {
    const value = source?.[section];
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  };
  return Object.fromEntries(Object.entries(DEFAULT_SETTINGS).map(([section, defaults]) => [
    section, { ...defaults, ...sectionValues(saved, section), ...sectionValues(edited, section) }
  ]));
}

function normalizeProject(project) {
  return {
    ...project,
    title: project.title || project.slug,
    theme: ['dark', 'silver', 'blue'].includes(project.theme) ? project.theme : 'silver',
    coverText: project.coverText ?? project.title ?? '',
    photos: list(project.photos).filter(photo => photo && (safeURL(photo.src) || safeURL(photo.imageStyle?.previewVideo) || editorPreview)),
    thumbnailMotion: project.thumbnailMotion || 'hover'
  };
}

function renderShell() {
  const setText = (selector, value) => {
    const node = document.querySelector(selector);
    if (node) { node.textContent = value ?? ''; node.hidden = !value; }
  };
  setText('.brand', settings.identity.brand);
  setText('[data-nav="about"]', settings.navigation.about);
  setText('[data-nav="gallery"]', settings.navigation.gallery);
  setText('.skip', settings.navigation.skip);
  setText('.footer-inner > :first-child', settings.footer.left);
  setText('.footer-inner > :last-child', settings.footer.right);
  document.querySelector('footer').hidden = !settings.footer.left && !settings.footer.right;
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.content = settings.identity.description;
  const iconURL = safeURL(settings.identity.siteIcon) || safeURL('/favicon.svg');
  let icon = document.querySelector('link[rel="icon"]');
  if (!icon) { icon = document.createElement('link'); icon.rel = 'icon'; document.head.append(icon); }
  icon.removeAttribute('type');
  // Clearing the upload restores the default; replacing the same filename refreshes it.
  const url = new URL(iconURL);
  if (url.origin === location.origin) url.searchParams.set('icon', String(Date.now()));
  icon.href = url.href;
}

function cover(project) {
  if (media(project.thumbnail)) return `<img src="${media(project.thumbnail)}" alt="${esc(project.thumbnailAlt || project.title)}" loading="lazy">`;
  if (media(project.previewVideo)) return videoThumbnail(project.previewVideo,project.thumbnailAlt||project.title);
  return `<div class="type-cover ${project.theme}">${textElement('span', 'cover-label', settings.project.coverLabel)}<span class="cover-type">${paragraphs(project.coverText)}</span>${textElement('span', 'cover-bottom', settings.project.coverMark)}</div>`;
}

function card(project, index) {
  const number = settings.project.showNumbers ? `<span class="card-index">${String(index + 1).padStart(2, '0')}</span>` : '';
  if (project.demo) return `<article class="project-card demo-card" aria-label="Empty gallery slot ${index + 1}"><div class="thumbnail demo-thumbnail demo-tone-${Math.floor(index / 3)}"></div><div class="card-heading"><span class="demo-title" aria-hidden="true"></span>${number}</div></article>`;
  const isGIF = /\.gif(?:[?#]|$)/i.test(project.previewVideo || '');
  if(project.thumbnailMotion==='controls'&&media(project.previewVideo)&&!isGIF){
    const playback=editorPreview?'muted playsinline preload="metadata"':'controls playsinline preload="metadata"';
    const poster=project.thumbnail||automaticVideoPoster(project.previewVideo);
    return `<article class="project-card" data-project="${esc(project.slug)}"><div class="project-link"><div class="thumbnail" data-fit="${project.thumbnailFit==='contain'?'contain':'cover'}"><video class="card-video-player ${editorPreview?'media-preview':''}" ${playback} src="${media(poster)?media(project.previewVideo):firstFrameSource(project.previewVideo)}" ${media(poster)?`poster="${media(poster)}"`:''} aria-label="${esc(project.title)}"></video>${editorPreview&&media(poster)?`<img class="media-video-thumbnail" src="${media(poster)}" alt="${esc(project.thumbnailAlt||project.title)}">`:''}</div><div class="card-heading"><h3><a href="/?project=${encodeURIComponent(project.slug)}">${esc(project.title)}</a></h3>${number}</div></div></article>`;
  }
  const gifPreview = project.thumbnailMotion !== 'still' && !reducedMotion.matches && isGIF && media(project.previewVideo);
  const previewURL = media(project.previewVideo);
  const previewMotion = project.thumbnailMotion === 'loop' ? 'loop' : 'hover';
  const preview = previewURL && (editorPreview || project.thumbnailMotion !== 'still')
    ? isGIF
      ? editorPreview ? `<img class="preview preview-gif" src="${previewURL}" alt="Preview animation" aria-hidden="true">` : ''
      : `<video class="preview" data-motion="${previewMotion}" muted loop playsinline preload="none" ${previewMotion === 'hover' ? `data-src="${previewURL}"` : `src="${previewURL}"`} aria-hidden="true" tabindex="-1"></video>`
    : '';

  return `<article class="project-card" data-project="${esc(project.slug)}"><a class="project-link" href="/?project=${encodeURIComponent(project.slug)}"><div class="thumbnail" data-fit="${project.thumbnailFit === 'contain' ? 'contain' : 'cover'}">${gifPreview && !editorPreview ? `<img class="preview-gif" src="${media(project.previewVideo)}" alt="${esc(project.thumbnailAlt || project.title)}" loading="lazy">` : cover(project)}${preview}</div><div class="card-heading"><h3>${esc(project.title)}</h3>${number}</div></a></article>`;
}

function galleryProjects(data) {
  // Existing projects stay visible until their gallery switch is turned off.
  return data.projects.filter(project => project.showInGallery !== false);
}

function highlightPosition(value) {
  const position = Number(value);
  return Number.isInteger(position) && position >= 1 && position <= 9 ? position : 10;
}

function highlightProjects(data) {
  if (settings.carousel.source === 'demo') return Array.from({ length: 9 }, () => ({ demo: true }));
  const legacySelection = data.projects.some(project => project.homepageHighlight != null && project.homepageHighlight !== '');
  return galleryProjects(data)
    .filter(project => {
      if (typeof project.featuredOnHomepage === 'boolean') return project.featuredOnHomepage;
      // Preserve choices made with the earlier position dropdown until switches are saved.
      return !legacySelection || highlightPosition(project.homepageHighlight) <= 9;
    })
    .sort((a, b) => highlightPosition(a.homepageOrder ?? a.homepageHighlight) - highlightPosition(b.homepageOrder ?? b.homepageHighlight))
    .slice(0, 9);
}

function carouselGroups(projects) {
  if (!projects.length) return [];
  const perSlide = Math.min(smallScreen.matches ? 1 : 3, projects.length);
  return Array.from({ length: Math.ceil(projects.length / perSlide) }, (_, group) =>
    Array.from({ length: perSlide }, (_, item) => {
      const index = (group * perSlide + item) % projects.length;
      return { project: projects[index], index };
    })
  );
}

function renderCarousel(data) {
  const projects = highlightProjects(data);
  if (!projects.length) return '';
  // Wrap the final group back to the beginning instead of leaving empty columns.
  const groups = carouselGroups(projects).map(group => group.map(({ project, index }) => card(project, index)).join(''));
  return `<section class="wrap selected"><div class="section-heading">${textElement('h2', '', settings.home.highlightsTitle)}${settings.home.galleryLink ? `<a class="text-link" href="${galleryURL}">${esc(settings.home.galleryLink)}</a>` : ''}</div><div class="project-carousel" style="--cards-per-slide:${Math.min(smallScreen.matches ? 1 : 3, projects.length)}" role="region" aria-roledescription="carousel" aria-label="Project highlights" data-groups="${groups.length}"><div class="carousel-viewport"><div class="carousel-track">${groups.map((group, i) => `<div class="carousel-slide" role="group" aria-roledescription="slide" aria-label="${i + 1} of ${groups.length}" ${i ? 'inert aria-hidden="true"' : 'aria-hidden="false"'}>${group}</div>`).join('')}${groups.length > 1 ? `<div class="carousel-slide carousel-clone" inert aria-hidden="true">${groups[0]}</div>` : ''}</div></div>${groups.length > 1 ? `<div class="carousel-controls"><div class="carousel-dots">${groups.map((_, i) => `<button type="button" class="carousel-dot" data-page="${i}" aria-label="Show group ${i + 1}" aria-current="${i === 0}"></button>`).join('')}</div><div class="carousel-actions">${settings.carousel.showCount ? `<span class="carousel-status" aria-live="off">1 / ${groups.length}</span>` : ''}<button type="button" class="carousel-arrow" data-direction="-1" aria-label="Previous projects">${esc(settings.carousel.previous)}</button><button type="button" class="carousel-arrow" data-direction="1" aria-label="Next projects">${esc(settings.carousel.next)}</button><button type="button" class="carousel-pause" aria-label="Pause gallery slideshow">${esc(settings.carousel.pause)}</button></div></div>` : ''}</div></section>`;
}

function bindPreviews() {
  // The editor plays only the preview explicitly selected for cropping.
  if (editorPreview) return;
  const controller=new AbortController(),options={signal:controller.signal};
  const items=[...document.querySelectorAll('.project-card')].map(card=>{
    const video=card.querySelector('video.preview');
    return {card,link:card.querySelector('.project-link'),video,motion:video?.dataset.motion||'loop',visible:false,pending:false,blocked:false,engaged:false};
  }).concat([...document.querySelectorAll('.media-preview-frame')].map(card=>({card,link:card.querySelector('.image-box')||card,video:card.querySelector('.media-preview'),motion:card.dataset.motion||'hover',visible:false,pending:false,blocked:false,engaged:false}))).filter(item=>item.video&&item.motion!=='still');
  const wants=item=>item.visible&&!item.card.closest('[inert]')&&!document.hidden&&!reducedMotion.matches&&!editorPreview&&(item.motion==='loop'||item.engaged||(touchScreen.matches&&item.motion==='hover'));
  function ensureSource(item){
    if(!item.video.getAttribute('src')&&item.video.dataset.src){
      // Hover previews stay light offscreen, then buffer shortly before the card reaches the viewport.
      item.video.preload='auto';
      item.video.src=item.video.dataset.src;
      item.video.load();
    }
  }
  function update(item){
    if(item.video.tagName==='IMG'){item.link.classList.toggle('playing',wants(item));return;}
    if(!wants(item)){item.video.pause();item.link.classList.remove('playing');return;}
    ensureSource(item);
    if(item.pending||!item.video.paused||item.blocked)return;
    item.pending=true;item.video.muted=true;item.video.defaultMuted=true;item.video.playsInline=true;
    Promise.resolve(item.video.play()).then(()=>{item.pending=false;if(controller.signal.aborted||!wants(item)){item.video.pause();return;}item.blocked=false;item.link.classList.add('playing');}).catch(()=>{item.pending=false;if(controller.signal.aborted)return;item.blocked=true;item.link.classList.remove('playing');});
  }

  // Buffer hover previews only when they are near the viewport. On touch devices, visible hover previews autoplay like GIFs.
  const preloadObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{
    if(!entry.isIntersecting)return;
    const item=items.find(i=>i.video===entry.target);
    if(item&&item.motion==='hover'){
      ensureSource(item);
      preloadObserver.unobserve(item.video);
    }
  }),{rootMargin:'600px 250px',threshold:0});

  const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{const item=items.find(i=>i.video===entry.target);if(item){item.visible=entry.isIntersecting&&entry.intersectionRatio>=.15;update(item);}}),{threshold:.15});
  items.forEach(item=>{
    if(item.card.classList.contains('media-preview-frame')){item.link.tabIndex=0;item.link.setAttribute('aria-label','Media preview');}
    item.video.addEventListener('pause',()=>item.link.classList.remove('playing'),options);
    if(item.motion==='hover'){
      item.link.addEventListener('mouseenter',()=>{item.engaged=true;item.blocked=false;update(item);},options);
      item.link.addEventListener('mouseleave',()=>{item.engaged=false;update(item);},options);
      item.link.addEventListener('focusin',()=>{item.engaged=true;item.blocked=false;update(item);},options);
      item.link.addEventListener('focusout',()=>{item.engaged=false;update(item);},options);
      preloadObserver.observe(item.video);
    }
    observer.observe(item.video);
  });
  // Some mobile browsers defer muted playback until the first user interaction.
  const retry=()=>items.forEach(item=>{item.blocked=false;update(item);});
  document.addEventListener('pointerdown',retry,{...options,passive:true});
  document.addEventListener('keydown',retry,options);
  document.addEventListener('visibilitychange',retry,options);
  reducedMotion.addEventListener('change',retry,options);
  activeCleanups.push(()=>{controller.abort();observer.disconnect();preloadObserver.disconnect();items.forEach(i=>i.video.pause?.());});
}

function bindCarousel(carousel) {
  if (!carousel) return;
  const events = new AbortController(), eventOptions = { signal: events.signal };
  const count = Number(carousel.dataset.groups);
  if (count < 2) return;
  const viewport = carousel.querySelector('.carousel-viewport');
  const track = carousel.querySelector('.carousel-track');
  const slides = [...track.children];
  const dots = [...carousel.querySelectorAll('.carousel-dot')];
  const pause = carousel.querySelector('.carousel-pause');
  const status = carousel.querySelector('.carousel-status');
  const seconds = Number(carousel.dataset.seconds ?? settings.carousel.seconds);
  const interval = (Number.isFinite(seconds) ? Math.max(1, Math.min(30, seconds)) : 2.5) * 1000;
  let index = Math.max(0,Math.min(count-1,Number(carousel.dataset.currentGroup)||0)), visualIndex = index, timer, finishTimer, busy = false;
  let userPaused = reducedMotion.matches || editorPreview || carousel.dataset.autoplay==='false', hovered = false, focused = false, visible = false;
  const canRun = () => !userPaused && !hovered && !focused && visible && !document.hidden;
  function schedule() {
    clearTimeout(timer);
    if (canRun()) timer = setTimeout(() => move(1), interval);
  }
  function position() {
    // Include the real gutter between slides, rather than translating by 100% alone.
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    const step = viewport.getBoundingClientRect().width + gap;
    track.style.transform = `translate3d(${-visualIndex * step}px, 0, 0)`;
  }
  function showState() {
    carousel.dataset.currentGroup=String(index);
    dots.forEach((dot, i) => dot.setAttribute('aria-current', String(i === index)));
    slides.forEach((slide, i) => {
      const active = i === index && i < count;
      slide.inert = !active;
      slide.setAttribute('aria-hidden', String(!active));
    });
    if (status) status.textContent = `${index + 1} / ${count}`;
    pause.textContent = userPaused ? settings.carousel.play : settings.carousel.pause;
    pause.setAttribute('aria-label', userPaused ? 'Play gallery slideshow' : 'Pause gallery slideshow');
  }
  function settle() {
    clearTimeout(finishTimer);
    if (visualIndex === count) {
      track.classList.add('no-transition');
      visualIndex = 0;
      position();
      void track.offsetWidth;
      track.classList.remove('no-transition');
    }
    busy = false;
  }
  function go(next, clone = false) {
    if (busy) return;
    index = next;
    visualIndex = clone ? count : index;
    busy = true;
    showState();
    position();
    clearTimeout(finishTimer);
    finishTimer = setTimeout(settle, reducedMotion.matches ? 0 : 500);
    schedule();
  }
  function move(direction) {
    go((index + direction + count) % count, direction === 1 && index === count - 1);
  }
  carousel.querySelectorAll('[data-direction]').forEach(button => button.addEventListener('click', () => move(Number(button.dataset.direction)), eventOptions));
  dots.forEach(dot => dot.addEventListener('click', () => go(Number(dot.dataset.page)), eventOptions));
  pause.addEventListener('click', () => { userPaused = !userPaused; showState(); schedule(); }, eventOptions);
  // Reading a project or tabbing through its link pauses automatic movement.
  viewport.addEventListener('mouseenter', () => { hovered = !touchScreen.matches; schedule(); }, eventOptions);
  viewport.addEventListener('mouseleave', () => { hovered = false; schedule(); }, eventOptions);
  carousel.addEventListener('focusin', () => { focused = viewport.contains(document.activeElement); schedule(); }, eventOptions);
  carousel.addEventListener('focusout', () => { setTimeout(() => { focused = viewport.contains(document.activeElement); schedule(); }, 0); }, eventOptions);
  document.addEventListener('visibilitychange', schedule, eventOptions);
  reducedMotion.addEventListener('change', () => { userPaused = reducedMotion.matches; showState(); schedule(); }, eventOptions);
  const visibilityObserver = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; schedule(); }, { threshold: 0.15 });
  visibilityObserver.observe(carousel);
  const resizeObserver = new ResizeObserver(() => {
    settle();
    track.classList.add('no-transition');
    position();
    void track.offsetWidth;
    track.classList.remove('no-transition');
  });
  resizeObserver.observe(viewport);
  carousel.addEventListener('previewinteraction', () => { userPaused = true; showState(); schedule(); }, eventOptions);
  let start = null, suppressTap = false;
  viewport.style.touchAction = 'pan-y pinch-zoom';
  viewport.addEventListener('touchstart', e => { if(e.touches.length===1){suppressTap=false;start={x:e.touches[0].clientX,y:e.touches[0].clientY};clearTimeout(timer);} }, {...eventOptions,passive:true});
  viewport.addEventListener('touchend', e => { if(!start)return;const dx=e.changedTouches[0].clientX-start.x,dy=e.changedTouches[0].clientY-start.y;start=null;if(Math.abs(dx)>40&&Math.abs(dx)>Math.abs(dy)*1.25){suppressTap=true;move(dx<0?1:-1);}schedule(); }, {...eventOptions,passive:true});
  viewport.addEventListener('click', e => {if(suppressTap){e.preventDefault();e.stopPropagation();suppressTap=false;}}, {...eventOptions,capture:true});
  viewport.addEventListener('touchcancel', () => {start=null;schedule();}, eventOptions);
  activeCleanups.push(() => {events.abort();clearTimeout(timer);clearTimeout(finishTimer);visibilityObserver.disconnect();resizeObserver.disconnect();});
  showState();position();
}

async function fetchJSON(path) {
  const url = new URL(path, location.origin);
  url.searchParams.set('updated', String(Date.now()));
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Could not load ${path}`);
  return response.json();
}

const Model = window.PortfolioModel;
const smallScreen = matchMedia('(max-width: 650px)');
const touchScreen = matchMedia('(hover: none), (pointer: coarse)');
const editorPreview = new URLSearchParams(location.search).get('editorPreview') === '1' && window.parent !== window;
let previewAssets = {};
let activeCleanups = [];
let currentData, currentPageKey;
let savedVideoPosters={};
const videoPostersReady=app?fetchJSON('/video-posters.json').then(index=>{
  savedVideoPosters=index&&typeof index==='object'&&!Array.isArray(index)?index:{};
  if(editorPreview&&currentData){const y=window.scrollY;displayPortfolio(currentData,currentPageKey);window.scrollTo(0,y);}
}).catch(()=>{}):Promise.resolve();
function mediaURL(value) {
  if (editorPreview && typeof previewAssets[value] === 'string' && previewAssets[value].startsWith('blob:' + location.origin + '/')) return previewAssets[value];
  return safeURL(value);
}
const media = value => esc(mediaURL(value));
function automaticVideoPoster(src){return currentData?.videoPosters?.[src]||savedVideoPosters[src]||'';}
function firstFrameSource(src){const value=mediaURL(src);if(!value)return '';const url=new URL(value);if(!url.hash)url.hash='t=0.001';return esc(url.href);}
const number = Model.numeric;
const choice = (value, values, fallback) => values.includes(value) ? value : fallback;
function imageCSS(style = {}, fallbackFit = 'cover') {
  const widths={small:40,medium:65,large:85,full:100};
  const width=number(style.width,widths[style.size]||100,10,100);
  const ratios={auto:'auto',square:'1 / 1',portrait:'4 / 5',tall:'3 / 4',landscape:'4 / 3',wide:'16 / 9'};
  const height=number(style.height,0,0,1200);
  return `--photo-rotation:${photoRotation(style.rotation)};--image-width:${width}%;--image-height:${height?height+'px':'auto'};--image-ratio:${ratios[style.aspect]||'auto'};--image-fit:${choice(style.fit,['cover','contain'],fallbackFit)};--image-x:${number(style.focalX,50,0,100)}%;--image-y:${number(style.focalY,50,0,100)}%;--image-margin:${number(style.margin,0,0,120)}px;--image-padding:${number(style.padding,0,0,80)}px;--caption-align:${choice(style.captionAlignment,['left','center','right'],'left')}`;
}
function previewCSS(style={},fallbackFit='cover') {
  const inherited=style.enabled===false?{}:style,preview=style.previewStyle?.enabled===false?{}:style.previewStyle||{};
  return `--preview-fit:${choice(preview.fit,['cover','contain'],choice(inherited.fit,['cover','contain'],fallbackFit))};--preview-x:${number(preview.focalX,number(inherited.focalX,50,0,100),0,100)}%;--preview-y:${number(preview.focalY,number(inherited.focalY,50,0,100),0,100)}%`;
}
function mediaPreview(src,motion='hover') {
  if(!media(src))return '';
  return /\.gif(?:[?#]|$)/i.test(src)?`<img class="media-preview" src="${media(src)}" alt="Preview animation" aria-hidden="true">`:`<video class="media-preview" data-motion="${motion}" data-src="${media(src)}" muted loop playsinline preload="none" aria-hidden="true" tabindex="-1"></video>`;
}
function videoThumbnail(src,alt='Video thumbnail') {
  // A real image remains visible on phones that do not decode paused videos.
  if(!media(src))return '';
  if(/\.gif(?:[?#]|$)/i.test(src))return `<img src="${media(src)}" alt="${esc(alt)}" loading="lazy">`;
  const poster=automaticVideoPoster(src);
  if(media(poster))return `<img class="video-thumbnail" src="${media(poster)}" alt="${esc(alt)}" loading="lazy">`;
  return `<video class="video-thumbnail" src="${firstFrameSource(src)}" muted playsinline preload="metadata" aria-label="${esc(alt)}" tabindex="-1"></video>`;
}
function photoFrame(src,alt,style={},options={}) {
  const geometry=['size','width','height','aspect','align','fit','focalX','focalY','margin','padding'];
  const custom=style.enabled!==false&&geometry.some(key=>style[key]!==undefined&&style[key]!==null&&style[key]!=='');
  if(style.enabled===false)style=Object.fromEntries(Object.entries(style).filter(([key])=>!geometry.includes(key)));
  const caption=style.caption ?? options.caption ?? '';
  const captionHTML=caption && style.showCaption!==false ? `<figcaption class="${options.captionClass||'image-caption'}">${paragraphs(caption)}</figcaption>`:'';
  const above=style.captionPosition==='above';
  const previewSrc=options.previewSrc??style.previewVideo,motion=choice(options.motion??style.previewBehavior,['controls','hover','loop','still'],'hover'),hasPreview=!!media(previewSrc);
  if(hasPreview&&motion==='controls')return renderVideo(previewSrc,src,{...style,caption,poster:src,previewVideo:undefined,previewBehavior:'controls'},options.path,'section-video',{frameClass:options.frameClass,alt});
  const previewStyle=options.previewStyle?{...style,previewStyle:options.previewStyle}:style;
  const thumbnail=media(src)?`<img src="${media(src)}" alt="${esc(alt||'')}" ${options.eager?'':'loading="lazy"'}>`:hasPreview?videoThumbnail(previewSrc,alt):'<span class="image-placeholder" role="img" aria-label="Space for a photo"></span>';
  return `<figure class="image-frame ${options.frameClass||''} ${custom?'image-custom':''} ${hasPreview?'media-preview-frame':''} image-align-${choice(style.align,['left','center','right'],'center')} ${above?'caption-above':''}" style="${imageCSS(style,options.fit)};${previewCSS(previewStyle,options.fit)}" data-image-style="${esc(options.path||'')}" data-motion="${motion}">${above?captionHTML:''}<div class="image-box ${options.boxClass||''}">${thumbnail}${hasPreview&&(editorPreview||motion!=='still')?mediaPreview(previewSrc,motion):''}</div>${above?'':captionHTML}</figure>`;
}
function renderHero(data) {
  const headline=[settings.home.headline?paragraphs(settings.home.headline):'',settings.home.subheadline?`<span>${paragraphs(settings.home.subheadline)}</span>`:''].filter(Boolean).join('<br>');
  return `<section class="intro wrap hero-with-photo"><div class="hero-copy">${textElement('p','eyebrow',settings.home.eyebrow)}${headline?`<h1>${headline}</h1>`:''}${settings.home.button?`<div class="intro-bottom"><a class="pill" href="${safe(settings.home.buttonLink)||galleryURL}">${esc(settings.home.button)}</a></div>`:''}</div>${photoFrame(data.heroPhoto,data.heroPhotoAlt||`Portrait of ${data.name}`,data.heroImage||{},{frameClass:'hero-frame',boxClass:'hero-photo'+(media(data.heroPhoto)?' has-photo':''),path:'heroImage',eager:true})}</section>`;
}
function renderAbout(data) {
  return `<section class="about-section"><div class="wrap about-grid"><div class="about-portrait-column">${textElement('h2','',settings.home.aboutTitle)}${photoFrame(data.portrait,data.portraitAlt||`Portrait of ${data.name}`,data.portraitImage||{},{frameClass:'portrait-figure',boxClass:'portrait-box',caption:data.personal??data.portraitCaption??'',captionClass:'portrait-caption',path:'portraitImage'})}</div><div class="about-copy">${textElement('p','',data.bio)}</div></div></section>`;
}
function renderHobbies(data) {
  const hobbies=Array.from({length:3},(_,i)=>list(data.hobbies)[i]||{});
  return `<section class="wrap hobbies-section">${textElement('h2','',settings.home.hobbiesTitle)}${textElement('p','hobbies-intro',data.hobbiesIntro)}<div class="hobbies-grid">${hobbies.map((hobby,i)=>`<article class="hobby-card hobby-position-${choice(hobby.imageStyle?.position,['left','right','above','below'],'above')}">${photoFrame(hobby.photo,hobby.alt||hobby.title,hobby.imageStyle||{},{boxClass:'hobby-photo',path:`hobbies.${i}.imageStyle`})}<div class="hobby-copy">${textElement('h3','',hobby.title)}${textElement('p','',hobby.text)}</div></article>`).join('')}</div></section>`;
}
function projectIntro(project) {
  const description=project.description??project.summary??'';
  return `${settings.project.back?`<a class="text-link back" href="${galleryURL}">${esc(settings.project.back)}</a>`:''}<div class="detail-heading"><h1>${esc(project.title)}</h1>${textElement('p','page-subtitle project-description',description)}</div>`;
}
function renderVideo(src,poster,style={},path='',className='section-video',options={}) {
  if(!media(src)&&!editorPreview&&style.poster==null)return '';
  poster=(style.poster??(media(src)?poster:''))||automaticVideoPoster(src);
  const motion=choice(style.previewBehavior,['controls','hover','loop','still'],'controls');
  if(!media(src)||motion!=='controls'||editorPreview&&/\.gif(?:[?#]|$)/i.test(src))return media(poster)||editorPreview||media(src)?photoFrame(poster,options.alt||'Video thumbnail',style,{fit:'contain',path,previewSrc:src,motion}):'';
  if(/\.gif(?:[?#]|$)/i.test(src))return photoFrame(src,'Animated project image',style,{fit:'contain',path});
  const custom=style.enabled!==false&&Object.keys(style).some(key=>['width','height','aspect','align','fit','margin','padding'].includes(key));
  const caption=style.caption&&style.showCaption!==false?textElement('figcaption','image-caption',style.caption):'';
  const preload='metadata';
  const playback=editorPreview?'muted playsinline preload="metadata"':options.gifLike&&style.previewBehavior==null?'autoplay loop muted playsinline preload="auto"':`controls playsinline preload="${preload}" ${style.loop?'loop':''} ${style.muted?'muted':''}`;
  const video=`<video class="${className} media-video ${editorPreview?'media-preview':''}" ${playback} ${options.alt?`aria-label="${esc(options.alt)}"`:''} ${media(poster)?`poster="${media(poster)}"`:''} src="${media(poster)?media(src):firstFrameSource(src)}">${esc(settings.project.videoFallback)} <a href="${media(src)}">${esc(settings.project.downloadVideo)}</a></video>`;
  return `<figure class="video-frame ${options.frameClass||''} ${custom?'video-custom':''} image-align-${choice(style.align,['left','center','right'],'center')}" data-image-style="${esc(path)}" style="${imageCSS(style,'contain')};${previewCSS(style,'contain')}">${style.captionPosition==='above'?caption:''}<div class="video-media-box">${video}${editorPreview&&media(poster)?`<img class="media-video-thumbnail" src="${media(poster)}" alt="${esc(options.alt||'Video thumbnail')}">`:''}</div>${style.captionPosition!=='above'?caption:''}</figure>`;
}
function projectVideo(project,data) {
  return renderVideo(project.video,project.thumbnail,project.videoStyle||{},`projects.${data.projects.indexOf(project)}.videoStyle`,'main-video');
}
function renderPhotoText(section,ctx,path,legacyPhoto) {
  const photo=legacyPhoto||section;
  const src=legacyPhoto?photo.src:section.image;
  const text=legacyPhoto?(photo.text??photo.caption??''):section.text;
  const heading=legacyPhoto?photo.title:section.heading;
  const style={...(photo.imageStyle||{}),...(legacyPhoto?{caption:photo.shortCaption??photo.imageStyle?.caption}: {caption:section.caption??section.imageStyle?.caption}),showCaption:legacyPhoto?(photo.showCaption??photo.imageStyle?.showCaption):(section.showCaption??photo.imageStyle?.showCaption)};
  const position=choice(section.imagePosition||photo.imagePosition,['left','right','above','below'],'left');
  const only=!text&&!heading;
  return `<section class="content-section ${ctx.info.kind==='project'?'':'wrap'}"><div class="section-row layout-${position} ${only?'photo-only':''}" style="--photo-columns:${position==='right'?`minmax(0,${number(section.textWidth,44,10,90)}fr) minmax(0,${number(section.imageWidth,56,10,90)}fr)`:`minmax(0,${number(section.imageWidth,56,10,90)}fr) minmax(0,${number(section.textWidth,44,10,90)}fr)`};--content-gap:${number(section.gap,46,0,100)}px;--text-size:${{small:16,normal:18,large:22}[section.textSize]||18}px;align-items:${choice(section.alignment,['start','center','end'],'center')}"><div class="photo-pane">${photoFrame(src,photo.alt||heading||ctx.info.title,style,{fit:'contain',path})}</div>${only?'':`<div class="section-copy" style="text-align:${choice(section.textAlign,['left','center','right'],'left')}">${textElement('h2','',heading)}${textElement('p','',text)}</div>`}</div></section>`;
}

function renderMediaCarousel(section,ctx,sectionPath){
  const items=list(section.items),perSlide=Math.min(smallScreen.matches?1:3,items.length);
  if(!items.length)return editorPreview?`<section class="wrap content-section"><p>Add photos or videos in More controls.</p></section>`:'';
  const groups=Array.from({length:Math.ceil(items.length/perSlide)},(_,group)=>items.slice(group*perSlide,(group+1)*perSlide).map((item,offset)=>{
    const i=group*perSlide+offset,path=`${sectionPath}.items.${i}.imageStyle`;
    const frame=item.type==='video'?renderVideo(item.src,item.poster,item.imageStyle||{},path,'carousel-video'):photoFrame(item.src,item.alt||'Carousel media '+(i+1),item.imageStyle||{},{fit:'cover',path});
    return `<div class="carousel-media-item">${frame}</div>`;
  }).join(''));
  return `<section class="wrap content-section media-carousel-section"><div class="section-heading">${textElement('h2','',section.heading)}</div><div class="project-carousel media-carousel" style="--cards-per-slide:${perSlide}" role="region" aria-roledescription="carousel" aria-label="${esc(section.heading||'Photo and video carousel')}" data-groups="${groups.length}" data-seconds="${number(section.seconds,3,1,30)}" data-autoplay="${section.autoplay!==false}"><div class="carousel-viewport"><div class="carousel-track">${groups.map((html,i)=>`<div class="carousel-slide" role="group" aria-roledescription="slide" aria-label="${i+1} of ${groups.length}" ${i?'inert aria-hidden="true"':'aria-hidden="false"'}>${html}</div>`).join('')}${groups.length>1?`<div class="carousel-slide carousel-clone" inert aria-hidden="true">${groups[0]}</div>`:''}</div></div>${groups.length>1?`<div class="carousel-controls"><div class="carousel-dots">${groups.map((_,i)=>`<button type="button" class="carousel-dot" data-page="${i}" aria-label="Show group ${i+1}" aria-current="${i===0}"></button>`).join('')}</div><div class="carousel-actions"><span class="carousel-status" aria-live="off">1 / ${groups.length}</span><button type="button" class="carousel-arrow" data-direction="-1" aria-label="Previous media">${esc(settings.carousel.previous)}</button><button type="button" class="carousel-arrow" data-direction="1" aria-label="Next media">${esc(settings.carousel.next)}</button><button type="button" class="carousel-pause" aria-label="Pause gallery slideshow">${esc(settings.carousel.pause)}</button></div></div>`:''}</div></section>`;
}

function renderMediaPair(section,ctx,sectionPath) {
  const items=list(section.items).slice(0,3);
  if(!items.length)return '';
  const mediaItems=items.map((item,i)=>{
    const itemPath=`${sectionPath}.items.${i}.imageStyle`;
    if(item.type==='blank'&&!media(item.src)&&!media(item.imageStyle?.previewVideo)&&!editorPreview){
      return `<div class="paired-media-item media-placeholder" role="img" aria-label="${esc(item.alt||'Placeholder image')}"></div>`;
    }
    if(item.type==='video'){
      if(item.gifLike===true){
        return `<div class="paired-media-item paired-giflike-item">${renderVideo(item.src,item.poster,item.imageStyle||{},itemPath,'paired-giflike-video',{gifLike:true,alt:item.alt||ctx.info.title||'Animated project media'})}</div>`;
      }
      return `<div class="paired-media-item paired-video-item">${renderVideo(item.src,item.poster,item.imageStyle||{},itemPath,'paired-video')}</div>`;
    }
    const gifClass=/\.gif(?:[?#]|$)/i.test(item.src||'')?' paired-gif-item':'';
    return `<div class="paired-media-item${gifClass}">${photoFrame(item.src,item.alt||ctx.info.title,item.imageStyle||{},{fit:'cover',path:itemPath})}</div>`;
  }).join('');
  return `<section class="content-section ${ctx.info.kind==='project'?'':'wrap'}"><div class="media-pair media-count-${items.length}">${mediaItems}</div>${textElement('p','pair-caption',section.text)}</section>`;
}

function renderVideoText(section,ctx,sectionPath) {
  const style={...section.imageStyle,caption:section.caption??section.imageStyle?.caption,showCaption:section.showCaption??section.imageStyle?.showCaption};
  const video=section.gifLike===true
    ? renderVideo(section.video,section.poster,style,`${sectionPath}.imageStyle`,'video-text-media',{gifLike:true,alt:section.alt||ctx.info.title||'Animated project media'})
    : renderVideo(section.video,section.poster||'',style,`${sectionPath}.imageStyle`,'video-text-media');
  const copy=textElement('p','',section.text);
  const position=section.videoPosition==='right'?'right':'left';
  return `<section class="content-section ${ctx.info.kind==='project'?'':'wrap'}"><div class="video-text-row video-${position}"><div class="video-text-media-wrap">${video}</div><div class="video-text-copy">${copy}</div></div></section>`;
}

function panelAppearance(section){
  const style=section.panelStyle;
  if(!style||typeof style!=='object')return {css:'',attributes:''};
  let css='',attributes='';
  const property=(name,value)=>{css+=`--panel-${name}:${value};`;attributes+=` data-panel-${name}`;};
  const color=value=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value);
  if(style.transparent===true)property('color','transparent');
  else if(color(style.color))property('color',style.color);
  else if(style.transparent===false)property('color','#f3f1ec');
  if(color(style.textColor))property('text-color',style.textColor);
  if(['square','rounded','pill','custom'].includes(style.shape))property('radius',style.shape==='custom'?number(style.radius,16,0,120)+'px':{square:'0px',rounded:'16px',pill:'9999px'}[style.shape]);
  if(style.padding!=null&&Number.isFinite(Number(style.padding))&&style.padding!=='')property('padding',number(style.padding,32,0,120)+'px');
  return {css,attributes};
}
function renderSection(section,ctx,index) {
  if(section.visible===false)return '';
  const {data,info}=ctx;
  const project=info.project;
  const keyPath=info.kind==='project'?`projects.${data.projects.indexOf(project)}.sections`:info.kind==='page'?`pages.${data.pages.indexOf(info.page)}.sections`:`pageLayouts.${info.key}.sections`;
  const sectionPath=`${keyPath}.${index}`;
  const panel=panelAppearance(section);
  let html='';
  switch(section.type) {
    case 'hero':html=renderHero(data);break;
    case 'about':html=renderAbout(data);break;
    case 'hobbies':html=renderHobbies(data);break;
    case 'highlights':html=renderCarousel(data);break;
    case 'galleryIntro':html=`<div class="wrap gallery-intro">${textElement('p','eyebrow',settings.gallery.eyebrow)}${textElement('h1','',settings.gallery.headline)}${textElement('p','page-subtitle',settings.gallery.subtitle)}</div>`;break;
    case 'galleryGrid': {const projects=galleryProjects(data);html=`<section class="wrap gallery-list"><div class="project-grid">${projects.map(card).join('')}</div></section>`;break;}
    case 'projectIntro':if(project)html=projectIntro(project);break;
    case 'projectVideo':if(project)html=projectVideo(project,data);break;
    case 'projectPhoto': {const photo=Model.photoSource(data,info.key,section);if(photo)html=renderPhotoText(section,ctx,`projects.${data.projects.indexOf(project)}.photos.${project.photos.indexOf(photo)}.imageStyle`,photo);break;}
    case 'projectThumbnail':if(project)html=renderPhotoText({...section,image:project.thumbnail,alt:project.thumbnailAlt||project.title,imageStyle:{...project.thumbnailStyle,previewVideo:project.previewVideo,previewStyle:project.previewStyle,previewBehavior:project.thumbnailMotion},showCaption:project.thumbnailStyle?.showCaption},ctx,`projects.${data.projects.indexOf(project)}.thumbnailStyle`);break;
    case 'projectEnd':html=`<div class="project-end">${textElement('span','',settings.project.endText)}${settings.project.galleryButton?`<a class="pill" href="${galleryURL}">${esc(settings.project.galleryButton)}</a>`:''}</div>`;break;
    case 'photoText':html=renderPhotoText(section,ctx,`${sectionPath}.imageStyle`);break;
    case 'mediaPair':html=renderMediaPair(section,ctx,sectionPath);break;
    case 'mediaCarousel':html=renderMediaCarousel(section,ctx,sectionPath);break;
    case 'text':case 'heading':html=`<section class="content-section text-section ${info.kind==='project'?'':'wrap'}" style="text-align:${choice(section.textAlign,['left','center','right'],'left')};--text-size:${{small:16,normal:18,large:22}[section.textSize]||18}px">${textElement(choice(section.headingLevel,['h1','h2','h3'],'h2'),'',section.heading)}${textElement('p','',section.text)}</section>`;break;
    case 'videoText':html=renderVideoText(section,ctx,sectionPath);break;
    case 'video':html=`<section class="content-section ${info.kind==='project'?'':'wrap'}">${textElement('h2','',section.heading)}${renderVideo(section.video,section.poster,{...section.imageStyle,caption:section.caption,showCaption:section.showCaption,loop:section.loop,muted:section.muted},`${sectionPath}.imageStyle`)}${textElement('p','',section.text)}</section>`;break;
    case 'spacer':html=`<div style="height:${number(section.height,40,0,200)}px"></div>`;break;
  }
  const customLayout=section.imagePosition&&['hero','about'].includes(section.type);
  const css=`${section.spacingTop!=null?`padding-top:${number(section.spacingTop,0,0,200)}px;`:''}${section.spacingBottom!=null?`padding-bottom:${number(section.spacingBottom,0,0,200)}px;`:''}--section-gap:${number(section.gap,48,0,100)}px;--section-text-align:${choice(section.textAlign,['left','center','right'],'left')};--layout-columns:${section.imagePosition==='right'?`minmax(0,${number(section.textWidth,55,10,90)}fr) minmax(0,${number(section.imageWidth,45,10,90)}fr)`:`minmax(0,${number(section.imageWidth,45,10,90)}fr) minmax(0,${number(section.textWidth,55,10,90)}fr)`};${section.textAlign?`text-align:${choice(section.textAlign,['left','center','right'],'left')};`:``}${section.textSize?`--section-text-size:${{small:16,normal:18,large:22}[section.textSize]||18}px;`:``}`;
  return `<div class="builder-section section-${esc(section.type)} section-width-${choice(section.contentWidth,['default','narrow','wide','full'],'default')} ${customLayout?'builder-layout builder-position-'+choice(section.imagePosition,['left','right','above','below'],'left'):''}" data-section-id="${esc(section.id)}"${panel.attributes} style="${css}${panel.css}">${html}</div>`;
}
function renderStructured(data,key) {
  const info=Model.pageInfo(data,key);if(!info)return '';
  const html=Model.sections(data,key).map((s,i)=>renderSection(s,{data,info},i)).join('');
  if(info.kind==='project')return `<article class="wrap detail">${html}</article>`;
  if(info.kind==='gallery')return `<div class="gallery structured-gallery">${html}</div>`;
  return html;
}
function renderHome(data) {document.title=settings.identity.homeTitle;return renderStructured(data,'home');}
function renderGallery(data) {document.title=settings.identity.galleryTitle;return renderStructured(data,'gallery');}
function renderProject(project,data) {document.title=`${project.title} — ${data.name}`;return renderStructured(data,'project:'+project.slug);}
function applyThumbnailControls(data) {
  document.querySelectorAll('.project-card[data-project]').forEach(card=>{
    const index=data.projects.findIndex(p=>p.slug===card.dataset.project),project=data.projects[index];if(!project)return;
    const style=project.thumbnailStyle||{},box=card.querySelector('.thumbnail');
    box.dataset.imageStyle=`projects.${index}.thumbnailStyle`;
    box.style.setProperty('--photo-rotation',String(photoRotation(style.rotation)));
    const inherited=style.enabled===false?{}:style,preview=project.previewStyle?.enabled===false?{}:project.previewStyle||{};
    box.style.setProperty('--preview-fit',choice(preview.fit,['cover','contain'],choice(inherited.fit,['cover','contain'],project.thumbnailFit==='contain'?'contain':'cover')));
    box.style.setProperty('--preview-x',number(preview.focalX,number(inherited.focalX,50,0,100),0,100)+'%');
    box.style.setProperty('--preview-y',number(preview.focalY,number(inherited.focalY,50,0,100),0,100)+'%');
    if(style.enabled===false||!Object.keys(style).length)return;
    const renderStyle=style.aspect&&style.aspect!=='auto'?style:{...style,aspect:'square'};
    box.classList.add('thumbnail-custom');box.style.cssText+=imageCSS(renderStyle,project.thumbnailFit==='contain'?'contain':'cover');
    box.dataset.align=choice(style.align,['left','center','right'],'center');
    let caption;
    if(style.caption&&style.showCaption!==false){caption=document.createElement('p');caption.className='image-caption';caption.style.textAlign=choice(style.captionAlignment,['left','center','right'],'left');caption.textContent=style.caption;box.insertAdjacentElement(style.captionPosition==='above'?'beforebegin':'afterend',caption);}
    if(style.position){const link=card.querySelector('.project-link'),group=document.createElement('div');group.className='thumbnail-group';link.classList.add('thumbnail-layout-'+choice(style.position,['left','right','above','below'],'above'));link.prepend(group);if(caption&&style.captionPosition==='above')group.append(caption);group.append(box);if(caption&&style.captionPosition!=='above')group.append(caption);}
    const button=card.querySelector('.preview-play');
    if(button){const observer=new ResizeObserver(()=>{const photo=box.getBoundingClientRect(),bounds=card.getBoundingClientRect();button.style.top=(photo.top-bounds.top+12)+'px';button.style.right=(bounds.right-photo.right+12)+'px';button.style.maxWidth=Math.max(44,photo.width-24)+'px';});observer.observe(box);activeCleanups.push(()=>observer.disconnect());}
  });
}
function photoRotation(value){return ((Math.round(number(value,0,-36000,36000)/90)*90)%360+360)%360;}
function bindPhotoRotations(){
  const events=new AbortController(),observer=new ResizeObserver(entries=>entries.forEach(entry=>update(entry.target)));
  const photos=new Map();
  function update(box){
    const item=photos.get(box);if(!item)return;const {image,rotation,autoRatio,maxHeight}=item;
    if(!image.naturalWidth||!image.naturalHeight)return;
    const quarter=rotation%180!==0;
    if(autoRatio){box.style.aspectRatio=quarter?image.naturalHeight+' / '+image.naturalWidth:image.naturalWidth+' / '+image.naturalHeight;if(maxHeight!=='none')box.style.maxHeight=maxHeight;}
    image.classList.add('photo-rotated-image');
    const width=box.clientWidth,height=box.clientHeight;if(!width||!height)return;
    image.style.setProperty('width',(quarter?height:width)+'px','important');image.style.setProperty('height',(quarter?width:height)+'px','important');
    image.style.setProperty('transform',`translate(-50%,-50%) rotate(${rotation}deg) scale(var(--photo-hover-scale,1))`,'important');
  }
  app.querySelectorAll('[data-image-style]').forEach(frame=>{
    const rotation=photoRotation(getComputedStyle(frame).getPropertyValue('--photo-rotation'));if(!rotation)return;
    const box=frame.classList.contains('thumbnail')?frame:frame.querySelector(':scope > .image-box,:scope > .video-media-box');if(!box)return;
    const image=box.querySelector(':scope > img:not(.media-preview):not(.video-thumbnail)');if(!image)return;
    const css=getComputedStyle(box),height=getComputedStyle(frame).getPropertyValue('--image-height').trim();
    const autoRatio=css.aspectRatio==='auto'&&css.flexGrow==='0'&&!frame.classList.contains('portfolio-positioned')&&(!height||height==='auto');
    photos.set(box,{image,rotation,autoRatio,maxHeight:getComputedStyle(image).maxHeight});
    image.addEventListener('load',()=>update(box),{signal:events.signal});observer.observe(box);update(box);
  });
  activeCleanups.push(()=>{events.abort();observer.disconnect();});
}
function bindImageLightbox() {
  if (editorPreview) return;

  // Static photos and real GIF <img> elements can be enlarged; videos stay playback-only.
  const zoomImage=box=>{
    if(box.querySelector(':scope > video'))return null;
    const animated=[...box.querySelectorAll(':scope > img.media-preview')].find(img=>/\.gif(?:[?#]|$)/i.test(img.currentSrc||img.src||''));
    return animated||box.querySelector(':scope > img:not(.video-thumbnail)');
  };
  const boxes=[...app.querySelectorAll('.image-frame .image-box')].filter(box=>zoomImage(box));
  if(!boxes.length)return;

  const events=new AbortController(),options={signal:events.signal};
  const overlay=document.createElement('div');
  overlay.className='photo-lightbox';
  overlay.hidden=true;
  overlay.innerHTML='<img class="photo-lightbox-image" alt="">';
  document.body.append(overlay);
  const enlarged=overlay.querySelector('.photo-lightbox-image');
  let lastTrigger=null;
  let rotation=0;
  function fitEnlarged(){
    if(overlay.hidden||!enlarged.naturalWidth||!enlarged.naturalHeight)return;
    const quarter=rotation%180!==0,width=overlay.clientWidth-40,height=overlay.clientHeight-40;
    const scale=Math.min(1,(quarter?height:width)/enlarged.naturalWidth,(quarter?width:height)/enlarged.naturalHeight);
    enlarged.style.width=enlarged.naturalWidth*scale+'px';enlarged.style.height=enlarged.naturalHeight*scale+'px';enlarged.style.maxWidth='none';enlarged.style.maxHeight='none';enlarged.style.transform=`rotate(${rotation}deg)`;
  }
  enlarged.addEventListener('load',fitEnlarged,options);window.addEventListener('resize',fitEnlarged,options);

  function open(box,trigger){
    const photo=zoomImage(box);
    if(!photo)return;
    lastTrigger=trigger;
    rotation=photo.classList.contains('media-preview')?0:photoRotation(getComputedStyle(box.closest('[data-image-style]')).getPropertyValue('--photo-rotation'));
    enlarged.src=photo.currentSrc||photo.src;
    enlarged.alt=photo.alt||'Enlarged image';
    overlay.hidden=false;
    document.body.classList.add('lightbox-open');
    fitEnlarged();
  }
  function close(){
    if(overlay.hidden)return;
    overlay.hidden=true;
    enlarged.removeAttribute('src');
    document.body.classList.remove('lightbox-open');
    lastTrigger?.focus({preventScroll:true});
  }

  boxes.forEach(box=>{
    box.classList.add('photo-zoomable');
    const trigger=document.createElement('button');
    trigger.type='button';
    trigger.className='photo-zoom-trigger';
    trigger.setAttribute('aria-label','Enlarge image');
    trigger.innerHTML='<span class="photo-zoom-hint" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"></circle><path d="M15.5 15.5L21 21M10.5 7.5v6M7.5 10.5h6"></path></svg></span>';
    box.append(trigger);
    trigger.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();open(box,trigger);},options);
  });

  enlarged.addEventListener('click',close,options);
  overlay.addEventListener('click',event=>{if(event.target===overlay)close();},options);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!overlay.hidden)close();},options);
  activeCleanups.push(()=>{
    events.abort();
    overlay.remove();
    document.body.classList.remove('lightbox-open');
    boxes.forEach(box=>{box.classList.remove('photo-zoomable');box.querySelector(':scope > .photo-zoom-trigger')?.remove();});
  });
}

function cleanupActive() {activeCleanups.forEach(fn=>fn());activeCleanups=[];}
function displayPortfolio(input,key) {
  const carouselState=new Map(editorPreview&&key===currentPageKey?[...document.querySelectorAll('.media-carousel')].map(node=>[node.closest('[data-section-id]')?.dataset.sectionId,node.dataset.currentGroup||'0']):[]);
  cleanupActive();
  document.documentElement.style.setProperty('--viewport-width', document.documentElement.clientWidth+'px');
  currentData=Model.upgrade(input);currentPageKey=key;
  const data=currentData;
  data.projects=list(data.projects).filter(p=>p&&p.slug).map(normalizeProject);
  settings=mergeSettings(window.legacyPortfolioSettings||{},data.website);
  if(Object.hasOwn(data,'siteIcon'))settings.identity.siteIcon=data.siteIcon;
  data.name ||= settings.identity.brand;
  renderShell();
  const info=Model.pageInfo(data,key);
  if(info) {
    document.title=info.kind==='home'?settings.identity.homeTitle:info.kind==='gallery'?settings.identity.galleryTitle:`${info.title} — ${data.name}`;
    app.innerHTML=renderStructured(data,key);
    if(info.project)document.querySelector('meta[name="description"]').content=info.project.description||'';
  } else app.innerHTML=`<section class="wrap intro">${textElement('h1','',settings.messages.notFound)}<a class="pill" href="${galleryURL}">${esc(settings.messages.backToProjects)}</a></section>`;
  document.querySelector('[data-nav="about"]')?.setAttribute('aria-current',['home','about'].includes(key)?'page':'false');
  document.querySelector('[data-nav="gallery"]')?.setAttribute('aria-current',key==='gallery'||key.startsWith('project:')?'page':'false');
  document.querySelectorAll('[data-custom-nav]').forEach(n=>n.remove());
  const nav=document.querySelector('.nav-links');
  for(const page of data.pages||[])if(page.showInNavigation){const link=document.createElement('a');link.dataset.customNav=page.slug;link.href='/?page='+encodeURIComponent(page.slug);link.textContent=page.title;nav.append(link);}
  app.removeAttribute('aria-busy');applyThumbnailControls(data);
  bindPhotoRotations();
  if(info&&window.PortfolioObjects){const objects=window.PortfolioObjects.mount({data,key,settings,model:Model,editing:editorPreview});activeCleanups.push(()=>objects.destroy());}
  bindPreviews();
  bindImageLightbox();
  document.querySelectorAll('.project-carousel').forEach(node=>{const saved=carouselState.get(node.closest('[data-section-id]')?.dataset.sectionId);if(saved!=null)node.dataset.currentGroup=saved;bindCarousel(node);});
  if(editorPreview)decoratePreview();
}
function routeKey() {
  const query=new URLSearchParams(location.search);
  if(query.get('project'))return 'project:'+query.get('project');
  if(query.get('page'))return query.get('page')==='about'?'about':'page:'+query.get('page');
  if(query.get('view')==='gallery'||/^\/gallery\/?$/.test(location.pathname))return 'gallery';
  if(location.pathname.startsWith('/projects/'))return 'project:'+decodeURIComponent(location.pathname.slice(10).replace(/\/$/,''));
  return location.pathname==='/'||location.pathname==='/index.html'?'home':'missing';
}
async function boot() {
  const [contentResult,settingsResult]=await Promise.allSettled([fetchJSON('/content.json'),fetchJSON('/site-settings.json')]);
  await videoPostersReady;
  window.legacyPortfolioSettings=settingsResult.status==='fulfilled'?settingsResult.value:{};
  if(contentResult.status!=='fulfilled') {settings=mergeSettings(window.legacyPortfolioSettings);renderShell();app.innerHTML=`<section class="wrap intro">${textElement('h1','',settings.messages.loadError)}${textElement('p','',settings.messages.retry)}</section>`;app.removeAttribute('aria-busy');return;}
  displayPortfolio(contentResult.value,routeKey());
  smallScreen.addEventListener('change',()=>{const y=window.scrollY;displayPortfolio(currentData,currentPageKey);window.scrollTo(0,y);});
}
function decoratePreview() {
  document.body.classList.add('editing-preview');
  const send=value=>window.parent.postMessage({portfolioPreview:true,...value},location.origin);
  if(window.PortfolioCanvas){
    const canvas=window.PortfolioCanvas.mount({data:currentData,key:currentPageKey,settings,model:Model,send});
    activeCleanups.push(()=>canvas.destroy());
    return;
  }
  const controller=new AbortController();activeCleanups.push(()=>controller.abort());
  app.addEventListener('click',event=>{const section=event.target.closest('[data-section-id]');if(!section)return;event.preventDefault();const img=event.target.closest('[data-image-style]');send({action:'select',id:section.dataset.sectionId,imagePath:img?.dataset.imageStyle});},{signal:controller.signal});
  app.querySelectorAll('[data-image-style]').forEach(frame=>{
    if(!frame.dataset.imageStyle)return;
    const handle=document.createElement('button');handle.type='button';handle.className='image-resize-handle';handle.title='Drag to resize this image';handle.setAttribute('aria-label','Drag to resize image');frame.append(handle);
    handle.addEventListener('pointerdown',event=>{
      event.preventDefault();event.stopPropagation();handle.setPointerCapture(event.pointerId);
      const parentWidth=frame.parentElement.getBoundingClientRect().width;
      const start=frame.getBoundingClientRect().width,x=event.clientX;
      send({action:'resize-start',id:frame.closest('[data-section-id]').dataset.sectionId,path:frame.dataset.imageStyle});
      const move=e=>{const width=Math.round(Math.max(10,Math.min(100,(start+e.clientX-x)/parentWidth*100)));frame.style.setProperty('--image-width',width+'%');frame.style.width=width+'%';send({action:'resize',path:frame.dataset.imageStyle,width});};
      const end=()=>{handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',end);handle.removeEventListener('pointercancel',end);send({action:'resize-end'});};
      handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',end);
    },{signal:controller.signal});
  });
}
if(app&&editorPreview) {
  window.addEventListener('message',event=>{
    if(event.origin!==location.origin||event.source!==window.parent||!event.data?.portfolioEditor)return;
    if(event.data.action==='ping')window.parent.postMessage({portfolioPreview:true,action:'ready',canvas:window.PortfolioCanvas?.version||''},location.origin);
    if(event.data.action==='render'){
      const y=event.data.key===currentPageKey?window.scrollY:0;
      previewAssets=event.data.assets||{};displayPortfolio(event.data.data,event.data.key);
      if(window.PortfolioCanvas)window.PortfolioCanvas.select(event.data.selected,event.data.imagePath||'',event.data.textPath||'');
      else if(event.data.selected)document.querySelector(`[data-section-id="${CSS.escape(event.data.selected)}"]`)?.classList.add('selected-section');
      window.scrollTo(0,y);
    }
    if(event.data.action==='select'){
      if(window.PortfolioCanvas)window.PortfolioCanvas.select(event.data.id,event.data.imagePath||'',event.data.textPath||'');
      else{document.querySelectorAll('.selected-section').forEach(n=>n.classList.remove('selected-section'));document.querySelector(`[data-section-id="${CSS.escape(event.data.id)}"]`)?.classList.add('selected-section');}
    }
  });
  window.parent.postMessage({portfolioPreview:true,action:'ready',canvas:window.PortfolioCanvas?.version||''},location.origin);
}
window.PortfolioDefaults=DEFAULT_SETTINGS;
if(app&&!editorPreview)boot();

