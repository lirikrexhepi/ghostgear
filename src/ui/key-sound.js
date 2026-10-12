const files = import.meta.glob('../assets/sounds/keyboard/*.wav', { eager: true, query: '?url', import: 'default' });

const STORAGE_KEY = 'gear_keysound_muted';
const HEAVY = new Set(['Space', 'Enter', 'NumpadEnter', 'Backspace']);

const urls = { down: [], up: [], heavy: [] };
Object.entries(files)
  .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
  .forEach(([path, url]) => {
    const name = path.split('/').pop();
    if (name.startsWith('down-')) urls.down.push(url);
    else if (name.startsWith('up-')) urls.up.push(url);
    else if (name.startsWith('heavy-')) urls.heavy.push(url);
  });

let ctx = null;
let master = null;
let buffers = null;
let loading = null;
let muted = localStorage.getItem(STORAGE_KEY) === '1';
const listeners = new Set();

function context() {
  if (!ctx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor({ latencyHint: 'interactive' });
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
  }
  return ctx;
}

function decode(c, data) {
  return new Promise((resolve, reject) => c.decodeAudioData(data, resolve, reject));
}

async function load() {
  const c = context();
  if (!c) return null;
  const fetchAll = list =>
    Promise.all(
      list.map(async url => {
        const res = await fetch(url);
        return decode(c, await res.arrayBuffer());
      })
    );
  const [down, up, heavy] = await Promise.all([fetchAll(urls.down), fetchAll(urls.up), fetchAll(urls.heavy)]);
  buffers = { down, up, heavy };
  return buffers;
}

const pick = list => list[Math.floor(Math.random() * list.length)];

function play(buffer, gain) {
  const c = ctx;
  const src = c.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = 0.94 + Math.random() * 0.12;
  const g = c.createGain();
  g.gain.value = gain * (0.85 + Math.random() * 0.25);
  src.connect(g);
  g.connect(master);
  src.start();
  src.onended = () => {
    src.disconnect();
    g.disconnect();
  };
}

export const keySound = {
  get muted() {
    return muted;
  },

  setMuted(value) {
    muted = !!value;
    localStorage.setItem(STORAGE_KEY, muted ? '1' : '0');
    listeners.forEach(fn => fn(muted));
  },

  onMuteChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  prepare() {
    if (!loading) loading = load().catch(() => null);
    return loading;
  },

  resume() {
    const c = context();
    if (c && c.state !== 'running') c.resume().catch(() => {});
    this.prepare();
  },

  down(code) {
    if (muted || !buffers || !ctx || ctx.state !== 'running') return;
    play(pick(HEAVY.has(code) ? buffers.heavy : buffers.down), 1);
  },

  up() {
    if (muted || !buffers || !ctx || ctx.state !== 'running') return;
    play(pick(buffers.up), 0.8);
  }
};
