import { state } from '../core/state.js';
import { eventBus } from '../core/event-bus.js';

export const ICON_SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4"/></svg>';
export const ICON_MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';
const LOGO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a8 8 0 0 0-8 8v10l3-2 2.5 1.7 2.5-1.7 2.5 1.7L17 18l3 2V10a8 8 0 0 0-8-8z"/><circle cx="9.5" cy="10" r="1" fill="currentColor" stroke="none"/><circle cx="14.5" cy="10" r="1" fill="currentColor" stroke="none"/></svg>';

export class AppShell {
  constructor(container) {
    this.container = container;
    this.render();
    eventBus.on('theme:changed', () => this.renderThemeIcon());
    eventBus.on('view:changed', () => this.syncHeader());
  }

  render() {
    this.container.innerHTML = `
      <header class="header" id="app-header">
        <button class="brand" id="btn-home" aria-label="Devices">${LOGO}<span>Ghost Gear</span></button>
        <button class="icon-button" id="btn-theme" aria-label="Toggle appearance"></button>
      </header>
      <main class="main" id="app-main-content"></main>
      <div class="toast" id="toast" role="status" aria-live="polite"></div>
    `;
    this.container.querySelector('#btn-home').addEventListener('click', () => state.goHome());
    this.container.querySelector('#btn-theme').addEventListener('click', () => state.toggleTheme());
    this.renderThemeIcon();
    this.syncHeader();
  }

  renderThemeIcon() {
    const btn = this.container.querySelector('#btn-theme');
    if (btn) btn.innerHTML = state.theme === 'dark' ? ICON_SUN : ICON_MOON;
  }

  syncHeader() {
    const header = this.container.querySelector('#app-header');
    if (header) header.style.display = state.currentView === 'device' ? 'none' : '';
  }
}
