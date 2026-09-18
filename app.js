'use strict';

const app = document.querySelector('#app');
const galleryURL = '/?view=gallery';
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));
const paragraphs = value => esc(value).replace(/\n/g, '<br>');
const safe = value => {
  if (!value) return '';
  try {
    const url = new URL(value, location.origin);
    return ['http:', 'https:'].includes(url.protocol) ? esc(url.href) : '';
  } catch { return ''; }
};
const list = value => Array.isArray(value) ? value : [];

function normalizeProject(project) {
  return {
    ...project,
    title: project.title || 'Untitled project',
    theme: ['dark', 'silver', 'blue'].includes(project.theme) ? project.theme : 'silver',
    coverText: project.coverText || project.title || '',
    photos: list(project.photos).filter(photo => photo && photo.src),
    thumbnailMotion: project.thumbnailMotion || 'hover'
  };
}

function cover(project) {
  if (safe(project.thumbnail)) {
    return `<img src="${safe(project.thumbnail)}" alt="${esc(project.title)}" loading="lazy">`;
  }
  return `<div class="type-cover ${project.theme}"><span class="cover-label">PROJECT</span><span class="cover-type">${paragraphs(project.coverText)}</span><span class="cover-bottom" aria-hidden="true">↗</span></div>`;
}

function card(project, index) {
  if (project.demo) {
    return `<article class="project-card demo-card" aria-label="Empty gallery slot ${index + 1}"><div class="thumbnail demo-thumbnail demo-tone-${Math.floor(index / 3)}"></div><div class="card-heading"><span class="demo-title" aria-hidden="true"></span><span class="card-index">${String(index + 1).padStart(2, '0')}</span></div></article>`;
  }
  const preview = safe(project.previewVideo) && project.thumbnailMotion !== 'still'
    ? `<video class="preview" data-motion="${project.thumbnailMotion === 'loop' ? 'loop' : 'hover'}" muted loop playsinline preload="none" src="${safe(project.previewVideo)}" aria-hidden="true" tabindex="-1"></video>`
    : '';
  return `<article class="project-card"><a class="project-link" href="/?project=${encodeURIComponent(project.slug)}"><div class="thumbnail" data-fit="${project.thumbnailFit === 'contain' ? 'contain' : 'cover'}">${cover(project)}${preview}</div><div class="card-heading"><h3>${esc(project.title)}</h3><span class="card-index">${String(index + 1).padStart(2, '0')}</span></div></a></article>`;
}

function renderCarousel(data) {
  const projects = data.homepageGalleryDemo
    ? Array.from({ length: 9 }, () => ({ demo: true }))
    : data.projects;
  if (!projects.length) return '';
  const groups = [];
  for (let i = 0; i < projects.length; i += 3) {
    groups.push(projects.slice(i, i + 3).map((project, j) => card(project, i + j)).join(''));
  }
  return `<section class="wrap selected"><div class="section-heading"><h2>Things I’ve been working on.</h2><a class="text-link" href="${galleryURL}">View gallery ↗</a></div><div class="project-carousel" role="region" aria-roledescription="carousel" aria-label="Project gallery" data-groups="${groups.length}"><div class="carousel-viewport"><div class="carousel-track">${groups.map((group, i) => `<div class="carousel-slide" role="group" aria-roledescription="slide" aria-label="${i + 1} of ${groups.length}" ${i ? 'inert aria-hidden="true"' : 'aria-hidden="false"'}>${group}</div>`).join('')}${groups.length > 1 ? `<div class="carousel-slide carousel-clone" inert aria-hidden="true">${groups[0]}</div>` : ''}</div></div>${groups.length > 1 ? `<div class="carousel-controls"><div class="carousel-dots">${groups.map((_, i) => `<button type="button" class="carousel-dot" data-page="${i}" aria-label="Show group ${i + 1}" aria-current="${i === 0}"></button>`).join('')}</div><div class="carousel-actions"><span class="carousel-status" aria-live="polite">1 / ${groups.length}</span><button type="button" class="carousel-arrow" data-direction="-1" aria-label="Previous three projects">←</button><button type="button" class="carousel-arrow" data-direction="1" aria-label="Next three projects">→</button><button type="button" class="carousel-pause" aria-label="Pause gallery slideshow">Pause</button></div></div>` : ''}</div></section>`;
}

