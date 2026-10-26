// Extra controls for Google Drive's audio preview: skip, speed, loop, A–B repeat
// and keyboard shortcuts. The audio element itself is exposed by hook.js.
(() => {
  const RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];
  const SKIP = 10; // seconds
  const PLAY_BUTTON = '[jsname="mQ2ste"]'; // Drive's play/pause button
  const INLINE_MIN_WIDTH = 720; // narrower cards get the controls underneath

  let audio = null;
  let rate = 1;
  let ab = []; // A–B repeat points in seconds: [], [a] or [a, b]
  let shown = false;
  let watching = false;
  let timer = 0;
  let ui = null;

  chrome.storage.local.get({ driveAudioRate: 1 }, (s) => {
    rate = s.driveAudioRate;
    applyRate();
    render();
  });

  // 'play' doesn't bubble, but capture still sees it on its way down.
  document.addEventListener('play', (e) => {
    if (e.target instanceof HTMLAudioElement) bind(e.target);
  }, true);

  function bind(el) {
    if (el !== audio) {
      audio?.removeEventListener('loadedmetadata', applyRate);
      audio?.removeEventListener('ratechange', render);
      audio = el;
      audio.addEventListener('loadedmetadata', applyRate);
      audio.addEventListener('ratechange', render);
      ab = [];
    }
    applyRate();
    ui ??= build();
    render();
    track();
    watchAB();
  }

  // ---- actions ------------------------------------------------------------

  function applyRate() {
    if (audio && audio.playbackRate !== rate) {
      audio.defaultPlaybackRate = audio.playbackRate = rate;
    }
  }

  function setRate(r) {
    rate = Math.min(RATES.at(-1), Math.max(RATES[0], r));
    applyRate();
    render();
    try {
      chrome.storage.local.set({ driveAudioRate: rate });
    } catch {} // extension was reloaded; the page keeps working
  }

  function stepRate(dir) {
    const i = RATES.findIndex((r) => r >= rate);
    const at = i === -1 ? RATES.length - 1 : i;
    const next = RATES[rate === RATES[at] ? at + dir : dir > 0 ? at : at - 1];
    if (next) setRate(next);
  }

  function seek(t) {
    const end = Number.isFinite(audio.duration) ? audio.duration : t;
    audio.currentTime = Math.max(0, Math.min(end, t));
  }

  function toggle() {
    // Prefer Drive's own button so its icon stays in sync.
    const btn = playButton();
    if (btn) btn.click();
    else if (audio.paused) audio.play();
    else audio.pause();
  }

  function toggleLoop() {
    audio.loop = !audio.loop;
    render();
  }

  function cycleAB() {
    const t = audio.currentTime;
    if (ab.length === 0) ab = [t];
    else if (ab.length === 1) ab = t > ab[0] ? [ab[0], t] : [t];
    else ab = [];
    render();
    watchAB();
  }

  // timeupdate only fires ~4x a second; a frame loop keeps the B jump tight.
  function watchAB() {
    if (watching) return;
    watching = true;
    requestAnimationFrame(function tick() {
      if (ab.length !== 2 || audio.paused) return (watching = false);
      if (audio.currentTime >= ab[1]) audio.currentTime = ab[0];
      requestAnimationFrame(tick);
    });
  }

  // ---- placement ----------------------------------------------------------

  const playButton = () =>
    [...document.querySelectorAll(PLAY_BUTTON)].find((b) => b.offsetWidth);

  const ancestor = (el, test) => {
    while (el && !test(el)) el = el.parentElement;
    return el;
  };

  // Drive's player only exists while the preview is open, so poll while we
  // might be visible and stop once the preview is gone.
  function track() {
    clearInterval(timer);
    timer = setInterval(place, 400);
    place();
  }

  function place() {
    const btn = playButton();
    const row = btn && ancestor(btn, (el) => el.offsetWidth > 300); // play + waveform
    const volume = row?.nextElementSibling; // Drive's volume row
    const body = row?.parentElement;
    const card = body && ancestor(body, (el) =>
      getComputedStyle(el).backgroundColor !== 'rgba(0, 0, 0, 0)');

    const visible = audio?.currentSrc && (btn ? !!body : !audio.paused);
    if (!visible) {
      show(false);
      if (!audio || audio.paused) clearInterval(timer);
      return;
    }

    const s = ui.host.style;
    if (!btn) {
      // Drive changed its markup: float at the bottom instead of failing.
      setMode('below');
      Object.assign(s, { left: '50%', top: '', bottom: '24px', width: '', height: '' });
    } else {
      const b = body.getBoundingClientRect();
      const v = volume?.getBoundingClientRect();
      if (v?.height && b.width >= INLINE_MIN_WIDTH) {
        // Sit in the empty space either side of Drive's volume slider.
        setMode('inline');
        Object.assign(s, {
          left: b.left + 'px', top: v.top + 'px', bottom: '',
          width: b.width + 'px', height: v.height + 'px',
        });
      } else {
        const c = (card ?? body).getBoundingClientRect();
        setMode('below');
        Object.assign(s, {
          left: c.left + c.width / 2 + 'px', top: c.bottom + 12 + 'px',
          bottom: '', width: '', height: '',
        });
      }
    }
    show(true);
  }

  function setMode(mode) {
    ui.bar.className = `bar ${mode}`;
    ui.host.style.setProperty('--x', mode === 'below' ? '-50%' : '0');
  }

  function show(on) {
    shown = on;
    if (ui) ui.host.style.display = on ? 'block' : 'none';
  }

  // ---- keyboard -----------------------------------------------------------

  // Space is left alone: Drive already handles it.
  const KEYS = {
    k: toggle,
    j: () => seek(audio.currentTime - SKIP),
    l: () => seek(audio.currentTime + SKIP),
    '<': () => stepRate(-1),
    '>': () => stepRate(1),
    r: toggleLoop,
  };

  addEventListener('keydown', (e) => {
    if (!shown || e.ctrlKey || e.metaKey || e.altKey) return;
    const target = e.composedPath()[0];
    if (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

    // Shift + , / . by physical key too, since not every layout types < and > there.
    const key = e.shiftKey && e.code === 'Comma' ? '<'
      : e.shiftKey && e.code === 'Period' ? '>'
      : e.key.length === 1 ? e.key.toLowerCase() : e.key;
    let action = KEYS[key];
    if (!action && /^\d$/.test(key) && Number.isFinite(audio.duration)) {
      action = () => seek((audio.duration * key) / 10);
    }
    if (!action) return;

    e.preventDefault();
    e.stopImmediatePropagation();
    action();
  }, true);

  // ---- ui -----------------------------------------------------------------

  // Drive enforces Trusted Types, so the UI is built node by node, not via innerHTML.
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const SVG_TAGS = new Set(['svg', 'path', 'text']);

  function h(tag, attrs = {}, ...kids) {
    const el = SVG_TAGS.has(tag)
      ? document.createElementNS(SVG_NS, tag)
      : document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    el.append(...kids);
    return el;
  }

  const icon = (...kids) => h('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }, ...kids);
  const skipIcon = (flip) => icon(
    h('path', {
      d: 'M12 5V2L7 6l5 4V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z',
      ...(flip && { transform: 'matrix(-1 0 0 1 24 0)' }),
    }),
    h('text', { x: 12, y: 15.6, 'text-anchor': 'middle' }, String(SKIP)));
  const pathIcon = (d) => icon(h('path', { d }));
  const ICON_LOOP = 'M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z';
  const ICON_MINUS = 'M19 13H5v-2h14v2z';
  const ICON_PLUS = 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z';

  const CSS = `
    :host { all: initial; position: fixed; z-index: 2147483647; display: none;
      transform: translateX(var(--x, 0)); pointer-events: none; }
    .bar { display: flex; align-items: center; justify-content: space-between;
      box-sizing: border-box; width: 100%; height: 100%; color: rgb(227, 227, 227);
      font: 500 14px/1 "Google Sans", Roboto, Arial, sans-serif; }
    .bar.below { gap: 16px; padding: 4px 12px; border-radius: 28px;
      background: rgb(40, 42, 44); box-shadow: 0 4px 12px rgba(0, 0, 0, .4); }
    .group { display: flex; align-items: center; gap: 4px; pointer-events: auto; }
    button { all: unset; box-sizing: border-box; display: flex; align-items: center;
      justify-content: center;
      min-width: 40px; height: 40px; padding: 0 8px; border-radius: 20px;
      cursor: pointer; color: inherit; font: inherit;
      font-variant-numeric: tabular-nums; transition: background .15s, color .15s; }
    button:hover { background: rgba(227, 227, 227, .08); }
    button:active { background: rgba(227, 227, 227, .16); }
    button:focus-visible { outline: 2px solid rgb(168, 199, 250); outline-offset: -2px; }
    button.on { color: rgb(168, 199, 250); }
    svg { width: 24px; height: 24px; fill: currentColor; }
    text { font: 700 7px Roboto, Arial, sans-serif; }
    .rate { min-width: 56px; }
    .ab span { opacity: .45; }
    .ab span.set { opacity: 1; color: rgb(168, 199, 250); }
  `;

  function build() {
    const host = document.createElement('supersnacks-drive-audio');
    const root = host.attachShadow({ mode: 'closed' });

    const button = (title, onClick, ...kids) => {
      const b = h('button', { title }, ...kids);
      b.addEventListener('click', () => audio && onClick());
      return b;
    };

    const rate = button('Playback speed — click to reset, scroll to change', () => setRate(1));
    rate.className = 'rate';
    rate.addEventListener('wheel', (e) => {
      e.preventDefault();
      stepRate(e.deltaY < 0 ? 1 : -1);
    }, { passive: false });

    const loop = button('Loop (R)', toggleLoop, pathIcon(ICON_LOOP));
    const abParts = [h('span', {}, 'A'), h('span', {}, 'B')];
    const abButton = button('A–B repeat: set A, set B, clear', cycleAB, abParts[0], '–', abParts[1]);
    abButton.className = 'ab';

    const bar = h('div', { class: 'bar' },
      h('div', { class: 'group' },
        button(`Back ${SKIP} s (J)`, () => seek(audio.currentTime - SKIP), skipIcon(false)),
        button(`Forward ${SKIP} s (L)`, () => seek(audio.currentTime + SKIP), skipIcon(true))),
      h('div', { class: 'group' },
        button('Slower (Shift + ,)', () => stepRate(-1), pathIcon(ICON_MINUS)),
        rate,
        button('Faster (Shift + .)', () => stepRate(1), pathIcon(ICON_PLUS)),
        loop,
        abButton));

    root.append(h('style', {}, CSS), bar);
    document.documentElement.append(host);
    return { host, bar, rate, loop, ab: abParts };
  }

  function render() {
    if (!ui || !audio) return;
    ui.rate.textContent = `${+audio.playbackRate.toFixed(2)}×`;
    ui.loop.classList.toggle('on', audio.loop);
    ui.ab.forEach((s, i) => s.classList.toggle('set', i < ab.length));
  }
})();
