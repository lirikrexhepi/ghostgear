import { el, group, header, CHECK } from '../controls.js';

const ACTIONS = ['Left Click', 'Right Click', 'Middle Click', 'Forward', 'Back', 'DPI Cycle', 'Disabled'];
const FLIP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.7"/><path d="M20 4v4.7h-4.7"/><path d="M20 12a8 8 0 0 1-13.7 5.6L4 15.3"/><path d="M4 20v-4.7h4.7"/></svg>';

export class ButtonsSection {
  constructor() {
    this.id = 'buttons';
    this.label = 'Buttons';
    this.interactive = true;
    this.selected = null;
    this.flipped = false;
  }

  enter(ctx) {
    this.ctx = ctx;
    this.device = ctx.device;
    this.selected = null;
    this.flipBtn = el('button', { class: 'icon-button', 'aria-label': 'Show underside', title: 'Flip', html: FLIP });
    this.flipBtn.addEventListener('click', () => this.flip(!this.flipped));
    ctx.topRight.prepend(this.flipBtn);
    this.render();
  }

  leave() {
    if (this.flipBtn) this.flipBtn.remove();
    if (this.flipped) this.flip(false);
  }

  onViewer() {
    this.syncLabels();
  }

  flip(on) {
    this.flipped = on;
    const v = this.ctx.viewer;
    if (v) v.setView(on ? 'bottom' : 'home');
  }

  button(id) {
    return this.device.buttons.find(b => b.id === id);
  }

  describe(id) {
    const b = this.button(id);
    return b ? b.currentAction : null;
  }

  onSelection(ids) {
    const id = ids[ids.length - 1];
    this.selected = this.button(id) ? id : null;
    this.render();
  }

  syncLabels() {
    const v = this.ctx && this.ctx.viewer;
    if (!v) return;
    this.device.buttons.forEach(b => {
      if (b.id === 'btn_dpi') return;
      v.setLabel(b.id, b.currentAction !== b.defaultAction ? b.currentAction : null);
    });
  }

  pick(id) {
    const v = this.ctx.viewer;
    if (!v) return;
    if (id === 'btn_dpi' && !this.flipped) this.flip(true);
    v.select([id]);
  }

  async assign(action) {
    await this.device.remapButton(this.selected, action);
    this.syncLabels();
    this.render();
  }

  render() {
    const { scroll, foot } = this.ctx;
    foot.replaceChildren();
    if (!this.selected) {
      const list = el('div', { class: 'list' });
      this.device.buttons.forEach(b => {
        const item = el('button', { class: 'list-item' }, [el('span', { text: b.name }), el('span', { class: 'row-value', text: b.currentAction })]);
        item.addEventListener('click', () => this.pick(b.id));
        list.appendChild(item);
      });
      scroll.replaceChildren(header('Buttons', 'Click a button on the mouse or pick one below.'), group('', [list]));
      const changed = this.device.buttons.some(b => b.currentAction !== b.defaultAction);
      const reset = el('button', { class: 'link danger', text: 'Reset all' });
      reset.addEventListener('click', async () => {
        for (const b of this.device.buttons) await this.device.remapButton(b.id, b.defaultAction);
        this.syncLabels();
        this.render();
      });
      foot.append(el('span', { text: 'Not saved to the mouse yet' }), changed ? reset : el('span'));
      return;
    }
    const b = this.button(this.selected);
    const list = el('div', { class: 'list', role: 'listbox', 'aria-label': `${b.name} action` });
    ACTIONS.forEach(a => {
      const item = el('button', { class: 'list-item', role: 'option', 'aria-pressed': String(a === b.currentAction), 'aria-selected': String(a === b.currentAction) }, [
        el('span', { text: a }),
        el('span', { html: CHECK })
      ]);
      item.addEventListener('click', () => this.assign(a));
      list.appendChild(item);
    });
    scroll.replaceChildren(header(b.name, b.currentAction === b.defaultAction ? 'Default' : `Was ${b.defaultAction}`), group('Action', [list]));
    const def = el('button', { class: 'link', text: 'Use default' });
    def.addEventListener('click', () => this.assign(b.defaultAction));
    const done = el('button', { class: 'link', text: 'Done' });
    done.addEventListener('click', () => this.ctx.viewer && this.ctx.viewer.clearSelection());
    foot.append(b.currentAction !== b.defaultAction ? def : el('span'), done);
  }
}