function renderHobbies(data) {
  const hobbies = Array.from({ length: 3 }, (_, i) => list(data.hobbies)[i] || {});
  return `<section class="wrap hobbies-section" aria-labelledby="hobbies-heading"><h2 id="hobbies-heading">Hobbies</h2><div class="hobbies-grid">${hobbies.map((hobby, i) => `<article class="hobby-card"><div class="hobby-photo">${safe(hobby.photo) ? `<img src="${safe(hobby.photo)}" alt="${esc(hobby.alt || hobby.title || `Hobby photo ${i + 1}`)}" loading="lazy">` : `<span role="img" aria-label="Space for hobby photo ${i + 1}"></span>`}</div>${hobby.title ? `<h3>${esc(hobby.title)}</h3>` : ''}${hobby.text ? `<p>${paragraphs(hobby.text)}</p>` : '<div class="empty-paragraph" aria-hidden="true"><span></span><span></span><span></span></div>'}</article>`).join('')}</div></section>`;
}

function renderHome(data) {
  document.title = `${data.name} — Mechanical Engineering`;
  return `<section class="intro wrap hero-with-photo"><div class="hero-copy"><p class="eyebrow">MECHANICAL ENGINEERING · WASHINGTON STATE UNIVERSITY</p><h1>Hi, I’m ${esc(data.name)}.<br><span>I like to build things.</span></h1><div class="intro-bottom"><a class="pill" href="${galleryURL}">Explore my projects <span>↗</span></a></div></div><div class="hero-photo">${safe(data.heroPhoto) ? `<img src="${safe(data.heroPhoto)}" alt="Portrait of ${esc(data.name)}">` : '<span role="img" aria-label="Space for a photo"></span>'}</div></section><section class="about-section"><div class="wrap about-grid"><div class="about-portrait-column"><h2>A little about me.</h2><div class="portrait-box">${safe(data.portrait) ? `<img src="${safe(data.portrait)}" alt="Portrait of ${esc(data.name)}" loading="lazy">` : '<span class="portrait-placeholder" role="img" aria-label="Space for a portrait"></span>'}</div></div><div><p>${paragraphs(data.bio)}</p><p>${paragraphs(data.personal)}</p></div></div></section>${renderHobbies(data)}${renderCarousel(data)}`;
}

function renderGallery(data) {
  document.title = `Projects — ${data.name}`;
  return `<section class="wrap gallery"><p class="eyebrow">THE PROJECT GALLERY</p><h1>Ideas. Made real.</h1><p class="page-subtitle">A collection of builds, experiments, and work in progress.</p><div class="gallery-meta"><span>All projects</span><span>${String(data.projects.length).padStart(2, '0')}</span></div><div class="project-grid">${data.projects.map(card).join('')}</div></section>`;
}

function photoSection(photo, index, project) {
  const text = photo.text || photo.caption || '';
  return `<figure class="photo-text-row ${text || photo.title ? '' : 'photo-only'}"><a class="photo-link" href="${safe(photo.src)}" target="_blank" rel="noopener"><img src="${safe(photo.src)}" alt="${esc(photo.alt || photo.caption || `${project.title}, photo ${index + 1}`)}" loading="lazy"></a>${text || photo.title ? `<figcaption>${photo.title ? `<h2>${esc(photo.title)}</h2>` : ''}${text ? `<p>${paragraphs(text)}</p>` : ''}</figcaption>` : ''}</figure>`;
}

