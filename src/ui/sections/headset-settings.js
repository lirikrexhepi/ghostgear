import { el, group, header, toggle, row } from '../controls.js';
import { eventBus } from '../../core/event-bus.js';

export class HeadsetAudioSection {
  constructor() {
    this.id = 'audio';
    this.label = 'Audio';
    this.interactive = false;
    this.off = null;
  }

  enter(ctx) {
    this.ctx = ctx;
    const d = ctx.device;

    const sidetoneToggle = toggle(d.sidetone, on => d.setSidetone(on), 'Mic monitoring');
    const sidetoneRow = row('Mic monitoring', sidetoneToggle);
    const hint = el('p', { class: 'hint', text: 'Hear your voice through the headset with zero latency.' });

    this.off = eventBus.on('device:sidetone_updated', on => {
      sidetoneToggle.setAttribute('aria-checked', String(!!on));
    });

    ctx.scroll.replaceChildren(
      header('Audio'),
      group('Microphone', [sidetoneRow, hint])
    );
    ctx.foot.replaceChildren(el('span', { text: d.isMock ? 'Demo device' : 'Saved to the headset' }));
  }

  leave() {
    if (this.off) {
      this.off();
      this.off = null;
    }
  }
}
