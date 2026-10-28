/* =========================================================
   anotetoself · core
   Shared helpers, data store, page chrome (binder, tabs,
   header, footer), stickers, toasts and backup.
   Exposes everything on window.J for the page scripts.
   ========================================================= */
(() => {
  'use strict';

  /* ---------------------------------------------------------
     SVG defs: squiggle filters + doodle symbols
     --------------------------------------------------------- */
  const filter = (i, seed, scale) =>
    `<filter id="squiggle-${i}" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="3" seed="${seed}" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="${scale}" xChannelSelector="R" yChannelSelector="G"/></filter>`;
  const INK = 'stroke="#2b2b2b" stroke-width="1.6" stroke-linejoin="round"';

  document.body.insertAdjacentHTML('afterbegin', `
<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>
  ${filter(0, 1, 3.5)}${filter(1, 7, 4)}${filter(2, 13, 3.5)}${filter(3, 21, 4)}${filter(4, 34, 3.5)}
  <symbol id="i-star" viewBox="0 0 24 24"><path d="M12 2 L14.8 8.6 L22 9.3 L16.5 14 L18.2 21 L12 17.3 L5.8 21 L7.5 14 L2 9.3 L9.2 8.6Z" fill="currentColor" ${INK}/></symbol>
  <symbol id="i-heart" viewBox="0 0 24 24"><path d="M12 21 C5 15.2 2 11.6 2 8 C2 5 4.4 3 7 3 C9 3 11 4.2 12 6.2 C13 4.2 15 3 17 3 C19.6 3 22 5 22 8 C22 11.6 19 15.2 12 21Z" fill="currentColor" ${INK}/></symbol>
  <symbol id="i-sparkle" viewBox="0 0 24 24"><path d="M12 1 C13 8 16 11 23 12 C16 13 13 16 12 23 C11 16 8 13 1 12 C8 11 11 8 12 1Z" fill="currentColor" ${INK}/></symbol>
  <symbol id="i-loop" viewBox="0 0 24 24"><path d="M1 17 C5 5 14 4 12 12 C10 20 3 15 9 9 C14 4 21 9 23 14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></symbol>
  <symbol id="i-sun" viewBox="0 0 24 24"><g stroke="#2b2b2b" stroke-width="1.8" stroke-linecap="round"><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.5 4.5l2 2M17.5 17.5l2 2M4.5 19.5l2-2M17.5 6.5l2-2"/></g><circle cx="12" cy="12" r="5.2" fill="currentColor" ${INK}/></symbol>
  <symbol id="i-flower" viewBox="0 0 24 24"><g fill="currentColor" stroke="#2b2b2b" stroke-width="1.5"><circle cx="12" cy="5.5" r="4"/><circle cx="18.2" cy="10" r="4"/><circle cx="15.8" cy="17.4" r="4"/><circle cx="8.2" cy="17.4" r="4"/><circle cx="5.8" cy="10" r="4"/></g><circle cx="12" cy="12" r="3.4" fill="#f5d6a0" stroke="#2b2b2b" stroke-width="1.5"/></symbol>
  <symbol id="i-swirl" viewBox="0 0 24 24"><path d="M3 12 C3 6 9 3 13 5 C17 7 17 13 13 14 C10 15 9 11 12 10" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></symbol>
  <symbol id="i-bulb" viewBox="0 0 24 24"><path d="M12 2 C7.5 2 5 5.4 5 8.8 C5 11.6 6.8 13.2 8 14.6 C8.8 15.5 9 16.4 9 17.5 H15 C15 16.4 15.2 15.5 16 14.6 C17.2 13.2 19 11.6 19 8.8 C19 5.4 16.5 2 12 2Z" fill="currentColor" ${INK}/><path d="M9.5 20 H14.5 M10.5 22.5 H13.5" stroke="#2b2b2b" stroke-width="1.8" stroke-linecap="round"/></symbol>
  <symbol id="i-check" viewBox="0 0 24 24"><path d="M4 13 L9.5 18 L20 5" fill="none" stroke="#2b2b2b" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-x" viewBox="0 0 24 24"><path d="M6 6 L18 18 M18 6 L6 18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></symbol>
  <symbol id="i-search" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="#2b2b2b" stroke-width="2.4"/><path d="M15.5 15.5 L21 21" stroke="#2b2b2b" stroke-width="2.6" stroke-linecap="round"/></symbol>
  <symbol id="i-play" viewBox="0 0 24 24"><path d="M7 4.5 C7 3.6 8 3 8.8 3.5 L19.5 11 C20.2 11.5 20.2 12.5 19.5 13 L8.8 20.5 C8 21 7 20.4 7 19.5Z" fill="#2b2b2b"/></symbol>
  <symbol id="i-pause" viewBox="0 0 24 24"><rect x="5.5" y="4" width="4.5" height="16" rx="1.6" fill="#2b2b2b"/><rect x="14" y="4" width="4.5" height="16" rx="1.6" fill="#2b2b2b"/></symbol>
  <symbol id="i-next" viewBox="0 0 24 24"><path d="M3 5.5 L11.5 12 L3 18.5Z M11.5 5.5 L20 12 L11.5 18.5Z" fill="#2b2b2b" stroke="#2b2b2b" stroke-width="1.4" stroke-linejoin="round"/></symbol>
  <symbol id="i-prev" viewBox="0 0 24 24"><path d="M21 5.5 L12.5 12 L21 18.5Z M12.5 5.5 L4 12 L12.5 18.5Z" fill="#2b2b2b" stroke="#2b2b2b" stroke-width="1.4" stroke-linejoin="round"/></symbol>
</defs></svg>`);

  /* ---------------------------------------------------------
     Helpers
     --------------------------------------------------------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const svgUse = (id, size) => `<svg aria-hidden="true"${size ? ` width="${size}" height="${size}"` : ''}><use href="#${id}"/></svg>`;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nowIso = () => new Date().toISOString();
  const debounce = (fn, ms = 400) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const restart = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
  const autosize = el => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 4 + 'px'; };

  function safeUrl(u) {
    if (!u) return '';
    try {
      const url = new URL(String(u).trim());
      return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
    } catch { return ''; }
  }
  function parseTags(str) {
    return [...new Set(String(str || '').split(/[,#]/).map(t => t.trim().toLowerCase().slice(0, 24)).filter(Boolean))];
  }

  const fmt = {
    stamp: new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }),
    time: new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }),
    day: new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
    date: new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
    month: new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })
  };
  function ago(iso) {
    const s = (Date.now() - new Date(iso)) / 1000;
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    if (s < 86400 * 7) return Math.floor(s / 86400) + 'd ago';
    return fmt.date.format(new Date(iso));
  }

  /* ---------------------------------------------------------
     Storage
     --------------------------------------------------------- */
  const PREFIX = 'anotetoself.';
  const Store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem(PREFIX + key);
        return v === null ? fallback : JSON.parse(v);
      } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); }
      catch { toast('could not save — browser storage is full or blocked'); }
    }
  };

  function collection(key, seed) {
    let items = Store.get(key, null);
    if (!Array.isArray(items)) { items = seed ? seed() : []; Store.set(key, items); }
    const api = {
      all: () => items,
      get: id => items.find(x => x.id === id),
      save: () => Store.set(key, items),
      add(item, atStart = true) { atStart ? items.unshift(item) : items.push(item); api.save(); return item; },
      remove(id) {
        const index = items.findIndex(x => x.id === id);
        if (index < 0) return null;
        const [item] = items.splice(index, 1);
        api.save();
        return { item, index };
      },
      restore({ item, index }) { items.splice(index, 0, item); api.save(); }
    };
    return api;
  }

  /* ---------------------------------------------------------
     Data model: log entries, ideas, sources
     --------------------------------------------------------- */
  const IDEA_STATUSES = [
    { id: 'spark', label: 'spark', icon: '✦', tone: 'var(--yellow)' },
    { id: 'exploring', label: 'exploring', icon: '🔍', tone: 'var(--slate-light)' },
    { id: 'testing', label: 'testing', icon: '🧪', tone: 'var(--slate-mid)' },
    { id: 'done', label: 'done', icon: '✓', tone: 'var(--sage)' },
    { id: 'parked', label: 'parked', icon: '⏸', tone: 'var(--beige)' }
  ];
  const SOURCE_STATUSES = [
    { id: 'to-read', label: 'to read', tone: 'var(--beige)' },
    { id: 'reading', label: 'reading', tone: 'var(--slate-light)' },
    { id: 'read', label: 'read ✓', tone: 'var(--sage)' }
  ];
  const ideaStatus = id => IDEA_STATUSES.find(s => s.id === id) || IDEA_STATUSES[0];
  const sourceStatus = id => SOURCE_STATUSES.find(s => s.id === id) || SOURCE_STATUSES[0];

  // first-visit sample content, so no page starts empty
  const seedTime = Date.now();
  const hoursAgo = h => new Date(seedTime - h * 36e5).toISOString();
  const seedSourceId = uid();
  const seedIdeaId = uid();

  const entries = collection('entries', () => [
    { id: uid(), text: 'Pretty good start to the morning, woke up early ☀️', mood: '🙂', ts: hoursAgo(2) },
    { id: uid(), text: 'Batched all my emails into two slots today. Felt noticeably less scattered by 4pm.', mood: '😌', ts: hoursAgo(5), ideaId: seedIdeaId },
    { id: uid(), text: 'Feeling pretty good mentally/emotionally. Maybe go to the beach tomorrow?', mood: '', ts: hoursAgo(26) }
  ]);

  const sources = collection('sources', () => [
    { id: seedSourceId, title: 'Deep Work', authors: 'Cal Newport', year: '2016', url: '', status: 'reading', tags: ['focus'],
      notes: 'Ch. 2 on attention residue → relevant to the batching idea.', added: hoursAgo(50) },
    { id: uid(), title: 'Your favourite paper goes here', authors: 'Someone et al.', year: '', url: '', status: 'to-read', tags: [],
      notes: '', added: hoursAgo(30) }
  ]);

  function normalizeIdea(i) {
    i.title = i.title || 'untitled idea';
    i.status = ideaStatus(i.status).id;
    for (const k of ['tags', 'questions', 'notes', 'sourceIds']) if (!Array.isArray(i[k])) i[k] = [];
    for (const k of ['summary', 'hypothesis', 'nextStep']) if (typeof i[k] !== 'string') i[k] = '';
    i.created = i.created || nowIso();
    i.updated = i.updated || i.created;
    return i;
  }
  function makeIdea(fields = {}) {
    const t = nowIso();
    return normalizeIdea({ id: uid(), status: 'spark', created: t, updated: t, ...fields });
  }

  const ideas = collection('ideas', () => [
    makeIdea({
      id: seedIdeaId,
      title: 'Does task batching actually save energy?',
      summary: 'I keep saying batching helps — can I measure it with a week of simple logs?',
      hypothesis: 'If I batch similar tasks, I finish more with less end-of-day fatigue.',
      nextStep: 'Rate energy 1–5 every evening for 7 days',
      status: 'exploring',
      tags: ['productivity', 'self-experiment'],
      questions: [
        { id: uid(), text: 'How do I rate energy consistently?', done: false },
        { id: uid(), text: 'What counts as one "batch"?', done: true }
      ],
      notes: [{ id: uid(), text: 'Day 1: emails at 11 and 4 only. Calmer afternoon, but I forgot to eat lunch.', ts: hoursAgo(5) }],
      sourceIds: [seedSourceId],
      created: hoursAgo(54), updated: hoursAgo(5)
    }),
    makeIdea({
      title: 'Sunset walks and evening mood',
      summary: 'Does getting outside before the sun sets change how I feel at night?',
      tags: ['wellbeing'],
      created: hoursAgo(20), updated: hoursAgo(20)
    }),
    makeIdea({
      title: 'A zine of planner doodles',
      summary: 'Collect the little characters from my pages into a printable zine.',
      status: 'parked',
      tags: ['creative'],
      created: hoursAgo(200), updated: hoursAgo(120)
    })
  ]);
  ideas.all().forEach(normalizeIdea);

  function touchIdea(idea) { idea.updated = nowIso(); ideas.save(); }
  const ideaHref = id => `idea.html?id=${encodeURIComponent(id)}`;
  const ideasByRecent = () => [...ideas.all()].sort((a, b) => b.updated.localeCompare(a.updated));
  function ideaOptions(selectedId, emptyLabel = '— not about an idea —') {
    return `<option value="">${esc(emptyLabel)}</option>` + ideasByRecent()
      .map(i => `<option value="${esc(i.id)}"${i.id === selectedId ? ' selected' : ''}>${esc(ideaStatus(i.status).icon)} ${esc(i.title)}</option>`).join('');
  }

  // one log entry <li>, shared by the Today and Log pages
  function entryEl(e, { isNew = false, timeOnly = false, onDelete } = {}) {
    const li = document.createElement('li');
    li.className = 'entry' + (isNew ? ' is-new' : '');
    li.dataset.id = e.id;

    const body = document.createElement('div');
    const time = document.createElement('time');
    time.dateTime = e.ts;
    time.textContent = (timeOnly ? fmt.time : fmt.stamp).format(new Date(e.ts));
    if (e.mood) time.insertAdjacentHTML('beforeend', `<span class="mood-tag">${esc(e.mood)}</span>`);
    const p = document.createElement('p');
    p.textContent = e.text;
    body.append(time, p);
    const idea = e.ideaId && ideas.get(e.ideaId);
    if (idea) body.insertAdjacentHTML('beforeend', `<a class="tag" href="${ideaHref(idea.id)}">💡 ${esc(idea.title)}</a>`);
    li.appendChild(body);

    if (onDelete) {
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'del';
      del.setAttribute('aria-label', 'Delete entry');
      del.innerHTML = svgUse('i-x', 16);
      del.addEventListener('click', () => onDelete(e, li));
      li.appendChild(del);
    }
    return li;
  }

  // remove an item with a leave animation, then call done()
  function animateOut(el, done) {
    el.classList.add('is-leaving');
    el.addEventListener('animationend', () => { el.remove(); if (done) done(); }, { once: true });
  }

  const EMPTY_PAGE_SVG = `<svg viewBox="0 0 64 64" class="squiggly" aria-hidden="true">
    <path d="M14 8 H44 L52 16 V56 H14Z" fill="#fff" stroke="#2b2b2b" stroke-width="3" stroke-linejoin="round"/>
    <path d="M44 8 V16 H52" fill="none" stroke="#2b2b2b" stroke-width="3"/>
    <path d="M22 28 H44 M22 36 H40 M22 44 H34" stroke="#a9bfcf" stroke-width="3" stroke-linecap="round"/></svg>`;
  function emptyEl(text, tag = 'li') {
    const el = document.createElement(tag);
    el.className = 'empty';
    el.innerHTML = EMPTY_PAGE_SVG + esc(text);
    return el;
  }

  /* ---------------------------------------------------------
     Toast + celebratory bursts
     --------------------------------------------------------- */
  let toastEl, toastMsg, toastBtn, toastTimer, toastAction = null;
  function toast(text, action) {
    if (!toastEl) return;
    toastMsg.textContent = text;
    toastAction = action ? action.onClick : null;
    toastBtn.hidden = !action;
    if (action) toastBtn.textContent = action.label;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, action ? 5000 : 2400);
  }
  function hideToast() { toastEl.classList.remove('show'); toastAction = null; }

  const BURST_SHAPES = ['i-star', 'i-heart', 'i-sparkle', 'i-loop', 'i-flower'];
  const COLORS = ['#f5d6a0', '#ff6b6b', '#4a6b82', '#a9bfcf', '#fbecc9'];
  function burst(x, y, count = 10, spread = 90) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    for (let i = 0; i < count; i++) {
      const s = document.createElement('span');
      s.className = 'burst';
      const angle = rand(0, Math.PI * 2), dist = rand(spread * .5, spread);
      s.style.left = x + 'px';
      s.style.top = y + 'px';
      s.style.color = pick(COLORS);
      s.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
      s.style.setProperty('--dy', Math.sin(angle) * dist - 30 + 'px');
      s.style.setProperty('--rot', rand(-200, 200) + 'deg');
      s.innerHTML = svgUse(pick(BURST_SHAPES));
      document.body.appendChild(s);
      setTimeout(() => s.remove(), 950);
    }
  }
  function burstFrom(el, n, spread) {
    const r = el.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2, n, spread);
  }

  /* ---------------------------------------------------------
     Page chrome: binder, header, tabs, footer
     --------------------------------------------------------- */
  const SECTIONS = [
    { id: 'today', label: 'TODAY', href: 'index.html' },
    { id: 'ideas', label: 'IDEAS', href: 'ideas.html' },
    { id: 'log', label: 'LOG', href: 'log.html' },
    { id: 'library', label: 'LIBRARY', href: 'library.html' }
  ];
  const page = $('#page');
  const pageId = page.dataset.page;
  const activeTab = page.dataset.tab || pageId;

  function buildChrome() {
    const desk = document.createElement('div');
    desk.className = 'desk';
    const binder = document.createElement('div');
    binder.className = 'binder';
    page.before(desk);
    desk.appendChild(binder);
    binder.appendChild(page);

    const now = new Date();
    const todayIdx = (now.getDay() + 6) % 7;
    const week = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => `<span class="${i === todayIdx ? 'is-today' : ''}">${d}</span>`).join('');
    page.insertAdjacentHTML('afterbegin', `
      <div class="sticker-layer" id="stickerLayer" aria-hidden="true"></div>
      <span class="doodle" style="--size:30px; top:-14px; left:-12px; color:var(--yellow); --tilt:-12deg">${svgUse('i-star')}</span>
      <span class="doodle" style="--size:26px; top:64px; right:-14px; color:var(--coral); --delay:-1s; --dur:3s">${svgUse('i-heart')}</span>
      <span class="doodle" style="--size:36px; bottom:56px; left:-16px; color:var(--slate); --delay:-.6s">${svgUse('i-loop')}</span>
      <header>
        <div class="title-frame"><h1 id="pageTitle">${esc(page.dataset.title || '')}${pageId === 'today' ? '<sup>®</sup>' : ''}</h1></div>
        <div class="meta-row">
          <span class="date-chip">${esc(new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(now))}</span>
          <div class="week" aria-label="This week">${week}</div>
        </div>
      </header>`);

    page.insertAdjacentHTML('beforeend', `
      <footer class="page-foot">
        JOURNAL – DRAW – BRAINSTORM – TAKE NOTES – MINDMAP
        <small>everything stays in this browser · nothing is uploaded</small>
        <div class="backup">
          <button type="button" class="btn white sketch press" id="exportBtn" title="Download all your journal data as a JSON file">⬇ back up</button>
          <button type="button" class="btn white sketch press" id="importBtn" title="Restore from a backup file">⬆ restore</button>
          <input type="file" id="importFile" accept="application/json,.json" hidden />
        </div>
      </footer>`);

    const side = document.createElement('nav');
    side.className = 'side-tabs';
    side.setAttribute('aria-label', 'Journal sections');
    side.innerHTML = SECTIONS.map((s, i) =>
      `<a class="tab press" data-tone="${i}" href="${s.href}"${s.id === activeTab ? ' aria-current="page"' : ''}>${s.label}</a>`).join('');
    binder.appendChild(side);

    const bottom = document.createElement('nav');
    bottom.className = 'bottom-tabs';
    bottom.setAttribute('aria-label', 'Page style');
    bottom.innerHTML = `
      <button type="button" class="tab press" data-pattern="blank" aria-pressed="false">BLANK</button>
      <button type="button" class="tab press" data-pattern="dot" aria-pressed="true">DOT</button>
      <button type="button" class="tab press" data-pattern="grid" aria-pressed="false">GRID</button>
      <button type="button" class="tab press" id="stickerTab" aria-pressed="false" title="Sticker mode: click the page to place stickers">STICKERS</button>`;
    binder.appendChild(bottom);

    document.body.insertAdjacentHTML('beforeend', `
      <div class="toast sketch" id="toast" role="status" aria-live="polite">
        <span id="toastMsg"></span><button type="button" id="toastBtn" hidden></button>
      </div>`);
    toastEl = $('#toast'); toastMsg = $('#toastMsg'); toastBtn = $('#toastBtn');
    toastBtn.addEventListener('click', () => { const fn = toastAction; hideToast(); if (fn) fn(); });
  }

  /* ---------------------------------------------------------
     Page patterns + sticker mode
     --------------------------------------------------------- */
  function initPaper() {
    const layer = $('#stickerLayer');
    const patternTabs = $$('.bottom-tabs [data-pattern]');
    const stickerTab = $('#stickerTab');
    const STICKERS = ['i-star', 'i-heart', 'i-sparkle', 'i-sun', 'i-flower', 'i-swirl', 'i-bulb'];
    const key = pageId === 'today' ? 'stickers' : 'stickers.' + pageId;
    let stickers = Store.get(key, []);
    let stickerMode = false;

    function setPattern(p) {
      page.dataset.pattern = p;
      patternTabs.forEach(t => t.setAttribute('aria-pressed', String(t.dataset.pattern === p)));
      Store.set('pattern', p);
    }
    patternTabs.forEach(t => t.addEventListener('click', () => setPattern(t.dataset.pattern)));
    setPattern(Store.get('pattern', 'dot'));

    function stickerEl(s) {
      const el = document.createElement('span');
      el.className = 'sticker';
      el.style.left = s.x + '%';
      el.style.top = s.y + '%';
      el.style.color = s.color;
      el.style.setProperty('--rot', s.rot + 'deg');
      el.innerHTML = svgUse(s.type);
      el.addEventListener('click', ev => {
        if (!stickerMode) return;
        ev.stopPropagation();
        stickers = stickers.filter(x => x.id !== s.id);
        Store.set(key, stickers);
        el.remove();
      });
      return el;
    }
    layer.replaceChildren(...stickers.map(stickerEl));

    stickerTab.addEventListener('click', () => {
      stickerMode = !stickerMode;
      stickerTab.setAttribute('aria-pressed', String(stickerMode));
      page.classList.toggle('sticker-mode', stickerMode);
      toast(stickerMode ? 'sticker mode on · click the page to stick, click a sticker to peel' : 'sticker mode off');
    });

    page.addEventListener('click', e => {
      if (!stickerMode) return;
      if (e.target.closest('button, input, textarea, select, a, label, [role="slider"], [draggable="true"]')) return;
      const r = page.getBoundingClientRect();
      const s = {
        id: uid(),
        x: +(((e.clientX - r.left) / r.width) * 100).toFixed(2),
        y: +(((e.clientY - r.top) / r.height) * 100).toFixed(2),
        type: pick(STICKERS),
        color: pick(COLORS),
        rot: Math.round(rand(-25, 25))
      };
      stickers.push(s);
      Store.set(key, stickers);
      layer.appendChild(stickerEl(s));
    });
  }

  /* ---------------------------------------------------------
     Backup / restore (JSON file)
     --------------------------------------------------------- */
  function initBackup() {
    $('#exportBtn').addEventListener('click', () => {
      const data = {};
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k.startsWith(PREFIX)) data[k.slice(PREFIX.length)] = JSON.parse(localStorage.getItem(k));
        }
      } catch { return toast('could not read browser storage'); }
      const blob = new Blob([JSON.stringify({ app: 'anotetoself', version: 2, exported: nowIso(), data }, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `anotetoself-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      toast('backup downloaded ✓');
    });

    const file = $('#importFile');
    $('#importBtn').addEventListener('click', () => file.click());
    file.addEventListener('change', async () => {
      const f = file.files[0];
      file.value = '';
      if (!f) return;
      try {
        const json = JSON.parse(await f.text());
        if (json.app !== 'anotetoself' || typeof json.data !== 'object') throw new Error('not a backup');
        if (!confirm('Replace everything in this journal with the backup? This cannot be undone.')) return;
        Object.keys(localStorage).filter(k => k.startsWith(PREFIX)).forEach(k => localStorage.removeItem(k));
        for (const [k, v] of Object.entries(json.data)) localStorage.setItem(PREFIX + k, JSON.stringify(v));
        location.reload();
      } catch {
        toast("that file doesn't look like an anotetoself backup");
      }
    });
  }

  buildChrome();
  initPaper();
  initBackup();

  window.J = {
    $, $$, uid, rand, pick, svgUse, esc, nowIso, debounce, restart, autosize, safeUrl, parseTags, fmt, ago,
    Store, toast, burst, burstFrom,
    entries, ideas, sources, makeIdea, touchIdea, ideaHref, ideasByRecent, ideaOptions,
    entryEl, animateOut, emptyEl,
    IDEA_STATUSES, SOURCE_STATUSES, ideaStatus, sourceStatus,
    setTitle(text) { $('#pageTitle').textContent = text; }
  };
})();
