/* =========================================================
   anotetoself · IDEA FILE (idea.html?id=…)
   ========================================================= */
(() => {
  'use strict';
  const { $, esc, uid, svgUse, toast, burstFrom, restart, fmt, autosize, IDEA_STATUSES, ideaStatus } = J;

  const id = new URLSearchParams(location.search).get('id');
  const idea = id && J.ideas.get(id);
  if (!idea) { $('#notFound').hidden = false; return; }
  $('#detail').hidden = false;

  /* ---------- saving ---------- */
  const saveState = $('#saveState');
  let saveTimer;
  function save() {
    J.touchIdea(idea);
    paintMeta();
    saveState.textContent = 'saved ✓';
    saveState.classList.add('on');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveState.classList.remove('on'), 1200);
  }
  const saveSoon = J.debounce(save, 350);

  function paintMeta() {
    $('#ideaMeta').innerHTML = `<span>started ${esc(fmt.date.format(new Date(idea.created)))}</span><span>last touched ${esc(J.ago(idea.updated))}</span>`;
  }
  function paintTone() {
    $('#ideaMain').style.setProperty('--tone', ideaStatus(idea.status).tone);
  }
  function paintTitle() {
    document.title = `${idea.title || 'idea'} · anotetoself`;
  }

  /* ---------- text fields ---------- */
  const title = $('#ideaTitle');
  title.value = idea.title;
  title.addEventListener('input', () => { idea.title = title.value.trim() || 'untitled idea'; paintTitle(); saveSoon(); });

  [['#ideaSummary', 'summary'], ['#ideaHypothesis', 'hypothesis'], ['#ideaNext', 'nextStep']].forEach(([sel, key]) => {
    const el = $(sel);
    el.value = idea[key];
    if (el.tagName === 'TEXTAREA') { autosize(el); el.addEventListener('input', () => autosize(el)); }
    el.addEventListener('input', () => { idea[key] = el.value; saveSoon(); });
  });

  /* ---------- status ---------- */
  const picker = $('#statusPicker');
  function paintStatus() {
    picker.innerHTML = IDEA_STATUSES.map(s =>
      `<button type="button" class="status-pill press" data-status="${s.id}" style="--tone:${s.tone}" aria-pressed="${s.id === idea.status}">${s.icon} ${s.label}</button>`).join('');
  }
  picker.addEventListener('click', e => {
    const b = e.target.closest('[data-status]');
    if (!b || b.dataset.status === idea.status) return;
    idea.status = b.dataset.status;
    paintStatus(); paintTone(); save();
    if (idea.status === 'done') { burstFrom(b, 16, 120); toast('idea complete ✓ nice work'); }
  });

  /* ---------- tags ---------- */
  const tagEditor = $('#tagEditor'), tagInput = $('#tagInput');
  function paintTags() {
    tagEditor.querySelectorAll('.tag').forEach(t => t.remove());
    tagInput.insertAdjacentHTML('beforebegin', idea.tags.map(t =>
      `<span class="tag">#${esc(t)} <button type="button" data-untag="${esc(t)}" aria-label="Remove tag ${esc(t)}">×</button></span>`).join(''));
  }
  tagEditor.addEventListener('click', e => {
    const b = e.target.closest('[data-untag]');
    if (!b) return;
    idea.tags = idea.tags.filter(t => t !== b.dataset.untag);
    paintTags(); save();
  });
  function addTags() {
    const fresh = J.parseTags(tagInput.value).filter(t => !idea.tags.includes(t));
    tagInput.value = '';
    if (!fresh.length) return;
    idea.tags.push(...fresh);
    paintTags(); save();
  }
  tagInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTags(); }
    if (e.key === 'Backspace' && !tagInput.value && idea.tags.length) { idea.tags.pop(); paintTags(); save(); }
  });
  tagInput.addEventListener('blur', addTags);

  /* ---------- open questions ---------- */
  const qList = $('#questionList');
  function questionEl(q, isNew) {
    const li = document.createElement('li');
    li.className = 'need' + (q.done ? ' done' : '') + (isNew ? ' is-new' : '');
    li.innerHTML = `
      <button type="button" class="check" role="checkbox" aria-checked="${q.done}" aria-label="${esc(q.text)}">${svgUse('i-check')}</button>
      <span>${esc(q.text)}</span>
      <button type="button" class="del" aria-label="Remove question">${svgUse('i-x', 14)}</button>`;
    const chk = li.querySelector('.check');
    chk.addEventListener('click', () => {
      q.done = !q.done;
      li.classList.toggle('done', q.done);
      chk.setAttribute('aria-checked', String(q.done));
      save();
      if (q.done) burstFrom(chk, 6, 50);
    });
    li.querySelector('.del').addEventListener('click', () => {
      idea.questions = idea.questions.filter(x => x.id !== q.id);
      save();
      J.animateOut(li);
    });
    return li;
  }
  function paintQuestions() {
    qList.replaceChildren(...idea.questions.map(q => questionEl(q)));
  }
  $('#questionForm').addEventListener('submit', e => {
    e.preventDefault();
    const input = $('#questionInput');
    const text = input.value.trim();
    if (!text) return input.focus();
    const q = { id: uid(), text, done: false };
    idea.questions.push(q);
    save();
    qList.appendChild(questionEl(q, true));
    input.value = '';
  });

  /* ---------- research notes ---------- */
  const noteList = $('#noteList'), noteText = $('#noteText');
  function paintNotes(newId) {
    const notes = [...idea.notes].sort((a, b) => b.ts.localeCompare(a.ts));
    noteList.replaceChildren(...notes.map(n => J.entryEl(n, { isNew: n.id === newId, onDelete: deleteNote })));
    if (!notes.length) noteList.appendChild(J.emptyEl('no notes yet — what have you noticed?'));
    $('#noteCount').textContent = `${notes.length} note${notes.length === 1 ? '' : 's'}`;
  }
  function deleteNote(n, li) {
    const index = idea.notes.findIndex(x => x.id === n.id);
    idea.notes.splice(index, 1);
    save();
    J.animateOut(li, () => paintNotes());
    toast('note deleted', { label: 'undo', onClick: () => { idea.notes.splice(index, 0, n); save(); paintNotes(); } });
  }
  noteText.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); $('#noteForm').requestSubmit(); }
  });
  $('#noteForm').addEventListener('submit', e => {
    e.preventDefault();
    const text = noteText.value.trim();
    if (!text) { restart(noteText, 'shake'); return noteText.focus(); }
    const n = { id: uid(), text, ts: J.nowIso() };
    idea.notes.push(n);
    save();
    noteText.value = '';
    paintNotes(n.id);
    burstFrom($('#noteBtn'), 10, 90);
  });

  /* ---------- sources ---------- */
  const srcList = $('#sourceList'), srcPick = $('#sourcePick');
  function paintSources() {
    idea.sourceIds = idea.sourceIds.filter(sid => J.sources.get(sid));
    const linked = idea.sourceIds.map(sid => J.sources.get(sid));
    srcList.innerHTML = linked.map(s => {
      const url = J.safeUrl(s.url);
      const name = url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a>` : esc(s.title);
      const meta = [s.authors, s.year, J.sourceStatus(s.status).label].filter(Boolean).join(' · ');
      return `<li><span><span class="t">${name}</span><span class="m">${esc(meta)}</span></span>
        <button type="button" class="del" data-unlink="${esc(s.id)}" aria-label="Unlink ${esc(s.title)}">${svgUse('i-x', 14)}</button></li>`;
    }).join('') || `<li class="muted" style="display:block">no sources linked yet</li>`;

    const unlinked = J.sources.all().filter(s => !idea.sourceIds.includes(s.id));
    srcPick.innerHTML = unlinked.length
      ? `<option value="">link from library…</option>` + unlinked.map(s => `<option value="${esc(s.id)}">${esc(s.title)}</option>`).join('')
      : `<option value="">library is empty — add one below</option>`;
    srcPick.disabled = $('#linkSource').disabled = !unlinked.length;
  }
  srcList.addEventListener('click', e => {
    const b = e.target.closest('[data-unlink]');
    if (!b) return;
    idea.sourceIds = idea.sourceIds.filter(sid => sid !== b.dataset.unlink);
    save(); paintSources();
  });
  $('#linkSource').addEventListener('click', () => {
    if (!srcPick.value) return srcPick.focus();
    idea.sourceIds.push(srcPick.value);
    save(); paintSources();
  });
  $('#quickSource').addEventListener('submit', e => {
    e.preventDefault();
    const t = $('#qsTitle').value.trim();
    if (!t) return $('#qsTitle').focus();
    const s = J.sources.add({ id: uid(), title: t, authors: '', year: '', url: J.safeUrl($('#qsUrl').value), status: 'to-read', tags: [], notes: '', added: J.nowIso() });
    idea.sourceIds.push(s.id);
    e.target.reset();
    save(); paintSources();
    toast('added to your library + linked 📚');
  });

  /* ---------- related log entries ---------- */
  function paintLog() {
    const related = J.entries.all().filter(en => en.ideaId === idea.id).slice(0, 8);
    const list = $('#relatedLog');
    list.replaceChildren(...related.map(en => J.entryEl({ ...en, ideaId: null })));
    if (!related.length) list.appendChild(J.emptyEl('no log entries tagged with this idea yet'));
    $('#writeLog').href = `log.html?idea=${encodeURIComponent(idea.id)}`;
  }

  /* ---------- delete ---------- */
  $('#deleteIdea').addEventListener('click', () => {
    if (!confirm(`Delete “${idea.title}” and all its notes? Log entries stay, just untagged.`)) return;
    J.ideas.remove(idea.id);
    location.href = 'ideas.html';
  });

  paintTitle(); paintTone(); paintStatus(); paintTags(); paintQuestions(); paintNotes(); paintSources(); paintLog(); paintMeta();
})();
