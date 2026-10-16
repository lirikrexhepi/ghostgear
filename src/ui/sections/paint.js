import { el, group, header, segmented } from '../controls.js';
import { toast } from '../toast.js';

const PALETTE = ['#FF0000', '#FF6A00', '#FFD60A', '#4CFF1F', '#22E5FF', '#3B6CFF', '#A855F7', '#FF2D95', '#FFFFFF'];
const TOOLS = [{ value: 'paint', label: 'Paint' }, { value: 'erase', label: 'Erase' }, { value: 'pick', label: 'Pick' }];
const STORE_CURRENT = 'gear_paint_current';
const STORE_PATTERNS = 'gear_paint_patterns';
const UNDO_LIMIT = 40;
const GLOW = 1.4;
const TINT = 0.18;
const CLOSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 7l10 10M17 7L7 17"/></svg>';

const toLayoutId = id => (id === 'Backslash' ? 'IntlRo' : id);
const toViewerId = id => (id === 'IntlRo' ? 'Backslash' : id);
const hexToRgb = hex => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    toast("Couldn't save in this browser");
  }
}

export class PaintSection {
  constructor() {
    this.id = 'paint';
    this.label = 'Paint';
    this.interactive = true;
    this.color = PALETTE[0];
    this.tool = 'paint';
    this.cells = new Map(Object.entries(load(STORE_CURRENT, {})));
    this.undo = [];
    this.sending = false;
    this.sent = false;
  }

  enter(ctx) {
    this.ctx = ctx;
    this.device = ctx.device;
    this.render();
    this.arm();
  }

  leave() {
    const v = this.ctx && this.ctx.viewer;
    if (v) {
      v.setPaintHandler(null);
      v.setRGB(null);
      v.clearPartLights();
      v.resetPartTints();
    }
    if (this.ctx) this.ctx.setHint(null);
  }

  onViewer() {
    this.arm();
  }

  arm() {
    const v = this.ctx && this.ctx.viewer;
    if (!v) return;
    v.setPaintHandler((id, info) => this.stroke(toLayoutId(id), info));
    this.ctx.setHint('Click or drag across keys · right-click picks a colour');
    this.paintLights();
  }

  describe(viewerId) {
    return this.cells.get(toLayoutId(viewerId)) || null;
  }

  remember() {
    this.undo.push(new Map(this.cells));
    if (this.undo.length > UNDO_LIMIT) this.undo.shift();
  }

  stroke(keyId, info) {
    if (info.button === 2) {
      const picked = this.cells.get(keyId);
      if (picked) this.setColor(picked);
      return;
    }
    if (info.first) this.remember();
    if (this.tool === 'pick') {
      const picked = this.cells.get(keyId);
      if (picked) this.setColor(picked);
      this.setTool('paint');
      return;
    }
    if (this.tool === 'erase') this.cells.delete(keyId);
    else this.cells.set(keyId, this.color);
    this.changed();
  }

  changed() {
    this.sent = false;
    save(STORE_CURRENT, Object.fromEntries(this.cells));
    this.paintLights();
    this.paintFoot();
  }

  paintLights() {
    const v = this.ctx && this.ctx.viewer;
    if (!v) return;
    v.clearPartLights();
    v.resetPartTints();
    let sr = 0;
    let sg = 0;
    let sb = 0;
    this.cells.forEach((hex, keyId) => {
      const [r, g, b] = hexToRgb(hex);
      v.setPartLight(toViewerId(keyId), (r / 255) * GLOW, (g / 255) * GLOW, (b / 255) * GLOW);
      v.setPartTint(toViewerId(keyId), TINT + (1 - TINT) * (r / 255), TINT + (1 - TINT) * (g / 255), TINT + (1 - TINT) * (b / 255));
      sr += r;
      sg += g;
      sb += b;
    });
    const n = this.cells.size;
    if (n) {
      const peak = Math.max(sr, sg, sb) || 1;
      v.setRGB(`rgb(${Math.round((sr / peak) * 255)},${Math.round((sg / peak) * 255)},${Math.round((sb / peak) * 255)})`, Math.min(0.2, n / 340));
    } else {
      v.setRGB(null);
    }
  }

  setColor(hex) {
    this.color = hex.toUpperCase();
    if (this.tool === 'erase') this.setTool('paint');
    this.paintSwatches();
  }

  setTool(tool) {
    this.tool = tool;
    if (this.toolControl) this.toolControl.set(tool);
  }

  fill() {
    this.remember();
    this.device.layout.keys.forEach(k => this.cells.set(k.id, this.color));
    this.changed();
  }

  clear() {
    if (!this.cells.size) return;
    this.remember();
    this.cells.clear();
    this.changed();
  }

  back() {
    const prev = this.undo.pop();
    if (!prev) return;
    this.cells = prev;
    this.changed();
  }

