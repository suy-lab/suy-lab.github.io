/* =========================================================
   anotetoself · IDEAS board
   ========================================================= */
(() => {
  'use strict';
  const { $, esc, toast, burstFrom, restart, IDEA_STATUSES, ideaStatus } = J;

  const board = $('#board');
  const search = $('#ideaSearch');
  let query = '';
  let tagFilter = null;
  let justAdded = null;

  function haystack(i) {
    return [i.title, i.summary, i.hypothesis, i.nextStep, i.tags.join(' '), ...i.notes.map(n => n.text), ...i.questions.map(q => q.text)]
      .join(' ').toLowerCase();
  }
  const visible = () => J.ideas.all().filter(i =>
    (!tagFilter || i.tags.includes(tagFilter)) && (!query || haystack(i).includes(query)));

  /* ---------- tag chips ---------- */
  function renderTags() {
    const counts = {};
    J.ideas.all().forEach(i => i.tags.forEach(t => { counts[t] = (counts[t] || 0) + 1; }));
    const tags = Object.keys(counts).sort();
    if (tagFilter && !counts[tagFilter]) tagFilter = null;
    const wrap = $('#tagChips');
    wrap.innerHTML = tags.length
      ? `<button type="button" class="chip press" data-tag="" aria-pressed="${!tagFilter}">all tags</button>` +
        tags.map(t => `<button type="button" class="chip press" data-tag="${esc(t)}" aria-pressed="${t === tagFilter}">#${esc(t)} <small>${counts[t]}</small></button>`).join('')
      : '';
  }
  $('#tagChips').addEventListener('click', e => {
    const b = e.target.closest('[data-tag]');
    if (!b) return;
    tagFilter = b.dataset.tag || null;
    renderTags();
    renderBoard();
  });

  /* ---------- cards ---------- */
  function cardHtml(i, colIndex) {
    const s = ideaStatus(i.status);
    const open = i.questions.filter(q => !q.done).length;
    const prev = IDEA_STATUSES[colIndex - 1], next = IDEA_STATUSES[colIndex + 1];
    return `
      <article class="idea-card sketch press${i.id === justAdded ? ' is-new' : ''}" draggable="true" data-id="${esc(i.id)}" style="--tone:${s.tone}">
        <h3><a href="${J.ideaHref(i.id)}" draggable="false">${esc(i.title)}</a></h3>
        ${i.summary ? `<p>${esc(i.summary)}</p>` : ''}
        ${i.tags.length ? `<div class="tags">${i.tags.map(t => `<span class="tag">#${esc(t)}</span>`).join('')}</div>` : ''}
        <div class="card-meta">
          <span title="notes · open questions · sources">📝 ${i.notes.length} · ❓ ${open} · 📚 ${i.sourceIds.filter(id => J.sources.get(id)).length}</span>
          <span>${J.ago(i.updated)}</span>
        </div>
        <div class="move">
          <button type="button" data-move="-1" ${prev ? `aria-label="Move to ${prev.label}"` : 'disabled'}>‹</button>
          <button type="button" data-move="1" ${next ? `aria-label="Move to ${next.label}"` : 'disabled'}>›</button>
        </div>
      </article>`;
  }

  function renderBoard() {
    const items = visible();
    board.innerHTML = IDEA_STATUSES.map((s, ci) => {
      const col = items.filter(i => i.status === s.id).sort((a, b) => b.updated.localeCompare(a.updated));
      return `
        <section class="column" id="${s.id}" data-status="${s.id}" style="--tone:${s.tone}" aria-label="${s.label}">
          <div class="col-head"><span class="dot"></span>${s.icon} ${s.label}<span class="count">${col.length}</span></div>
          ${col.map(i => cardHtml(i, ci)).join('') || `<div class="col-empty">${query || tagFilter ? 'no matches' : 'drop ideas here'}</div>`}
        </section>`;
    }).join('');
    const total = J.ideas.all().length;
    $('#ideaCount').textContent = items.length === total ? `${total} ideas` : `${items.length} of ${total} ideas`;
    justAdded = null;
  }

  function moveIdea(id, status, fromEl) {
    const idea = J.ideas.get(id);
    if (!idea || idea.status === status) return;
    idea.status = status;
    J.touchIdea(idea);
    renderBoard();
    const card = board.querySelector(`[data-id="${CSS.escape(id)}"]`);
    if (card) restart(card, 'is-new');
    if (status === 'done') {
      burstFrom(card || fromEl || board, 16, 120);
      toast('idea complete ✓ nice work');
    } else {
      toast(`moved to ${ideaStatus(status).label}`);
    }
  }

  board.addEventListener('click', e => {
    const b = e.target.closest('[data-move]');
    if (!b) return;
    const card = b.closest('.idea-card');
    const idea = J.ideas.get(card.dataset.id);
    const idx = IDEA_STATUSES.findIndex(s => s.id === idea.status) + Number(b.dataset.move);
    if (IDEA_STATUSES[idx]) moveIdea(idea.id, IDEA_STATUSES[idx].id, card);
  });

  /* ---------- drag and drop ---------- */
  board.addEventListener('dragstart', e => {
    const card = e.target.closest('.idea-card');
    if (!card) return;
    e.dataTransfer.setData('text/plain', card.dataset.id);
    e.dataTransfer.effectAllowed = 'move';
    requestAnimationFrame(() => card.classList.add('dragging'));
  });
  board.addEventListener('dragend', e => e.target.closest?.('.idea-card')?.classList.remove('dragging'));
  board.addEventListener('dragover', e => {
    const col = e.target.closest('.column');
    if (!col) return;
    e.preventDefault();
    board.querySelectorAll('.drag-over').forEach(c => c !== col && c.classList.remove('drag-over'));
    col.classList.add('drag-over');
  });
  board.addEventListener('dragleave', e => {
    const col = e.target.closest('.column');
    if (col && !col.contains(e.relatedTarget)) col.classList.remove('drag-over');
  });
  board.addEventListener('drop', e => {
    const col = e.target.closest('.column');
    if (!col) return;
    e.preventDefault();
    col.classList.remove('drag-over');
    moveIdea(e.dataTransfer.getData('text/plain'), col.dataset.status, col);
  });

  /* ---------- new idea + search ---------- */
  $('#newIdeaForm').addEventListener('submit', e => {
    e.preventDefault();
    const title = $('#newTitle').value.trim();
    if (!title) return restart($('.new-idea'), 'shake');
    const idea = J.ideas.add(J.makeIdea({ title, tags: J.parseTags($('#newTags').value) }));
    justAdded = idea.id;
    e.target.reset();
    renderTags();
    renderBoard();
    burstFrom($('#newIdeaBtn'), 12, 100);
    toast('new spark on the board ✦', { label: 'open →', onClick: () => { location.href = J.ideaHref(idea.id); } });
  });

  search.addEventListener('input', J.debounce(() => { query = search.value.trim().toLowerCase(); renderBoard(); }, 150));

  renderTags();
  renderBoard();
  if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: 'nearest', inline: 'center' });
})();
