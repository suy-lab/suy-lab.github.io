/* =========================================================
   Research Journal — app.js
   1. Constants & sample entries    6. DOI lookup & BibTeX
   2. Utilities                     7. Connections panel
   3. State & persistence           7b. Month files & GitHub sync
   4. Card list & date filter       8. Characters (scientist, owl, spider)
   5. Entry form & link mentions    9. Wiring & boot
   ========================================================= */
'use strict';

(() => {
  /* ---------- 1. Constants & sample entries ---------- */
  const STORAGE_KEY = 'research-journal:v1';
  const SLEEP_AFTER_MS = 60000;
  const LINK_RE = /\[\[([a-z0-9-]+)\|([^\]\n]*)\]\]/gi;

  // index.html shows the current month; archive.html shows every earlier month.
  const PAGE = document.body.dataset.page === 'archive' ? 'archive' : 'journal';
  const PREFS_KEY = 'research-journal:prefs';

  const TYPES = {
    paper: { label: 'Paper', plural: 'Papers', chip: '#C2D7EF', ink: '#24507F' },
    idea: { label: 'Idea', plural: 'Ideas', chip: '#F2DC86', ink: '#6E510B' },
    log: { label: 'Daily log', plural: 'Daily logs', chip: '#BDE2C4', ink: '#285F40' },
  };
  const STATUS_LABEL = { open: 'Open question', exploring: 'Exploring', answered: 'Answered' };

  const ICONS = {
    paper: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/></svg>',
    idea: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/></svg>',
    log: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/></svg>',
    graph: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><circle cx="4.5" cy="6" r="2"/><circle cx="19.5" cy="6" r="2"/><circle cx="12" cy="20.5" r="2"/><path d="M6.2 7.1 9.6 10.4M17.8 7.1l-3.4 3.3M12 15v3.5"/></svg>',
  };

  const SAMPLES = [
    {
      id: 'p-transformer',
      type: 'paper',
      title: 'Attention Is All You Need',
      authors: ['Ashish Vaswani', 'Noam Shazeer', 'Niki Parmar', 'Jakob Uszkoreit', 'Llion Jones', 'Aidan N. Gomez', 'Łukasz Kaiser', 'Illia Polosukhin'],
      year: '2017',
      venue: 'Advances in Neural Information Processing Systems 30 (NeurIPS 2017)',
      doi: '10.48550/arXiv.1706.03762',
      url: 'https://arxiv.org/abs/1706.03762',
      abstract: '',
      created: '2026-10-20T10:00:00',
      body: 'Introduces the **Transformer**: an encoder–decoder built only from attention, with no recurrence or convolution.\n\nTo revisit: scaled dot-product attention, multi-head attention, and positional encodings.',
    },
    {
      id: 'i-attention',
      type: 'idea',
      title: 'Do attention weights explain predictions?',
      status: 'exploring',
      created: '2026-10-22T16:30:00',
      body: 'Attention maps *look* interpretable, but are they faithful explanations?\n\nTest: remove the most-attended tokens and measure how much the output changes. Builds on [[p-transformer|Attention Is All You Need]].',
    },
    {
      id: 'l-first-log',
      type: 'log',
      title: 'Read the Transformer paper and sketched a test',
      logDate: '2026-10-27',
      created: '2026-10-27T18:00:00',
      body: 'Read sections 3 and 4 of [[p-transformer|Attention Is All You Need]]. Sketched an ablation test for [[i-attention|Do attention weights explain predictions?]].\n\n**Next:** pick a small dataset to try it on.',
    },
  ];

  /* ---------- 2. Utilities ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const pad = (n) => String(n).padStart(2, '0');
  const rnd = (a, b) => a + Math.random() * (b - a);
  const plural = (n, word) => `${n} ${n === 1 ? word : word.replace(/y$/, 'ie')}${n === 1 ? '' : 's'}`;

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /** Only http(s) links may become hrefs; anything else (javascript:, data:…) is dropped. */
  function safeUrl(url) {
    if (!url) return '';
    try {
      const u = new URL(String(url).trim(), window.location.href);
      return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : '';
    } catch (err) {
      return '';
    }
  }

  function uid(type) {
    return `${type.charAt(0)}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  }

  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  /** “28 Oct 2026”: unambiguous for readers anywhere (28/10 vs 10/28). */
  function formatDate(t) {
    return new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function shorten(text, max) {
    return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
  }

  /** The date an entry belongs to: the log's own date, otherwise when it was written. */
  function entryTime(e) {
    if (e.type === 'log' && e.logDate) return new Date(`${e.logDate}T12:00:00`).getTime();
    return new Date(e.created).getTime();
  }

  function monthKey(t) {
    const d = new Date(t);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  }

  let CURRENT_MONTH = monthKey(Date.now());

  /** The month an entry is filed under (a log's own date, otherwise when it was written). */
  function monthOf(e) {
    return monthKey(entryTime(e));
  }

  function monthLabel(key, short = false) {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: short ? 'short' : 'long', year: 'numeric' });
  }

  /** Whether an entry belongs on this page. */
  function inScope(e) {
    return PAGE === 'journal' ? monthOf(e) >= CURRENT_MONTH : monthOf(e) < CURRENT_MONTH;
  }

  function timeValue(iso) {
    const t = new Date(iso).getTime();
    return Number.isNaN(t) ? 0 : t;
  }

  /** IDs this entry links to, in order, without duplicates or self-links. */
  function linksOf(entry) {
    const ids = [];
    for (const m of (entry.body || '').matchAll(LINK_RE)) {
      if (m[1] !== entry.id && !ids.includes(m[1])) ids.push(m[1]);
    }
    return ids;
  }

  function plainText(body) {
    return (body || '').replace(LINK_RE, (_, id, label) => label).replace(/\*\*?/g, '');
  }

  function shortAuthors(list) {
    if (!list || !list.length) return '';
    if (list.length === 1) return list[0];
    if (list.length === 2) return `${list[0]} & ${list[1]}`;
    return `${list[0]} et al.`;
  }

  /* ---------- 3. State & persistence ---------- */
  const state = {
    entries: [],
    deleted: {}, // id → when it was deleted, so a GitHub copy doesn't bring it back
    filter: 'all',
    query: '',
    dateFrom: '',
    dateTo: '',
    expanded: new Set(),
    selected: null,
    // connections panel
    mapSeed: null,
    mapTrail: [],
    depth: 1,
    mapHot: null,
    graph: null,
  };

  const byId = (id) => state.entries.find((e) => e.id === id);

  function sampleEntries() {
    return SAMPLES.map((s) => ({ ...s, authors: s.authors ? [...s.authors] : undefined }));
  }

  function isValidEntry(e) {
    return e && typeof e.id === 'string' && TYPES[e.type] && typeof e.title === 'string'
      && !Number.isNaN(new Date(e.created).getTime());
  }

  function loadEntries() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        const entries = Array.isArray(data.entries) ? data.entries.filter(isValidEntry) : [];
        if (entries.length || data.emptyOnPurpose) return entries.map((e) => ({ ...e, body: e.body || '' }));
      }
    } catch (err) { /* storage blocked or corrupt: start from the samples */ }
    return sampleEntries();
  }

  function loadDeleted() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return (data && data.deleted) || {};
    } catch (err) {
      return {};
    }
  }

  function loadPrefs() {
    try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; } catch (err) { return {}; }
  }

  function savePrefs(prefs) {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (err) { /* storage blocked */ }
  }

  function persistNow() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: 2,
        savedAt: new Date().toISOString(),
        emptyOnPurpose: state.entries.length === 0,
        entries: state.entries,
        deleted: state.deleted,
      }));
    } catch (err) { /* storage full or blocked: keep working in memory */ }
  }

  /* ---------- DOM references ---------- */
  const el = {
    header: $('.site-header'),
    headerDate: $('#header-date'),
    perch: $('#owl-perch'),
    journal: $('#journal'),
    filters: $('#filters'),
    search: $('#search'),
    dateFrom: $('#date-from'),
    dateTo: $('#date-to'),
    dateClear: $('#date-clear'),
    count: $('#entry-count'),
    list: $('#entry-list'),
    newEntry: $('#new-entry'),
    composer: $('#composer'),
    composerHeading: $('#composer-heading'),
    form: $('#entry-form'),
    typeRadios: $$('input[name="type"]'),
    doi: $('#f-doi'),
    doiFetch: $('#doi-fetch'),
    bibtexBox: $('#bibtex-box'),
    bibtex: $('#f-bibtex'),
    bibtexImport: $('#bibtex-import'),
    importStatus: $('#import-status'),
    title: $('#f-title'),
    authors: $('#f-authors'),
    year: $('#f-year'),
    venue: $('#f-venue'),
    url: $('#f-url'),
    status: $('#f-status'),
    date: $('#f-date'),
    body: $('#f-body'),
    mention: $('#mention-menu'),
    linkPreview: $('#link-preview'),
    saveBtn: $('#save-entry'),
    cancel: $('#cancel-entry'),
    reset: $('#reset-journal'),
    panel: $('#map-panel'),
    mapHeading: $('#map-heading'),
    mapClose: $('#map-close'),
    mapTrail: $('#map-trail'),
    depthRadios: $$('input[name="depth"]'),
    mapSummary: $('#map-summary'),
    mapScroll: $('#map-scroll'),
    board: $('#map-board'),
    edges: $('#map-edges'),
    pop: $('#map-pop'),
    pageEyebrow: $('#page-eyebrow'),
    monthNav: $('#month-nav'),
    monthDownloads: $$('[data-month-dl]'),
    syncOpen: $('#sync-open'),
    syncBadge: $('#sync-badge'),
    syncDialog: $('#sync-dialog'),
    syncStatus: $('#sync-status'),
    syncDirty: $('#sync-dirty'),
    syncPush: $('#sync-push'),
    syncPull: $('#sync-pull'),
    dlMonth: $('#dl-month'),
    importBtn: $('#import-btn'),
    importFile: $('#import-file'),
    ghOwner: $('#gh-owner'),
    ghRepo: $('#gh-repo'),
    ghBranch: $('#gh-branch'),
    ghFolder: $('#gh-folder'),
    ghToken: $('#gh-token'),
    ghRemember: $('#gh-remember'),
  };

  /* ---------- 4. Card list & date filter ---------- */
  function neighborIds(id) {
    const entry = byId(id);
    const out = entry ? linksOf(entry).filter(byId) : [];
    const inc = state.entries.filter((e) => e.id !== id && linksOf(e).includes(id)).map((e) => e.id);
    return { out, inc, all: [...new Set([...out, ...inc])] };
  }

  // Links in both directions, built once per list render instead of rescanning every entry for every card.
  let linkIndex = null;
  function buildLinkIndex() {
    const ids = new Map(state.entries.map((e) => [e.id, e]));
    const out = new Map();
    const inc = new Map();
    state.entries.forEach((e) => {
      const targets = linksOf(e).filter((id) => ids.has(id));
      out.set(e.id, targets);
      targets.forEach((id) => {
        if (!inc.has(id)) inc.set(id, []);
        inc.get(id).push(e.id);
      });
    });
    return { ids, out, inc };
  }

  function inDateRange(e) {
    const t = entryTime(e);
    if (state.dateFrom && t < new Date(`${state.dateFrom}T00:00:00`).getTime()) return false;
    if (state.dateTo && t > new Date(`${state.dateTo}T23:59:59.999`).getTime()) return false;
    return true;
  }

  function filteredEntries() {
    const q = state.query.trim().toLowerCase();
    return state.entries
      .filter(inScope)
      .filter((e) => state.filter === 'all' || e.type === state.filter)
      .filter(inDateRange)
      .filter((e) => !q
        || e.title.toLowerCase().includes(q)
        || (e.authors || []).join(' ').toLowerCase().includes(q)
        || (e.venue || '').toLowerCase().includes(q)
        || plainText(e.body).toLowerCase().includes(q))
      .sort((a, b) => entryTime(b) - entryTime(a) || new Date(b.created) - new Date(a.created));
  }

  function renderFilters() {
    const counts = { paper: 0, idea: 0, log: 0 };
    const scoped = state.entries.filter(inScope);
    scoped.forEach((e) => { counts[e.type] += 1; });
    const pills = [['all', 'All', scoped.length, '#1F1E1B'],
      ...Object.entries(TYPES).map(([key, t]) => [key, t.plural, counts[key], t.ink])];
    el.filters.innerHTML = pills.map(([key, label, n, dot]) => `
      <button class="pill" type="button" data-filter="${key}" aria-pressed="${state.filter === key}" style="--dot:${dot}">
        ${key === 'all' ? '' : '<span class="pill-dot" aria-hidden="true"></span>'}<span>${label}</span><span class="pill-count">${n}</span>
      </button>`).join('');
  }

  function highlight(text, q) {
    if (!q) return esc(text);
    const lower = text.toLowerCase();
    let out = '';
    let i = 0;
    let hit = lower.indexOf(q);
    while (hit !== -1) {
      out += `${esc(text.slice(i, hit))}<mark>${esc(text.slice(hit, hit + q.length))}</mark>`;
      i = hit + q.length;
      hit = lower.indexOf(q, i);
    }
    return out + esc(text.slice(i));
  }

  /** Minimal Markdown: paragraphs, line breaks, **bold**, *italic* and [[id|Title]] links. */
  function renderBody(body) {
    const text = (body || '').trim();
    if (!text) return '<p class="empty">No notes yet.</p>';
    return text.split(/\n{2,}/).map((para) => {
      // Park links as placeholders so bold/italic can't match across the HTML we generate for them.
      const links = [];
      let html = esc(para).replace(LINK_RE, (_, id, label) => {
        links.push([id, label]);
        return `\u0000${links.length - 1}\u0000`;
      });
      html = html
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
        .replace(/\n/g, '<br>')
        .replace(/\u0000(\d+)\u0000/g, (_, i) => linkHtml(...links[Number(i)]));
      return `<p>${html}</p>`;
    }).join('');
  }

  function linkHtml(id, label) {
    const target = byId(id);
    return target
      ? `<a class="ref ref-${target.type}" href="#entry-${esc(id)}" data-link="${esc(id)}">${esc(target.title)}</a>`
      : `<span class="ref ref-missing" title="This entry was deleted">${label}</span>`;
  }

  function metaHtml(e) {
    if (e.type === 'paper') {
      const parts = [esc(shortAuthors(e.authors)), esc(e.year), e.venue ? `<em>${esc(e.venue)}</em>` : ''].filter(Boolean);
      return parts.length ? `<p class="card-meta">${parts.join(' · ')}</p>` : '';
    }
    if (e.type === 'idea') {
      const status = e.status || 'open';
      return `<p class="card-meta"><span class="status status-${status}">${STATUS_LABEL[status]}</span></p>`;
    }
    return '';
  }

  function cardHtml(e, q) {
    const t = TYPES[e.type];
    const id = esc(e.id);
    const open = state.expanded.has(e.id);
    const idx = linkIndex || buildLinkIndex();
    const incoming = idx.inc.get(e.id) || [];
    const connections = new Set([...(idx.out.get(e.id) || []), ...incoming]).size;
    const backlinks = incoming.map((id) => idx.ids.get(id));
    const excerpt = plainText(e.body).replace(/\s+/g, ' ').trim().slice(0, 220);
    const isSeed = state.mapSeed === e.id;
    const classes = ['card', `card-${e.type}`, open && 'is-open', state.selected === e.id && 'is-selected'].filter(Boolean).join(' ');

    let facts = '';
    if (e.type === 'paper') {
      const rows = [];
      if (e.authors && e.authors.length > 1) rows.push(`<span>${esc(e.authors.join(', '))}</span>`);
      if (e.doi) rows.push(`<span>DOI: <a href="https://doi.org/${esc(e.doi)}" target="_blank" rel="noopener">${esc(e.doi)}</a></span>`);
      const link = safeUrl(e.url);
      if (link && !(e.doi && link.includes(e.doi))) rows.push(`<span>Link: <a href="${esc(link)}" target="_blank" rel="noopener noreferrer">${esc(link)}</a></span>`);
      if (rows.length) facts = `<p class="paper-facts">${rows.join('')}</p>`;
    }

    return `
      <article class="${classes}" id="entry-${id}" data-id="${id}">
        <div class="card-top" data-action="toggle">
          <div class="card-row">
            <span class="type-chip">${ICONS[e.type]}${t.label}</span>
            <span class="card-row-end">
              <time class="card-date" datetime="${esc(e.logDate || e.created)}">${formatDate(entryTime(e))}</time>
              <button class="conn-btn" type="button" data-action="connections" aria-pressed="${isSeed}"
                aria-label="Connections for ${esc(e.title)}: ${plural(connections, 'linked entry')}">
                ${ICONS.graph}<span class="conn-label">Connections</span><span class="conn-count">${connections}</span>
              </button>
            </span>
          </div>
          <h3 class="card-title">
            <button class="card-head" type="button" aria-expanded="${open}" aria-controls="body-${id}">${highlight(e.title, q)}</button>
          </h3>
          ${metaHtml(e)}
          ${excerpt ? `<p class="card-excerpt">${highlight(excerpt, q)}</p>` : ''}
        </div>
        <div class="card-body-wrap" id="body-${id}"${open ? '' : ' inert'}><div class="card-body-clip">
        <div class="card-body">
          <div class="prose">${renderBody(e.body)}</div>
          ${e.type === 'paper' && e.abstract ? `<details class="abstract"><summary>Abstract</summary><p>${esc(e.abstract)}</p></details>` : ''}
          ${facts}
          ${backlinks.length ? `
            <div class="backlinks">
              <span class="backlinks-label">Linked from</span>
              ${backlinks.map((b) => `<a class="chip" href="#entry-${esc(b.id)}" data-link="${esc(b.id)}" style="--chip:${TYPES[b.type].chip}">${esc(b.title)}</a>`).join('')}
            </div>` : ''}
          <div class="card-actions">
            <button class="text-btn" type="button" data-action="edit">Edit</button>
            ${e.type === 'paper' ? '<button class="text-btn" type="button" data-action="bibtex">Copy BibTeX</button>' : ''}
            <button class="text-btn danger" type="button" data-action="delete">Delete</button>
          </div>
        </div>
        </div></div>
      </article>`;
  }

  function monthStats(m) {
    const counts = { paper: 0, idea: 0, log: 0 };
    state.entries.filter((e) => monthOf(e) === m).forEach((e) => { counts[e.type] += 1; });
    return [plural(counts.paper, 'paper'), plural(counts.idea, 'idea'), plural(counts.log, 'daily log')]
      .filter((s) => !s.startsWith('0 ')).join(' · ');
  }

  function monthDownloads(m) {
    return `
      <span class="month-dl" role="group" aria-label="Download ${esc(monthLabel(m))}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>
        <button class="dl-btn" type="button" data-action="download-json" data-month="${m}">JSON</button>
        <button class="dl-btn" type="button" data-action="download-md" data-month="${m}">Markdown</button>
      </span>`;
  }

  function renderMonthNav() {
    if (!el.monthNav) return;
    const months = [...new Set(state.entries.filter(inScope).map(monthOf))].sort().reverse();
    el.monthNav.innerHTML = months.length
      ? months.map((m) => `<a class="month-link" href="#month-${m}">${esc(monthLabel(m))}<span class="pill-count">${state.entries.filter((e) => monthOf(e) === m).length}</span></a>`).join('')
      : '';
  }

  function renderList() {
    linkIndex = buildLinkIndex();
    const q = state.query.trim().toLowerCase();
    const entries = filteredEntries();
    const scopedTotal = state.entries.filter(inScope).length;
    const datesSet = Boolean(state.dateFrom || state.dateTo);
    const where = PAGE === 'journal' ? 'this month' : 'in the archive';
    el.dateClear.hidden = !datesSet;
    el.count.textContent = entries.length === scopedTotal
      ? `${plural(entries.length, 'entry')} ${where}`
      : `${entries.length} of ${plural(scopedTotal, 'entry')} ${where}`;
    renderMonthNav();

    if (!entries.length) {
      let empty;
      if (scopedTotal) {
        empty = `<p>Nothing matches.</p><p>Try another search${datesSet ? ' or date range' : ''}, or <button class="text-btn" type="button" data-action="clear">show everything</button>.</p>`;
      } else if (PAGE === 'journal') {
        empty = `<p>Nothing yet for ${esc(monthLabel(CURRENT_MONTH))}.</p><p>Add a paper, an idea or today's log with <strong>New entry</strong>. Earlier months are in the <a href="archive.html">archive</a>.</p>`;
      } else {
        empty = '<p>The archive is empty.</p><p>When a month ends, its entries move here automatically.</p>';
      }
      el.list.innerHTML = `<div class="empty-state">${empty}</div>`;
      return;
    }

    if (PAGE === 'journal') {
      el.list.innerHTML = entries.map((e) => cardHtml(e, q)).join('');
      return;
    }

    // Archive: one section per month, newest first.
    const groups = new Map();
    entries.forEach((e) => {
      const m = monthOf(e);
      if (!groups.has(m)) groups.set(m, []);
      groups.get(m).push(e);
    });
    el.list.innerHTML = [...groups.entries()].map(([m, list]) => `
      <section class="month-group" id="month-${m}" aria-labelledby="month-title-${m}">
        <header class="month-head">
          <div>
            <h2 class="month-title" id="month-title-${m}">${esc(monthLabel(m))}</h2>
            <p class="month-stats">${monthStats(m)}</p>
          </div>
          ${monthDownloads(m)}
        </header>
        <div class="month-cards">${list.map((e) => cardHtml(e, q)).join('')}</div>
      </section>`).join('');
  }

  function renderAll() {
    renderFilters();
    renderList();
    updateSyncBadge();
    if (state.mapSeed) renderMap();
  }

  function cardFor(id) {
    return el.list.querySelector(`.card[data-id="${CSS.escape(id)}"]`);
  }

  function flash(node) {
    node.classList.remove('is-flash');
    void node.offsetWidth; // restart the animation
    node.classList.add('is-flash');
    setTimeout(() => node.classList.remove('is-flash'), 1300);
  }

  function select(id) {
    state.selected = id;
    $$('.card', el.list).forEach((c) => c.classList.toggle('is-selected', c.dataset.id === id));
  }

  function showEverything() {
    state.filter = 'all';
    state.query = '';
    state.dateFrom = '';
    state.dateTo = '';
    el.search.value = '';
    el.dateFrom.value = '';
    el.dateTo.value = '';
  }

  /** Expand an entry's card, scroll it into view, and let the owl land on it. */
  /** Entries from another month live on the other page: go there and open it. */
  function goToEntryPage(entry) {
    const page = monthOf(entry) >= CURRENT_MONTH ? 'index.html' : 'archive.html';
    window.location.href = `${page}#entry-${encodeURIComponent(entry.id)}`;
  }

  function openFromHash() {
    const m = /^#entry-(.+)$/.exec(window.location.hash);
    const entry = m && byId(decodeURIComponent(m[1]));
    if (entry && inScope(entry)) setTimeout(() => openEntry(entry.id), 500);
  }

  function openEntry(id) {
    const target = byId(id);
    if (!target) return;
    if (!inScope(target)) { goToEntryPage(target); return; }
    if (!cardFor(id)) showEverything();
    state.expanded.add(id);
    state.selected = id;
    renderFilters();
    renderList();
    const card = cardFor(id);
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    flash(card);
    setTimeout(() => Guide.landOn(card), 450);
  }

  function deleteEntry(id) {
    const e = byId(id);
    if (!e) return;
    if (!window.confirm(`Delete “${e.title}”? Links to it from other entries will show as deleted.`)) return;
    if (editingId === id) closeComposer();
    state.entries = state.entries.filter((x) => x.id !== id);
    state.deleted[id] = new Date().toISOString();
    state.expanded.delete(id);
    if (state.selected === id) state.selected = null;
    state.mapTrail = state.mapTrail.filter((t) => t !== id);
    if (state.mapSeed === id) closeConnections();
    Guide.goHome();
    persistNow();
    renderAll();
    announce(`Deleted “${e.title}”.`);
  }

  /* ---------- 5. Entry form & link mentions ---------- */
  let editingId = null;
  let draftAbstract = '';
  let draftBibtex = '';
  const mention = { open: false, start: 0, query: '', items: [], index: 0 };

  function setType(type) {
    el.form.dataset.type = type;
    el.typeRadios.forEach((r) => { r.checked = r.value === type; });
    el.title.placeholder = {
      paper: 'Paper title (filled in by DOI or BibTeX)',
      idea: 'A question or hypothesis',
      log: 'What did you work on? (optional)',
    }[type];
    if (type === 'log' && !el.date.value) el.date.value = todayISO();
  }

  function setImportStatus(text, tone = 'ok') {
    el.importStatus.textContent = text;
    el.importStatus.dataset.tone = tone;
  }

  function openComposer(entry = null) {
    editingId = entry ? entry.id : null;
    el.form.reset();
    draftAbstract = entry && entry.abstract ? entry.abstract : '';
    draftBibtex = entry && entry.bibtex ? entry.bibtex : '';
    setImportStatus('');
    el.bibtexBox.open = false;
    el.title.removeAttribute('aria-invalid');

    if (entry) {
      el.title.value = entry.title;
      el.body.value = entry.body || '';
      el.doi.value = entry.doi || '';
      el.authors.value = (entry.authors || []).join('; ');
      el.year.value = entry.year || '';
      el.venue.value = entry.venue || '';
      el.url.value = entry.url || '';
      el.status.value = entry.status || 'open';
      el.date.value = entry.logDate || '';
      if (draftBibtex) el.bibtex.value = draftBibtex;
    }
    setType(entry ? entry.type : el.form.dataset.type || 'paper');
    el.composerHeading.textContent = entry ? 'Edit entry' : 'New entry';
    el.saveBtn.textContent = entry ? 'Save changes' : 'Save entry';
    el.composer.hidden = false;
    el.newEntry.setAttribute('aria-expanded', 'true');
    updateLinkPreview();

    if (entry) {
      el.composer.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el.title.focus({ preventScroll: true });
    } else if (el.form.dataset.type === 'paper') {
      el.doi.focus();
    } else {
      el.title.focus();
    }
    Scientist.watch(el.composer);
  }

  function closeComposer() {
    el.composer.hidden = true;
    el.newEntry.setAttribute('aria-expanded', 'false');
    el.form.reset();
    editingId = null;
    draftAbstract = '';
    draftBibtex = '';
    setImportStatus('');
    closeMention();
    updateLinkPreview();
  }

  function saveEntry(event) {
    event.preventDefault();
    const type = el.form.dataset.type;
    let title = el.title.value.trim();
    const logDate = el.date.value || todayISO();
    if (!title && type === 'log') title = `Research log, ${formatDate(new Date(`${logDate}T12:00:00`))}`;
    if (!title) {
      el.title.setAttribute('aria-invalid', 'true');
      el.title.focus();
      Scientist.say(type === 'paper' ? 'Add a title, or fetch it with the DOI.' : 'Every entry needs a title!', 2800);
      return;
    }
    el.title.removeAttribute('aria-invalid');

    const data = { type, title, body: el.body.value.trim() };
    if (type === 'paper') {
      data.authors = el.authors.value.split(/;|\n/).map((a) => a.trim()).filter(Boolean);
      data.year = el.year.value.trim();
      data.venue = el.venue.value.trim();
      data.url = safeUrl(el.url.value);
      data.doi = normalizeDoi(el.doi.value) || '';
      data.abstract = draftAbstract;
      if (draftBibtex) data.bibtex = draftBibtex;
    } else if (type === 'idea') {
      data.status = el.status.value;
    } else {
      data.logDate = logDate;
    }

    let entry;
    let previousLinks = new Set();
    if (editingId && byId(editingId)) {
      const old = byId(editingId);
      previousLinks = new Set(linksOf(old));
      entry = { id: old.id, created: old.created, updated: new Date().toISOString(), ...data };
      state.entries[state.entries.indexOf(old)] = entry;
    } else {
      const now = new Date().toISOString();
      entry = { id: uid(type), created: now, updated: now, ...data };
      state.entries.push(entry);
    }
    persistNow();

    const newLinks = linksOf(entry).filter((id) => !previousLinks.has(id)).map(byId).filter(Boolean);
    const wasEditing = Boolean(editingId);
    closeComposer();
    if (state.filter !== 'all' && state.filter !== entry.type) state.filter = 'all';
    if (!inDateRange(entry)) { state.dateFrom = ''; state.dateTo = ''; el.dateFrom.value = ''; el.dateTo.value = ''; }
    state.query = '';
    el.search.value = '';
    state.expanded.add(entry.id);
    state.selected = entry.id;
    renderAll();

    const card = cardFor(entry.id);
    if (!card) { // its date puts it on the other page
      Scientist.cheer(PAGE === 'journal'
        ? `Saved to the archive, under ${monthLabel(monthOf(entry))}.`
        : 'Moved to this month’s journal.');
      return;
    }
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    flash(card);
    setTimeout(() => Guide.landOn(card), 500);

    if (newLinks.length) {
      Scientist.pointAtMap(`New link: ${shorten(entry.title, 40)} → ${shorten(newLinks[0].title, 40)}`);
    } else {
      Scientist.cheer(wasEditing ? 'Updated!' : `Saved! ${plural(state.entries.filter(inScope).length, 'entry')} this month.`);
    }
  }

  function updateLinkPreview() {
    const linked = linksOf({ id: editingId || '', body: el.body.value }).map(byId).filter(Boolean);
    el.linkPreview.innerHTML = linked.length
      ? `<span>Links to</span>${linked.map((e) => `<span class="chip" style="--chip:${TYPES[e.type].chip}">${esc(e.title)}</span>`).join('')}`
      : '';
  }

  /** Pixel position of a character index inside a textarea, measured with a hidden mirror element. */
  function caretCoords(textarea, index) {
    const mirror = document.createElement('div');
    const cs = getComputedStyle(textarea);
    ['boxSizing', 'width', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
      'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'fontStyle', 'fontVariant', 'fontWeight',
      'fontStretch', 'fontSize', 'lineHeight', 'fontFamily', 'textAlign', 'textTransform', 'textIndent',
      'letterSpacing', 'wordSpacing', 'tabSize'].forEach((p) => { mirror.style[p] = cs[p]; });
    Object.assign(mirror.style, {
      position: 'absolute', visibility: 'hidden', top: '0', left: '-9999px',
      whiteSpace: 'pre-wrap', overflowWrap: 'break-word', borderStyle: 'solid',
    });
    mirror.textContent = textarea.value.slice(0, index);
    const marker = document.createElement('span');
    marker.textContent = textarea.value.slice(index) || '.';
    mirror.appendChild(marker);
    document.body.appendChild(mirror);
    const coords = {
      top: marker.offsetTop - textarea.scrollTop,
      left: marker.offsetLeft - textarea.scrollLeft,
      lineHeight: parseFloat(cs.lineHeight) || 26,
    };
    mirror.remove();
    return coords;
  }

  function updateMention() {
    const ta = el.body;
    const caret = ta.selectionStart;
    if (caret !== ta.selectionEnd) { closeMention(); return; }
    const before = ta.value.slice(0, caret);
    const match = before.match(/(\[\[|@)([^[\]@\n|]{0,60})$/);
    if (!match) { closeMention(); return; }
    if (match[1] === '@') {
      const prev = before.charAt(before.length - match[0].length - 1);
      if (prev && !/[\s(]/.test(prev)) { closeMention(); return; } // e.g. an email address
    }
    mention.start = caret - match[0].length;
    mention.query = match[2].trim().toLowerCase();
    const q = mention.query;
    mention.items = state.entries
      .filter((e) => e.id !== editingId)
      .filter((e) => !q || e.title.toLowerCase().includes(q) || (e.authors || []).join(' ').toLowerCase().includes(q))
      .sort((a, b) => {
        const aStarts = a.title.toLowerCase().startsWith(q) ? 0 : 1;
        const bStarts = b.title.toLowerCase().startsWith(q) ? 0 : 1;
        return aStarts - bStarts || entryTime(b) - entryTime(a);
      })
      .slice(0, 8);
    if (!mention.open) mention.index = 0;
    mention.index = clamp(mention.index, 0, Math.max(0, mention.items.length - 1));
    mention.open = true;
    renderMention();
  }

  function renderMention() {
    const menu = el.mention;
    menu.innerHTML = mention.items.length
      ? mention.items.map((e, i) => `
          <li role="option" id="mention-opt-${i}" data-index="${i}" aria-selected="${i === mention.index}">
            <span class="mention-swatch" style="background:${TYPES[e.type].chip}" aria-hidden="true"></span>
            <span class="mention-title">${esc(e.title)}</span>
            <span class="mention-type">${TYPES[e.type].label}${monthOf(e) === CURRENT_MONTH ? '' : ` · ${monthLabel(monthOf(e), true)}`}</span>
          </li>`).join('')
      : `<li class="mention-empty" role="option" aria-disabled="true">No entries match “${esc(mention.query)}”</li>`;
    menu.hidden = false;

    const coords = caretCoords(el.body, mention.start);
    const maxLeft = Math.max(0, el.body.offsetWidth - menu.offsetWidth);
    menu.style.left = `${clamp(coords.left, 0, maxLeft)}px`;
    menu.style.top = `${Math.min(coords.top + coords.lineHeight + 6, el.body.offsetHeight + 4)}px`;

    el.body.setAttribute('aria-expanded', 'true');
    if (mention.items.length) {
      el.body.setAttribute('aria-activedescendant', `mention-opt-${mention.index}`);
      const active = menu.querySelector(`[data-index="${mention.index}"]`);
      if (active) active.scrollIntoView({ block: 'nearest' });
    }
  }

  function closeMention() {
    mention.open = false;
    el.mention.hidden = true;
    el.body.setAttribute('aria-expanded', 'false');
    el.body.removeAttribute('aria-activedescendant');
  }

  function linkToken(entry) {
    return `[[${entry.id}|${entry.title.replace(/[[\]|]/g, '')}]]`;
  }

  function insertLink(entry) {
    const ta = el.body;
    const caret = ta.selectionStart;
    const token = `${linkToken(entry)} `;
    ta.value = ta.value.slice(0, mention.start) + token + ta.value.slice(caret);
    const pos = mention.start + token.length;
    ta.setSelectionRange(pos, pos);
    ta.focus();
    closeMention();
    updateLinkPreview();
  }

  function onNotesKeydown(event) {
    if (!mention.open) return;
    const count = mention.items.length;
    if (event.key === 'ArrowDown' && count) {
      event.preventDefault();
      mention.index = (mention.index + 1) % count;
      renderMention();
    } else if (event.key === 'ArrowUp' && count) {
      event.preventDefault();
      mention.index = (mention.index - 1 + count) % count;
      renderMention();
    } else if ((event.key === 'Enter' || event.key === 'Tab') && count) {
      event.preventDefault();
      insertLink(mention.items[mention.index]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeMention();
    }
  }

  /* ---------- 6. DOI lookup & BibTeX ---------- */
  function normalizeDoi(raw) {
    const s = String(raw || '').trim()
      .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
      .replace(/^doi:\s*/i, '')
      .trim();
    return /^10\.\d{4,9}\/\S+$/.test(s) ? s : null;
  }

  /** Plain text from remote HTML. DOMParser builds an inert document: no scripts run and no images load. */
  function stripTags(html) {
    const clean = String(html || '').replace(/<jats:title>[^<]*<\/jats:title>/gi, '');
    const doc = new DOMParser().parseFromString(clean, 'text/html');
    return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function fromCsl(c, doi, source) {
    const first = (v) => (Array.isArray(v) ? v[0] : v) || '';
    const dateParts = (c.issued && c.issued['date-parts']) || (c.published && c.published['date-parts'])
      || (c['published-print'] && c['published-print']['date-parts']) || [[]];
    return {
      title: stripTags(first(c.title)),
      authors: (c.author || []).map((a) => a.literal || a.name || [a.given, a.family].filter(Boolean).join(' ')).filter(Boolean),
      year: dateParts[0] && dateParts[0][0] ? String(dateParts[0][0]) : '',
      venue: stripTags(first(c['container-title'])) || c.publisher || '',
      url: c.URL || `https://doi.org/${doi}`,
      doi,
      abstract: stripTags(c.abstract),
      source,
    };
  }

  async function fetchJson(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Look a DOI up online: doi.org content negotiation (Crossref, DataCite, …), then the Crossref API. */
  async function lookupDoi(doi) {
    const csl = await fetchJson(`https://doi.org/${encodeURI(doi)}`, {
      headers: { Accept: 'application/vnd.citationstyles.csl+json' },
    });
    if (csl && csl.title) return fromCsl(csl, doi, 'doi.org');
    const crossref = await fetchJson(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
    if (crossref && crossref.message) return fromCsl(crossref.message, doi, 'Crossref');
    throw new Error('Could not find that DOI online. Check it, or paste the BibTeX instead.');
  }

  function fillPaperFields(meta) {
    if (meta.title) el.title.value = meta.title;
    if (meta.authors && meta.authors.length) el.authors.value = meta.authors.join('; ');
    if (meta.year) el.year.value = meta.year;
    if (meta.venue) el.venue.value = meta.venue;
    if (safeUrl(meta.url)) el.url.value = safeUrl(meta.url);
    if (meta.doi) el.doi.value = meta.doi;
    if (meta.abstract) draftAbstract = meta.abstract;
    el.title.removeAttribute('aria-invalid');
    updateLinkPreview();
  }

  let doiRequest = 0;

  async function onFetchDoi() {
    if (el.doiFetch.disabled) return; // a lookup is already running
    const doi = normalizeDoi(el.doi.value);
    if (!doi) {
      setImportStatus('That doesn’t look like a DOI. It should start with “10.”, like 10.1038/nature14539.', 'error');
      el.doi.focus();
      return;
    }
    const ticket = ++doiRequest;
    el.doiFetch.disabled = true;
    setImportStatus(`Looking up ${doi}…`, 'busy');
    Scientist.say('Let me look that up…', 2200);
    try {
      const meta = await lookupDoi(doi);
      if (ticket !== doiRequest || el.composer.hidden) return; // the form moved on meanwhile
      fillPaperFields(meta);
      const extras = meta.abstract ? ' and abstract' : '';
      setImportStatus(`Filled title, authors, year, venue${extras} from ${meta.source}. Check them, add your notes, then save.`, 'ok');
      Scientist.cheer('Found it!');
    } catch (err) {
      setImportStatus(err.message, 'error');
      Scientist.say('Hmm, no luck with that DOI.', 2600);
    } finally {
      el.doiFetch.disabled = false;
    }
  }

  const ACCENTS = { '"': '̈', "'": '́', '`': '̀', '^': '̂', '~': '̃', '=': '̄', '.': '̇', u: '̆', v: '̌', H: '̋', c: '̧', k: '̨' };
  const LATEX_LETTERS = { ss: 'ß', o: 'ø', O: 'Ø', l: 'ł', L: 'Ł', ae: 'æ', AE: 'Æ', oe: 'œ', OE: 'Œ', aa: 'å', AA: 'Å', i: 'ı' };

  function latexToText(value) {
    return String(value || '')
      .replace(/\\([`'^"~=.]|[uvHck](?![a-zA-Z]))\s*(?:\{\s*\\?([A-Za-z])\s*\}|\\?([A-Za-z]))/g,
        (m, accent, a, b) => `${a || b}${ACCENTS[accent]}`.normalize('NFC'))
      .replace(/\{?\\(ss|o|O|l|L|ae|AE|oe|OE|aa|AA|i)\}?(?![a-zA-Z])/g, (m, letter) => LATEX_LETTERS[letter])
      .replace(/\\([&%$#_{}])/g, '$1')
      .replace(/---/g, '—')
      .replace(/--/g, '–')
      .replace(/\\[a-zA-Z]+\*?\s*/g, '')
      .replace(/[{}]/g, '')
      .replace(/~/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Small BibTeX reader: first entry only; handles {…} and "…" values, nesting and # joins. */
  function parseBibtex(src) {
    const head = /@\s*([a-zA-Z]+)\s*[{(]\s*([^,\s]*)\s*,/.exec(src);
    if (!head) return null;
    const fields = {};
    const n = src.length;
    let i = head.index + head[0].length;
    while (i < n) {
      while (i < n && /[\s,]/.test(src[i])) i++;
      if (i >= n || src[i] === '}' || src[i] === ')') break;
      const keyMatch = /^([A-Za-z][\w:.-]*)\s*=\s*/.exec(src.slice(i));
      if (!keyMatch) break;
      const key = keyMatch[1].toLowerCase();
      i += keyMatch[0].length;
      let value = '';
      for (;;) {
        while (i < n && /\s/.test(src[i])) i++;
        if (src[i] === '{') {
          const start = i;
          let depth = 0;
          for (; i < n; i++) {
            if (src[i] === '{') depth++;
            else if (src[i] === '}') { depth--; if (depth === 0) { i++; break; } }
          }
          value += src.slice(start + 1, i - 1);
        } else if (src[i] === '"') {
          i++;
          const start = i;
          let depth = 0;
          for (; i < n; i++) {
            const c = src[i];
            if (c === '{') depth++;
            else if (c === '}') depth--;
            else if (c === '"' && depth === 0 && src[i - 1] !== '\\') break;
          }
          value += src.slice(start, i);
          i++;
        } else {
          const bare = /^[^,}#\s]+/.exec(src.slice(i));
          if (bare) { value += bare[0]; i += bare[0].length; }
        }
        while (i < n && /\s/.test(src[i])) i++;
        if (src[i] === '#') { i++; continue; }
        break;
      }
      fields[key] = value;
    }
    return { entryType: head[1].toLowerCase(), key: head[2], fields };
  }

  function bibAuthors(raw) {
    if (!raw) return [];
    return raw.split(/\s+and\s+/i)
      .map((name) => latexToText(name))
      .filter((name) => name && name.toLowerCase() !== 'others')
      .map((name) => {
        if (!name.includes(',')) return name;
        const [last, ...rest] = name.split(',').map((s) => s.trim());
        return `${rest.reverse().join(' ')} ${last}`.trim();
      });
  }

  function onImportBibtex() {
    const raw = el.bibtex.value.trim();
    const parsed = raw && parseBibtex(raw);
    if (!parsed || !parsed.fields.title) {
      setImportStatus('Couldn’t read that BibTeX. It should start with @article{…} or similar and include a title.', 'error');
      el.bibtex.focus();
      return;
    }
    const f = parsed.fields;
    const doi = normalizeDoi(latexToText(f.doi || '')) || '';
    fillPaperFields({
      title: latexToText(f.title),
      authors: bibAuthors(f.author || f.editor),
      year: (latexToText(f.year || f.date || '').match(/\d{4}/) || [''])[0],
      venue: latexToText(f.journal || f.journaltitle || f.booktitle || f.publisher || f.school || f.institution || f.howpublished || ''),
      url: latexToText(f.url || '') || (doi ? `https://doi.org/${doi}` : ''),
      doi,
      abstract: latexToText(f.abstract || ''),
    });
    draftBibtex = raw;
    setImportStatus('Filled from BibTeX. Check the fields, add your notes, then save.', 'ok');
    Scientist.cheer('BibTeX imported!');
  }

  function toBibtex(e) {
    if (e.bibtex) return e.bibtex;
    const lastName = ((e.authors && e.authors[0]) || 'anon').split(/\s+/).pop()
      .normalize('NFD').replace(/[^A-Za-z]/g, '').toLowerCase() || 'anon';
    const word = ((e.title.match(/[A-Za-z]{4,}/) || ['paper'])[0]).toLowerCase();
    const kind = /proceedings|conference|neurips|icml|iclr|workshop|symposium/i.test(e.venue || '') ? 'inproceedings' : 'article';
    const fields = [
      ['title', `{${e.title}}`],
      ['author', (e.authors || []).join(' and ')],
      ['year', e.year],
      [kind === 'article' ? 'journal' : 'booktitle', e.venue],
      ['doi', e.doi],
      ['url', e.url],
    ].filter(([, v]) => v);
    return `@${kind}{${lastName}${e.year || ''}${word},\n${fields.map(([k, v]) => `  ${k} = {${v}}`).join(',\n')}\n}`;
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
      ta.remove();
      return ok;
    }
  }

  /* ---------- 7. Connections panel ---------- */
  // Each type keeps its own side of the seed: papers left, ideas upper right, logs lower right.
  const SECTOR_DEG = { paper: 180, idea: -52, log: 52 };
  const RING_RX = [0, 270, 450, 600];
  const RING_RY = [0, 160, 285, 390];
  const STOPWORDS = new Set(('about above after again against among because before being below between could during '
    + 'every first focus their there these those three which while would should other using based paper study '
    + 'model models from with this that have into over under within without where when what also more most such '
    + 'than then them they very just only some many each your yours really still might maybe think thing things '
    + 'today tomorrow yesterday sketched start started notes small great better pick next whether').split(' '));

  /** The sentence in `from`'s notes where it links to `toId`, as plain text. */
  function linkSentence(from, toId) {
    const body = (from && from.body) || '';
    const at = body.indexOf(`[[${toId}|`);
    if (at < 0) return '';
    let start = at;
    while (start > 0 && !/[.!?\n]/.test(body[start - 1])) start--;
    const close = body.indexOf(']]', at);
    let end = close < 0 ? at : close + 2;
    while (end < body.length && !/[.!?\n]/.test(body[end])) end++;
    if (end < body.length && body[end] !== '\n') end++;
    return shorten(plainText(body.slice(start, end)).replace(/\s+/g, ' ').trim(), 170);
  }

  function keywordsOf(e) {
    const text = `${e.title} ${plainText(e.body)} ${e.venue || ''}`.toLowerCase();
    const words = text.match(/[\p{L}]{5,}/gu) || [];
    return new Set(words.map((w) => w.replace(/(ies|es|s)$/, '')).filter((w) => w.length >= 5 && !STOPWORDS.has(w)));
  }

  /** Entries that are not linked yet but share an author or several keywords with the seed. */
  function suggestionsFor(seed, shown) {
    const seedWords = keywordsOf(seed);
    const seedAuthors = new Set((seed.authors || []).map((a) => a.toLowerCase()));
    return state.entries
      .filter((e) => !shown.has(e.id))
      .map((e) => {
        const authors = (e.authors || []).filter((a) => seedAuthors.has(a.toLowerCase()));
        const words = [...keywordsOf(e)].filter((w) => seedWords.has(w));
        const score = authors.length * 3 + words.length;
        const reason = authors.length
          ? `Same author: ${authors.slice(0, 2).join(', ')}`
          : `Shared words: ${words.slice(0, 3).join(', ')}`;
        return { e, score, reason };
      })
      .filter((s) => s.score >= 2)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }

  function buildGraph(seedId, depth) {
    const nodes = new Map();
    nodes.set(seedId, { id: seedId, role: 'seed', ring: 0 });

    const addNeighbors = (fromId, ring, role) => {
      const { out, inc } = neighborIds(fromId);
      out.forEach((id) => {
        if (!nodes.has(id)) nodes.set(id, { id, role, ring, dir: 'out', parent: fromId });
      });
      inc.forEach((id) => {
        const n = nodes.get(id);
        if (!n) nodes.set(id, { id, role, ring, dir: 'in', parent: fromId });
        else if (n.parent === fromId && n.dir === 'out') n.dir = 'both';
      });
    };
    addNeighbors(seedId, 1, 'direct');
    if (depth >= 2) {
      [...nodes.values()].filter((n) => n.ring === 1).forEach((n) => addNeighbors(n.id, 2, 'step2'));
    }

    // Why each entry is here: the sentence that made the link.
    nodes.forEach((n) => {
      if (n.role === 'seed') return;
      n.why = n.dir === 'in' ? linkSentence(byId(n.id), n.parent) : linkSentence(byId(n.parent), n.id);
    });

    const shown = new Set(nodes.keys());
    suggestionsFor(byId(seedId), shown).forEach(({ e, reason }) => {
      nodes.set(e.id, { id: e.id, role: 'suggest', ring: depth + 1, parent: seedId, why: reason });
    });

    const edges = [];
    nodes.forEach((n) => {
      if (n.role === 'suggest') return;
      linksOf(byId(n.id)).forEach((to) => {
        const target = nodes.get(to);
        if (target && target.role !== 'suggest') edges.push({ from: n.id, to, main: n.id === seedId || to === seedId });
      });
    });
    nodes.forEach((n) => {
      if (n.role === 'suggest') edges.push({ from: seedId, to: n.id, suggest: true });
    });
    return { seedId, nodes: [...nodes.values()], edges };
  }

  // Node sizes: the centre is largest, entries further out get smaller.
  const NODE_R = { seed: 30, direct: 20, step2: 15, suggest: 15 };
  const LABEL_W = { seed: 176, direct: 150, step2: 132, suggest: 132 };
  const MOVE_MS = 620;
  let mapFrame = 0;
  let edgeKeys = new Set();
  let popTimer = 0;

  function annotationOf(e) {
    let note;
    if (e.type === 'paper') note = [shortAuthors(e.authors), e.year].filter(Boolean).join(' · ') || 'Paper';
    else if (e.type === 'idea') note = STATUS_LABEL[e.status || 'open'];
    else return formatDate(entryTime(e));
    return monthOf(e) === CURRENT_MONTH ? note : `${monthLabel(monthOf(e), true)} · ${note}`;
  }

  function relationOf(n) {
    if (n.role === 'seed') return 'Centre of the map';
    if (n.role === 'suggest') return 'Possible connection, not linked yet';
    if (n.role === 'step2') return `2 steps away, via ${shorten(byId(n.parent).title, 34)}`;
    return { out: 'The centre links to this', in: 'This links to the centre', both: 'Linked both ways' }[n.dir];
  }

  function nodeHtml(n) {
    const e = byId(n.id);
    const t = TYPES[e.type];
    const action = n.role === 'seed' ? 'Press Enter to open its card.' : 'Press Enter to centre the map here.';
    return `
      <button type="button" class="gnode gnode-${e.type} role-${n.role}" data-id="${esc(e.id)}"
        style="--r:${NODE_R[n.role]}px;--lw:${LABEL_W[n.role]}px"
        aria-label="${esc(`${t.label}: ${e.title}. ${relationOf(n)}. ${action}`)}">
        <span class="gnode-dot">${ICONS[e.type]}</span>
        <span class="gnode-label">
          <span class="gnode-title">${esc(e.title)}</span>
          <span class="gnode-note">${esc(annotationOf(e))}</span>
        </span>
      </button>`;
  }

  /** Place nodes on type sectors around the seed, then nudge apart any labels that overlap. */
  function layoutGraph(graph) {
    const fitX = clamp((el.mapScroll.clientWidth - 60) / 720, 0.6, 1); // tighter rings in a narrow panel
    const groups = new Map();
    graph.nodes.forEach((n) => {
      // Collision box: the circle plus the label underneath it.
      n.hw = Math.max(n.r, n.lw / 2) + 6;
      n.boxTop = -n.r - 4;
      n.boxBottom = n.r + 6 + n.lh + 4;
      if (n.role === 'seed') { n.x = 0; n.y = 0; return; }
      const key = `${n.ring}:${byId(n.id).type}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(n);
    });
    groups.forEach((list, key) => {
      const [ring, type] = key.split(':');
      const r = Math.min(Number(ring), 3);
      const step = list.length > 1 ? Math.min(30, 120 / (list.length - 1)) : 0;
      list.forEach((n, i) => {
        const angle = ((SECTOR_DEG[type] + step * (i - (list.length - 1) / 2)) * Math.PI) / 180;
        n.x = Math.cos(angle) * RING_RX[r] * fitX;
        n.y = Math.sin(angle) * RING_RY[r];
      });
    });

    const nodes = graph.nodes;
    for (let iter = 0; iter < 140; iter++) {
      let moved = false;
      for (let a = 0; a < nodes.length; a++) {
        for (let b = a + 1; b < nodes.length; b++) {
          const p = nodes[a];
          const q = nodes[b];
          const pcy = p.y + (p.boxTop + p.boxBottom) / 2;
          const qcy = q.y + (q.boxTop + q.boxBottom) / 2;
          const dx = q.x - p.x;
          const dy = qcy - pcy;
          const ox = p.hw + q.hw - Math.abs(dx);
          const oy = (p.boxBottom - p.boxTop) / 2 + (q.boxBottom - q.boxTop) / 2 - Math.abs(dy);
          if (ox <= 0 || oy <= 0) continue;
          moved = true;
          const pFixed = p.role === 'seed';
          const qFixed = q.role === 'seed';
          const share = pFixed || qFixed ? 1 : 0.5;
          if (ox < oy) {
            const s = (dx === 0 ? (b % 2 ? 1 : -1) : Math.sign(dx)) * ox * share;
            if (!pFixed) p.x -= s;
            if (!qFixed) q.x += s;
          } else {
            const s = (dy === 0 ? (b % 2 ? 1 : -1) : Math.sign(dy)) * oy * share;
            if (!pFixed) p.y -= s;
            if (!qFixed) q.y += s;
          }
        }
      }
      if (!moved) break;
    }

    const margin = 28;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    nodes.forEach((n) => {
      minX = Math.min(minX, n.x - n.hw);
      maxX = Math.max(maxX, n.x + n.hw);
      minY = Math.min(minY, n.y + n.boxTop);
      maxY = Math.max(maxY, n.y + n.boxBottom);
    });
    const needW = maxX - minX + margin * 2;
    const needH = maxY - minY + margin * 2;
    const boardW = Math.max(needW, el.mapScroll.clientWidth);
    const boardH = Math.max(needH, el.mapScroll.clientHeight);
    const offX = margin - minX + (boardW - needW) / 2;
    const offY = margin - minY + (boardH - needH) / 2;
    nodes.forEach((n) => { n.x += offX; n.y += offY; });
    el.board.style.width = `${boardW}px`;
    el.board.style.height = `${boardH}px`;
    graph.center = { x: (minX + maxX) / 2 + offX, y: (minY + maxY) / 2 + offY };
  }

  /** Scroll so the whole group is as centred as possible while the seed stays in view. */
  function scrollMapToFit(graph, smooth) {
    const s = el.mapScroll;
    const seed = graph.nodes[0];
    const fit = (center, seedPos, half, view) => clamp(center - view / 2, seedPos + half + 16 - view, seedPos - half - 16);
    s.scrollTo({
      left: fit(graph.center.x, seed.x, seed.hw, s.clientWidth),
      top: fit(graph.center.y, seed.y, seed.r + 40, s.clientHeight),
      behavior: smooth ? 'smooth' : 'auto',
    });
  }

  /**
   * Curve between two circles. Both ends are aimed along the curve's own tangent,
   * so the arrowhead tip sits exactly on the target circle's rim.
   */
  function edgePath(a, b, gapEnd) {
    if (![a.cx, a.cy, b.cx, b.cy].every(Number.isFinite)) return ''; // not placed yet
    const dx = b.cx - a.cx;
    const dy = b.cy - a.cy;
    const len = Math.hypot(dx, dy);
    if (len < a.r + b.r + gapEnd + 6) return '';
    const ux = dx / len;
    const uy = dy / len;
    const bend = Math.min(34, len * 0.12);
    const mx = (a.cx + b.cx) / 2 - uy * bend;
    const my = (a.cy + b.cy) / 2 + ux * bend;
    const sLen = Math.hypot(mx - a.cx, my - a.cy) || 1;
    const eLen = Math.hypot(b.cx - mx, b.cy - my) || 1;
    const sx = a.cx + ((mx - a.cx) / sLen) * (a.r + 3);
    const sy = a.cy + ((my - a.cy) / sLen) * (a.r + 3);
    const ex = b.cx - ((b.cx - mx) / eLen) * (b.r + gapEnd);
    const ey = b.cy - ((b.cy - my) / eLen) * (b.r + gapEnd);
    return `M${sx.toFixed(1)} ${sy.toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`;
  }

  // userSpaceOnUse keeps arrowheads one size whatever the stroke width; refX=10 puts the tip on the path end.
  const EDGE_DEFS = `
    <defs>
      <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto">
        <path d="M0 0.8 L10 5 L0 9.2 Z" fill="#4C4A43"/>
      </marker>
      <marker id="arrow-hot" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="11" markerHeight="11" markerUnits="userSpaceOnUse" orient="auto">
        <path d="M0 0.8 L10 5 L0 9.2 Z" fill="#2D5596"/>
      </marker>
    </defs>`;

  function drawMapEdges(fadeIn = 1) {
    const g = state.graph;
    if (!g) return;
    const nodeById = new Map(g.nodes.map((n) => [n.id, n]));
    const hot = state.mapHot;
    const settled = [];
    const fresh = [];
    g.edges.forEach((edge) => {
      const a = nodeById.get(edge.from);
      const b = nodeById.get(edge.to);
      const d = a && b ? edgePath(a, b, edge.suggest ? 4 : 2) : '';
      if (!d) return;
      const isHot = hot && (hot === edge.from || hot === edge.to);
      const cls = ['edge', edge.suggest ? 'edge-suggest' : edge.main ? 'edge-main' : 'edge-side', isHot && 'is-hot'].filter(Boolean).join(' ');
      (edgeKeys.has(`${edge.from}>${edge.to}`) ? settled : fresh).push(`<path class="${cls}" d="${d}"/>`);
    });
    el.edges.innerHTML = `${EDGE_DEFS}${settled.join('')}<g opacity="${fadeIn.toFixed(3)}">${fresh.join('')}</g>`;
    el.edges.classList.toggle('has-hot', Boolean(hot));
  }

  function renderTrail() {
    const seed = byId(state.mapSeed);
    if (!seed) return;
    const crumbs = state.mapTrail.map((id, i) => ({ id, i, e: byId(id) })).filter((c) => c.e).slice(-3);
    const back = crumbs.length
      ? `<button class="trail-back" type="button" data-trail="back" aria-label="Back to ${esc(crumbs[crumbs.length - 1].e.title)}">
           <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>Back</button>`
      : '';
    el.mapTrail.innerHTML = `${back}<ol class="trail-list">
      ${crumbs.map((c) => `<li><button class="trail-item" type="button" data-trail="${c.i}">${esc(shorten(c.e.title, 28))}</button></li>`).join('')}
      <li><span class="trail-current" aria-current="true"><span class="trail-dot" style="background:${TYPES[seed.type].chip}"></span>${esc(shorten(seed.title, 40))}</span></li>
    </ol>`;
  }

  function placeNode(n) {
    n.el.style.transform = `translate3d(${n.cx.toFixed(1)}px, ${n.cy.toFixed(1)}px, 0)`;
  }

  /** Glide every node from where it is to where the new layout wants it, redrawing edges each frame. */
  function animateMap(graph, starts) {
    cancelAnimationFrame(mapFrame);
    state.mapMoving = true;
    el.board.classList.add('is-moving');
    const t0 = performance.now();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const frame = (now) => {
      const p = reduce ? 1 : Math.min(1, (now - t0) / MOVE_MS);
      const k = 1 - (1 - p) ** 3; // ease-out cubic
      graph.nodes.forEach((n) => {
        const s = starts.get(n.id);
        n.cx = s.x + (n.x - s.x) * k;
        n.cy = s.y + (n.y - s.y) * k;
        placeNode(n);
      });
      drawMapEdges(k);
      if (graph.popId) positionPop(graph.popId);
      if (p < 1) {
        mapFrame = requestAnimationFrame(frame);
      } else {
        edgeKeys = new Set(graph.edges.map((e) => `${e.from}>${e.to}`));
        state.mapMoving = false;
        el.board.classList.remove('is-moving');
        drawMapEdges(1);
      }
    };
    mapFrame = requestAnimationFrame(frame);
  }

  /**
   * Build and lay out the graph for the current seed. Nodes that stay on screen are reused and glide to
   * their new spot; new ones grow out of `originId` (the node you clicked); the rest fade away.
   */
  function renderMap(originId = null) {
    const seed = byId(state.mapSeed);
    if (!seed || el.panel.hidden) return;
    const prev = state.graph;
    const prevPos = new Map(prev ? prev.nodes.map((n) => [n.id, { x: n.cx ?? n.x, y: n.cy ?? n.y }]) : []);
    const graph = buildGraph(seed.id, state.depth);
    state.graph = graph;
    hidePop(true);

    const existing = new Map($$('.gnode:not(.is-leaving)', el.board).map((b) => [b.dataset.id, b]));
    const keep = new Set(graph.nodes.map((n) => n.id));
    existing.forEach((b, id) => {
      if (keep.has(id)) return;
      b.classList.add('is-leaving');
      b.tabIndex = -1;
      setTimeout(() => b.remove(), 400);
      existing.delete(id);
    });

    graph.nodes.forEach((n) => {
      const holder = document.createElement('div');
      holder.innerHTML = nodeHtml(n).trim();
      const fresh = holder.firstElementChild;
      const old = existing.get(n.id);
      if (old) {
        old.className = fresh.className;
        old.style.setProperty('--r', fresh.style.getPropertyValue('--r'));
        old.style.setProperty('--lw', fresh.style.getPropertyValue('--lw'));
        old.setAttribute('aria-label', fresh.getAttribute('aria-label'));
        old.innerHTML = fresh.innerHTML;
        n.el = old;
      } else {
        fresh.classList.add('is-new');
        setTimeout(() => fresh.classList.remove('is-new'), 700);
        el.board.appendChild(fresh);
        n.el = fresh;
      }
      n.r = NODE_R[n.role];
      n.lw = LABEL_W[n.role];
      n.lh = n.el.querySelector('.gnode-label').offsetHeight;
    });
    layoutGraph(graph);

    // Keep the new centre where it was on screen, so everything else moves around it.
    const seedNode = graph.nodes[0];
    const seedWas = prevPos.get(seedNode.id);
    const shift = seedWas ? { x: seedNode.x - seedWas.x, y: seedNode.y - seedWas.y } : { x: 0, y: 0 };
    if (seedWas) {
      el.mapScroll.scrollLeft += shift.x;
      el.mapScroll.scrollTop += shift.y;
      $$('.gnode.is-leaving', el.board).forEach((b) => {
        const m = /translate3d\(([-\d.]+)px, ([-\d.]+)px/.exec(b.style.transform);
        if (m) b.style.transform = `translate3d(${Number(m[1]) + shift.x}px, ${Number(m[2]) + shift.y}px, 0)`;
      });
    } else {
      scrollMapToFit(graph, false);
    }

    const origin = (originId && prevPos.get(originId)) || seedWas || { x: seedNode.x - shift.x, y: seedNode.y - shift.y };
    const starts = new Map(graph.nodes.map((n) => {
      const p = prevPos.get(n.id) || (n.parent && prevPos.get(n.parent)) || origin;
      return [n.id, { x: p.x + shift.x, y: p.y + shift.y }];
    }));
    if (!prev) edgeKeys = new Set();
    graph.nodes.forEach((n) => { // place nodes at their start right away, so nothing draws at NaN before the first frame
      const s = starts.get(n.id);
      n.cx = s.x;
      n.cy = s.y;
      placeNode(n);
    });
    animateMap(graph, starts);
    if (seedWas) scrollMapToFit(graph, true);
    renderTrail();

    const direct = graph.nodes.filter((n) => n.role === 'direct').length;
    const step2 = graph.nodes.filter((n) => n.role === 'step2').length;
    const suggest = graph.nodes.filter((n) => n.role === 'suggest').length;
    el.mapSummary.textContent = [
      plural(direct, 'direct link'),
      state.depth === 2 ? `${step2} more 2 steps away` : '',
      suggest ? plural(suggest, 'possible connection') : '',
    ].filter(Boolean).join(' · ');
  }

  /* Popover: details for the node under the pointer or keyboard focus. */
  function graphNode(id) {
    return state.graph && state.graph.nodes.find((n) => n.id === id);
  }

  function positionPop(id) {
    const n = graphNode(id);
    if (!n) return;
    const pop = el.pop;
    const w = pop.offsetWidth;
    const h = pop.offsetHeight;
    const boardW = el.board.offsetWidth;
    const boardH = el.board.offsetHeight;
    let x = n.cx + n.r + 14;
    if (x + w > boardW - 8) x = n.cx - n.r - 14 - w;
    const y = clamp(n.cy - 26, 8, boardH - h - 8);
    pop.style.transform = `translate3d(${Math.max(8, x).toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
  }

  function showPop(id) {
    const n = graphNode(id);
    if (!n) return;
    clearTimeout(popTimer);
    const e = byId(id);
    const t = TYPES[e.type];
    el.pop.dataset.id = id;
    el.pop.className = `gpop gpop-${e.type}`;
    el.pop.innerHTML = `
      <span class="type-chip">${ICONS[e.type]}${t.label}</span>
      <p class="gpop-title">${esc(e.title)}</p>
      <p class="gpop-note">${esc(e.type === 'paper' && e.authors && e.authors.length ? [shortAuthors(e.authors), e.year, e.venue].filter(Boolean).join(' · ') : annotationOf(e))}</p>
      <p class="gpop-rel">${esc(relationOf(n))}</p>
      ${n.why ? `<p class="gpop-why">${n.role === 'suggest' ? esc(n.why) : `“${esc(n.why)}”`}</p>` : ''}
      <span class="gpop-actions">
        <button class="cnode-btn" type="button" data-map="open">Open card</button>
        ${n.role !== 'seed' ? '<button class="cnode-btn" type="button" data-map="recentre">Centre here</button>' : ''}
        ${n.role === 'suggest' ? '<button class="cnode-btn cnode-btn-strong" type="button" data-map="link">Link them</button>' : ''}
      </span>`;
    state.graph.popId = id;
    if (n.el.nextElementSibling !== el.pop) n.el.after(el.pop); // Tab from the node lands on its buttons
    positionPop(id);
    el.pop.classList.add('is-open');
  }

  function hidePop(now) {
    clearTimeout(popTimer);
    const close = () => {
      el.pop.classList.remove('is-open');
      if (state.graph) state.graph.popId = null;
    };
    if (now) close(); else popTimer = setTimeout(close, 220);
  }

  function setMapHot(id) {
    if (state.mapHot === id) return;
    state.mapHot = id;
    $$('.gnode', el.board).forEach((n) => n.classList.toggle('is-hot', n.dataset.id === id));
    $$('.card', el.list).forEach((c) => c.classList.toggle('is-hot', c.dataset.id === id));
    drawMapEdges(1);
  }

  function seedDot() {
    const node = state.mapSeed && el.board.querySelector(`.gnode.role-seed[data-id="${CSS.escape(state.mapSeed)}"]`);
    return node ? node.querySelector('.gnode-dot') : null;
  }

  function syncConnButtons() {
    $$('.conn-btn', el.list).forEach((b) => {
      b.setAttribute('aria-pressed', String(b.closest('.card').dataset.id === state.mapSeed));
    });
  }

  let closeTimer = 0;

  /** Open the side panel with the map centred on one entry. */
  function openConnections(id) {
    if (!byId(id)) return;
    const wasOpen = !el.panel.hidden && !el.panel.classList.contains('is-closing');
    clearTimeout(closeTimer);
    if (state.mapSeed !== id) state.mapTrail = wasOpen && state.mapSeed ? [...state.mapTrail, state.mapSeed] : [];
    state.mapSeed = id;
    if (!wasOpen) {
      state.graph = null;
      $$('.gnode', el.board).forEach((b) => b.remove());
    }
    el.panel.hidden = false;
    el.panel.classList.remove('is-closing');
    requestAnimationFrame(() => document.body.classList.add('map-open'));
    select(id);
    syncConnButtons();
    if (wasOpen) {
      renderMap(id);
    } else {
      renderTrail();
      el.mapSummary.textContent = '';
      setTimeout(() => renderMap(), 340); // let the panel slide most of the way open first
      el.mapHeading.focus({ preventScroll: true });
    }
    setTimeout(() => Guide.landOn(seedDot()), wasOpen ? 300 : 650);
  }

  function recentre(id) {
    if (!byId(id) || id === state.mapSeed) return;
    state.mapTrail = [...state.mapTrail, state.mapSeed];
    state.mapSeed = id;
    select(id);
    syncConnButtons();
    renderMap(id);
    setTimeout(() => Guide.landOn(seedDot()), MOVE_MS);
  }

  function goBackTo(index) {
    const id = state.mapTrail[index];
    if (!byId(id)) return;
    state.mapTrail = state.mapTrail.slice(0, index);
    state.mapSeed = id;
    select(id);
    syncConnButtons();
    renderMap(id);
    setTimeout(() => Guide.landOn(seedDot()), MOVE_MS);
  }

  function closeConnections() {
    const seedId = state.mapSeed;
    document.body.classList.remove('map-open');
    el.panel.classList.add('is-closing');
    hidePop(true);
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
      el.panel.hidden = true;
      el.panel.classList.remove('is-closing');
    }, 420);
    state.mapSeed = null;
    state.mapTrail = [];
    state.graph = null;
    state.mapHot = null;
    cancelAnimationFrame(mapFrame);
    state.mapMoving = false;
    syncConnButtons();
    Guide.goHome();
    const card = seedId && cardFor(seedId);
    if (card) $('.conn-btn', card).focus({ preventScroll: true });
  }

  /** "Link them": add a link from the seed's notes to a suggested entry. */
  function linkSuggestion(id) {
    const seed = byId(state.mapSeed);
    const target = byId(id);
    if (!seed || !target) return;
    seed.body = `${seed.body ? `${seed.body.trimEnd()}\n\n` : ''}Related: ${linkToken(target)}`;
    seed.updated = new Date().toISOString();
    persistNow();
    renderFilters();
    renderList();
    renderMap();
    Scientist.pointAtMap(`Linked! ${shorten(seed.title, 34)} → ${shorten(target.title, 34)}`);
  }

  /* ---------- 7b. Month files: download, import, GitHub sync ---------- */
  const SYNC_KEY = 'research-journal:sync';
  const SYNCED_KEY = 'research-journal:synced';
  const TOKEN_KEY = 'research-journal:token';

  function entriesOfMonth(m) {
    return state.entries.filter((e) => monthOf(e) === m).sort((a, b) => a.id.localeCompare(b.id));
  }

  function allMonths() {
    return [...new Set(state.entries.map(monthOf))].sort().reverse();
  }

  /** One month as a file: the same text is downloaded, committed to GitHub, and compared to spot changes. */
  function monthFileText(m, entries = entriesOfMonth(m)) {
    return `${JSON.stringify({ version: 1, month: m, entries }, null, 2)}\n`;
  }

  function hashText(text) {
    let h = 5381;
    for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }

  function downloadFile(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function monthMarkdown(m) {
    const list = state.entries.filter((e) => monthOf(e) === m).sort((a, b) => entryTime(a) - entryTime(b));
    const text = (body) => (body || '').trim().replace(LINK_RE, (_, id, label) => {
      const t = byId(id);
      return `*${t ? t.title : label}*`;
    });
    const linksLine = (e) => {
      const titles = linksOf(e).map(byId).filter(Boolean).map((t) => t.title);
      return titles.length ? [`Links to: ${titles.join('; ')}`, ''] : [];
    };
    const out = [`# Research Journal: ${monthLabel(m)}`, '', monthStats(m), ''];
    const section = (type, heading, render) => {
      const items = list.filter((e) => e.type === type);
      if (!items.length) return;
      out.push(`## ${heading}`, '');
      items.forEach((e) => out.push(...render(e)));
    };
    section('paper', 'Papers', (e) => [
      `### ${e.title}`, '',
      [e.authors && e.authors.length ? e.authors.join(', ') : '', e.year ? `(${e.year})` : '', e.venue ? `*${e.venue}*` : ''].filter(Boolean).join(' '),
      '',
      e.doi ? `DOI: [${e.doi}](https://doi.org/${e.doi})` : (e.url ? `Link: ${e.url}` : ''),
      '',
      ...(e.abstract ? [`> ${e.abstract}`, ''] : []),
      ...(e.body ? [text(e.body), ''] : []),
      ...linksLine(e),
    ].filter((line, i, arr) => !(line === '' && arr[i - 1] === '')));
    section('idea', 'Ideas', (e) => [
      `### ${e.title}`, '', `Status: ${STATUS_LABEL[e.status || 'open']}`, '',
      ...(e.body ? [text(e.body), ''] : []), ...linksLine(e),
    ]);
    section('log', 'Daily logs', (e) => [
      `### ${formatDate(entryTime(e))}: ${e.title}`, '',
      ...(e.body ? [text(e.body), ''] : []), ...linksLine(e),
    ]);
    return `${out.join('\n').trim()}\n`;
  }

  function downloadMonth(m, format) {
    if (format === 'md') downloadFile(`research-journal-${m}.md`, monthMarkdown(m), 'text/markdown');
    else downloadFile(`research-journal-${m}.json`, monthFileText(m), 'application/json');
    const done = `${monthLabel(m)} downloaded as ${format === 'md' ? 'Markdown' : 'JSON'}.`;
    Scientist.say(done, 2600);
    announce(done);
  }

  function downloadEverything() {
    const text = `${JSON.stringify({ version: 1, exported: new Date().toISOString(), entries: state.entries }, null, 2)}\n`;
    downloadFile(`research-journal-all-${todayISO()}.json`, text, 'application/json');
  }

  /** Merge entries from a file or from GitHub: new ones are added, newer edits win, deleted ones stay deleted. */
  function mergeEntries(incoming) {
    let added = 0;
    let updated = 0;
    incoming.filter(isValidEntry).forEach((r) => {
      const rTime = timeValue(r.updated || r.created);
      if (state.deleted[r.id] && timeValue(state.deleted[r.id]) >= rTime) return;
      const local = byId(r.id);
      const clean = { ...r, body: r.body || '', url: safeUrl(r.url) };
      if (!local) {
        state.entries.push(clean);
        added++;
      } else if (rTime > timeValue(local.updated || local.created)) {
        state.entries[state.entries.indexOf(local)] = clean;
        updated++;
      }
    });
    return { added, updated };
  }

  async function importFile(file) {
    try {
      const data = JSON.parse(await file.text());
      const list = Array.isArray(data) ? data : data.entries;
      if (!Array.isArray(list)) throw new Error('not a journal file');
      const { added, updated } = mergeEntries(list);
      persistNow();
      renderAll();
      setSyncStatus(`Imported ${file.name}: ${added} new, ${updated} updated.`, 'ok');
    } catch (err) {
      setSyncStatus('That file isn’t a Research Journal JSON export.', 'error');
    }
  }

  // --- GitHub ---------------------------------------------------------------
  function guessRepo() {
    if (!window.location.hostname.endsWith('.github.io')) return {};
    const owner = window.location.hostname.split('.')[0];
    const first = window.location.pathname.split('/').filter(Boolean)[0];
    return { owner, repo: first && !first.endsWith('.html') ? first : `${owner}.github.io` };
  }

  function syncConfig() {
    let saved = {};
    let token = '';
    try {
      saved = JSON.parse(localStorage.getItem(SYNC_KEY)) || {};
      token = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || '';
    } catch (err) { /* storage blocked */ }
    const guess = guessRepo();
    return {
      owner: saved.owner || guess.owner || '',
      repo: saved.repo || guess.repo || '',
      branch: saved.branch || 'main',
      folder: saved.folder ?? 'data',
      remember: Boolean(saved.remember),
      token,
    };
  }

  function storeSyncConfig(cfg) {
    try {
      const { token, ...rest } = cfg;
      localStorage.setItem(SYNC_KEY, JSON.stringify(rest));
      localStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
      if (token) (cfg.remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
    } catch (err) { /* storage blocked */ }
  }

  const githubReady = (cfg) => Boolean(cfg.owner && cfg.repo && cfg.token);

  // Remember each month's “updated” stamp from index.json, so later visits only fetch months that changed.
  const REMOTE_INDEX_KEY = 'research-journal:remote-index';
  function changedMonths(source, months, all) {
    if (all) return months;
    let known = {};
    try { known = (JSON.parse(localStorage.getItem(REMOTE_INDEX_KEY)) || {})[source] || {}; } catch (err) { known = {}; }
    return months.filter((x) => !x.updated || known[x.month] !== x.updated);
  }
  function rememberMonths(source, months) {
    try {
      const saved = JSON.parse(localStorage.getItem(REMOTE_INDEX_KEY)) || {};
      saved[source] = Object.fromEntries(months.map((x) => [x.month, x.updated]));
      localStorage.setItem(REMOTE_INDEX_KEY, JSON.stringify(saved));
    } catch (err) { /* storage blocked: next visit fetches everything again */ }
  }

  function syncedHashes() {
    try { return JSON.parse(localStorage.getItem(SYNCED_KEY)) || {}; } catch (err) { return {}; }
  }

  function storeSynced(map) {
    try { localStorage.setItem(SYNCED_KEY, JSON.stringify(map)); } catch (err) { /* storage blocked */ }
  }

  /** Months whose local entries differ from what was last saved to GitHub. */
  function dirtyMonths() {
    const synced = syncedHashes();
    const months = new Set([...allMonths(), ...Object.keys(synced)]);
    return [...months].filter((m) => hashText(monthFileText(m)) !== synced[m]).sort();
  }

  function toBase64(text) {
    const bytes = new TextEncoder().encode(text);
    let bin = '';
    bytes.forEach((b) => { bin += String.fromCharCode(b); });
    return btoa(bin);
  }

  function fromBase64(b64) {
    const bin = atob(String(b64).replace(/\s/g, ''));
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  }

  function ghUrl(cfg, name) {
    const filePath = [cfg.folder, name].filter(Boolean).join('/').split('/').map(encodeURIComponent).join('/');
    return `https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/contents/${filePath}`;
  }

  function ghHeaders(cfg) {
    const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    if (cfg.token) headers.Authorization = `Bearer ${cfg.token}`;
    return headers;
  }

  function ghError(status) {
    return {
      401: 'GitHub rejected the token. Check it is correct and hasn’t expired.',
      403: 'The token can’t write here. It needs “Contents: Read and write” for this repository.',
      404: 'Repository, branch or folder not found, or the token has no access to it.',
      409: 'GitHub reported a conflict. Load from GitHub first, then save again.',
      422: 'GitHub refused the file. Check the branch and folder names.',
    }[status] || `GitHub returned an error (${status}).`;
  }

  async function ghGetFile(cfg, name) {
    const res = await fetch(`${ghUrl(cfg, name)}?ref=${encodeURIComponent(cfg.branch)}`, { headers: ghHeaders(cfg), cache: 'no-store' });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(ghError(res.status));
    const data = await res.json();
    return { sha: data.sha, text: fromBase64(data.content || '') };
  }

  /** Create or update one file in the repository; returns false when it was already up to date. */
  async function ghPutFile(cfg, name, text, message) {
    const existing = await ghGetFile(cfg, name);
    if (existing && existing.text === text) return false;
    const res = await fetch(ghUrl(cfg, name), {
      method: 'PUT',
      headers: { ...ghHeaders(cfg), 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, content: toBase64(text), branch: cfg.branch, ...(existing ? { sha: existing.sha } : {}) }),
    });
    if (!res.ok) throw new Error(ghError(res.status));
    return true;
  }

  async function pushToGitHub() {
    const cfg = readSyncForm();
    storeSyncConfig(cfg);
    if (!githubReady(cfg)) {
      setSyncStatus('Fill in the owner, repository and token first.', 'error');
      return;
    }
    const months = dirtyMonths();
    if (!months.length) {
      setSyncStatus('Everything is already saved to GitHub.', 'ok');
      return;
    }
    setSyncBusy(true);
    try {
      const synced = syncedHashes();
      for (const m of months) {
        setSyncStatus(`Saving ${monthLabel(m)}…`, 'busy');
        const text = monthFileText(m);
        await ghPutFile(cfg, `${m}.json`, text, `Research journal: ${monthLabel(m)}`);
        synced[m] = hashText(text);
        storeSynced(synced);
      }
      setSyncStatus('Updating the month index…', 'busy');
      const index = await ghGetFile(cfg, 'index.json');
      const remoteCounts = new Map();
      const remoteUpdated = new Map();
      try {
        (index ? JSON.parse(index.text).months : []).forEach((x) => {
          remoteCounts.set(x.month, x.count);
          remoteUpdated.set(x.month, x.updated);
        });
      } catch (err) { /* rebuild it */ }
      const pushedAt = new Date().toISOString();
      const months2 = [...new Set([...remoteCounts.keys(), ...allMonths()])].sort().reverse();
      const indexText = `${JSON.stringify({
        version: 1,
        updated: new Date().toISOString(),
        months: months2.map((m) => ({
          month: m,
          count: entriesOfMonth(m).length || remoteCounts.get(m) || 0,
          updated: months.includes(m) ? pushedAt : (remoteUpdated.get(m) || pushedAt),
        })),
      }, null, 2)}\n`;
      await ghPutFile(cfg, 'index.json', indexText, 'Research journal: update month index');
      state.deleted = {}; // GitHub now matches, so deleted entries can't come back
      persistNow();
      setSyncStatus(`Saved ${plural(months.length, 'month')} to ${cfg.owner}/${cfg.repo}. GitHub Pages shows it within a minute or two.`, 'ok');
      Scientist.cheer('Saved to GitHub!');
    } catch (err) {
      setSyncStatus(err.message || 'Couldn’t reach GitHub. Check your connection.', 'error');
    } finally {
      setSyncBusy(false);
      updateSyncBadge();
    }
  }

  /**
   * Load saved months: first the files published next to the site (GitHub Pages, no token),
   * then the repository itself when a token is set (fresh even before Pages rebuilds).
   */
  async function pullRemote({ quiet = false } = {}) {
    const cfg = syncConfig();
    const folder = cfg.folder || 'data';
    const sources = [async () => {
      const idx = await fetchJson(`${folder}/index.json`, { cache: 'no-store' });
      if (!idx || !Array.isArray(idx.months)) return null;
      const files = await Promise.all(changedMonths('pages', idx.months, !quiet)
        .map((x) => fetchJson(`${folder}/${x.month}.json`, { cache: 'no-store' })));
      rememberMonths('pages', idx.months);
      return files;
    }];
    if (githubReady(cfg) || (!quiet && cfg.owner && cfg.repo)) {
      sources.push(async () => {
        const idx = await ghGetFile(cfg, 'index.json');
        if (!idx) return null;
        const months = JSON.parse(idx.text).months || [];
        const files = await Promise.all(changedMonths('api', months, !quiet).map((x) => ghGetFile(cfg, `${x.month}.json`)));
        rememberMonths('api', months);
        return files.filter(Boolean).map((f) => JSON.parse(f.text));
      });
    }
    let added = 0;
    let updated = 0;
    let found = false;
    let failure = '';
    const synced = syncedHashes();
    for (const load of sources) {
      try {
        const files = await load();
        if (!files) continue;
        found = true;
        files.forEach((f) => {
          if (!f || !Array.isArray(f.entries)) return;
          const r = mergeEntries(f.entries);
          added += r.added;
          updated += r.updated;
          const remote = monthFileText(f.month, [...f.entries].sort((a, b) => a.id.localeCompare(b.id)));
          if (f.month && monthFileText(f.month) === remote) synced[f.month] = hashText(remote);
        });
      } catch (err) {
        failure = err.message;
      }
    }
    storeSynced(synced);
    if (added || updated) {
      persistNow();
      renderAll();
    }
    updateSyncBadge();
    if (!quiet) {
      if (found) setSyncStatus(`Loaded from GitHub: ${added} new, ${updated} updated.`, 'ok');
      else setSyncStatus(failure || 'No saved months found yet. Save to GitHub first.', failure ? 'error' : 'ok');
    }
  }

  // --- the Save & sync dialog --------------------------------------------------
  function setSyncStatus(text, tone = 'ok') {
    if (!el.syncStatus) return;
    el.syncStatus.textContent = text;
    el.syncStatus.dataset.tone = tone;
  }

  function setSyncBusy(busy) {
    [el.syncPush, el.syncPull].forEach((b) => { if (b) b.disabled = busy; });
  }

  function readSyncForm() {
    return {
      owner: el.ghOwner.value.trim(),
      repo: el.ghRepo.value.trim(),
      branch: el.ghBranch.value.trim() || 'main',
      folder: el.ghFolder.value.trim().replace(/^\/+|\/+$/g, ''),
      token: el.ghToken.value.trim(),
      remember: el.ghRemember.checked,
    };
  }

  function updateSyncBadge() {
    if (!el.syncBadge) return;
    const cfg = syncConfig();
    const n = githubReady(cfg) ? dirtyMonths().length : 0;
    el.syncBadge.hidden = n === 0;
    el.syncBadge.textContent = String(n);
    el.syncOpen.setAttribute('aria-label', n ? `Save and sync: ${plural(n, 'month')} not saved to GitHub` : 'Save and sync');
    if (el.syncDirty) {
      el.syncDirty.textContent = githubReady(cfg)
        ? (n ? `${plural(n, 'month')} with changes not on GitHub yet.` : 'Everything is saved to GitHub.')
        : '';
    }
  }

  function openSyncDialog() {
    const cfg = syncConfig();
    el.ghOwner.value = cfg.owner;
    el.ghRepo.value = cfg.repo;
    el.ghBranch.value = cfg.branch;
    el.ghFolder.value = cfg.folder;
    el.ghToken.value = cfg.token;
    el.ghRemember.checked = cfg.remember;
    const months = allMonths();
    const pick = PAGE === 'journal' ? CURRENT_MONTH : (months.find((m) => m < CURRENT_MONTH) || CURRENT_MONTH);
    el.dlMonth.innerHTML = (months.length ? months : [CURRENT_MONTH])
      .map((m) => `<option value="${m}"${m === pick ? ' selected' : ''}>${esc(monthLabel(m))}</option>`).join('');
    setSyncStatus('');
    updateSyncBadge();
    el.syncDialog.showModal();
  }

  function bindSyncEvents() {
    if (!el.syncDialog) return;
    el.syncOpen.addEventListener('click', openSyncDialog);
    el.syncDialog.addEventListener('click', (e) => {
      if (e.target === el.syncDialog) el.syncDialog.close(); // click on the backdrop
      const dl = e.target.closest('[data-dl]');
      if (!dl) return;
      if (dl.dataset.dl === 'all') downloadEverything();
      else downloadMonth(el.dlMonth.value, dl.dataset.dl);
    });
    el.importBtn.addEventListener('click', () => el.importFile.click());
    el.importFile.addEventListener('change', () => {
      const file = el.importFile.files[0];
      if (file) importFile(file);
      el.importFile.value = '';
    });
    el.syncPush.addEventListener('click', pushToGitHub);
    el.syncPull.addEventListener('click', async () => {
      const cfg = readSyncForm();
      storeSyncConfig(cfg);
      setSyncBusy(true);
      setSyncStatus('Loading from GitHub…', 'busy');
      await pullRemote();
      setSyncBusy(false);
    });
    [el.ghOwner, el.ghRepo, el.ghBranch, el.ghFolder, el.ghToken, el.ghRemember].forEach((input) => {
      input.addEventListener('change', () => { storeSyncConfig(readSyncForm()); updateSyncBadge(); });
    });
    el.monthDownloads.forEach((b) => b.addEventListener('click', () => downloadMonth(CURRENT_MONTH, b.dataset.monthDl)));
  }

  /** What the owl or spider says when the page opens. */
  function guideGreeting(prefs) {
    const scoped = state.entries.filter(inScope).length;
    if (PAGE === 'archive') {
      const months = new Set(state.entries.filter(inScope).map(monthOf)).size;
      return scoped
        ? `Welcome to the archive: ${plural(scoped, 'entry')} across ${plural(months, 'month')}.`
        : 'The archive is empty for now. Finished months land here.';
    }
    if (prefs.lastMonth && prefs.lastMonth < CURRENT_MONTH && state.entries.some((e) => monthOf(e) === prefs.lastMonth)) {
      return `Hoo! New month. ${monthLabel(prefs.lastMonth)} is in the archive now.`;
    }
    return `Hoo! ${plural(scoped, 'entry')} so far in ${monthLabel(CURRENT_MONTH).split(' ')[0]}.`;
  }

  /* ---------- 8. Characters ---------- */
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Layout reads for the characters happen once per frame, before anything moves, to avoid forced reflows.
  const frameLayout = { journal: null, header: null, perch: null, panel: null };
  let lastMeasure = 0;
  /** Every frame while a character travels; four times a second while everyone rests. */
  function measureFrame(now = performance.now(), busy = true) {
    if (!busy && frameLayout.journal && now - lastMeasure < 250) return;
    lastMeasure = now;
    frameLayout.journal = el.journal.getBoundingClientRect();
    frameLayout.panel = document.body.classList.contains('map-open') && window.innerWidth >= 960
      ? el.panel.getBoundingClientRect() : null;
    frameLayout.header = el.header.getBoundingClientRect();
    frameLayout.perch = el.perch ? el.perch.getBoundingClientRect() : null;
  }

  /** Screen readers hear real outcomes (saved, deleted, downloaded) here; the characters' chatter stays visual. */
  function announce(text) {
    const region = $('#app-status');
    if (!region) return;
    region.textContent = '';
    setTimeout(() => { region.textContent = text; }, 60);
  }

  function setBubbleText(bubble, text) {
    bubble.textContent = text;
    bubble.dataset.w = String(bubble.offsetWidth); // measured once per message, not every frame
  }

  function bubbleShift(bubble, x) {
    const half = Number(bubble.dataset.w || bubble.offsetWidth) / 2;
    let shift = 0;
    if (x - half < 12) shift = 12 - (x - half);
    else if (x + half > window.innerWidth - 12) shift = window.innerWidth - 12 - (x + half);
    bubble.style.setProperty('--shift', `${shift}px`);
  }

  /** Dr. Pip walks the bottom edge below the cards: reads, cheers on saves, points at new links, dozes off. */
  const Scientist = (() => {
    const root = $('#scientist');
    const flip = $('.char-flip', root);
    const bubble = $('.char-bubble', root);
    const button = $('.char-hit', root);
    const SPEED = { walk: 66, hurry: 180 };
    const me = { x: -50, tx: 0, v: 0, facing: 1, moving: false, pace: 'walk', onArrive: null, state: 'walking', sleeping: false };
    let ready = false;
    let idleTimer = 0;
    let bubbleTimer = 0;

    const panelBeside = () => window.innerWidth >= 960 && document.body.classList.contains('map-open');

    function range() {
      if (window.innerWidth >= 960) {
        const r = frameLayout.journal || el.journal.getBoundingClientRect();
        return { min: Math.max(40, r.left + 30), max: r.right - 30 };
      }
      return { min: 40, max: window.innerWidth - 40 };
    }

    function setState(next) {
      me.state = next;
      root.dataset.state = next;
      root.dataset.pace = me.pace;
    }

    function scheduleIdle(ms) {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(nextIdle, ms);
    }

    function walkTo(x, pace, onArrive) {
      clearTimeout(idleTimer);
      const r = range();
      me.tx = clamp(x, r.min, r.max);
      me.pace = pace;
      me.moving = true;
      me.onArrive = onArrive || null;
      setState('walking');
    }

    function read(ms) {
      me.moving = false;
      setState('reading');
      scheduleIdle(ms);
    }

    function nextIdle() {
      if (me.sleeping) return;
      const r = range();
      if (Math.random() < 0.65) {
        let x = me.x;
        for (let tries = 0; tries < 10 && Math.abs(x - me.x) < 120; tries++) x = rnd(r.min, r.max);
        walkTo(x, 'walk', () => read(rnd(4000, 8000)));
      } else {
        read(rnd(3000, 6000));
      }
    }

    function say(text, ms = 3000) {
      setBubbleText(bubble, text);
      bubbleShift(bubble, me.x);
      bubble.classList.add('is-visible');
      clearTimeout(bubbleTimer);
      bubbleTimer = setTimeout(() => bubble.classList.remove('is-visible'), ms);
    }

    function cheer(text) {
      if (!ready) return;
      wake(true);
      me.moving = false;
      setState('cheering');
      if (text) { say(text, 2800); announce(text); }
      scheduleIdle(2400);
    }

    /** Hurry to the edge nearest the connections panel and point at it; cheer if it's closed. */
    function pointAtMap(text) {
      if (!ready) return;
      wake(true);
      if (!panelBeside()) { cheer(text); return; }
      announce(text);
      walkTo(range().max, 'hurry', () => {
        me.facing = 1;
        setState('pointing');
        say(text, 3600);
        scheduleIdle(4000);
      });
    }

    /** Stroll under an element (the entry form) and read along. */
    function watch(target) {
      if (!ready || !target) return;
      wake(true);
      const r = target.getBoundingClientRect();
      const x = clamp(r.left + r.width * 0.82, range().min, range().max);
      if (Math.abs(me.tx - x) < 30 && (me.moving || me.state === 'reading')) {
        if (!me.moving) scheduleIdle(7000);
        return;
      }
      walkTo(x, 'walk', () => read(7000));
    }

    function sleep() {
      if (me.sleeping) return;
      me.sleeping = true;
      me.moving = false;
      clearTimeout(idleTimer);
      bubble.classList.remove('is-visible');
      setState('sleeping');
    }

    function wake(quiet) {
      if (!me.sleeping) return;
      me.sleeping = false;
      setState('reading');
      if (!quiet) say('Oh! I was just… resting my eyes.', 2600);
      scheduleIdle(2000);
    }

    function greeting() {
      if (PAGE === 'archive') return 'Ah, the archives! Mind the cobwebs.';
      const h = new Date().getHours();
      if (h < 5) return 'Late-night research? Respect.';
      if (h < 12) return 'Good morning! Ready to read?';
      if (h < 17) return 'Good afternoon! What are we learning?';
      if (h < 22) return 'Good evening! Time to log the day?';
      return 'Burning the midnight oil?';
    }

    function tick(dt) {
      if (me.moving) {
        if (reduceMotion.matches) me.x = me.tx; // arrive at once
        const dx = me.tx - me.x;
        const dist = Math.abs(dx);
        me.v += (SPEED[me.pace] - me.v) * Math.min(1, dt * 3);
        const step = Math.min(me.v, dist * 3 + 20) * dt;
        if (dist > 1) me.facing = dx > 0 ? 1 : -1;
        if (dist <= Math.max(step, 1)) {
          me.x = me.tx;
          me.moving = false;
          me.v = 0;
          const done = me.onArrive;
          me.onArrive = null;
          if (done) done(); else read(4000);
        } else {
          me.x += Math.sign(dx) * step;
        }
      } else if (!me.sleeping) {
        const r = range(); // stay under the cards when the layout changes
        if (me.x < r.min - 1 || me.x > r.max + 1) me.x += (clamp(me.x, r.min, r.max) - me.x) * Math.min(1, dt * 6);
      }
      root.style.transform = `translate3d(${me.x.toFixed(1)}px, ${window.innerHeight - 4}px, 0)`;
      flip.style.transform = `scaleX(${me.facing})`;
      if (bubble.classList.contains('is-visible')) bubbleShift(bubble, me.x);
    }

    function init() {
      ready = true;
      button.addEventListener('click', () => {
        if (me.sleeping) { wake(false); return; }
        const lines = ['Correlation is not causation!', 'Have you backed up your data?', 'Cite your sources!', 'Ooh, interesting.', 'One more paper, then coffee.'];
        cheer(lines[Math.floor(Math.random() * lines.length)]);
      });
      const r = range();
      me.x = -50;
      walkTo(r.min + (r.max - r.min) * 0.45, 'hurry', () => {
        setState('cheering');
        say(greeting(), 4200);
        scheduleIdle(4600);
      });
    }

    return { init, tick, say, cheer, pointAtMap, watch, sleep, wake, busy: () => me.moving };
  })();

  /** Minerva the owl perches in the header and flies down to whichever card or map node you open. */
  const Owl = (() => {
    const root = $('#owl');
    if (!root) return null;
    const bubble = $('.char-bubble', root);
    const button = $('.char-hit', root);
    const me = { x: 0, y: 0, tilt: 0, state: 'perched', flight: null, anchor: null, sleeping: false };
    let ready = false;
    let homeTimer = 0;
    let bubbleTimer = 0;

    function perchPoint() {
      const r = frameLayout.perch || el.perch.getBoundingClientRect();
      return { x: r.left + r.width * 0.55, y: r.top + 30 * (r.height / 40) };
    }

    function landingPoint(target) {
      if (!target || !target.isConnected || target.closest('[hidden]')) return null;
      const r = target.getBoundingClientRect();
      const small = r.width < 120; // map nodes: land on top of the circle, not its corner
      let top = (frameLayout.header || el.header.getBoundingClientRect()).bottom + 56;
      let bottom = window.innerHeight - 70;
      const scroller = target.closest('.map-scroll');
      if (scroller) { // stay inside the visible part of the map
        const s = scroller.getBoundingClientRect();
        top = Math.max(top, s.top + 50);
        bottom = Math.min(bottom, s.bottom - 10);
        if (r.right < s.left + 40 || r.right > s.right + 4) return null;
      }
      if (r.top < top || r.top > bottom) return null;
      return { x: small ? r.left + r.width / 2 : r.right - 44, y: r.top + (small ? 3 : 5) };
    }

    function setState(next) {
      me.state = next;
      root.dataset.state = next;
    }

    function flyTo(getPoint, onLand) {
      const from = { x: me.x, y: me.y };
      const target = getPoint();
      if (!target) return false;
      const dist = Math.hypot(target.x - from.x, target.y - from.y);
      me.flight = { from, getPoint, onLand, t0: performance.now(), dur: clamp(dist * 1.4, 500, 1300) };
      setState('flying');
      return true;
    }

    function landOn(target) {
      if (!ready || !target) return;
      if (me.sleeping) wake(true);
      clearTimeout(homeTimer);
      if (me.anchor === target && me.state === 'landed') {
        homeTimer = setTimeout(goHome, 10000);
        return;
      }
      me.anchor = target;
      const ok = flyTo(() => landingPoint(target), () => {
        setState('landed');
        homeTimer = setTimeout(goHome, 10000);
      });
      if (!ok) me.anchor = null;
    }

    function goHome() {
      clearTimeout(homeTimer);
      me.anchor = null;
      if (me.state === 'perched' || me.state === 'sleeping') return;
      flyTo(perchPoint, () => setState(me.sleeping ? 'sleeping' : 'perched'));
    }

    function say(text, ms = 3000) {
      setBubbleText(bubble, text);
      bubbleShift(bubble, me.x);
      bubble.classList.add('is-visible');
      clearTimeout(bubbleTimer);
      bubbleTimer = setTimeout(() => bubble.classList.remove('is-visible'), ms);
    }

    function sleep() {
      if (me.sleeping) return;
      me.sleeping = true;
      clearTimeout(homeTimer);
      bubble.classList.remove('is-visible');
      if (me.state === 'flying') return; // falls asleep after landing
      setState('sleeping');
    }

    function wake(quiet) {
      if (!me.sleeping) return;
      me.sleeping = false;
      if (me.state === 'sleeping') setState(me.anchor ? 'landed' : 'perched');
      if (!quiet) say('Hoo? Oh, you’re back!', 2400);
      if (me.anchor) homeTimer = setTimeout(goHome, 6000);
    }

    function tick(now) {
      if (me.flight) {
        const f = me.flight;
        let p = f.getPoint();
        if (!p) { // target scrolled away mid-flight: head home instead
          me.anchor = null;
          f.getPoint = perchPoint;
          f.onLand = () => setState(me.sleeping ? 'sleeping' : 'perched');
          p = perchPoint();
        }
        const raw = reduceMotion.matches ? 1 : clamp((now - f.t0) / f.dur, 0, 1);
        const t = raw < 0.5 ? 2 * raw * raw : 1 - ((-2 * raw + 2) ** 2) / 2; // ease in-out
        const cx = (f.from.x + p.x) / 2;
        const cy = Math.min(f.from.y, p.y) - 70;
        me.x = (1 - t) ** 2 * f.from.x + 2 * (1 - t) * t * cx + t * t * p.x;
        me.y = (1 - t) ** 2 * f.from.y + 2 * (1 - t) * t * cy + t * t * p.y;
        const lean = raw < 0.85 ? clamp((p.x - f.from.x) / 40, -14, 14) : 0; // level out before landing
        me.tilt += (lean - me.tilt) * 0.12;
        if (raw >= 1) {
          me.flight = null;
          f.onLand();
          if (me.sleeping && me.state !== 'sleeping') setState('sleeping');
        }
      } else if (me.anchor) {
        const p = landingPoint(me.anchor);
        if (!p) goHome();
        else { me.x = p.x; me.y = p.y; }
      } else {
        const p = perchPoint();
        me.x = p.x;
        me.y = p.y;
      }
      if (!me.flight) me.tilt *= 0.85;
      root.style.setProperty('--tilt', `${me.tilt.toFixed(2)}deg`);
      root.style.transform = `translate3d(${me.x.toFixed(1)}px, ${me.y.toFixed(1)}px, 0)`;
      if (bubble.classList.contains('is-visible')) bubbleShift(bubble, me.x);
    }

    function init() {
      ready = true;
      const p = perchPoint();
      me.x = p.x;
      me.y = p.y;
      setState('perched');
      button.addEventListener('click', () => {
        if (me.sleeping) { wake(false); return; }
        const papers = state.entries.filter((e) => e.type === 'paper').length;
        const ideas = state.entries.filter((e) => e.type === 'idea' && e.status !== 'answered').length;
        const lines = [
          `Hoo! ${plural(papers, 'paper')} read so far.`,
          `Hoo! ${plural(ideas, 'open idea')} waiting for you.`,
          'Hoo! Have you written today’s log?',
        ];
        say(lines[Math.floor(Math.random() * lines.length)], 2800);
      });
      setTimeout(() => say(state.greeting, 3800), 2600);
    }

    return { init, tick, landOn, goHome, say, sleep, wake, busy: () => Boolean(me.flight || me.anchor || (me.path && me.path.length)) };
  })();

  /**
   * Kip the spider keeps the archive. It hangs from a silk thread under the header, climbs up and scuttles
   * along the top to reach a card, lowers itself onto what you open, and spins its web when idle.
   */
  const Spider = (() => {
    const root = $('#spider');
    if (!root) return null;
    const thread = $('#spider-thread');
    const web = $('#spider-web');
    const bubble = $('.char-bubble', root);
    const button = $('.char-hit', root);
    const SPEED = { climbing: 230, walking: 210, descending: 290 };
    const BODY_H = 45; // svg height on screen; the thread meets its top centre
    const me = { x: 0, y: 0, path: [], onArrive: null, anchor: null, sleeping: false, state: 'hanging' };
    let ready = false;
    let homeTimer = 0;
    let idleTimer = 0;
    let bubbleTimer = 0;

    const ceilingY = () => (frameLayout.header || el.header.getBoundingClientRect()).bottom;
    // Rest under the web; with the connections panel open, hang in the gap beside it instead of over its close button.
    const home = () => ({
      x: frameLayout.panel ? frameLayout.panel.left - 20 : window.innerWidth - 74,
      y: ceilingY() + 96,
    });

    function buildWeb() {
      const cx = 160;
      const angles = Array.from({ length: 7 }, (_, i) => Math.PI / 2 + (Math.PI / 2) * (i / 6));
      const spokes = angles.map((a) => `M${cx} 0 L${(cx + Math.cos(a) * 158).toFixed(1)} ${(Math.sin(a) * 158).toFixed(1)}`).join(' ');
      const rings = [26, 48, 70, 94, 118, 142].map((r) => angles
        .map((a, i) => `${i ? 'L' : 'M'}${(cx + Math.cos(a) * r).toFixed(1)} ${(Math.sin(a) * r).toFixed(1)}`).join(' ')).join(' ');
      web.innerHTML = `<path class="web-spokes" d="${spokes}"/><path class="web-spiral" pathLength="1" d="${rings}"/>`;
    }

    function setState(next) {
      me.state = next;
      root.dataset.state = next;
    }

    function landingPoint(target) {
      if (!target || !target.isConnected || target.closest('[hidden]')) return null;
      const r = target.getBoundingClientRect();
      const small = r.width < 120;
      let minY = ceilingY() + BODY_H + 24;
      let maxY = window.innerHeight - 30;
      const scroller = target.closest('.map-scroll');
      if (scroller) {
        const s = scroller.getBoundingClientRect();
        minY = Math.max(minY, s.top + 30);
        maxY = Math.min(maxY, s.bottom - 10);
        if (r.right < s.left + 30 || r.left > s.right - 30) return null;
      }
      const y = r.top + (small ? 3 : 8);
      if (y < minY || y > maxY) return null;
      return { x: small ? r.left + r.width / 2 : r.right - 64, y };
    }

    /** Spiders travel by thread: climb to the top, scuttle across, then lower down. */
    function travelTo(point, onArrive) {
      clearTimeout(idleTimer);
      const top = ceilingY() + BODY_H - 4;
      const path = [];
      if (Math.abs(point.x - me.x) > 4) {
        if (me.y > top + 2) path.push({ x: me.x, y: top, mode: 'climbing' });
        path.push({ x: point.x, y: top, mode: 'walking' });
      }
      const fromY = path.length ? top : me.y;
      path.push({ x: point.x, y: point.y, mode: point.y >= fromY ? 'descending' : 'climbing' });
      me.path = path;
      me.onArrive = onArrive || null;
      setState(path[0].mode);
    }

    function scheduleIdle(ms) {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        if (me.sleeping || me.anchor || me.path.length) return;
        setState('spinning');
        web.classList.remove('is-spinning');
        void web.getBoundingClientRect(); // restart the drawing animation
        web.classList.add('is-spinning');
        idleTimer = setTimeout(() => {
          if (me.state === 'spinning') setState('hanging');
          scheduleIdle(rnd(10000, 16000));
        }, 4200);
      }, ms);
    }

    function goHome() {
      clearTimeout(homeTimer);
      me.anchor = null;
      travelTo(home(), () => {
        setState(me.sleeping ? 'sleeping' : 'hanging');
        scheduleIdle(rnd(5000, 9000));
      });
    }

    function landOn(target) {
      if (!ready || !target) return;
      if (me.sleeping) wake(true);
      clearTimeout(homeTimer);
      if (me.anchor === target && me.state === 'landed') {
        homeTimer = setTimeout(goHome, 10000);
        return;
      }
      const p = landingPoint(target);
      if (!p) return;
      me.anchor = target;
      travelTo(p, () => {
        setState('landed');
        homeTimer = setTimeout(goHome, 10000);
      });
    }

    function say(text, ms = 3000) {
      setBubbleText(bubble, text);
      bubbleShift(bubble, me.x);
      bubble.classList.add('is-visible');
      clearTimeout(bubbleTimer);
      bubbleTimer = setTimeout(() => bubble.classList.remove('is-visible'), ms);
    }

    function sleep() {
      if (me.sleeping) return;
      me.sleeping = true;
      clearTimeout(homeTimer);
      clearTimeout(idleTimer);
      bubble.classList.remove('is-visible');
      if (!me.path.length) setState('sleeping');
    }

    function wake(quiet) {
      if (!me.sleeping) return;
      me.sleeping = false;
      if (me.state === 'sleeping') setState(me.anchor ? 'landed' : 'hanging');
      if (!quiet) say('Mm? Oh, a visitor!', 2400);
      if (me.anchor) homeTimer = setTimeout(goHome, 6000);
      else scheduleIdle(6000);
    }

    function tick(now, dt) {
      // Follow the card or node we're heading to (or sitting on) as it scrolls.
      if (me.anchor) {
        const p = landingPoint(me.anchor);
        if (!p) {
          goHome();
        } else if (me.path.length) {
          const last = me.path[me.path.length - 1];
          last.x = p.x;
          last.y = p.y;
          if (me.path.length > 1) me.path[me.path.length - 2].x = p.x;
        } else {
          const k = Math.min(1, dt * 12);
          me.x += (p.x - me.x) * k;
          me.y += (p.y - me.y) * k;
        }
      }

      if (me.path.length) {
        const wp = me.path[0];
        if (me.state !== wp.mode) setState(wp.mode);
        const dx = wp.x - me.x;
        const dy = wp.y - me.y;
        const dist = Math.hypot(dx, dy);
        const step = reduceMotion.matches ? Infinity : Math.min(SPEED[wp.mode], dist * 5 + 50) * dt; // eases into each stop
        if (dist <= step) {
          me.x = wp.x;
          me.y = wp.y;
          me.path.shift();
          if (!me.path.length) {
            const done = me.onArrive;
            me.onArrive = null;
            if (done) done();
            if (me.sleeping) setState('sleeping');
          }
        } else {
          me.x += (dx / dist) * step;
          me.y += (dy / dist) * step;
        }
      } else if (!me.anchor) {
        const h = home(); // stay under the web through resizes
        me.x += (h.x - me.x) * Math.min(1, dt * 4);
        me.y += (h.y - me.y) * Math.min(1, dt * 4);
      }

      const top = ceilingY();
      const length = Math.max(0, me.y - BODY_H + 4 - top);
      thread.style.transform = `translate3d(${(me.x - 0.75).toFixed(1)}px, ${top.toFixed(1)}px, 0) scaleY(${length.toFixed(1)})`;
      root.style.transform = `translate3d(${me.x.toFixed(1)}px, ${me.y.toFixed(1)}px, 0)`;
      if (bubble.classList.contains('is-visible')) bubbleShift(bubble, me.x);
    }

    function init() {
      ready = true;
      buildWeb();
      measureFrame();
      const h = home();
      me.x = h.x;
      me.y = ceilingY() + BODY_H - 30; // tucked up under the header
      setState('descending');
      travelTo({ x: h.x, y: ceilingY() + 190 }, () => {
        setState('landed');
        say(state.greeting, 4400);
        homeTimer = setTimeout(goHome, 4800);
      });
      button.addEventListener('click', () => {
        if (me.sleeping) { wake(false); return; }
        const lines = ['I keep every thread.', 'Old notes, still connected.', 'Dusty? Never. Archived.', 'Psst… try the Connections button.'];
        say(lines[Math.floor(Math.random() * lines.length)], 2600);
      });
    }

    return { init, tick, landOn, goHome, say, sleep, wake, busy: () => Boolean(me.flight || me.anchor || (me.path && me.path.length)) };
  })();

  /** Each page has one guide: the owl on this month's page, the spider in the archive. */
  const Guide = Owl || Spider;

  /** Shared animation loop and idle detection for both characters. */
  function startCharacters() {
    Scientist.init();
    Guide.init();
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      measureFrame(now, Scientist.busy() || Guide.busy()); // reads first…
      Guide.tick(now, dt); // …the owl or spider reads its target, then moves…
      Scientist.tick(dt); // …the scientist only writes
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);

    let lastActivity = Date.now();
    let asleep = false;
    const onActivity = () => {
      lastActivity = Date.now();
      if (asleep) {
        asleep = false;
        Scientist.wake(false);
        Guide.wake(true);
      }
    };
    ['mousemove', 'mousedown', 'keydown', 'touchstart', 'wheel', 'scroll'].forEach((type) => {
      window.addEventListener(type, onActivity, { passive: true });
    });
    setInterval(() => {
      if (!asleep && Date.now() - lastActivity >= SLEEP_AFTER_MS) {
        asleep = true;
        Scientist.sleep();
        Guide.sleep();
      }
    }, 1000);
  }

  /* ---------- 9. Wiring & boot ---------- */
  function bindEvents() {
    // Filters, search & dates
    el.filters.addEventListener('click', (e) => {
      const pill = e.target.closest('[data-filter]');
      if (!pill) return;
      state.filter = pill.dataset.filter;
      renderFilters();
      renderList();
    });
    let searchTimer = 0;
    el.search.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.query = el.search.value;
        renderList();
      }, 120);
    });
    const onDates = () => {
      state.dateFrom = el.dateFrom.value;
      state.dateTo = el.dateTo.value;
      renderList();
    };
    el.dateFrom.addEventListener('change', onDates);
    el.dateTo.addEventListener('change', onDates);
    el.dateClear.addEventListener('click', () => {
      el.dateFrom.value = '';
      el.dateTo.value = '';
      onDates();
      el.dateFrom.focus();
    });

    // Cards (delegated)
    el.list.addEventListener('click', async (e) => {
      const link = e.target.closest('[data-link]');
      if (link) {
        e.preventDefault();
        openEntry(link.dataset.link);
        return;
      }
      const action = e.target.closest('[data-action]');
      if (!action) return;
      const card = action.closest('.card');
      const id = card && card.dataset.id;
      const entry = id && byId(id);
      switch (action.dataset.action) {
        case 'toggle': {
          // Toggle in place so the body can slide open and closed.
          const open = !state.expanded.has(id);
          if (open) state.expanded.add(id); else state.expanded.delete(id);
          card.classList.toggle('is-open', open);
          $('.card-head', card).setAttribute('aria-expanded', String(open));
          $('.card-body-wrap', card).inert = !open;
          select(id);
          if (open) setTimeout(() => Guide.landOn(card), 200);
          break;
        }
        case 'connections':
          if (state.mapSeed === id) closeConnections();
          else openConnections(id);
          break;
        case 'edit':
          openComposer(entry);
          break;
        case 'bibtex': {
          const ok = await copyText(toBibtex(entry));
          const msg = ok ? 'BibTeX copied to your clipboard.' : 'Couldn’t copy. Your browser blocked the clipboard.';
          Scientist.say(msg, 2600);
          announce(msg);
          break;
        }
        case 'delete':
          deleteEntry(id);
          break;
        case 'download-json':
        case 'download-md':
          downloadMonth(action.dataset.month, action.dataset.action === 'download-md' ? 'md' : 'json');
          break;
        case 'clear':
          showEverything();
          renderFilters();
          renderList();
          break;
        default:
      }
    });

    // Hovering a card lights up its node in the open map
    el.list.addEventListener('mouseover', (e) => {
      if (!state.graph) return;
      const card = e.target.closest('.card');
      setMapHot(card && graphNode(card.dataset.id) ? card.dataset.id : null);
    });

    // Entry form
    el.newEntry.addEventListener('click', () => {
      if (el.composer.hidden) openComposer(null); else closeComposer();
    });
    el.cancel.addEventListener('click', closeComposer);
    el.form.addEventListener('submit', saveEntry);
    el.typeRadios.forEach((r) => r.addEventListener('change', () => setType(r.value)));
    el.form.addEventListener('input', () => Scientist.watch(el.composer));
    el.doiFetch.addEventListener('click', onFetchDoi);
    el.doi.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); onFetchDoi(); }
    });
    el.doi.addEventListener('paste', () => setTimeout(() => { if (normalizeDoi(el.doi.value)) onFetchDoi(); }, 0));
    el.bibtexImport.addEventListener('click', onImportBibtex);
    el.bibtex.addEventListener('paste', () => setTimeout(onImportBibtex, 0));
    el.title.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); el.body.focus(); }
    });
    el.body.addEventListener('input', () => { updateMention(); updateLinkPreview(); });
    el.body.addEventListener('keydown', onNotesKeydown);
    el.body.addEventListener('click', updateMention);
    el.body.addEventListener('blur', () => setTimeout(closeMention, 120));
    el.mention.addEventListener('mousedown', (e) => {
      const item = e.target.closest('[data-index]');
      e.preventDefault(); // keep focus in the textarea
      if (item) insertLink(mention.items[Number(item.dataset.index)]);
    });

    el.reset.addEventListener('click', () => {
      if (!window.confirm('Replace everything with the 3 sample entries? Your own entries will be removed.')) return;
      state.entries = sampleEntries();
      state.expanded.clear();
      state.selected = null;
      showEverything();
      closeComposer();
      if (state.mapSeed) closeConnections();
      persistNow();
      renderAll();
      Scientist.cheer('Fresh notebook!');
    });

    // Connections panel
    el.mapClose.addEventListener('click', closeConnections);
    el.panel.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); closeConnections(); }
    });
    el.depthRadios.forEach((r) => r.addEventListener('change', () => {
      state.depth = Number(r.value);
      renderMap();
    }));
    el.mapTrail.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-trail]');
      if (!btn) return;
      goBackTo(btn.dataset.trail === 'back' ? state.mapTrail.length - 1 : Number(btn.dataset.trail));
    });
    // Map: clicking a node re-centres on it (the centre itself opens its card); the popover holds the details.
    let tapPointer = 'mouse';
    let popBeforeTap = null;
    el.board.addEventListener('pointerdown', (e) => {
      tapPointer = e.pointerType;
      popBeforeTap = el.pop.classList.contains('is-open') ? el.pop.dataset.id : null;
    });
    el.board.addEventListener('click', (e) => {
      const action = e.target.closest('[data-map]');
      if (action) {
        const id = el.pop.dataset.id;
        if (action.dataset.map === 'recentre') recentre(id);
        else if (action.dataset.map === 'open') openEntry(id);
        else if (action.dataset.map === 'link') linkSuggestion(id);
        return;
      }
      const node = e.target.closest('.gnode');
      if (!node || node.classList.contains('is-leaving')) return;
      if (tapPointer === 'touch' && popBeforeTap !== node.dataset.id) { // no hover on touch screens
        setMapHot(node.dataset.id);
        showPop(node.dataset.id);
        return;
      }
      if (node.dataset.id === state.mapSeed) openEntry(node.dataset.id);
      else recentre(node.dataset.id);
    });
    el.board.addEventListener('mouseover', (e) => {
      if (e.target.closest('.gpop')) { clearTimeout(popTimer); return; }
      if (state.mapMoving) return; // nodes gliding under a still pointer shouldn't pop up details
      const node = e.target.closest('.gnode:not(.is-leaving)');
      setMapHot(node ? node.dataset.id : null);
      if (node) showPop(node.dataset.id); else hidePop(false);
    });
    el.board.addEventListener('mouseleave', () => {
      setMapHot(null);
      hidePop(false);
    });
    el.board.addEventListener('focusin', (e) => {
      const node = e.target.closest('.gnode');
      if (node) { setMapHot(node.dataset.id); showPop(node.dataset.id); }
      else if (e.target.closest('.gpop')) clearTimeout(popTimer);
    });
    el.board.addEventListener('focusout', (e) => {
      if (!el.board.contains(e.relatedTarget)) { setMapHot(null); hidePop(false); }
    });

    // Re-layout the map when the panel changes size
    let resizeTimer = 0;
    new ResizeObserver(() => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { if (state.mapSeed) renderMap(); }, 150);
    }).observe(el.mapScroll);

    // Every change is saved as it happens, so closing a tab never needs to write (and can't clobber another tab).
    // When another tab saves, reload from storage instead.
    window.addEventListener('storage', (e) => {
      if (e.key !== STORAGE_KEY) return;
      state.entries = loadEntries();
      state.deleted = loadDeleted();
      renderAll();
    });

    // A tab left open over the turn of a month moves to the new month when you come back to it.
    document.addEventListener('visibilitychange', () => {
      const now = monthKey(Date.now());
      if (document.visibilityState !== 'visible' || now === CURRENT_MONTH) return;
      CURRENT_MONTH = now;
      if (el.pageEyebrow && PAGE === 'journal') el.pageEyebrow.textContent = monthLabel(CURRENT_MONTH);
      renderAll();
    });
  }

  function boot() {
    el.headerDate.textContent = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    state.entries = loadEntries();
    state.deleted = loadDeleted();
    const prefs = loadPrefs();
    state.greeting = guideGreeting(prefs);
    savePrefs({ ...prefs, lastMonth: CURRENT_MONTH });
    if (el.pageEyebrow && PAGE === 'journal') el.pageEyebrow.textContent = monthLabel(CURRENT_MONTH);
    bindEvents();
    bindSyncEvents();
    renderAll();
    persistNow();
    startCharacters();
    openFromHash();
    window.addEventListener('hashchange', openFromHash);
    pullRemote({ quiet: true }); // pick up months saved to GitHub from another computer
  }

  boot();
})();