  patterns() {
    return load(STORE_PATTERNS, []);
  }

  savePattern() {
    if (!this.cells.size) {
      toast('Paint some keys first');
      return;
    }
    const list = this.patterns();
    list.push({ name: `Pattern ${list.length + 1}`, cells: Object.fromEntries(this.cells) });
    save(STORE_PATTERNS, list);
    this.render();
  }

  loadPattern(index) {
    const hit = this.patterns()[index];
    if (!hit) return;
    this.remember();
    this.cells = new Map(Object.entries(hit.cells));
    this.changed();
  }

  deletePattern(index) {
    const list = this.patterns();
    list.splice(index, 1);
    save(STORE_PATTERNS, list);
    this.render();
  }

  async send() {
    if (this.sending) return;
    this.sending = true;
    this.paintFoot();
    try {
      const colors = new Map();
      this.cells.forEach((hex, keyId) => colors.set(keyId, hexToRgb(hex)));
      await this.device.writePerKey(colors);
      this.sent = true;
    } catch (e) {
      toast("Couldn't reach the keyboard");
    }
    this.sending = false;
    this.paintFoot();
  }

  paintSwatches() {
    (this.swatchButtons || []).forEach(({ b, c }) => b.setAttribute('aria-pressed', String(c === this.color)));
    if (this.customSwatch) this.customSwatch.setAttribute('aria-pressed', String(!PALETTE.includes(this.color)));
    if (this.picker) this.picker.value = this.color.toLowerCase();
  }

  paintFoot() {
    if (!this.statusEl) return;
    this.statusEl.textContent = this.sending ? 'Sending, this takes a few seconds' : this.sent ? 'Sent to the keyboard' : this.device.isMock ? 'Demo device' : 'Not sent yet';
    this.sendButton.disabled = this.sending;
    this.sendButton.textContent = this.sending ? 'Sending' : 'Send to keyboard';
  }

  render() {
    const { scroll, foot } = this.ctx;
    this.swatchButtons = [];
    const swatches = el('div', { class: 'swatches' });
    PALETTE.forEach(c => {
      const b = el('button', { class: 'swatch', type: 'button', style: { background: c }, 'aria-label': c, 'aria-pressed': String(c === this.color) });
      b.addEventListener('click', () => this.setColor(c));
      swatches.appendChild(b);
      this.swatchButtons.push({ b, c });
    });
    this.picker = el('input', { type: 'color', value: this.color.toLowerCase(), 'aria-label': 'Custom colour' });
    this.picker.addEventListener('input', () => this.setColor(this.picker.value));
    this.customSwatch = el('label', { class: 'swatch custom', title: 'Custom', 'aria-pressed': String(!PALETTE.includes(this.color)) }, [this.picker]);
    swatches.appendChild(this.customSwatch);

    this.toolControl = segmented(TOOLS, this.tool, v => {
      this.tool = v;
    }, { small: true, label: 'Tool' });
    const action = (label, fn, cls = 'link') => {
      const b = el('button', { class: cls, type: 'button', text: label });
      b.addEventListener('click', fn);
      return b;
    };
    const actions = el('div', { class: 'paint-actions' }, [
      action('Undo', () => this.back()),
      action('Fill', () => this.fill()),
      action('Clear', () => this.clear(), 'link danger')
    ]);

    const saved = this.patterns();
    const list = el('div', { class: 'list' });
    saved.forEach((p, i) => {
      const item = el('div', { class: 'list-item pattern' }, [
        el('button', { class: 'pattern-name', type: 'button', text: p.name }),
        el('span', { class: 'row-value', text: `${Object.keys(p.cells).length} keys` })
      ]);
      item.querySelector('.pattern-name').addEventListener('click', () => this.loadPattern(i));
      const del = el('button', { class: 'pattern-delete', type: 'button', 'aria-label': `Delete ${p.name}`, html: CLOSE });
      del.addEventListener('click', () => this.deletePattern(i));
      item.appendChild(del);
      list.appendChild(item);
    });
    const patternHead = el('div', { class: 'group-head' }, [el('h3', { class: 'group-label', text: 'Patterns' }), action('Save current', () => this.savePattern())]);

    scroll.replaceChildren(
      header('Paint', 'Colour keys, then send the pattern to the keyboard.'),
      group('Colour', [swatches]),
      group('Tool', [this.toolControl, actions]),
      el('section', { class: 'group' }, [patternHead, saved.length ? list : el('p', { class: 'inspector-sub', text: 'Saved patterns show up here.' })])
    );

    this.statusEl = el('span');
    this.sendButton = el('button', { class: 'primary-button', type: 'button' });
    this.sendButton.addEventListener('click', () => this.send());
    foot.replaceChildren(this.statusEl, this.sendButton);
    this.paintFoot();
  }
}
