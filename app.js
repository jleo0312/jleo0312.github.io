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
    "downloadVideo": "Download the video"
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

function mergeSettings(saved = {}) {
  return Object.fromEntries(Object.entries(DEFAULT_SETTINGS).map(([section, defaults]) => [
    section, { ...defaults, ...(saved[section] && typeof saved[section] === 'object' ? saved[section] : {}) }
  ]));
}

function normalizeProject(project) {
  return {
    ...project,
    title: project.title || project.slug,
    theme: ['dark', 'silver', 'blue'].includes(project.theme) ? project.theme : 'silver',
    coverText: project.coverText ?? project.title ?? '',
    photos: list(project.photos).filter(photo => photo && safeURL(photo.src)),
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
  const iconURL = safeURL(settings.identity.siteIcon);
  if (iconURL) {
    let icon = document.querySelector('link[rel="icon"]');
    if (!icon) { icon = document.createElement('link'); icon.rel = 'icon'; document.head.append(icon); }
    icon.removeAttribute('type');
    // Refresh an image even when the editor replaces an icon with the same filename.
    const url = new URL(iconURL);
    if (url.origin === location.origin) url.searchParams.set('icon', String(Date.now()));
    icon.href = url.href;
  }
}

function cover(project) {
  if (safe(project.thumbnail)) return `<img src="${safe(project.thumbnail)}" alt="${esc(project.thumbnailAlt || project.title)}" loading="lazy">`;
  return `<div class="type-cover ${project.theme}">${textElement('span', 'cover-label', settings.project.coverLabel)}<span class="cover-type">${paragraphs(project.coverText)}</span>${textElement('span', 'cover-bottom', settings.project.coverMark)}</div>`;
}

function card(project, index) {
  const number = settings.project.showNumbers ? `<span class="card-index">${String(index + 1).padStart(2, '0')}</span>` : '';
  if (project.demo) return `<article class="project-card demo-card" aria-label="Empty gallery slot ${index + 1}"><div class="thumbnail demo-thumbnail demo-tone-${Math.floor(index / 3)}"></div><div class="card-heading"><span class="demo-title" aria-hidden="true"></span>${number}</div></article>`;
  const preview = safe(project.previewVideo) && project.thumbnailMotion !== 'still'
    ? `<video class="preview" data-motion="${project.thumbnailMotion === 'loop' ? 'loop' : 'hover'}" muted loop playsinline preload="none" src="${safe(project.previewVideo)}" aria-hidden="true" tabindex="-1"></video>` : '';
  return `<article class="project-card" data-project="${esc(project.slug)}"><a class="project-link" href="/?project=${encodeURIComponent(project.slug)}"><div class="thumbnail" data-fit="${project.thumbnailFit === 'contain' ? 'contain' : 'cover'}">${cover(project)}${preview}</div><div class="card-heading"><h3>${esc(project.title)}</h3>${number}</div></a></article>`;
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
  const perSlide = Math.min(3, projects.length);
  return Array.from({ length: Math.ceil(projects.length / 3) }, (_, group) =>
    Array.from({ length: perSlide }, (_, item) => {
      const index = (group * 3 + item) % projects.length;
      return { project: projects[index], index };
    })
  );
}

function renderCarousel(data) {
  const projects = highlightProjects(data);
  if (!projects.length) return '';
  // Wrap the final group back to the beginning instead of leaving empty columns.
  const groups = carouselGroups(projects).map(group => group.map(({ project, index }) => card(project, index)).join(''));
  return `<section class="wrap selected"><div class="section-heading">${textElement('h2', '', settings.home.highlightsTitle)}${settings.home.galleryLink ? `<a class="text-link" href="${galleryURL}">${esc(settings.home.galleryLink)}</a>` : ''}</div><div class="project-carousel" style="--cards-per-slide:${Math.min(3, projects.length)}" role="region" aria-roledescription="carousel" aria-label="Project highlights" data-groups="${groups.length}"><div class="carousel-viewport"><div class="carousel-track">${groups.map((group, i) => `<div class="carousel-slide" role="group" aria-roledescription="slide" aria-label="${i + 1} of ${groups.length}" ${i ? 'inert aria-hidden="true"' : 'aria-hidden="false"'}>${group}</div>`).join('')}${groups.length > 1 ? `<div class="carousel-slide carousel-clone" inert aria-hidden="true">${groups[0]}</div>` : ''}</div></div>${groups.length > 1 ? `<div class="carousel-controls"><div class="carousel-dots">${groups.map((_, i) => `<button type="button" class="carousel-dot" data-page="${i}" aria-label="Show group ${i + 1}" aria-current="${i === 0}"></button>`).join('')}</div><div class="carousel-actions">${settings.carousel.showCount ? `<span class="carousel-status" aria-live="off">1 / ${groups.length}</span>` : ''}<button type="button" class="carousel-arrow" data-direction="-1" aria-label="Previous three projects">${esc(settings.carousel.previous)}</button><button type="button" class="carousel-arrow" data-direction="1" aria-label="Next three projects">${esc(settings.carousel.next)}</button><button type="button" class="carousel-pause" aria-label="Pause gallery slideshow">${esc(settings.carousel.pause)}</button></div></div>` : ''}</div></section>`;
}

function renderHobbies(data) {
  const hobbies = Array.from({ length: 3 }, (_, i) => list(data.hobbies)[i] || {});
  return `<section class="wrap hobbies-section">${textElement('h2', '', settings.home.hobbiesTitle)}<div class="hobbies-grid">${hobbies.map((hobby, i) => `<article class="hobby-card"><div class="hobby-photo">${safe(hobby.photo) ? `<img src="${safe(hobby.photo)}" alt="${esc(hobby.alt || hobby.title || `Hobby photo ${i + 1}`)}" loading="lazy">` : `<span role="img" aria-label="Space for hobby photo ${i + 1}"></span>`}</div>${textElement('h3', '', hobby.title)}${textElement('p', '', hobby.text)}</article>`).join('')}</div></section>`;
}

function renderHome(data) {
  document.title = settings.identity.homeTitle;
  const headline = [settings.home.headline ? paragraphs(settings.home.headline) : '', settings.home.subheadline ? `<span>${paragraphs(settings.home.subheadline)}</span>` : ''].filter(Boolean).join('<br>');
  // Reuse the editor's existing second-paragraph value as the photo caption.
  // An intentionally cleared caption stays empty, even if an older caption key remains.
  const caption = data.personal ?? data.portraitCaption ?? '';
  return `<section class="intro wrap hero-with-photo"><div class="hero-copy">${textElement('p', 'eyebrow', settings.home.eyebrow)}${headline ? `<h1>${headline}</h1>` : ''}${settings.home.button ? `<div class="intro-bottom"><a class="pill" href="${safe(settings.home.buttonLink) || galleryURL}">${esc(settings.home.button)}</a></div>` : ''}</div><div class="hero-photo">${safe(data.heroPhoto) ? `<img src="${safe(data.heroPhoto)}" alt="${esc(data.heroPhotoAlt || `Portrait of ${data.name}`)}">` : '<span role="img" aria-label="Space for a photo"></span>'}</div></section><section class="about-section"><div class="wrap about-grid"><div class="about-portrait-column">${textElement('h2', '', settings.home.aboutTitle)}<figure class="portrait-figure"><div class="portrait-box">${safe(data.portrait) ? `<img src="${safe(data.portrait)}" alt="${esc(data.portraitAlt || `Portrait of ${data.name}`)}" loading="lazy">` : '<span class="portrait-placeholder" role="img" aria-label="Space for a portrait"></span>'}</div>${textElement('figcaption', 'portrait-caption', caption)}</figure></div><div class="about-copy">${textElement('p', '', data.bio)}</div></div></section>${renderHobbies(data)}${renderCarousel(data)}`;
}

function renderGallery(data) {
  document.title = settings.identity.galleryTitle;
  const projects = galleryProjects(data);
  return `<section class="wrap gallery">${textElement('p', 'eyebrow', settings.gallery.eyebrow)}${textElement('h1', '', settings.gallery.headline)}${textElement('p', 'page-subtitle', settings.gallery.subtitle)}<div class="gallery-meta">${textElement('span', '', settings.gallery.allProjects)}${settings.gallery.showCount ? `<span>${String(projects.length).padStart(2, '0')}</span>` : ''}</div><div class="project-grid">${projects.map(card).join('')}</div></section>`;
}

function photoSection(photo, index, project) {
  const text = photo.text ?? photo.caption ?? '';
  return `<figure class="photo-text-row ${text || photo.title ? '' : 'photo-only'}"><a class="photo-link" href="${safe(photo.src)}" target="_blank" rel="noopener"><img src="${safe(photo.src)}" alt="${esc(photo.alt || photo.caption || `${project.title}, photo ${index + 1}`)}" loading="lazy"></a>${text || photo.title ? `<figcaption>${textElement('h2', '', photo.title)}${textElement('p', '', text)}</figcaption>` : ''}</figure>`;
}

function renderProject(project, data) {
  const description = project.description ?? project.summary ?? '';
  document.title = `${project.title} — ${data.name}`;
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.content = description;
  const media = safe(project.video) ? `<video class="main-video" controls playsinline preload="metadata" ${safe(project.thumbnail) ? `poster="${safe(project.thumbnail)}"` : ''} src="${safe(project.video)}">${esc(settings.project.videoFallback)} <a href="${safe(project.video)}">${esc(settings.project.downloadVideo)}</a></video>` : '';
  const photos = project.photos.length ? project.photos : safe(project.thumbnail) && !media ? [{ src: project.thumbnail, alt: project.title }] : [];
  return `<article class="wrap detail">${settings.project.back ? `<a class="text-link back" href="${galleryURL}">${esc(settings.project.back)}</a>` : ''}<div class="detail-heading"><h1>${esc(project.title)}</h1>${textElement('p', 'page-subtitle project-description', description)}</div>${media}<div class="photo-text-sections">${photos.map((photo, i) => photoSection(photo, i, project)).join('')}</div><div class="project-end">${textElement('span', '', settings.project.endText)}${settings.project.galleryButton ? `<a class="pill" href="${galleryURL}">${esc(settings.project.galleryButton)}</a>` : ''}</div></article>`;
}
function bindPreviews() {
  const items = [...document.querySelectorAll('.project-link')].map(link => ({ link, video: link.querySelector('video.preview'), visible: false, hovered: false, timer: null })).filter(item => item.video);
  function update(item) {
    const play = item.visible && !document.hidden && !reducedMotion.matches && (item.video.dataset.motion === 'loop' || item.hovered);
    if (play) {
      item.video.muted = true;
      item.video.play().then(() => {
        if (item.visible && !document.hidden && !reducedMotion.matches && (item.video.dataset.motion === 'loop' || item.hovered)) item.link.classList.add('playing');
        else { item.video.pause(); item.link.classList.remove('playing'); }
      }).catch(() => {});
    } else {
      item.video.pause();
      item.link.classList.remove('playing');
    }
  }
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const item = items.find(item => item.video === entry.target);
      if (item) { item.visible = entry.isIntersecting; update(item); }
    });
  }, { threshold: 0.15 });
  items.forEach(item => {
    const start = () => { clearTimeout(item.timer); item.timer = setTimeout(() => { item.hovered = true; update(item); }, 200); };
    const stop = () => { clearTimeout(item.timer); item.hovered = false; update(item); };
    item.link.addEventListener('mouseenter', start);
    item.link.addEventListener('mouseleave', stop);
    item.link.addEventListener('focus', start);
    item.link.addEventListener('blur', stop);
    observer.observe(item.video);
  });
  document.addEventListener('visibilitychange', () => items.forEach(update));
  reducedMotion.addEventListener('change', () => items.forEach(update));
}

