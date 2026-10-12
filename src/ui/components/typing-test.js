import { el } from '../controls.js';
import { keySound } from '../key-sound.js';
import { TYPING_WORDS } from '../typing-words.js';

const LINES = 3;
const MIN_COLS = 16;
const MAX_COLS = 46;

const ICON_RESTART = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v4.5h-4.5"/></svg>';
const ICON_SOUND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6"/><path d="M18 6.5a8 8 0 0 1 0 11"/></svg>';
const ICON_MUTED = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>';
export const ICON_TYPING = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M6.5 10h.01M10 10h.01M14 10h.01M17.5 10h.01M8 14h8"/></svg>';

const VIEWER_ID = {
  NumpadEnter: 'Enter',
  IntlBackslash: 'Backslash',
  ContextMenu: 'Fn',
  Delete: 'Backspace'
};

function isEditable(target) {
  if (!target || !target.tagName) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

function randomWord(previous) {
  let word = previous;
  while (word === previous) word = TYPING_WORDS[Math.floor(Math.random() * TYPING_WORDS.length)];
  return word;
}

function buildLines(cols) {
  const lines = [];
  let previous = '';
  for (let i = 0; i < LINES; i += 1) {
    const words = [];
    let length = 0;
    for (;;) {
      const word = randomWord(previous);
      const next = length + (words.length ? 1 : 0) + word.length;
      if (next > cols && words.length) break;
      words.push(word);
      length = next;
      previous = word;
    }
    lines.push(words.join(' '));
  }
  return lines;
}

export function createTypingTest({ getViewer = () => null } = {}) {
  const textEl = el('div', { class: 'typing-text', 'aria-hidden': 'true' });
  const caret = el('div', { class: 'typing-caret' });
  const stat = el('div', { class: 'typing-stat', role: 'status', 'aria-live': 'polite' });
  const restartBtn = el('button', { class: 'typing-icon', type: 'button', 'aria-label': 'Restart test', title: 'Restart (Tab)', html: ICON_RESTART });
  const muteBtn = el('button', { class: 'typing-icon typing-mute', type: 'button', 'aria-label': 'Mute key sounds' });
  const bar = el('div', { class: 'typing-bar' }, [restartBtn, muteBtn]);
  const inner = el('div', { class: 'typing-inner' }, [textEl, bar, stat]);
  const probe = el('span', { class: 'typing-probe', text: 'mmmmmmmmmm', 'aria-hidden': 'true' });
  const root = el('div', { class: 'typing hidden', role: 'group', 'aria-label': 'Typing test' }, [inner, probe]);

  let open = false;
  let cols = 40;
  let target = '';
  let chars = [];
  let states = [];
  let history = [];
  let cursor = 0;
  let startedAt = 0;
  let finishedAt = 0;
  let correctKeys = 0;
  let totalKeys = 0;
  let liveTimer = null;
  let calmTimer = null;
  let laidOutWidth = 0;
  const pressed = new Set();

  const viewerId = code => VIEWER_ID[code] || code;

  function syncMute() {
    const muted = keySound.muted;
    muteBtn.innerHTML = muted ? ICON_MUTED : ICON_SOUND;
    muteBtn.setAttribute('aria-pressed', String(muted));
    muteBtn.setAttribute('aria-label', muted ? 'Unmute key sounds' : 'Mute key sounds');
    muteBtn.title = muted ? 'Sound off' : 'Sound on';
  }

  function charWidth() {
    const w = probe.getBoundingClientRect().width / 10;
    return w > 0 ? w : 13;
  }

  function measureCols() {
    const available = root.clientWidth - 48;
    if (available <= 0) return cols;
    return Math.max(MIN_COLS, Math.min(MAX_COLS, Math.floor(available / charWidth())));
  }

  function wpm() {
    const end = finishedAt || performance.now();
    const minutes = (end - startedAt) / 60000;
    if (!startedAt || minutes <= 0) return 0;
    const correct = states.reduce((n, s) => n + (s === 1 ? 1 : 0), 0);
    return Math.round(correct / 5 / minutes);
  }

  function accuracy() {
    return totalKeys ? Math.round((correctKeys / totalKeys) * 100) : 100;
  }

  function renderStat() {
    if (finishedAt) {
      stat.classList.add('done');
      stat.textContent = `${wpm()} wpm  ${accuracy()}%`;
    } else if (startedAt && performance.now() - startedAt > 1500) {
      stat.classList.remove('done');
      stat.textContent = `${wpm()}`;
    } else {
      stat.classList.remove('done');
      stat.textContent = '';
    }
  }

  function placeCaret() {
    if (!chars.length) return;
    const atEnd = cursor >= chars.length;
    const node = chars[atEnd ? chars.length - 1 : cursor];
    caret.style.height = `${node.offsetHeight}px`;
    const x = node.offsetLeft + (atEnd ? node.offsetWidth : 0);
    caret.style.transform = `translate(${x}px, ${node.offsetTop}px)`;
  }

  function paint(from, to) {
    for (let i = Math.max(0, from); i < Math.min(chars.length, to); i += 1) {
      const s = states[i];
      chars[i].className = s === 1 ? 'ch ok' : s === 2 ? 'ch bad' : 'ch';
    }
  }

  function build() {
    const lines = buildLines(cols);
    const texts = lines.map((line, i) => (i < lines.length - 1 ? `${line} ` : line));
    target = texts.join('');
    chars = [];
    textEl.style.width = `${Math.ceil(cols * charWidth()) + 2}px`;
    const lineNodes = texts.map(text => {
      const node = el('div', { class: 'typing-line' });
      for (const c of text) {
        const span = el('span', { class: 'ch', text: c });
        chars.push(span);
        node.appendChild(span);
      }
      return node;
    });
    textEl.replaceChildren(caret, ...lineNodes);
    states = new Array(chars.length).fill(0);
    history = [];
    cursor = 0;
    startedAt = 0;
    finishedAt = 0;
    correctKeys = 0;
    totalKeys = 0;
    clearInterval(liveTimer);
    liveTimer = null;
    root.classList.remove('finished');
    renderStat();
    placeCaret();
  }

  function restart() {
    cols = measureCols();
    laidOutWidth = root.clientWidth;
    build();
  }

  function finish() {
    finishedAt = performance.now();
    clearInterval(liveTimer);
    liveTimer = null;
    root.classList.add('finished');
    renderStat();
  }

  function begin() {
    if (startedAt) return;
    startedAt = performance.now();
    liveTimer = setInterval(renderStat, 500);
  }

  function typeChar(key) {
    if (finishedAt || cursor >= target.length) return;
    const expected = target[cursor];
    if (key === ' ') {
      const wordStart = cursor === 0 ? 0 : target.lastIndexOf(' ', cursor - 1) + 1;
      const nextSpace = target.indexOf(' ', cursor);
      if (expected === ' ') {
        begin();
        totalKeys += 1;
        correctKeys += 1;
        history.push(cursor);
        states[cursor] = 1;
        paint(cursor, cursor + 1);
        cursor += 1;
      } else if (cursor > wordStart && nextSpace !== -1) {
        totalKeys += 1;
        history.push(cursor);
        for (let i = cursor; i < nextSpace; i += 1) states[i] = 2;
        states[nextSpace] = 1;
        paint(cursor, nextSpace + 1);
        cursor = nextSpace + 1;
      }
    } else if (expected === ' ') {
      begin();
      totalKeys += 1;
    } else {
      begin();
      totalKeys += 1;
      history.push(cursor);
      if (key === expected) {
        correctKeys += 1;
        states[cursor] = 1;
      } else {
        states[cursor] = 2;
      }
      paint(cursor, cursor + 1);
      cursor += 1;
    }
    placeCaret();
    if (cursor >= target.length) finish();
    else renderStat();
  }

  function backspace() {
    if (finishedAt || !history.length) return;
    const previous = history.pop();
    for (let i = previous; i < cursor; i += 1) states[i] = 0;
    paint(previous, cursor);
    cursor = previous;
    placeCaret();
  }

  function calm() {
    root.classList.add('active');
    clearTimeout(calmTimer);
    calmTimer = setTimeout(() => root.classList.remove('active'), 650);
  }

  function pressViewer(code) {
    const v = getViewer();
    if (v && v.press) v.press(viewerId(code));
  }

  function releaseViewer(code) {
    const v = getViewer();
    if (v && v.release) v.release(viewerId(code));
  }

  function releaseAll() {
    pressed.forEach(releaseViewer);
    pressed.clear();
  }

  function onKeyDown(e) {
    if (!open || e.isComposing || isEditable(e.target)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^F\d+$/.test(e.code)) return;

    keySound.resume();
    e.preventDefault();
    e.stopImmediatePropagation();

    if (e.repeat && e.code !== 'Backspace') return;
    if (!e.repeat && !pressed.has(e.code)) {
      pressed.add(e.code);
      keySound.down(e.code);
      pressViewer(e.code);
    }

    if (e.code === 'Tab' || e.code === 'Escape') {
      restart();
      return;
    }
    calm();
    if (e.key === 'Backspace') backspace();
    else if (e.key.length === 1) typeChar(e.key);
  }

  function onKeyUp(e) {
    if (!pressed.has(e.code)) return;
    pressed.delete(e.code);
    releaseViewer(e.code);
    keySound.up(e.code);
    if (open && !isEditable(e.target)) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }

  function onPointer() {
    if (open) keySound.resume();
  }

  restartBtn.addEventListener('click', () => {
    restart();
    restartBtn.blur();
  });
  muteBtn.addEventListener('click', () => {
    keySound.setMuted(!keySound.muted);
    muteBtn.blur();
  });
  const offMute = keySound.onMuteChange(syncMute);
  syncMute();

  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('keyup', onKeyUp, true);
  window.addEventListener('blur', releaseAll);
  window.addEventListener('pointerdown', onPointer, true);

  const resizeObserver = new ResizeObserver(() => {
    if (!open) return;
    if (startedAt && !finishedAt) {
      placeCaret();
      return;
    }
    if (Math.abs(root.clientWidth - laidOutWidth) < 2) return;
    restart();
  });
  resizeObserver.observe(root);

  function setOpen(next) {
    if (next === open) return;
    open = next;
    root.classList.toggle('hidden', !open);
    if (open) {
      const active = document.activeElement;
      if (active && active !== document.body && active.blur) active.blur();
      keySound.resume();
      restart();
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => {
          if (open && !startedAt) restart();
        });
      }
    } else {
      releaseAll();
      clearInterval(liveTimer);
      liveTimer = null;
    }
  }

  return {
    root,
    get isOpen() {
      return open;
    },
    open: () => setOpen(true),
    close: () => setOpen(false),
    toggle() {
      setOpen(!open);
      return open;
    },
    setInset(px) {
      root.style.right = `${px}px`;
    },
    destroy() {
      open = false;
      releaseAll();
      clearInterval(liveTimer);
      clearTimeout(calmTimer);
      resizeObserver.disconnect();
      offMute();
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('blur', releaseAll);
      window.removeEventListener('pointerdown', onPointer, true);
      root.remove();
    }
  };
}
