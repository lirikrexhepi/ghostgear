import { state } from '../../core/state.js';
import { eventBus } from '../../core/event-bus.js';
import { mountDevice3D } from '../components/device-3d.js';
import { createTypingTest, ICON_TYPING } from '../components/typing-test.js';
import { el, segmented } from '../controls.js';
import { ICON_SUN, ICON_MOON } from '../app-shell.js';
import { deviceStatus } from './home-view.js';
import { toast } from '../toast.js';
import { KeysSection } from '../sections/keys.js';
import { LightingSection } from '../sections/lighting.js';
import { PaintSection } from '../sections/paint.js';
import { KeyboardSettingsSection } from '../sections/keyboard-settings.js';
import { ButtonsSection } from '../sections/buttons.js';
import { DpiSection } from '../sections/dpi.js';
import { MouseSettingsSection } from '../sections/mouse-settings.js';
import { HeadsetAudioSection } from '../sections/headset-settings.js';

const CHEVRON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';

const HEADSET_EMBED = 'https://sketchfab.com/models/6f4043e2ef664e51a28cfb393a93888f/embed';
const HEADSET_EMBED_PARAMS = ['autostart=1', 'preload=1', 'transparent=1', 'dnt=1', 'ui_controls=0', 'ui_infos=0', 'ui_stop=0', 'ui_inspector=0', 'ui_watermark=0', 'ui_watermark_link=0', 'ui_ar=0', 'ui_help=0', 'ui_settings=0', 'ui_vr=0', 'ui_fullscreen=0', 'ui_annotations=0', 'ui_hint=0', 'ui_loading=0'].join('&');
const HEADSET_PAGE = 'https://sketchfab.com/3d-models/hyperx-headphone-6f4043e2ef664e51a28cfb393a93888f';

const lastSection = new Map();
let nudged = false;

export class DeviceView {
  constructor(container, device) {
    this.container = container;
    this.device = device;
    if (device.type === 'keyboard') {
      this.sections = [new KeysSection(), new LightingSection(), new PaintSection(), new KeyboardSettingsSection()];
    } else if (device.type === 'mouse') {
      this.sections = [new ButtonsSection(), new DpiSection(), new MouseSettingsSection()];
    } else {
      this.sections = [new HeadsetAudioSection()];
    }
    this.active = null;
    this.offs = [];
    this.render();
  }

  get viewer() {
    return this.mount3d ? this.mount3d.viewer : null;
  }

  insetRight() {
    return window.innerWidth > 860 ? 380 : 0;
  }