function bindCarousel() {
  const carousel = document.querySelector('.project-carousel');
  if (!carousel) return;
  const count = Number(carousel.dataset.groups);
  if (count < 2) return;
  const viewport = carousel.querySelector('.carousel-viewport');
  const track = carousel.querySelector('.carousel-track');
  const slides = [...track.children];
  const dots = [...carousel.querySelectorAll('.carousel-dot')];
  const pause = carousel.querySelector('.carousel-pause');
  const status = carousel.querySelector('.carousel-status');
  const seconds = Number(settings.carousel.seconds);
  const interval = (Number.isFinite(seconds) ? Math.max(1, Math.min(30, seconds)) : 2.5) * 1000;
  let index = 0, visualIndex = 0, timer, finishTimer, busy = false;
  let userPaused = reducedMotion.matches, hovered = false, focused = false, visible = false;
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
  carousel.querySelectorAll('[data-direction]').forEach(button => button.addEventListener('click', () => move(Number(button.dataset.direction))));
  dots.forEach(dot => dot.addEventListener('click', () => go(Number(dot.dataset.page))));
  pause.addEventListener('click', () => { userPaused = !userPaused; showState(); schedule(); });
  // Reading a project or tabbing through its link pauses automatic movement.
  viewport.addEventListener('mouseenter', () => { hovered = true; schedule(); });
  viewport.addEventListener('mouseleave', () => { hovered = false; schedule(); });
  carousel.addEventListener('focusin', () => { focused = viewport.contains(document.activeElement); schedule(); });
  carousel.addEventListener('focusout', () => { setTimeout(() => { focused = viewport.contains(document.activeElement); schedule(); }, 0); });
  document.addEventListener('visibilitychange', schedule);
  reducedMotion.addEventListener('change', () => { userPaused = reducedMotion.matches; showState(); schedule(); });
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; schedule(); }, { threshold: 0.15 }).observe(carousel);
  new ResizeObserver(() => {
    settle();
    track.classList.add('no-transition');
    position();
    void track.offsetWidth;
    track.classList.remove('no-transition');
  }).observe(viewport);
  showState();
}

