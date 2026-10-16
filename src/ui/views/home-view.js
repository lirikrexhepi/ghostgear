import { state } from '../../core/state.js';
import { hidManager } from '../../core/hid-manager.js';
import { eventBus } from '../../core/event-bus.js';
import keyboardImage from '../../assets/images/mk12_keyboard.png';
import mouseImage from '../../assets/images/r1_mouse.png';
import headsetImage from '../../assets/images/cloud3_headset.png';

const PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
const WIFI = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="20" r="1" fill="currentColor"/></svg>';
const CABLE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="6" y="3" width="12" height="11" rx="2.5"/><path d="M10 14v4a2 2 0 0 0 4 0v-4"/><path d="M9 7v1M15 7v1"/></svg>';
const CLOSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M7 7l10 10M17 7L7 17"/></svg>';
const CHEVRON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';

function batteryIcon(level) {
  const fill = Math.max(1, Math.round((Math.min(100, level) / 100) * 11));
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="17" height="10" rx="2.5"/><path d="M22 10.5v3" stroke-linecap="round"/><rect x="4.5" y="9.5" width="${fill}" height="5" rx="1" fill="currentColor" stroke="none"/></svg>`;
}

function isWired(device) {
  return device.connectionMode === 'wired';
}

export function deviceStatus(device) {
  if (isWired(device)) return `${device.connectionType || 'USB'} · Wired`;
  return `2.4G · ${device.battery}%`;
}

function statsHtml(device) {
  if (isWired(device)) {
    return `<span class="stat">${CABLE}${device.connectionType || 'USB'}</span><span class="stat">${batteryIcon(100)}Wired</span>`;
  }
  return `<span class="stat">${WIFI}2.4G</span><span class="stat">${batteryIcon(device.battery)}${device.battery}%</span>`;
}

export class HomeView {
  constructor(container) {
    this.container = container;
    this.onChange = () => {
      if (this.container.isConnected) this.render();
    };
    this.render();
    this.offs = ['device:added', 'device:removed', 'device:battery', 'devices:restored'].map(ev => eventBus.on(ev, this.onChange));
  }

  destroy() {
    this.offs.forEach(off => off());
  }

  render() {
    const cards = state.devices
      .map(device => {
        let image = mouseImage;
        if (device.type === 'keyboard') image = keyboardImage;
        else if (device.type === 'headset') image = headsetImage;
        return `
          <div class="card-wrap">
          <button class="device-card" data-device-id="${device.id}" aria-label="Configure ${device.displayName}">
            <div class="device-card-media" data-kind="${device.type}"><img src="${image}" alt=""></div>
            <div class="device-card-body">
              <div class="device-card-top">
                <span class="device-card-name">${device.displayName}</span>
                <span class="configure">${CHEVRON}</span>
              </div>
              <div class="device-card-bottom">
                <span class="device-card-stats">${statsHtml(device)}</span>
              </div>
            </div>
          </button>
          <button class="card-remove" data-remove="${device.id}" aria-label="Remove ${device.displayName}">${CLOSE}<span>Remove</span></button>
          </div>
        `;
      })
      .join('');

    this.container.innerHTML = `
      <div class="home">
        <h1 class="home-title">Devices</h1>
        <div class="device-grid">
          ${cards}
        </div>
        ${state.devices.length === 0 && hidManager.restored ? '<p class="home-empty">No devices connected</p>' : ''}
        <p class="home-note">Use the receiver or a cable. Bluetooth isn't supported.</p>
        <button class="home-add" id="btn-add" aria-label="Add device">${PLUS}</button>
      </div>
    `;

    this.container.querySelectorAll('.device-card').forEach(card => {
      card.addEventListener('click', () => {
        const dev = state.devices.find(d => d.id === card.dataset.deviceId);
        if (dev) state.selectDevice(dev);
      });
    });
    this.container.querySelector('#btn-add').addEventListener('click', () => hidManager.requestDevice());
    this.container.querySelectorAll('.card-remove').forEach(btn => {
      const reset = () => btn.classList.remove('confirm');
      btn.closest('.card-wrap').addEventListener('mouseleave', reset);
      btn.addEventListener('blur', reset);
      btn.addEventListener('click', e => {
        e.stopPropagation();
        if (!btn.classList.contains('confirm')) {
          btn.classList.add('confirm');
          return;
        }
        const dev = state.devices.find(d => d.id === btn.dataset.remove);
        if (dev) hidManager.forgetDevice(dev);
      });
    });
  }
}