function renderProject(project, data) {
  const description = project.description || project.summary || '';
  document.title = `${project.title} — ${data.name}`;
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.content = description;
  const media = safe(project.video)
    ? `<video class="main-video" controls playsinline preload="metadata" ${safe(project.thumbnail) ? `poster="${safe(project.thumbnail)}"` : ''} src="${safe(project.video)}">Your browser cannot play this video. <a href="${safe(project.video)}">Download the video</a></video>`
    : '';
  const photos = project.photos.length ? project.photos : safe(project.thumbnail) && !media ? [{ src: project.thumbnail, alt: project.title }] : [];
  return `<article class="wrap detail"><a class="text-link back" href="${galleryURL}">← All projects</a><div class="detail-heading"><h1>${esc(project.title)}</h1>${description ? `<p class="page-subtitle project-description">${paragraphs(description)}</p>` : ''}</div>${media}<div class="photo-text-sections">${photos.map((photo, i) => photoSection(photo, i, project)).join('')}</div><div class="project-end"><span>Keep exploring.</span><a class="pill" href="${galleryURL}">Back to the gallery ↗</a></div></article>`;
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
  const track = carousel.querySelector('.carousel-track');
  const slides = [...track.children];
  const dots = [...carousel.querySelectorAll('.carousel-dot')];
  const pause = carousel.querySelector('.carousel-pause');
  const status = carousel.querySelector('.carousel-status');
  let index = 0, timer, resetTimer, busy = false;
  let userPaused = reducedMotion.matches, hovered = false, focused = false, visible = false;
  const canRun = () => !userPaused && !hovered && !focused && visible && !document.hidden;
  function schedule() {
    clearTimeout(timer);
    if (canRun()) timer = setTimeout(() => move(1), 3000);
  }
  function showState() {
    dots.forEach((dot, i) => dot.setAttribute('aria-current', String(i === index)));
    slides.forEach((slide, i) => { slide.inert = i !== index; slide.setAttribute('aria-hidden', String(i !== index)); });
    status.textContent = `${index + 1} / ${count}`;
    pause.textContent = userPaused ? 'Play' : 'Pause';
    pause.setAttribute('aria-label', userPaused ? 'Play gallery slideshow' : 'Pause gallery slideshow');
  }
  function go(next, clone = false) {
    if (busy) return;
    clearTimeout(timer);
    index = next;
    busy = true;
    showState();
    track.style.transform = `translateX(-${(clone ? count : index) * 100}%)`;
    clearTimeout(resetTimer);
    const finish = () => {
      if (clone) {
        track.classList.add('no-transition');
        track.style.transform = 'translateX(0)';
        void track.offsetWidth;
        track.classList.remove('no-transition');
      }
      busy = false;
      schedule();
    };
    resetTimer = setTimeout(finish, reducedMotion.matches ? 0 : 580);
  }
  function move(direction) {
    const next = (index + direction + count) % count;
    go(next, direction === 1 && index === count - 1);
  }
  carousel.querySelectorAll('[data-direction]').forEach(button => button.addEventListener('click', () => move(Number(button.dataset.direction))));
  dots.forEach(dot => dot.addEventListener('click', () => go(Number(dot.dataset.page))));
  pause.addEventListener('click', () => { userPaused = !userPaused; showState(); schedule(); });
  carousel.addEventListener('mouseenter', () => { hovered = true; schedule(); });
  carousel.addEventListener('mouseleave', () => { hovered = false; schedule(); });
  carousel.addEventListener('focusin', () => { focused = true; schedule(); });
  carousel.addEventListener('focusout', () => { setTimeout(() => { focused = carousel.contains(document.activeElement); schedule(); }, 0); });
  document.addEventListener('visibilitychange', schedule);
  reducedMotion.addEventListener('change', () => { userPaused = reducedMotion.matches; showState(); schedule(); });
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; schedule(); }, { threshold: 0.15 }).observe(carousel);
  showState();
}

fetch('/content.json', { cache: 'no-cache' }).then(response => {
  if (!response.ok) throw new Error('Content unavailable');
  return response.json();
}).then(data => {
  data.projects = list(data.projects).filter(project => project && project.slug).map(normalizeProject);
  data.name = data.name || 'Josh';
  const query = new URLSearchParams(location.search);
  const path = decodeURIComponent(location.pathname).replace(/\/$/, '') || '/';
  const slug = query.get('project') || (path.startsWith('/projects/') ? path.slice('/projects/'.length) : '');
  const isGallery = !slug && (path === '/gallery' || query.get('view') === 'gallery');
  const isHome = !slug && !isGallery && (path === '/' || path === '/index.html');
  const project = data.projects.find(project => project.slug === slug);
  document.querySelector('[data-nav="about"]')?.setAttribute('aria-current', isHome ? 'page' : 'false');
  const galleryLink = document.querySelector('[data-nav="gallery"]');
  galleryLink?.setAttribute('href', galleryURL);
  galleryLink?.setAttribute('aria-current', isGallery || project ? 'page' : 'false');
  if (isHome) app.innerHTML = renderHome(data);
  else if (isGallery) app.innerHTML = renderGallery(data);
  else if (project) app.innerHTML = renderProject(project, data);
  else {
    document.title = `Page not found — ${data.name}`;
    app.innerHTML = `<section class="wrap intro"><h1>Nothing here yet.</h1><div class="intro-bottom"><a class="pill" href="${galleryURL}">Back to projects ↗</a></div></section>`;
  }
  app.removeAttribute('aria-busy');
  bindPreviews();
  bindCarousel();
}).catch(() => {
  app.removeAttribute('aria-busy');
  app.innerHTML = '<section class="wrap intro"><h1>Couldn’t load the portfolio.</h1><p>Please refresh to try again.</p></section>';
});
