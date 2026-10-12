import { createDeviceViewer } from '../index.js';
import { MK12_KEYS } from '../keyboard/layout.js';
import keyboardImage from '../../assets/images/mk12_keyboard.jpg';
import mouseImage from '../../assets/images/r1_mouse.jpg';

const params = new URLSearchParams(location.search);
const only = params.get('device');
const solo = params.get('solo') === '1';
if (solo) document.body.classList.add('solo');
if (params.get('theme') === 'dark') document.documentElement.dataset.theme = 'dark';

const MOUSE_IDS = [
  ['btn_left', 'Left button'],
  ['btn_right', 'Right button'],
  ['btn_middle', 'Wheel click'],
  ['wheel_scroll', 'Wheel scroll'],
  ['btn_forward', 'Side 1 (front)'],
  ['btn_back', 'Side 2 (rear)'],
  ['btn_dpi', 'DPI button']
];

const assignments = new Map();
const logEl = document.getElementById('log');

function log(kind, data) {
  const t = new Date();
  const stamp = `${String(t.getMinutes()).padStart(2, '0')}:${String(t.getSeconds()).padStart(2, '0')}.${String(t.getMilliseconds()).padStart(3, '0')}`;
  logEl.textContent += `${stamp}  ${kind.padEnd(16)} ${typeof data === 'string' ? data : JSON.stringify(data)}\n`;
  logEl.scrollTop = logEl.scrollHeight;
}

const viewers = {};
const fallback = { keyboard: keyboardImage, mouse: mouseImage };

['keyboard', 'mouse'].forEach(device => {
  const stage = document.getElementById(`stage-${device}`);
  const card = stage.closest('.dev-card');
  if (only && only !== device) {
    card.remove();
    return;
  }
  const viewer = createDeviceViewer(stage, {
    device,
    theme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
    fallbackImage: fallback[device],
    fallbackAlt: device,
    autoRotate: !solo,
    describe: id => assignments.get(`${device}:${id}`) || null,
    onHover: id => log(`${device}.hover`, String(id)),
    onClick: (id, info) => log(`${device}.click`, { id, ...info }),
    onSelectionChange: ids => log(`${device}.select`, ids)
  });
  viewer.on('scroll', (id, d) => log(`${device}.scroll`, { id, d: Number(d.toFixed(2)) }));
  viewer.on('blocked', id => log(`${device}.blocked`, id));
  viewers[device] = viewer;
});

window.__viewers = viewers;

function idOptions(device) {
  if (device === 'keyboard') return MK12_KEYS.map(k => [k.id, `${k.id} (${k.name})`]);
  return MOUSE_IDS;
}

document.querySelectorAll('.dev-controls').forEach(box => {
  const device = box.dataset.for;
  const viewer = viewers[device];
  if (!viewer) return;
  const sel = document.createElement('select');
  idOptions(device).forEach(([id, label]) => {
    const o = document.createElement('option');
    o.value = id;
    o.textContent = label;
    sel.appendChild(o);
  });
  box.appendChild(sel);
  const add = (label, fn) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.addEventListener('click', () => fn(sel.value, b));
    box.appendChild(b);
    return b;
  };
  add('Select', id => viewer.select([id]));
  add('Clear', () => viewer.clearSelection());
  add('Highlight', id => viewer.highlight(id, '#FFB020'));
  add('Unhighlight', () => viewer.clearHighlight());
  add('Press', id => viewer.press(id));
  add('Release', id => viewer.release(id));
  add('Tap', id => viewer.tap(id));
  const label = document.createElement('input');
  label.type = 'text';
  label.placeholder = 'Label';
  label.size = 8;
  box.appendChild(label);
  add('Set label', id => viewer.setLabel(id, label.value));
  const disabled = new Set();
  add('Disable', id => {
    if (disabled.has(id)) disabled.delete(id);
    else disabled.add(id);
    viewer.setDisabled(Array.from(disabled));
    log(`${device}.disabled`, Array.from(disabled));
  });
  add('Assign', id => {
    assignments.set(`${device}:${id}`, label.value || 'Unassigned');
    log(`${device}.assign`, { id, to: label.value });
  });
  ['home', 'top', 'front', 'side', 'back', 'bottom'].forEach(v => add(v, () => viewer.setView(v)));
  add('Reset', () => viewer.resetView());
  if (device === 'keyboard') {
    const color = document.createElement('input');
    color.type = 'color';
    color.value = '#00ccff';
    box.appendChild(color);
    const range = document.createElement('input');
    range.type = 'range';
    range.min = '0';
    range.max = '1';
    range.step = '0.05';
    range.value = '0.8';
    box.appendChild(range);
    const apply = () => viewer.setRGB(color.value, Number(range.value));
    color.addEventListener('input', apply);
    range.addEventListener('input', apply);
    add('RGB off', () => viewer.setRGB(null));
  }
});

document.querySelectorAll('.dev-tools button').forEach(btn => {
  btn.addEventListener('click', async () => {
    const act = btn.dataset.act;
    if (act === 'theme') {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      Object.values(viewers).forEach(v => v.setTheme(next));
    } else if (act === 'live') {
      const on = btn.getAttribute('aria-pressed') !== 'true';
      btn.setAttribute('aria-pressed', String(on));
      Object.values(viewers).forEach(v => v.setLiveInput(on));
    } else if (act === 'rotate') {
      const on = btn.getAttribute('aria-pressed') !== 'true';
      btn.setAttribute('aria-pressed', String(on));
      Object.values(viewers).forEach(v => v.setAutoRotate(on));
    } else if (act === 'export') {
      for (const [device, v] of Object.entries(viewers)) {
        const blob = await v.exportGLB();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${device}.glb`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        log('export', { device, bytes: blob.size });
      }
    }
  });
});

document.querySelector('[data-act="clear-log"]').addEventListener('click', () => {
  logEl.textContent = '';
});
