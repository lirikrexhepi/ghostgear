const svg = body => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const ICONS = {
  polling: svg('<path class="i-trace" pathLength="1" d="M3 12h4l2.5-6 4 12 2.5-6H21"/>'),
  liftoff: svg('<g class="i-lift"><rect x="8" y="3" width="8" height="11" rx="4"/><path d="M12 3v4"/></g><path class="i-ground" d="M4 20h16"/>'),
  sensor: svg('<circle cx="12" cy="12" r="6.5"/><circle class="i-core" cx="12" cy="12" r="1.8"/><g class="i-ticks"><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></g>'),
  sync: svg('<g class="i-spin"><path d="M20 11a8 8 0 0 0-13.7-4.6L4 8.7"/><path d="M4 4.5v4.2h4.2"/><path d="M4 13a8 8 0 0 0 13.7 4.6L20 15.3"/><path d="M20 19.5v-4.2h-4.2"/></g>'),
  angle: svg('<path d="M5 4v15h15"/><path class="i-snapline" d="M5 19L19 9"/>'),
  ripple: svg('<path class="i-trace" pathLength="1" d="M2.5 12c1.6-5 3.2-5 4.8 0s3.2 5 4.8 0 3.2-5 4.8 0 1.8 3.3 2.6 3"/>'),
  click: svg('<circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/><circle class="i-ring" cx="12" cy="12" r="5.5"/><circle class="i-ring i-ring-2" cx="12" cy="12" r="9"/>'),
  sleep: svg('<path class="i-moon" d="M20.5 13.2A8.5 8.5 0 1 1 10.8 3.5a6.6 6.6 0 0 0 9.7 9.7z"/><path class="i-z" d="M15 3.5h3.5L15 7h3.5"/>'),
  range: svg('<path d="M12 12.5V20"/><circle cx="12" cy="10" r="1.3" fill="currentColor" stroke="none"/><path class="i-arc" d="M9.2 7.2a4 4 0 0 0 0 5.6M14.8 7.2a4 4 0 0 1 0 5.6"/><path class="i-arc i-arc-2" d="M6.6 4.6a7.6 7.6 0 0 0 0 10.8M17.4 4.6a7.6 7.6 0 0 1 0 10.8"/>'),
  light: svg('<path class="i-bulb" d="M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.2 1.1 2.2h5c0-1 .4-1.7 1.1-2.2A6 6 0 0 0 12 3z"/><path d="M9.5 19h5M10.5 21.5h3"/>'),
  brightness: svg('<circle class="i-core" cx="12" cy="12" r="3.5"/><g class="i-ticks"><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/></g>'),
  chip: svg('<rect class="i-chip" x="7" y="7" width="10" height="10" rx="2"/><path d="M10 3v2M14 3v2M10 19v2M14 19v2M3 10h2M3 14h2M19 10h2M19 14h2"/>'),
  pair: svg('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path class="i-link" d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
  speed: svg('<path d="M4.5 18a8.5 8.5 0 1 1 15 0"/><path class="i-needle" d="M12 18l4-6"/>')
};
