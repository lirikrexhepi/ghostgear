import { el, group, header, slider } from '../controls.js';

const COLORS = ['#FF3B30', '#0A84FF', '#34C759', '#FFCC00', '#BF5AF2', '#FF9500'];
const MAX_DPI = 18000;
const MAX_STAGES = 6;

export class DpiSection {
  constructor() {
    this.id = 'dpi';
    this.label = 'DPI';
    this.interactive = false;
  }

  enter(ctx) {
    this.ctx = ctx;
    this.device = ctx.device;
    this.editing = this.device.currentDpiStage;
    this.render();
  }

  leave() {}

  render() {
    const d = this.device;
    const stages = d.dpiStages;
    if (this.editing >= stages.length) this.editing = stages.length - 1;
    const list = el('div', { class: 'dpi-stages' });
    stages.forEach((st, i) => {
      const active = i === d.currentDpiStage;
      const item = el('button', { class: 'dpi-stage', 'aria-pressed': String(i === this.editing) }, [
        el('span', { class: 'dpi-stage-dot', style: { background: st.color } }),
        el('span', { class: 'dpi-stage-value', text: st.dpi.toLocaleString() }),
        el('span', { class: 'row-value', text: active ? 'Active' : '' })
      ]);
      item.addEventListener('click', () => {
        this.editing = i;
        d.setDpiStage(i);
        this.render();
      });
      list.appendChild(item);
    });

    const toDpi = x => Math.max(100, Math.round((100 * Math.pow(MAX_DPI / 100, x / 1000)) / 50) * 50);
    const toPos = dpi => Math.round((Math.log(dpi / 100) / Math.log(MAX_DPI / 100)) * 1000);
    const value = slider({
      label: `Stage ${this.editing + 1}`,
      min: 0,
      max: 1000,
      step: 1,
      value: toPos(stages[this.editing].dpi),
      format: x => `${toDpi(x).toLocaleString()} DPI`,
      onInput: x => {
        const v = toDpi(x);
        stages[this.editing].dpi = v;
        const label = list.children[this.editing].querySelector('.dpi-stage-value');
        if (label) label.textContent = v.toLocaleString();
      },
      onChange: x => d.setDpiValue(this.editing, toDpi(x))
    });

    const actions = el('div', { style: { display: 'flex', justifyContent: 'space-between', marginTop: '12px' } });
    if (stages.length < MAX_STAGES) {
      const add = el('button', { class: 'link', text: 'Add stage' });
      add.addEventListener('click', () => {
        const lastDpi = stages[stages.length - 1].dpi;
        stages.push({ dpi: Math.min(MAX_DPI, lastDpi * 2), color: COLORS[stages.length % COLORS.length] });
        this.editing = stages.length - 1;
        d.setDpiStageCount();
        this.render();
      });
      actions.appendChild(add);
    } else {
      actions.appendChild(el('span'));
    }
    if (stages.length > 1) {
      const remove = el('button', { class: 'link danger', text: 'Remove' });
      remove.addEventListener('click', () => {
        stages.splice(this.editing, 1);
        if (d.currentDpiStage >= stages.length) d.currentDpiStage = stages.length - 1;
        this.editing = Math.max(0, this.editing - 1);
        d.setDpiStageCount();
        this.render();
      });
      actions.appendChild(remove);
    }

    this.ctx.scroll.replaceChildren(
      header('DPI', `${stages[d.currentDpiStage].dpi.toLocaleString()} active`),
      group('Stages', [list, actions]),
      group('', [value])
    );
    this.ctx.foot.replaceChildren();
  }
}
