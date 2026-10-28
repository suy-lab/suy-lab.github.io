/* =========================================================
   anotetoself · READING LIBRARY
   ========================================================= */
(() => {
  'use strict';
  const { $, esc, uid, svgUse, toast, burstFrom, restart, autosize, SOURCE_STATUSES, sourceStatus } = J;

  const listEl = $('#libList');
  let statusFilter = '';
  let query = '';
  let justAdded = null;

  const linkedIdeas = s => J.ideas.all().filter(i => i.sourceIds.includes(s.id));

  /* ---------- filters ---------- */
  function renderChips() {
    const all = J.sources.all();
    $('#statusChips').innerHTML =
      `<button type="button" class="chip press" data-status="" aria-pressed="${!statusFilter}">all <small>${all.length}</small></button>` +
      SOURCE_STATUSES.map(s =>
        `<button type="button" class="chip press" data-status="${s.id}" aria-pressed="${s.id === statusFilter}">${s.label} <small>${all.filter(x => x.status === s.id).length}</small></button>`).join('');
  }
  $('#statusChips').addEventListener('click', e => {
    const b = e.target.closest('[data-status]');
    if (!b) return;
    statusFilter = b.dataset.status;
    renderChips(); render();
  });
  $('#libSearch').addEventListener('input', J.debounce(e => { query = e.target.value.trim().toLowerCase(); render(); }, 150));

  /* ---------- cards ---------- */
  function sourceEl(s) {
    const st = sourceStatus(s.status);
    const url = J.safeUrl(s.url);
    const ideas = linkedIdeas(s);
    const unlinked = J.ideasByRecent().filter(i => !i.sourceIds.includes(s.id));
    const el = document.createElement('article');
    el.className = 'card sketch press source-card' + (s.id === justAdded ? ' is-new' : '');
    el.innerHTML = `
      <div class="source-head">
        <h3>${url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)} ↗</a>` : esc(s.title)}</h3>
        <button type="button" class="status-btn press" style="--tone:${st.tone}" title="click to change status">${esc(st.label)}</button>
        <button type="button" class="del" aria-label="Delete ${esc(s.title)}">${svgUse('i-x', 16)}</button>
      </div>
      <div class="src-meta">${esc([s.authors, s.year].filter(Boolean).join(' · ') || 'no author yet')}</div>
      ${s.tags.length ? `<div>${s.tags.map(t => `<span class="tag">#${esc(t)}</span>`).join('')}</div>` : ''}
      <label class="sr-only" for="n-${esc(s.id)}">Notes on ${esc(s.title)}</label>
      <textarea class="paper-input small" id="n-${esc(s.id)}" maxlength="6000" placeholder="key takeaways, quotes, page numbers…"></textarea>
      <div class="linked">
        <span class="muted">ideas:</span>
        ${ideas.map(i => `<a class="tag" href="${J.ideaHref(i.id)}">💡 ${esc(i.title)}</a>`).join('') || '<span class="muted">none yet</span>'}
        ${unlinked.length ? `<select class="select" aria-label="Link to an idea"><option value="">+ link idea…</option>${unlinked.map(i => `<option value="${esc(i.id)}">${esc(i.title)}</option>`).join('')}</select>` : ''}
      </div>`;

    const notes = el.querySelector('textarea');
    notes.value = s.notes || '';
    requestAnimationFrame(() => autosize(notes));
    notes.addEventListener('input', () => autosize(notes));
    notes.addEventListener('input', J.debounce(() => { s.notes = notes.value; J.sources.save(); }, 350));

    el.querySelector('.status-btn').addEventListener('click', ev => {
      const idx = SOURCE_STATUSES.findIndex(x => x.id === s.status);
      s.status = SOURCE_STATUSES[(idx + 1) % SOURCE_STATUSES.length].id;
      J.sources.save();
      const b = ev.currentTarget;
      b.textContent = sourceStatus(s.status).label;
      b.style.setProperty('--tone', sourceStatus(s.status).tone);
      if (s.status === 'read') burstFrom(b, 10, 80);
      renderChips();
    });

    el.querySelector('.del').addEventListener('click', () => {
      const removed = J.sources.remove(s.id);
      J.animateOut(el, () => { renderChips(); if (!listEl.children.length) render(); });
      toast('source removed', { label: 'undo', onClick: () => { J.sources.restore(removed); renderChips(); render(); } });
    });

    el.querySelector('select')?.addEventListener('change', ev => {
      const idea = J.ideas.get(ev.target.value);
      if (!idea) return;
      idea.sourceIds.push(s.id);
      J.touchIdea(idea);
      render();
      toast(`linked to “${idea.title}”`);
    });
    return el;
  }

  function render() {
    const items = J.sources.all().filter(s =>
      (!statusFilter || s.status === statusFilter) &&
      (!query || [s.title, s.authors, s.year, s.notes, s.tags.join(' ')].join(' ').toLowerCase().includes(query)));
    listEl.replaceChildren(...items.map(sourceEl));
    if (!items.length) listEl.appendChild(J.emptyEl(query || statusFilter ? 'nothing on this shelf matches' : 'the shelf is empty — add your first source', 'div'));
    justAdded = null;
  }

  /* ---------- add ---------- */
  function fillIdeaSelect() { $('#srcIdea').innerHTML = J.ideaOptions('', '— none —'); }
  $('#sourceForm').addEventListener('submit', e => {
    e.preventDefault();
    const title = $('#srcTitle').value.trim();
    if (!title) return restart($('.add-source'), 'shake');
    const rawUrl = $('#srcUrl').value.trim();
    const url = J.safeUrl(rawUrl);
    if (rawUrl && !url) { toast('links need to start with http:// or https://'); return $('#srcUrl').focus(); }
    const s = J.sources.add({
      id: uid(), title, url, status: 'to-read', notes: '', added: J.nowIso(),
      authors: $('#srcAuthors').value.trim(),
      year: $('#srcYear').value.trim(),
      tags: J.parseTags($('#srcTags').value)
    });
    const idea = J.ideas.get($('#srcIdea').value);
    if (idea) { idea.sourceIds.push(s.id); J.touchIdea(idea); }
    justAdded = s.id;
    e.target.reset();
    fillIdeaSelect();
    statusFilter = ''; query = ''; $('#libSearch').value = '';
    renderChips(); render();
    burstFrom($('#srcBtn'), 12, 100);
    toast('shelved ✓');
  });

  // older data may lack tags
  J.sources.all().forEach(s => { if (!Array.isArray(s.tags)) s.tags = []; });
  fillIdeaSelect();
  renderChips();
  render();
})();
