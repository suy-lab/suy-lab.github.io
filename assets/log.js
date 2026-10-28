/* =========================================================
   anotetoself · RESEARCH LOG
   ========================================================= */
(() => {
  'use strict';
  const { $, $$, esc, uid, toast, burstFrom, restart, fmt } = J;

  const form = $('#logForm'), text = $('#logText'), ideaSel = $('#logIdea');
  const groups = $('#logGroups');
  const preset = new URLSearchParams(location.search).get('idea');
  let mood = '';
  let query = '';
  let month = null; // "YYYY-M"
  let ideaFilter = preset && J.ideas.get(preset) ? preset : '';

  const monthKey = d => `${d.getFullYear()}-${d.getMonth()}`;

  /* ---------- filters ---------- */
  function renderFilters() {
    const keys = [...new Set(J.entries.all().map(e => monthKey(new Date(e.ts))))];
    if (month && !keys.includes(month)) month = null;
    $('#monthChips').innerHTML =
      `<button type="button" class="chip press" data-month="" aria-pressed="${!month}">all</button>` +
      keys.map(k => {
        const [y, m] = k.split('-').map(Number);
        return `<button type="button" class="chip press" data-month="${k}" aria-pressed="${k === month}">${esc(fmt.month.format(new Date(y, m, 1)).toLowerCase())}</button>`;
      }).join('');
    $('#filterIdea').innerHTML = J.ideaOptions(ideaFilter, 'all ideas');
    ideaSel.innerHTML = J.ideaOptions(ideaSel.value || preset);
  }
  $('#monthChips').addEventListener('click', e => {
    const b = e.target.closest('[data-month]');
    if (!b) return;
    month = b.dataset.month || null;
    renderFilters();
    render();
  });
  $('#filterIdea').addEventListener('change', e => { ideaFilter = e.target.value; render(); });
  $('#logSearch').addEventListener('input', J.debounce(e => { query = e.target.value.trim().toLowerCase(); render(); }, 150));

  /* ---------- timeline ---------- */
  function onDelete(e, li) {
    const removed = J.entries.remove(e.id);
    J.animateOut(li, () => { renderFilters(); render(); });
    toast('entry deleted', { label: 'undo', onClick: () => { J.entries.restore(removed); renderFilters(); render(); } });
  }

  function render(newId) {
    const list = J.entries.all().filter(e => {
      if (month && monthKey(new Date(e.ts)) !== month) return false;
      if (ideaFilter && e.ideaId !== ideaFilter) return false;
      if (query) {
        const idea = e.ideaId && J.ideas.get(e.ideaId);
        if (!(e.text + ' ' + (idea ? idea.title : '')).toLowerCase().includes(query)) return false;
      }
      return true;
    });

    groups.replaceChildren();
    let currentDay = null, ul = null;
    for (const e of list) {
      const d = new Date(e.ts);
      if (d.toDateString() !== currentDay) {
        currentDay = d.toDateString();
        const sec = document.createElement('section');
        sec.className = 'day-group';
        sec.innerHTML = `<h3>${esc(fmt.day.format(d).toLowerCase())}</h3>`;
        ul = document.createElement('ul');
        ul.className = 'timeline';
        sec.appendChild(ul);
        groups.appendChild(sec);
      }
      ul.appendChild(J.entryEl(e, { isNew: e.id === newId, timeOnly: true, onDelete }));
    }
    if (!list.length) {
      groups.appendChild(J.emptyEl(query || month || ideaFilter ? 'nothing matches those filters' : 'your log is empty — write the first line', 'div'));
    }
    const total = J.entries.all().length;
    $('#logCount').textContent = list.length === total ? `${total} entries` : `${list.length} of ${total}`;
  }

  /* ---------- compose ---------- */
  $$('.mood', form).forEach(btn => btn.addEventListener('click', () => {
    const on = btn.getAttribute('aria-pressed') !== 'true';
    $$('.mood', form).forEach(b => b.setAttribute('aria-pressed', 'false'));
    btn.setAttribute('aria-pressed', String(on));
    mood = on ? btn.dataset.mood : '';
  }));
  text.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); form.requestSubmit(); }
  });
  form.addEventListener('submit', e => {
    e.preventDefault();
    const value = text.value.trim();
    if (!value) { restart(form, 'shake'); toast('write something first ✎'); return text.focus(); }
    const entry = { id: uid(), text: value, mood, ts: J.nowIso() };
    if (ideaSel.value) {
      entry.ideaId = ideaSel.value;
      const idea = J.ideas.get(ideaSel.value);
      if (idea) J.touchIdea(idea);
    }
    J.entries.add(entry);
    text.value = '';
    mood = '';
    $$('.mood', form).forEach(b => b.setAttribute('aria-pressed', 'false'));
    // make sure the new entry is visible
    query = ''; $('#logSearch').value = ''; month = null;
    if (ideaFilter && ideaFilter !== entry.ideaId) ideaFilter = '';
    renderFilters();
    render(entry.id);
    burstFrom($('#logBtn'), 12, 100);
    toast(`saved · ${fmt.time.format(new Date(entry.ts))}`);
  });

  renderFilters();
  render();
  if (preset) text.focus();
})();