  render() {
    const stage = el('div', { class: 'stage' });
    this.inspectorScroll = el('div', { class: 'inspector-scroll' });
    this.inspectorFoot = el('div', { class: 'inspector-foot' });
    this.inspector = el('aside', { class: 'inspector', 'aria-label': 'Settings' }, [this.inspectorScroll, this.inspectorFoot]);

    const back = el('button', { class: 'back', 'aria-label': 'Back to devices' }, [
      el('span', { class: 'back-chevron', html: CHEVRON }),
      el('span', {}, [
        el('div', { class: 'back-name', text: this.device.displayName }),
        el('div', { class: 'back-meta', text: deviceStatus(this.device) })
      ])
    ]);
    back.addEventListener('click', () => state.goHome());

    const initial = lastSection.get(this.device.id) || this.sections[0].id;
    this.tabs = segmented(
      this.sections.map(s => ({ value: s.id, label: s.label })),
      initial,
      id => this.show(id),
      { label: 'Sections' }
    );

    const theme = el('button', { class: 'icon-button', 'aria-label': 'Toggle appearance', html: state.theme === 'dark' ? ICON_SUN : ICON_MOON });
    theme.addEventListener('click', () => state.toggleTheme());
    this.offs.push(eventBus.on('theme:changed', t => {
      theme.innerHTML = t === 'dark' ? ICON_SUN : ICON_MOON;
    }));
    this.topRight = el('div', { style: { display: 'flex', gap: '4px', alignItems: 'center' } }, [theme]);
    if (this.device.type === 'keyboard') {
      this.typing = createTypingTest({ getViewer: () => this.viewer });
      this.typingToggle = el('button', {
        class: 'icon-button typing-toggle',
        type: 'button',
        'aria-label': 'Typing test',
        'aria-pressed': 'false',
        title: 'Typing test',
        html: ICON_TYPING
      });
      this.typingToggle.addEventListener('click', () => {
        const on = this.typing.toggle();
        this.typingToggle.setAttribute('aria-pressed', String(on));
        this.typingToggle.blur();
      });
      this.topRight.prepend(this.typingToggle);
    }

    const topbar = el('div', { class: 'topbar' }, [back, this.tabs, this.topRight]);
    this.hint = el('div', { class: 'stage-hint hidden', 'aria-hidden': 'true' });
    this.root = el('div', { class: 'device-page' }, [stage, topbar, this.inspector, this.hint, this.typing ? this.typing.root : null]);
    this.container.appendChild(this.root);

    this.panelVisible = true;
    this.syncTyping();
    if (this.device.type === 'headset') {
      const frame = el('iframe', {
        class: 'embed-frame',
        title: 'HyperX Headphone',
        src: `${HEADSET_EMBED}?${HEADSET_EMBED_PARAMS}`,
        allow: 'autoplay; fullscreen; xr-spatial-tracking',
        allowfullscreen: true,
        loading: 'lazy'
      });
      const credit = el('p', { class: 'embed-credit' }, [
        el('a', { href: HEADSET_PAGE, target: '_blank', rel: 'nofollow noopener', text: 'HyperX Headphone' }),
        ' by ',
        el('a', { href: 'https://sketchfab.com/Mohamed-amr', target: '_blank', rel: 'nofollow noopener', text: 'Mohamed-amr' }),
        ' on ',
        el('a', { href: 'https://sketchfab.com', target: '_blank', rel: 'nofollow noopener', text: 'Sketchfab' })
      ]);
      stage.appendChild(el('div', { class: 'stage-embed' }, [frame, credit]));
      this.mount3d = {
        ready: Promise.resolve(null),
        viewer: null,
        destroy: () => {}
      };
    } else {
      this.mount3d = mountDevice3D(stage, this.device, {
        insetRight: this.insetRight(),
        reserveRight: this.insetRight(),
        partNames: this.partNames(),
        describe: id => (this.active && this.active.describe ? this.active.describe(id) : null),
        onClick: (id, info) => this.active && this.active.onPartClick && this.active.onPartClick(id, info),
        onSelectionChange: ids => this.active && this.active.onSelection && this.active.onSelection(ids)
      });
    }

    this.onResize = () => {
      this.syncTyping();
      if (this.viewer) this.viewer.setInsets({ right: this.panelVisible ? this.insetRight() : 0, reserve: this.insetRight(), animate: false });
    };
    window.addEventListener('resize', this.onResize);

    this.offs.push(eventBus.on('device:error', ({ id }) => {
      if (id === this.device.id) toast(`Couldn't reach the ${this.device.type}`);
    }));
    this.offs.push(eventBus.on('device:lighting_updated', () => this.active && this.active.onDeviceUpdate && this.active.onDeviceUpdate()));
    const nudge = () => {
      if (!this.device.isMock || nudged) return;
      nudged = true;
      toast(`Preview only. Add your ${this.device.type} on the home screen to apply changes.`, 4200);
    };
    ['device:lighting_updated', 'device:perkey_updated', 'device:debounce_updated', 'device:sleep_updated', 'device:keymap_updated', 'device:sidetone_updated', 'mouse:button_remapped', 'mouse:dpi_updated', 'mouse:polling_updated', 'mouse:param_updated', 'mouse:lod_updated', 'mouse:sleep_updated', 'mouse:debounce_updated'].forEach(ev => this.offs.push(eventBus.on(ev, nudge)));

    this.show(initial);
    this.mount3d.ready.then(viewer => {
      if (!viewer || !this.root.isConnected) return;
      viewer.setInteractive(!!(this.active && this.active.interactive));
      viewer.setInsets({ right: this.panelVisible ? this.insetRight() : 0, reserve: this.insetRight(), animate: false });
      if (this.active && this.active.onViewer) this.active.onViewer(viewer);
    });
  }

  syncTyping() {
    if (this.typing) this.typing.setInset(this.panelVisible ? this.insetRight() : 0);
  }

  partNames() {
    const names = {};
    if (this.device.type === 'keyboard' && this.device.layout) {
      this.device.layout.keys.forEach(k => {
        const id = k.id === 'IntlRo' ? 'Backslash' : k.id;
        names[id] = /^[A-Za-z0-9]$/.test(k.label) || k.label.length > 1 ? k.label : id;
      });
    } else if (this.device.buttons) {
      this.device.buttons.forEach(b => {
        names[b.id] = b.name;
      });
    }
    return names;
  }

  context() {
    const view = this;
    return {
      device: this.device,
      scroll: this.inspectorScroll,
      foot: this.inspectorFoot,
      topRight: this.topRight,
      setPanel: visible => view.setPanel(visible),
      setHint: text => view.setHint(text),
      get viewer() {
        return view.viewer;
      }
    };
  }

  setPanel(visible) {
    if (this.panelVisible === visible) return;
    this.panelVisible = visible;
    this.syncTyping();
    this.inspector.classList.toggle('hidden', !visible);
    if (this.viewer) this.viewer.setInsets({ right: visible ? this.insetRight() : 0, reserve: this.insetRight() });
  }

  setHint(text) {
    if (text) this.hint.textContent = text;
    this.hint.classList.toggle('hidden', !text);
  }

  show(id) {
    const next = this.sections.find(s => s.id === id) || this.sections[0];
    if (this.active === next) return;
    if (this.active) this.active.leave();
    this.active = next;
    lastSection.set(this.device.id, next.id);
    this.inspectorScroll.replaceChildren();
    this.inspectorFoot.replaceChildren();
    this.inspectorScroll.scrollTop = 0;
    this.setHint(null);
    this.setPanel(true);
    next.enter(this.context());
    const v = this.viewer;
    if (v) {
      v.setInteractive(!!next.interactive);
      v.clearSelection({ silent: true });
      if (next.onViewer) next.onViewer(v);
    }
  }

  destroy() {
    if (this.active) this.active.leave();
    this.offs.forEach(off => off());
    window.removeEventListener('resize', this.onResize);
    if (this.typing) this.typing.destroy();
    if (this.mount3d) this.mount3d.destroy();
  }
}