async function fetchJSON(path) {
  const url = new URL(path, location.origin);
  url.searchParams.set('updated', String(Date.now()));
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Could not load ${path}`);
  return response.json();
}

async function boot() {
  const [contentResult, settingsResult] = await Promise.allSettled([
    fetchJSON('/content.json'), fetchJSON('/site-settings.json')
  ]);
  settings = mergeSettings(settingsResult.status === 'fulfilled' ? settingsResult.value : {});
  renderShell();
  if (contentResult.status !== 'fulfilled') {
    document.title = settings.identity.homeTitle;
    app.innerHTML = `<section class="wrap intro">${textElement('h1', '', settings.messages.loadError)}${textElement('p', '', settings.messages.retry)}</section>`;
    app.removeAttribute('aria-busy');
    return;
  }
  const data = contentResult.value;
  data.projects = list(data.projects).filter(project => project && project.slug).map(normalizeProject);
  data.name = data.name || settings.identity.brand;
  const query = new URLSearchParams(location.search);
  let path = location.pathname;
  try { path = decodeURIComponent(path); } catch { /* An invalid address is handled as a missing page. */ }
  path = path.replace(/\/index\.html$/, '').replace(/\/$/, '') || '/';
  const slug = query.get('project') || (path.startsWith('/projects/') ? path.slice('/projects/'.length) : '');
  const isGallery = !slug && (path === '/gallery' || query.get('view') === 'gallery');
  const isHome = !slug && !isGallery && path === '/';
  const project = data.projects.find(project => project.slug === slug);
  document.querySelector('[data-nav="about"]')?.setAttribute('aria-current', isHome ? 'page' : 'false');
  const galleryLink = document.querySelector('[data-nav="gallery"]');
  galleryLink?.setAttribute('href', galleryURL);
  galleryLink?.setAttribute('aria-current', isGallery || project ? 'page' : 'false');
  if (isHome) app.innerHTML = renderHome(data);
  else if (isGallery) app.innerHTML = renderGallery(data);
  else if (project) app.innerHTML = renderProject(project, data);
  else {
    document.title = `${settings.messages.notFound} — ${data.name}`;
    app.innerHTML = `<section class="wrap intro">${textElement('h1', '', settings.messages.notFound)}${settings.messages.backToProjects ? `<div class="intro-bottom"><a class="pill" href="${galleryURL}">${esc(settings.messages.backToProjects)}</a></div>` : ''}</section>`;
  }
  app.removeAttribute('aria-busy');
  bindPreviews();
  bindCarousel();
}

boot();
