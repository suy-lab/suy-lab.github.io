/* =========================================================
   anotetoself · TODAY page
   ========================================================= */
(() => {
  'use strict';
  const { $, $$, Store, toast, burst, burstFrom, restart, fmt, uid, svgUse, rand } = J;
  const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  /* ---------------------------------------------------------
     Buddy doodle
     --------------------------------------------------------- */
  const Buddy = (() => {
    const el = $('#buddy');
    function cheer() {
      restart(el, 'jump');
      const r = el.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top + 8, 4, 50);
    }
    el.addEventListener('click', cheer);
    el.addEventListener('animationend', e => { if (e.animationName === 'buddyJump') el.classList.remove('jump'); });
    return { cheer };
  })();

  /* ---------------------------------------------------------
     Recent log entries ("where i'm at")
     --------------------------------------------------------- */
  const RECENT = 6;
  const list = $('#timeline');

  function onDelete(e, li) {
    const removed = J.entries.remove(e.id);
    J.animateOut(li, () => { if (!list.children.length) list.appendChild(J.emptyEl('nothing here yet — the page is waiting for you')); });
    toast('note deleted', { label: 'undo', onClick: () => { J.entries.restore(removed); renderRecent(); } });
  }
  function renderRecent(newId) {
    const recent = J.entries.all().slice(0, RECENT);
    list.replaceChildren(...recent.map(e => J.entryEl(e, { isNew: e.id === newId, onDelete })));
    if (!recent.length) list.appendChild(J.emptyEl('nothing here yet — the page is waiting for you'));
  }

  /* ---------------------------------------------------------
     Compose: log note or new idea
     --------------------------------------------------------- */
  (() => {
    const form = $('#composeForm');
    const textarea = $('#entryText');
    const count = $('#charCount');
    const saveBtn = $('#saveBtn');
    const modeBtns = $$('[data-mode]', form);
    let mode = 'log', mood = '';

    function setMode(m) {
      mode = m;
      modeBtns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
      $('#moodRow').hidden = m === 'idea';
      saveBtn.textContent = m === 'idea' ? 'save idea 💡' : 'save note ★';
      textarea.placeholder = m === 'idea'
        ? 'first line = the idea\nthen anything else: why it matters, a hunch, a question…'
        : "what's on your mind? ideas, feelings, tiny wins…";
    }
    modeBtns.forEach(b => b.addEventListener('click', () => { setMode(b.dataset.mode); textarea.focus(); }));

    textarea.addEventListener('input', () => { count.textContent = textarea.value.length; });
    textarea.addEventListener('keydown', e => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); form.requestSubmit(); }
    });
    $$('.mood', form).forEach(btn => btn.addEventListener('click', () => {
      const on = btn.getAttribute('aria-pressed') !== 'true';
      $$('.mood', form).forEach(b => b.setAttribute('aria-pressed', 'false'));
      btn.setAttribute('aria-pressed', String(on));
      mood = on ? btn.dataset.mood : '';
    }));

    form.addEventListener('submit', e => {
      e.preventDefault();
      const text = textarea.value.trim();
      if (!text) {
        restart(form, 'shake');
        toast('write something first ✎');
        textarea.focus();
        return;
      }

      if (mode === 'idea') {
        const [first, ...rest] = text.split('\n');
        const idea = J.ideas.add(J.makeIdea({ title: first.trim().slice(0, 120), summary: rest.join('\n').trim() }));
        renderPulse();
        toast('new spark on the board ✦', { label: 'open →', onClick: () => { location.href = J.ideaHref(idea.id); } });
      } else {
        const entry = J.entries.add({ id: uid(), text, mood, ts: J.nowIso() });
        renderRecent(entry.id);
        list.scrollTo({ top: 0, behavior: 'smooth' });
        toast(`saved · ${fmt.time.format(new Date(entry.ts))}`);
      }

      textarea.value = '';
      count.textContent = '0';
      mood = '';
      $$('.mood', form).forEach(b => b.setAttribute('aria-pressed', 'false'));
      Buddy.cheer();
      burstFrom(saveBtn, 12, 100);
    });
  })();

  /* ---------------------------------------------------------
     Idea pulse
     --------------------------------------------------------- */
  function renderPulse() {
    const all = J.ideas.all();
    $('#pulseRow').innerHTML = J.IDEA_STATUSES.map(s => {
      const n = all.filter(i => i.status === s.id).length;
      return `<a class="pulse-stat" href="ideas.html#${s.id}" style="--tone:${s.tone}"><b>${n}</b><span>${s.icon} ${s.label}</span></a>`;
    }).join('');
    const latest = J.ideasByRecent()[0];
    $('#pulseFoot').innerHTML = latest
      ? `<span>last touched: <a href="${J.ideaHref(latest.id)}">${J.esc(latest.title)}</a></span><span class="muted">${J.ago(latest.updated)}</span>`
      : `<span class="muted">no ideas yet — switch the brain dump to 💡 to add one</span>`;
  }

  /* ---------------------------------------------------------
     Needs checklist
     --------------------------------------------------------- */
  (() => {
    const list = $('#needList');
    const input = $('#needInput');
    let needs = Store.get('needs', null);
    if (!Array.isArray(needs)) {
      needs = [
        { id: uid(), text: 'Use a timer for everything — it seems to be helping', done: false },
        { id: uid(), text: 'Go outside! The sun sets so early now', done: false },
        { id: uid(), text: 'Take a big fat break after a deep-work block', done: true },
        { id: uid(), text: 'Plan with task batching to save energy', done: false }
      ];
      Store.set('needs', needs);
    }
    const persist = () => Store.set('needs', needs);

    function needEl(n, isNew) {
      const li = document.createElement('li');
      li.className = 'need' + (n.done ? ' done' : '') + (isNew ? ' is-new' : '');
      const chk = document.createElement('button');
      chk.type = 'button';
      chk.className = 'check';
      chk.setAttribute('role', 'checkbox');
      chk.setAttribute('aria-checked', String(n.done));
      chk.setAttribute('aria-label', n.text);
      chk.innerHTML = svgUse('i-check');
      chk.addEventListener('click', () => {
        n.done = !n.done;
        li.classList.toggle('done', n.done);
        chk.setAttribute('aria-checked', String(n.done));
        persist();
        if (n.done) burstFrom(chk, 6, 50);
      });
      const span = document.createElement('span');
      span.textContent = n.text;
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'del';
      del.setAttribute('aria-label', 'Remove need');
      del.innerHTML = svgUse('i-x', 14);
      del.addEventListener('click', () => {
        needs = needs.filter(x => x.id !== n.id);
        persist();
        J.animateOut(li);
      });
      li.append(chk, span, del);
      return li;
    }

    list.replaceChildren(...needs.map(n => needEl(n)));
    $('#needForm').addEventListener('submit', e => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return input.focus();
      const n = { id: uid(), text, done: false };
      needs.push(n);
      persist();
      list.appendChild(needEl(n, true));
      input.value = '';
    });
  })();

  /* ---------------------------------------------------------
     Reward card
     --------------------------------------------------------- */
  const Reward = (() => {
    const input = $('#rewardInput'), box = $('#earned');
    const state = Object.assign({ text: 'Walk at the beach', earned: false }, Store.get('reward', {}));
    input.value = state.text;
    box.checked = state.earned;
    const persist = () => Store.set('reward', state);
    input.addEventListener('input', () => { state.text = input.value; persist(); });
    box.addEventListener('change', () => { state.earned = box.checked; persist(); if (box.checked) burstFrom(box, 8, 60); });
    return { earn() { box.checked = state.earned = true; persist(); } };
  })();

  /* ---------------------------------------------------------
     Lo-fi player: tiny Web Audio synth (no audio files needed)
     --------------------------------------------------------- */
  const Player = (() => {
    const TRACKS = [
      { title: 'rainy window', artist: 'the doodle tapes', bpm: 70, len: 120, wave: 'triangle',
        chords: [[57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65], [52, 55, 59, 62]] },
      { title: 'walk at the beach', artist: 'sunset sketches', bpm: 84, len: 110, wave: 'sine',
        chords: [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 67]] },
      { title: 'desk lamp hum', artist: 'anotetoself', bpm: 64, len: 130, wave: 'triangle',
        chords: [[62, 65, 69, 72], [58, 62, 65, 69], [60, 64, 67, 70], [57, 61, 64, 67]] }
    ];
    const PATTERN = [0, 2, 1, 3, 2, 1, 3, 2];

    const card = $('#player'), playBtn = $('#playBtn');
    const seek = $('#seek'), seekFill = $('#seekFill');
    let ctx = null, master = null;
    let idx = Store.get('track', 0) % TRACKS.length;
    let playing = false, elapsed = 0, lastT = 0, nextNote = 0, step = 0, sched = null, raf = null;

    function ensureCtx() {
      if (ctx) return ctx;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 1800;
      master = ctx.createGain(); master.gain.value = .22;
      master.connect(lp); lp.connect(ctx.destination);
      return ctx;
    }

    function note(midi, t, dur, gain = .3, type = 'sine') {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type;
      o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
      o.detune.value = rand(-6, 6); // a little tape wobble
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + dur + 0.05);
    }

    const stepDur = () => 60 / TRACKS[idx].bpm / 2;

    function scheduler() {
      const tr = TRACKS[idx];
      while (nextNote < ctx.currentTime + 0.12) {
        const chord = tr.chords[Math.floor(step / 8) % tr.chords.length];
        note(chord[PATTERN[step % 8]] + 12, nextNote, stepDur() * 1.8, .18, tr.wave);
        if (step % 8 === 0) {
          note(chord[0] - 12, nextNote, stepDur() * 7, .32, 'sine');
          note(chord[1], nextNote, stepDur() * 6, .07, 'sine');
        }
        if (step % 4 === 2) note(96, nextNote, .04, .015, 'square'); // soft hat tick
        nextNote += stepDur();
        step++;
      }
    }

    function loop() {
      const now = ctx.currentTime;
      elapsed += now - lastT;
      lastT = now;
      if (elapsed >= TRACKS[idx].len) load(idx + 1, true);
      paintTime();
      raf = requestAnimationFrame(loop);
    }

    function paintTime() {
      const len = TRACKS[idx].len, pct = Math.min(100, (elapsed / len) * 100);
      seekFill.style.width = pct + '%';
      seek.setAttribute('aria-valuenow', Math.round(pct));
      $('#tCur').textContent = mmss(elapsed);
      $('#tDur').textContent = '-' + mmss(Math.max(0, len - elapsed));
    }

    function load(i, keepPlaying) {
      idx = (i + TRACKS.length) % TRACKS.length;
      Store.set('track', idx);
      elapsed = 0; step = 0;
      if (ctx) nextNote = ctx.currentTime + 0.05;
      $('#trackTitle').textContent = TRACKS[idx].title;
      $('#trackArtist').textContent = TRACKS[idx].artist;
      paintTime();
      if (!keepPlaying && playing) pause();
    }

    function play() {
      if (!ensureCtx()) return toast('audio not supported in this browser');
      ctx.resume();
      playing = true;
      lastT = ctx.currentTime;
      nextNote = ctx.currentTime + 0.05;
      step = Math.floor(elapsed / stepDur());
      sched = setInterval(scheduler, 25);
      raf = requestAnimationFrame(loop);
      card.classList.add('playing');
      playBtn.innerHTML = svgUse('i-pause');
      playBtn.setAttribute('aria-label', 'Pause');
    }

    function pause() {
      playing = false;
      clearInterval(sched); cancelAnimationFrame(raf);
      card.classList.remove('playing');
      playBtn.innerHTML = svgUse('i-play');
      playBtn.setAttribute('aria-label', 'Play');
    }

    function seekTo(frac) {
      elapsed = Math.max(0, Math.min(.999, frac)) * TRACKS[idx].len;
      if (ctx) { step = Math.floor(elapsed / stepDur()); nextNote = ctx.currentTime + 0.05; lastT = ctx.currentTime; }
      paintTime();
    }

    playBtn.addEventListener('click', () => (playing ? pause() : play()));
    $('#nextBtn').addEventListener('click', () => load(idx + 1, true));
    $('#prevBtn').addEventListener('click', () => (elapsed > 3 ? seekTo(0) : load(idx - 1, true)));
    seek.addEventListener('click', e => {
      const r = seek.getBoundingClientRect();
      seekTo((e.clientX - r.left) / r.width);
    });
    seek.addEventListener('keydown', e => {
      const len = TRACKS[idx].len;
      if (e.key === 'ArrowRight') { e.preventDefault(); seekTo((elapsed + 5) / len); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); seekTo((elapsed - 5) / len); }
    });

    load(idx);

    return {
      chime() {
        if (!ensureCtx()) return;
        ctx.resume();
        const t = ctx.currentTime + 0.02;
        [72, 76, 79, 84].forEach((m, i) => note(m, t + i * 0.12, 0.8, .25, 'triangle'));
      }
    };
  })();

  /* ---------------------------------------------------------
     Goal tracker + focus timer
     --------------------------------------------------------- */
  (() => {
    const out = $('#minutes'), task = $('#goalTask'), btn = $('#timerBtn');
    const fill = $('#timerFill'), timeEl = $('#timerTime');
    const state = Object.assign({ mins: 30, task: 'my research' }, Store.get('goal', {}));
    let remaining = state.mins * 60, running = false, endAt = 0, tick = null;

    const persist = () => Store.set('goal', state);
    function paint() {
      out.textContent = state.mins;
      timeEl.textContent = mmss(Math.max(0, Math.ceil(remaining)));
      fill.style.width = (100 - (remaining / (state.mins * 60)) * 100) + '%';
    }
    function setLabel() {
      if (remaining <= 0) btn.textContent = '✓ done!';
      else if (running) btn.textContent = '❚❚ pause';
      else btn.textContent = remaining < state.mins * 60 ? '▶ resume' : '▶ start';
    }
    function setMins(v) {
      if (running) return;
      state.mins = Math.min(240, Math.max(5, v));
      remaining = state.mins * 60;
      persist(); paint(); setLabel();
    }
    function complete() {
      clearInterval(tick); running = false; remaining = 0;
      paint(); setLabel();
      burstFrom(btn, 16, 120);
      Reward.earn();
      Player.chime();
      toast(`${state.mins} mins on ${state.task || 'your task'} — done! treat yourself ♥`);
    }

    $('#minDown').addEventListener('click', () => setMins(state.mins - 5));
    $('#minUp').addEventListener('click', () => setMins(state.mins + 5));
    task.value = state.task;
    task.addEventListener('input', () => { state.task = task.value; persist(); });

    btn.addEventListener('click', () => {
      if (remaining <= 0) { remaining = state.mins * 60; paint(); setLabel(); return; }
      if (running) {
        running = false; clearInterval(tick);
        remaining = (endAt - Date.now()) / 1000;
      } else {
        running = true;
        endAt = Date.now() + remaining * 1000;
        tick = setInterval(() => {
          remaining = (endAt - Date.now()) / 1000;
          if (remaining <= 0) complete(); else paint();
        }, 250);
      }
      setLabel();
    });

    paint(); setLabel();
  })();

  /* ---------------------------------------------------------
     Profile affirmations + pep button
     --------------------------------------------------------- */
  (() => {
    const AFFIRMATIONS = [
      'I am on the right path.',
      'Small steps still count.',
      'Curiosity is my compass.',
      'Done is better than perfect.',
      'My pace is the right pace.',
      'Every question is a doorway.',
      'I am growing, quietly.'
    ];
    const el = $('#mantra');
    let i = Store.get('mantra', 0) % AFFIRMATIONS.length;
    el.textContent = AFFIRMATIONS[i];
    el.addEventListener('click', () => {
      i = (i + 1) % AFFIRMATIONS.length;
      Store.set('mantra', i);
      el.textContent = AFFIRMATIONS[i];
      restart(el, 'swap');
    });

    const btn = $('#gotThis'), countEl = $('#pepCount');
    let peps = Store.get('peps', 0);
    const paint = () => { countEl.textContent = peps ? `pep talks given: ${peps}` : 'press when you need it'; };
    btn.addEventListener('click', () => {
      peps++;
      Store.set('peps', peps);
      paint();
      burstFrom(btn, 14, 110);
      Buddy.cheer();
    });
    paint();
  })();

  renderRecent();
  renderPulse();
})();
