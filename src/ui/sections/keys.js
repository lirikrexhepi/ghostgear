import { el, group, header } from '../controls.js';
import { REMAP_KEY_CATEGORIES } from '../../devices/keyboard/mk12-layout.js';

const toLayoutId = id => (id === 'Backslash' ? 'IntlRo' : id);
const toViewerId = id => (id === 'IntlRo' ? 'Backslash' : id);
const LABELS = new Map();
REMAP_KEY_CATEGORIES.forEach(c => c.keys.forEach(k => LABELS.set(k.code, k.label)));
const LOCKED = ['Fn'];

export class KeysSection {
  constructor() {
    this.id = 'keys';
    this.label = 'Keys';
    this.interactive = true;
    this.selected = [];
    this.query = '';
  }

  enter(ctx) {
    this.ctx = ctx;
    this.device = ctx.device;
    this.selected = [];
    this.query = '';
    this.render();
  }

  leave() {
    const v = this.ctx && this.ctx.viewer;
    if (v) v.setDisabled([]);
    if (this.ctx) this.ctx.setHint(null);
  }

  onViewer(viewer) {
    viewer.setDisabled(LOCKED);
    this.syncLabels();
  }

  key(viewerId) {
    return this.device.layout.keys.find(k => k.id === toLayoutId(viewerId));
  }

  mappedCode(viewerId) {
    const k = this.key(viewerId);
    if (!k) return null;
    return this.device.keyRemaps.has(k.id) ? this.device.keyRemaps.get(k.id) : k.code;
  }

  mappedLabel(viewerId) {
    const code = this.mappedCode(viewerId);
    const k = this.key(viewerId);
    return LABELS.get(code) || (k && code === k.code ? k.label : `#${code}`);
  }

  isRemapped(viewerId) {
    const k = this.key(viewerId);
    return !!k && this.device.keyRemaps.has(k.id);
  }

  describe(viewerId) {
    return this.isRemapped(viewerId) ? `sends ${this.mappedLabel(viewerId)}` : null;
  }

  onSelection(ids) {
    this.selected = ids.slice();
    this.render();
  }

  syncLabels() {
    const v = this.ctx && this.ctx.viewer;
    if (!v) return;
    this.device.layout.keys.forEach(k => {
      const vid = toViewerId(k.id);
      v.setLabel(vid, this.device.keyRemaps.has(k.id) ? this.mappedLabel(vid) : null);
    });
  }

  assign(code) {
    this.selected.forEach(vid => {
      const k = this.key(vid);
      if (!k) return;
      if (code === k.code) this.device.clearKeyRemap(k.id);
      else this.device.remapKey(k.id, code);
    });
    this.syncLabels();
    this.renderChips();
    this.renderFoot();
    this.renderHeader();
  }

  remappedIds() {
    return Array.from(this.device.keyRemaps.keys()).map(toViewerId);
  }

  render() {
    const { scroll } = this.ctx;
    scroll.replaceChildren();
    const idle = this.selected.length === 0 && this.device.keyRemaps.size === 0;
    this.ctx.setPanel(!idle);
    this.ctx.setHint(idle ? 'Click a key to remap it' : null);
    if (this.selected.length === 0) {
      this.renderEmpty();
    } else {
      this.headerSlot = el('div');
      this.search = el('input', { class: 'search', type: 'search', placeholder: 'Search', value: this.query, 'aria-label': 'Search keys' });
      this.search.addEventListener('input', () => {
        this.query = this.search.value.trim().toLowerCase();
        this.renderChips();
      });
      this.chipSlot = el('div');
      scroll.append(this.headerSlot, el('div', { class: 'group' }, [this.search]), this.chipSlot);
      this.renderHeader();
      this.renderChips();
    }
    this.renderFoot();
  }

  renderHeader() {
    if (!this.headerSlot) return;
    const v = this.ctx.viewer;
    const names = this.selected.map(id => (v && v.getPart(id) ? v.getPart(id).name : id));
    const title = this.selected.length === 1 ? names[0] : `${this.selected.length} keys`;
    let sub = 'Default';
    if (this.selected.length === 1 && this.isRemapped(this.selected[0])) sub = `Sends ${this.mappedLabel(this.selected[0])}`;
    else if (this.selected.length > 1) sub = names.join(', ');
    this.headerSlot.replaceChildren(header(title, sub));
  }

  renderEmpty() {
    const { scroll } = this.ctx;
    this.headerSlot = null;
    const remapped = this.remappedIds();
    const children = [header('Keys', 'Click a key to remap it. Shift-click to pick several.')];
    if (remapped.length) {
      const list = el('div', { class: 'list' });
      remapped.forEach(vid => {
        const k = this.key(vid);
        const item = el('button', { class: 'list-item' }, [
          el('span', { text: k ? k.label : vid }),
          el('span', { class: 'row-value', text: this.mappedLabel(vid) })
        ]);
        item.addEventListener('click', () => this.ctx.viewer && this.ctx.viewer.select([vid]));
        list.appendChild(item);
      });
      children.push(group('Remapped', [list]));
    }
    scroll.append(...children);
  }

  renderChips() {
    if (!this.chipSlot) return;
    const current = this.selected.length === 1 ? this.mappedCode(this.selected[0]) : null;
    const q = this.query;
    const groups = [];
    REMAP_KEY_CATEGORIES.forEach(cat => {
      const keys = cat.keys.filter(k => !q || k.label.toLowerCase().includes(q) || cat.name.toLowerCase().includes(q));
      if (!keys.length) return;
      const chips = el('div', { class: 'chips' });
      keys.forEach(k => {
        const chip = el('button', { class: 'chip', 'aria-pressed': String(k.code === current), title: k.label, text: k.label });
        chip.addEventListener('click', () => this.assign(k.code));
        chips.appendChild(chip);
      });
      groups.push(group(cat.name.replace(' & ', ' and '), [chips]));
    });
    if (!groups.length) groups.push(el('p', { class: 'hint', text: 'No matches.' }));
    this.chipSlot.replaceChildren(...groups);
  }

  renderFoot() {
    const { foot } = this.ctx;
    foot.replaceChildren();
    if (this.selected.length) {
      const anyRemapped = this.selected.some(id => this.isRemapped(id));
      const reset = el('button', { class: 'link', text: 'Use default' });
      reset.addEventListener('click', () => {
        this.selected.forEach(id => {
          const k = this.key(id);
          if (k) this.device.clearKeyRemap(k.id);
        });
        this.syncLabels();
        this.render();
      });
      const done = el('button', { class: 'link', text: 'Done' });
      done.addEventListener('click', () => this.ctx.viewer && this.ctx.viewer.clearSelection());
      foot.append(anyRemapped ? reset : el('span'), done);
      return;
    }
    const count = this.device.keyRemaps.size;
    if (!count) {
      foot.append(el('span', { text: 'All keys use their defaults.' }));
      return;
    }
    const resetAll = el('button', { class: 'link danger', text: 'Reset all' });
    resetAll.addEventListener('click', () => {
      this.device.resetKeyRemaps();
      this.syncLabels();
      this.render();
    });
    foot.append(el('span', { text: `${count} remapped · ${this.device.isMock ? 'demo device' : this.device.supports && this.device.supports.keymap ? 'saved to the keyboard' : 'not saved to the keyboard yet'}` }), resetAll);
  }
}
