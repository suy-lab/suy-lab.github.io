/* =========================================================
   anotetoself · core
   Shared helpers, data store, page chrome (nav + footer),
   ink illustrations, toasts and backup.
   Exposes everything on window.J for the page scripts.
   ========================================================= */
(() => {
  'use strict';

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
     Ink illustrations (inline SVG, black line art + accents)
     --------------------------------------------------------- */
  const P = { ink: '#1b1b1b', paper: '#ffffff', lime: '#dff25b', coral: '#ef8e86', yellow: '#f6d878', sky: '#9cc9e6' };
  const GHOST = { ink: '#d9d6cc', paper: '#ffffff', lime: '#ffffff', coral: '#ffffff', yellow: '#ffffff', sky: '#ffffff' };

  // small objects, centred on 0,0
  const OBJ = {
    bulb: c => `<path d="M0 -28 C-17 -28 -24 -13 -19 -2 C-16 5 -9 10 -9 18 H9 C9 10 16 5 19 -2 C24 -13 17 -28 0 -28Z" fill="${c.lime}"/>
      <path d="M-8 24 H8 M-5 30 H5"/><path d="M-4 10 V2 L0 -4 L4 2 V10" stroke-width="2.5"/>
      <path d="M-30 -30 l-7 -7 M0 -38 v-9 M30 -30 l7 -7" stroke-width="2.5"/>`,
    book: c => `<path d="M-36 -4 C-22 -12 -9 -10 0 -2 C9 -10 22 -12 36 -4 V20 C22 12 9 14 0 22 C-9 14 -22 12 -36 20 Z" fill="${c.paper}"/>
      <path d="M0 -2 V22"/><path d="M-28 3 C-21 0 -14 0 -8 3 M-28 10 C-21 7 -14 7 -8 10 M8 3 C14 0 21 0 28 3 M8 10 C14 7 21 7 28 10" stroke-width="2"/>`,
    phone: c => `<g transform="rotate(-14)"><rect x="-16" y="-28" width="32" height="56" rx="7" fill="${c.paper}"/>
      <rect x="-10" y="-20" width="20" height="36" rx="2"/><path d="M-3 22 h6"/><path d="M-4 -10 l6 -6 M-4 -2 l10 -10" stroke-width="2"/></g>`,
    headphones: c => `<path d="M-26 8 C-26 -32 26 -32 26 8"/><path d="M-20 4 C-20 -22 20 -22 20 4" stroke-width="2"/>
      <rect x="-34" y="2" width="14" height="26" rx="7" fill="${c.paper}"/><rect x="20" y="2" width="14" height="26" rx="7" fill="${c.paper}"/>`,
    magnifier: c => `<circle cx="-4" cy="-4" r="16" fill="${c.paper}"/><path d="M-13 -9 a10 10 0 0 1 9 -6" stroke-width="2"/><path d="M8 8 L22 22" stroke-width="6"/>`,
    flask: c => `<path d="M-5 -26 V-8 L-20 18 C-23 24 -19 28 -13 28 H13 C19 28 23 24 20 18 L5 -8 V-26" fill="${c.paper}"/>
      <path d="M-15 11 C-6 7 6 15 16 11 L20 18 C23 24 19 28 13 28 H-13 C-19 28 -23 24 -20 18Z" fill="${c.lime}"/>
      <path d="M-9 -26 H9"/><circle cx="-2" cy="-14" r="2"/><circle cx="4" cy="-22" r="1.5"/>`,
    plane: c => `<path d="M-30 4 L30 -22 L8 26 L0 8 Z" fill="${c.paper}"/><path d="M0 8 L30 -22"/>
      <path d="M-34 18 l-12 5 M-28 28 l-16 7" stroke-dasharray="3 7" stroke-width="2.5"/>`,
    sparkle: c => `<path d="M0 -12 C1 -4 4 -1 12 0 C4 1 1 4 0 12 C-1 4 -4 1 -12 0 C-4 -1 -1 -4 0 -12Z" fill="${c.lime}" stroke-width="2"/>`
  };
  const place = (c, name, x, y, delay = 0, scale = 1) =>
    `<g transform="translate(${x} ${y}) scale(${scale})"><g class="float" style="animation-delay:${delay}s">${OBJ[name](c)}</g></g>`;
  const tube = (d, w = 15) => `<path d="${d}" stroke-width="${w}"/><path d="${d}" stroke="#fff" stroke-width="${w - 6}"/>`;

  const SCENES = {
    // girl at her laptop inside a frame, objects floating around
    desk: { vb: '0 0 440 380', draw: c => `
      <path d="M92 70 H150 M206 70 H344 V172 M344 214 V362 H92 V256 M92 210 V70"/>
      <path d="M168 246 C140 214 150 132 178 106 C204 82 252 84 270 120 C286 154 276 210 300 246 C270 254 246 232 244 212 L196 212 C190 232 180 248 168 246Z" fill="${c.ink}"/>
      <path d="M150 362 C152 290 180 236 222 234 C264 236 290 290 294 362" fill="${c.paper}"/>
      <path d="M212 214 V234 M232 214 V234"/>
      <path d="M190 140 C190 116 254 114 256 142 L256 184 C256 206 238 220 222 220 C206 220 190 206 190 184 Z" fill="${c.paper}"/>
      <path d="M186 152 C186 118 220 104 246 114 C258 120 262 136 260 152 C246 140 226 134 210 138 C200 142 192 146 186 152Z" fill="${c.ink}"/>
      <path d="M202 158 q6 -3 11 0 M231 158 q6 -3 11 0" stroke-width="2.5"/>
      <g class="blink"><circle cx="208" cy="169" r="2.8" fill="${c.ink}" stroke="none"/><circle cx="236" cy="169" r="2.8" fill="${c.ink}" stroke="none"/></g>
      <path d="M223 173 q-5 9 1 11" stroke-width="2.5"/><path d="M213 196 q9 6 18 0" stroke-width="2.5"/>
      <circle cx="200" cy="187" r="5" fill="${c.coral}" stroke="none" opacity=".5"/><circle cx="245" cy="187" r="5" fill="${c.coral}" stroke="none" opacity=".5"/>
      <path d="M150 262 L232 280 L246 350 L162 338 Z" fill="${c.paper}"/><path d="M188 300 l10 3" stroke-width="2"/>
      <path d="M162 338 L246 350 L300 350"/>
      <path d="M244 300 C254 290 272 290 280 300 C276 310 262 314 248 312" fill="${c.paper}"/><path d="M257 296 l4 8 M267 294 l3 8" stroke-width="2"/>
      ${place(c, 'book', 178, 62, 0)}${place(c, 'bulb', 60, 232, -1.2)}${place(c, 'phone', 372, 192, -.6)}
      ${place(c, 'headphones', 384, 306, -1.8)}${place(c, 'magnifier', 50, 60, -2.4, .9)}${place(c, 'sparkle', 316, 34, -.9)}` },

    // diver exploring the underwater part of an iceberg
    diver: { vb: '0 0 420 340', draw: c => `
      <g class="float slow">
        <path d="M170 150 L296 150 L278 205 L262 200 L250 286 L238 232 L226 310 L214 230 L196 224 L182 186 Z" fill="${c.lime}"/>
        <path d="M170 150 L195 70 L222 112 L246 52 L296 150 Z" fill="${c.paper}"/>
        <path d="M206 94 l14 -5 M204 103 l9 -3" stroke-width="2.5"/>
        <path d="M194 168 h22 M236 172 h30 M206 186 h14 M244 214 l5 20 M222 240 l4 18" stroke-width="2.5"/>
      </g>
      <path d="M150 158 C112 152 124 138 168 136"/><path d="M300 138 C344 140 350 154 306 162"/>
      <path d="M130 170 C150 176 180 176 196 174" stroke-width="2"/><path d="M290 172 C310 172 330 168 340 162" stroke-width="2"/>
      <g class="float" style="animation-duration:3.6s">
        ${tube('M58 226 L28 206 L12 188')}${tube('M52 238 L22 240 L4 228')}
        <path d="M12 188 l-16 -4 l3 -7 l-7 -7 l22 3 z" fill="${c.paper}"/><path d="M4 228 l-14 6 l-1 -8 l-9 -3 l20 -8 z" fill="${c.paper}"/>
        <g transform="translate(84 222) rotate(-22)"><rect x="-38" y="-13" width="70" height="26" rx="13" fill="${c.paper}"/></g>
        <g transform="translate(76 202) rotate(-22)"><rect x="-22" y="-9" width="42" height="18" rx="8" fill="${c.paper}"/><path d="M-8 -9 v18 M4 -9 v18" stroke-width="2.5"/></g>
        ${tube('M108 232 L128 250 L142 244', 13)}
        <circle cx="126" cy="222" r="14" fill="${c.paper}"/><rect x="127" y="212" width="13" height="10" rx="3" fill="${c.paper}"/>
        <path d="M120 211 C118 198 124 192 130 194" stroke-width="2.5"/><path d="M124 230 q4 3 8 0" stroke-width="2"/>
        <circle cx="154" cy="236" r="8" fill="${c.paper}"/><path d="M148 242 L142 248" stroke-width="4"/>
      </g>
      <g class="bubbles"><circle cx="134" cy="182" r="4"/><circle cx="142" cy="166" r="3"/><circle cx="136" cy="152" r="2.5"/></g>` },

    // waving "say hello" girl
    wave: { vb: '0 0 300 290', draw: c => `
      <path d="M66 288 C44 230 46 140 74 96 C100 56 176 52 198 92 C206 108 204 124 196 132 L100 132 C100 190 98 240 66 288Z" fill="${c.ink}"/>
      <path d="M28 292 C40 242 84 212 132 212 C160 212 178 222 190 242" fill="${c.paper}"/>
      <path d="M120 196 V214 M150 196 V212"/>
      <path d="M98 110 C98 80 182 76 188 112 L190 160 C190 190 166 206 142 206 C114 206 98 188 98 160Z" fill="${c.paper}"/>
      <path d="M92 128 C88 82 132 62 172 68 C194 72 204 90 200 108 C170 100 128 102 92 128Z" fill="${c.ink}"/>
      <path d="M100 140 c-12 -2 -12 22 0 22" fill="${c.paper}"/><circle cx="95" cy="172" r="9"/>
      <path d="M124 124 l10 -5 M156 119 l10 4" stroke-width="2.5"/>
      <g class="blink"><ellipse cx="130" cy="138" rx="2.6" ry="4" fill="${c.ink}" stroke="none"/><ellipse cx="162" cy="136" rx="2.6" ry="4" fill="${c.ink}" stroke="none"/></g>
      <path d="M148 142 l-4 16 h7" stroke-width="2.5"/>
      <path d="M126 170 C134 192 166 192 172 166 Z" fill="${c.ink}"/><path d="M141 184 q10 -7 19 -1" fill="${c.coral}" stroke="none"/>
      ${tube('M178 252 C206 248 230 242 248 232', 16)}
      <g class="wave-hand">
        <path d="M244 234 C238 216 244 204 256 204 C268 204 274 216 268 234 Z" fill="${c.paper}"/>
        <path d="M249 207 L242 176 C241 169 249 167 251 174 L258 204" fill="${c.paper}"/>
        <path d="M258 205 L267 176 C269 169 277 171 275 178 L267 207" fill="${c.paper}"/>
        <path d="M250 218 c6 -4 12 -2 15 4" stroke-width="2"/>
      </g>
      ${place(c, 'sparkle', 280, 160, -.5, .8)}` },

    // reading a big open book
    reader: { vb: '0 0 300 290', draw: c => `
      <path d="M62 290 C72 246 106 228 150 228 C194 228 228 246 238 290" fill="${c.paper}"/>
      <circle cx="150" cy="54" r="18" fill="${c.ink}"/>
      <path d="M110 124 C110 90 190 88 192 124 L192 160 L110 160Z" fill="${c.paper}"/>
      <path d="M106 130 C102 88 144 72 176 82 C196 90 200 110 196 128 C176 114 140 110 106 130Z" fill="${c.ink}"/>
      <path d="M126 130 q8 -4 14 0 M160 130 q8 -4 14 0" stroke-width="2.5"/>
      <g class="blink"><circle cx="134" cy="142" r="3" fill="${c.ink}" stroke="none"/><circle cx="168" cy="142" r="3" fill="${c.ink}" stroke="none"/></g>
      <g class="float slow">
        <path d="M46 152 C88 138 126 142 150 158 C174 142 212 138 254 152 V254 C212 240 174 244 150 260 C126 244 88 240 46 254 Z" fill="${c.paper}"/>
        <path d="M150 158 V260"/>
        <rect x="168" y="178" width="58" height="32" rx="3" fill="${c.lime}"/>
        <path d="M66 176 h62 M66 190 h56 M66 204 h62 M66 218 h40 M168 224 h58 M168 236 h40" stroke-width="2"/>
        <path d="M48 192 c-14 0 -18 14 -6 18 c-12 4 -8 18 6 16" fill="${c.paper}"/>
        <path d="M252 192 c14 0 18 14 6 18 c12 4 8 18 -6 16" fill="${c.paper}"/>
      </g>
      ${place(c, 'sparkle', 252, 92, -1.1)}${place(c, 'sparkle', 40, 110, -.3, .6)}` },

    // writing in a notebook
    writer: { vb: '0 0 320 290', draw: c => `
      <path d="M30 290 C34 226 62 184 104 182 C140 182 160 198 174 216" fill="${c.paper}"/>
      <path d="M94 158 V184 M114 158 V182"/>
      <path d="M70 92 C70 62 130 60 134 94 L134 126 C134 148 116 160 102 160 C84 160 70 148 70 126Z" fill="${c.paper}"/>
      <path d="M64 100 C58 56 108 40 136 62 C148 72 146 92 140 100 C124 84 96 82 76 96 C72 100 66 104 64 100Z" fill="${c.ink}"/>
      <path d="M86 118 q5 4 10 0 M112 118 q5 4 10 0" stroke-width="2.5"/><path d="M98 140 q6 3 11 0" stroke-width="2.5"/>
      <circle cx="82" cy="132" r="4.5" fill="${c.coral}" stroke="none" opacity=".5"/>
      <path d="M14 252 H306"/>
      <path d="M128 250 L168 198 H292 L264 250 Z" fill="${c.paper}"/>
      <path d="M170 220 h44" stroke="${c.lime}" stroke-width="8"/>
      <path d="M178 210 h84 M171 220 h84 M164 230 h70 M157 240 h50" stroke-width="2"/>
      ${tube('M150 222 C176 226 196 230 212 232', 14)}
      <g class="scribble">
        <path d="M206 226 c8 -10 24 -10 28 2 c-4 8 -18 10 -28 6" fill="${c.paper}"/>
        <path d="M224 224 L254 184" stroke-width="6"/><path d="M224 224 L220 232 L228 228" fill="${c.ink}"/>
      </g>
      ${place(c, 'bulb', 176, 64, -.8, .8)}${place(c, 'sparkle', 276, 120, -1.6, .8)}` },

    // thinker with a magnifying glass
    thinker: { vb: '0 0 220 220', draw: c => `
      <path d="M38 220 C44 180 72 162 100 162 C128 162 150 176 158 200" fill="${c.paper}"/>
      <path d="M64 80 C64 52 132 50 136 82 L136 118 C136 142 118 156 100 156 C80 156 64 142 64 118Z" fill="${c.paper}"/>
      <path d="M58 92 C50 44 108 26 140 52 C154 64 150 86 144 92 C128 76 108 74 90 80 C80 70 66 80 58 92Z" fill="${c.ink}"/>
      <g class="blink"><circle cx="86" cy="108" r="3" fill="${c.ink}" stroke="none"/></g>
      <path d="M90 136 q8 -4 16 0" stroke-width="2.5"/>
      <g class="float" style="animation-duration:2.4s">
        <circle cx="118" cy="106" r="20" fill="${c.lime}" fill-opacity=".55"/>
        <circle cx="118" cy="108" r="6" fill="${c.ink}" stroke="none"/>
        <path d="M132 122 L160 160" stroke-width="7"/>
        <path d="M146 146 c10 -6 22 2 20 14 c-6 8 -18 8 -24 0" fill="${c.paper}"/>
      </g>
      <g class="float" style="animation-delay:-1s"><path d="M172 34 c0 -12 18 -12 18 0 c0 8 -9 9 -9 18 M181 64 v1" stroke-width="3"/></g>` },

    // faint wireframe page for background decoration
    ghost: { vb: '0 0 1200 360', draw: c => `
      <g stroke-width="1.5">
        <rect x="10" y="20" width="90" height="70" rx="4"/><path d="M120 30 h70 M120 44 h60 M120 58 h70 M120 72 h40"/>
        <path d="M240 40 h150 M240 54 h130 M240 68 h150"/><rect x="440" y="10" width="150" height="70" rx="4"/>
        <path d="M640 40 h150 M640 54 h120 M640 68 h150"/><rect x="840" y="20" width="90" height="70" rx="4"/>
        <path d="M950 30 h70 M950 44 h60 M950 58 h70 M950 72 h40"/><rect x="1060" y="20" width="120" height="70" rx="4"/>
        <path d="M10 130 h60 M10 144 h50 M10 158 h60"/><rect x="90" y="120" width="70" height="80" rx="4"/>
        <path d="M10 230 h140 M10 244 h120 M10 258 h140"/><rect x="10" y="280" width="140" height="80" rx="4"/>
        <path d="M230 300 h100 M230 314 h80"/><path d="M430 320 h150 M430 334 h120"/><path d="M640 300 h140"/>
        <path d="M1040 140 h150 M1040 154 h120"/><rect x="1060" y="190" width="120" height="70" rx="4"/>
        <path d="M1050 290 h140 M1050 304 h110"/><rect x="880" y="280" width="140" height="80" rx="4"/>
      </g>
      ${place(c, 'phone', 55, 56, 0, .7)}${place(c, 'headphones', 125, 160, -1, .7)}${place(c, 'bulb', 80, 322, -2, .8)}
      ${place(c, 'book', 1120, 225, -.5, .7)}${place(c, 'magnifier', 950, 320, -1.4, .8)}${place(c, 'plane', 1120, 55, -2.2, .7)}` }
  };

  function art(name, ghost = false) {
    const c = ghost ? GHOST : P;
    if (OBJ[name]) {
      return `<svg class="art art-spot" viewBox="-50 -50 100 100" fill="none" stroke="${c.ink}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><g class="boil">${OBJ[name](c)}</g></svg>`;
    }
    const s = SCENES[name];
    if (!s) return '';
    return `<svg class="art art-${name}" viewBox="${s.vb}" fill="none" stroke="${c.ink}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><g class="boil">${s.draw(c)}</g></svg>`;
  }

  // pencil filters (the "line boil") + burst symbols
  document.body.insertAdjacentHTML('afterbegin', `
<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>
  ${[3, 11, 27].map((seed, i) => `<filter id="pencil-${i}" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="${seed}" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.6" xChannelSelector="R" yChannelSelector="G"/></filter>`).join('')}
  <symbol id="i-star" viewBox="0 0 24 24"><path d="M12 2 L14.8 8.6 L22 9.3 L16.5 14 L18.2 21 L12 17.3 L5.8 21 L7.5 14 L2 9.3 L9.2 8.6Z" fill="currentColor" stroke="#1b1b1b" stroke-width="1.6" stroke-linejoin="round"/></symbol>
  <symbol id="i-heart" viewBox="0 0 24 24"><path d="M12 21 C5 15.2 2 11.6 2 8 C2 5 4.4 3 7 3 C9 3 11 4.2 12 6.2 C13 4.2 15 3 17 3 C19.6 3 22 5 22 8 C22 11.6 19 15.2 12 21Z" fill="currentColor" stroke="#1b1b1b" stroke-width="1.6" stroke-linejoin="round"/></symbol>
  <symbol id="i-sparkle" viewBox="0 0 24 24"><path d="M12 1 C13 8 16 11 23 12 C16 13 13 16 12 23 C11 16 8 13 1 12 C8 11 11 8 12 1Z" fill="currentColor" stroke="#1b1b1b" stroke-width="1.6" stroke-linejoin="round"/></symbol>
  <symbol id="i-check" viewBox="0 0 24 24"><path d="M4 13 L9.5 18 L20 5" fill="none" stroke="#1b1b1b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-x" viewBox="0 0 24 24"><path d="M6 6 L18 18 M18 6 L6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></symbol>
  <symbol id="i-search" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15.5 15.5 L21 21" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></symbol>
  <symbol id="i-down" viewBox="0 0 24 24"><path d="M12 4 V15 M7 10.5 L12 15.5 L17 10.5 M5 20 H19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-up" viewBox="0 0 24 24"><path d="M12 16 V5 M7 9.5 L12 4.5 L17 9.5 M5 20 H19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-play" viewBox="0 0 24 24"><path d="M8 5 L19 12 L8 19 Z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></symbol>
  <symbol id="i-pause" viewBox="0 0 24 24"><path d="M8 5 V19 M16 5 V19" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></symbol>
  <symbol id="i-next" viewBox="0 0 24 24"><path d="M5 6 L13 12 L5 18 Z M13 6 L21 12 L13 18 Z" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></symbol>
  <symbol id="i-prev" viewBox="0 0 24 24"><path d="M19 6 L11 12 L19 18 Z M11 6 L3 12 L11 18 Z" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></symbol>
  <symbol id="i-logo" viewBox="0 0 32 32"><path d="M4 8 C9 5.5 13 5.5 16 8.5 C19 5.5 23 5.5 28 8 V26 C23 23.5 19 23.5 16 26.5 C13 23.5 9 23.5 4 26 Z M16 8.5 V26.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M20 7.2 V15 L22 13.4 L24 15 V6.8" fill="#dff25b" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></symbol>
</defs></svg>`);

  function fillArt(root = document) {
    $$('[data-art]', root).forEach(el => { el.innerHTML = art(el.dataset.art, el.hasAttribute('data-ghost')); });
  }
  function cheer(el) { if (el) restart(el, 'hop'); }

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
    { id: 'spark', label: 'spark', icon: '✦', tone: 'var(--t-spark)' },
    { id: 'exploring', label: 'exploring', icon: '◌', tone: 'var(--t-exploring)' },
    { id: 'testing', label: 'testing', icon: '△', tone: 'var(--t-testing)' },
    { id: 'done', label: 'done', icon: '✓', tone: 'var(--t-done)' },
    { id: 'parked', label: 'parked', icon: '–', tone: 'var(--t-parked)' }
  ];
  const SOURCE_STATUSES = [
    { id: 'to-read', label: 'to read', tone: 'var(--t-parked)' },
    { id: 'reading', label: 'reading', tone: 'var(--t-exploring)' },
    { id: 'read', label: 'read ✓', tone: 'var(--t-done)' }
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
  sources.all().forEach(s => { if (!Array.isArray(s.tags)) s.tags = []; });

  function touchIdea(idea) { idea.updated = nowIso(); ideas.save(); }
  const ideaHref = id => `idea.html?id=${encodeURIComponent(id)}`;
  const ideasByRecent = () => [...ideas.all()].sort((a, b) => b.updated.localeCompare(a.updated));
  function ideaOptions(selectedId, emptyLabel = '— not about an idea —') {
    return `<option value="">${esc(emptyLabel)}</option>` + ideasByRecent()
      .map(i => `<option value="${esc(i.id)}"${i.id === selectedId ? ' selected' : ''}>${esc(ideaStatus(i.status).icon)} ${esc(i.title)}</option>`).join('');
  }

  // one log entry <li>, shared by the Today, Log and Idea pages
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
    if (idea) body.insertAdjacentHTML('beforeend', `<a class="tag" href="${ideaHref(idea.id)}" style="--tone:${ideaStatus(idea.status).tone}">${esc(idea.title)}</a>`);
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

  function emptyEl(text, tag = 'li') {
    const el = document.createElement(tag);
    el.className = 'empty';
    el.innerHTML = `<div class="empty-art">${art('wave')}</div><p>${esc(text)}</p>`;
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

  const BURST_SHAPES = ['i-star', 'i-heart', 'i-sparkle'];
  const COLORS = ['#dff25b', '#86b38d', '#ef8e86', '#9cc9e6', '#f6d878'];
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
     Page chrome: top nav + footer
     --------------------------------------------------------- */
  const SECTIONS = [
    { id: 'today', label: 'Today', href: 'index.html' },
    { id: 'ideas', label: 'Ideas', href: 'ideas.html' },
    { id: 'log', label: 'Log', href: 'log.html' },
    { id: 'library', label: 'Library', href: 'library.html' }
  ];
  const page = $('#page');
  const pageId = page.dataset.page;
  const activeTab = page.dataset.tab || pageId;

  function buildChrome() {
    page.insertAdjacentHTML('beforebegin', `
      <a class="skip" href="#page">Skip to content</a>
      <header class="topbar wrap">
        <a class="brand" href="index.html">${svgUse('i-logo', 30)}<span>anotetoself</span><sup>®</sup></a>
        <nav class="nav" aria-label="Journal sections">
          ${SECTIONS.map(s => `<a href="${s.href}"${s.id === activeTab ? ' aria-current="page"' : ''}>${s.label}</a>`).join('')}
        </nav>
        <div class="tools">
          <button type="button" class="icon-btn" data-action="export" title="Back up your journal" aria-label="Back up your journal">${svgUse('i-down', 20)}</button>
          <button type="button" class="icon-btn" data-action="import" title="Restore from a backup" aria-label="Restore from a backup">${svgUse('i-up', 20)}</button>
        </div>
      </header>`);

    page.insertAdjacentHTML('afterend', `
      <footer class="site-foot wrap">
        <div class="foot-left">
          <a class="brand small" href="index.html">${svgUse('i-logo', 22)}<span>anotetoself</span></a>
          <span class="muted">© ${new Date().getFullYear()}</span>
          <span class="muted">Private by design — everything stays in this browser.</span>
        </div>
        <div class="foot-right">
          <button type="button" class="link-btn" data-action="export">Back up</button>
          <button type="button" class="link-btn" data-action="import">Restore</button>
        </div>
        <input type="file" id="importFile" accept="application/json,.json" hidden />
      </footer>
      <div class="toast" id="toast" role="status" aria-live="polite">
        <span id="toastMsg"></span><button type="button" id="toastBtn" hidden></button>
      </div>`);

    toastEl = $('#toast'); toastMsg = $('#toastMsg'); toastBtn = $('#toastBtn');
    toastBtn.addEventListener('click', () => { const fn = toastAction; hideToast(); if (fn) fn(); });
  }

  /* ---------------------------------------------------------
     Backup / restore (JSON file)
     --------------------------------------------------------- */
  function exportData() {
    const data = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k.startsWith(PREFIX)) data[k.slice(PREFIX.length)] = JSON.parse(localStorage.getItem(k));
      }
    } catch { return toast('could not read browser storage'); }
    const blob = new Blob([JSON.stringify({ app: 'anotetoself', version: 3, exported: nowIso(), data }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `anotetoself-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('backup downloaded ✓');
  }

  function initBackup() {
    const file = $('#importFile');
    document.addEventListener('click', e => {
      const b = e.target.closest('[data-action]');
      if (!b) return;
      if (b.dataset.action === 'export') exportData();
      if (b.dataset.action === 'import') file.click();
    });
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
  initBackup();
  fillArt();

  window.J = {
    $, $$, uid, rand, pick, svgUse, esc, nowIso, debounce, restart, autosize, safeUrl, parseTags, fmt, ago,
    Store, toast, burst, burstFrom, art, fillArt, cheer,
    entries, ideas, sources, makeIdea, touchIdea, ideaHref, ideasByRecent, ideaOptions,
    entryEl, animateOut, emptyEl,
    IDEA_STATUSES, SOURCE_STATUSES, ideaStatus, sourceStatus
  };
})();
