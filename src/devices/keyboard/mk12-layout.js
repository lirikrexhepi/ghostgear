// Meetion MK12 65% (68 Keys) layout metadata & matrix mapping
// Coordinates and dimensions extracted from official driver profiles

export const MK12_LAYOUT = {
  width: 732,
  height: 226,
  keys: [
    // Row 0 (Number / Esc Row)
    { id: 'Escape', x: 1, y: 1, w: 40, h: 40, label: 'Esc', subLabel: '`~', code: 41 },
    { id: 'Digit1', x: 47, y: 1, w: 40, h: 40, label: '1', subLabel: '!', code: 30 },
    { id: 'Digit2', x: 93, y: 1, w: 40, h: 40, label: '2', subLabel: '@', code: 31 },
    { id: 'Digit3', x: 139, y: 1, w: 40, h: 40, label: '3', subLabel: '#', code: 32 },
    { id: 'Digit4', x: 185, y: 1, w: 40, h: 40, label: '4', subLabel: '$', code: 33 },
    { id: 'Digit5', x: 231, y: 1, w: 40, h: 40, label: '5', subLabel: '%', code: 34 },
    { id: 'Digit6', x: 277, y: 1, w: 40, h: 40, label: '6', subLabel: '^', code: 35 },
    { id: 'Digit7', x: 323, y: 1, w: 40, h: 40, label: '7', subLabel: '&', code: 36 },
    { id: 'Digit8', x: 369, y: 1, w: 40, h: 40, label: '8', subLabel: '*', code: 37 },
    { id: 'Digit9', x: 415, y: 1, w: 40, h: 40, label: '9', subLabel: '(', code: 38 },
    { id: 'Digit0', x: 461, y: 1, w: 40, h: 40, label: '0', subLabel: ')', code: 39 },
    { id: 'Minus', x: 507, y: 1, w: 40, h: 40, label: '-', subLabel: '_', code: 45 },
    { id: 'Equal', x: 553, y: 1, w: 40, h: 40, label: '=', subLabel: '+', code: 46 },
    { id: 'Backspace', x: 599, y: 1, w: 86, h: 40, label: 'Backspace', code: 42 },
    { id: 'LED_Mode', x: 691, y: 1, w: 40, h: 40, label: '💡', subLabel: 'RGB', code: 250, isSpecial: true },

    // Row 1 (Tab / QWERTY Row)
    { id: 'Tab', x: 1, y: 47, w: 66, h: 40, label: 'Tab', code: 43 },
    { id: 'KeyQ', x: 73, y: 47, w: 40, h: 40, label: 'Q', code: 20 },
    { id: 'KeyW', x: 119, y: 47, w: 40, h: 40, label: 'W', code: 26 },
    { id: 'KeyE', x: 165, y: 47, w: 40, h: 40, label: 'E', code: 8 },
    { id: 'KeyR', x: 211, y: 47, w: 40, h: 40, label: 'R', code: 21 },
    { id: 'KeyT', x: 257, y: 47, w: 40, h: 40, label: 'T', code: 23 },
    { id: 'KeyY', x: 303, y: 47, w: 40, h: 40, label: 'Y', code: 28 },
    { id: 'KeyU', x: 349, y: 47, w: 40, h: 40, label: 'U', code: 24 },
    { id: 'KeyI', x: 395, y: 47, w: 40, h: 40, label: 'I', code: 12 },
    { id: 'KeyO', x: 441, y: 47, w: 40, h: 40, label: 'O', code: 18 },
    { id: 'KeyP', x: 487, y: 47, w: 40, h: 40, label: 'P', code: 19 },
    { id: 'BracketLeft', x: 533, y: 47, w: 40, h: 40, label: '[', subLabel: '{', code: 47 },
    { id: 'BracketRight', x: 579, y: 47, w: 40, h: 40, label: ']', subLabel: '}', code: 48 },
    { id: 'Insert', x: 691, y: 47, w: 40, h: 40, label: 'Ins', code: 73 },

    // Row 2 (Caps / Home Row)
    { id: 'CapsLock', x: 1, y: 93, w: 72, h: 40, label: 'Caps', code: 57 },
    { id: 'KeyA', x: 79, y: 93, w: 40, h: 40, label: 'A', code: 4 },
    { id: 'KeyS', x: 125, y: 93, w: 40, h: 40, label: 'S', code: 22 },
    { id: 'KeyD', x: 171, y: 93, w: 40, h: 40, label: 'D', code: 7 },
    { id: 'KeyF', x: 217, y: 93, w: 40, h: 40, label: 'F', code: 9 },
    { id: 'KeyG', x: 263, y: 93, w: 40, h: 40, label: 'G', code: 10 },
    { id: 'KeyH', x: 309, y: 93, w: 40, h: 40, label: 'H', code: 11 },
    { id: 'KeyJ', x: 355, y: 93, w: 40, h: 40, label: 'J', code: 13 },
    { id: 'KeyK', x: 401, y: 93, w: 40, h: 40, label: 'K', code: 14 },
    { id: 'KeyL', x: 447, y: 93, w: 40, h: 40, label: 'L', code: 15 },
    { id: 'Semicolon', x: 493, y: 93, w: 40, h: 40, label: ';', subLabel: ':', code: 51 },
    { id: 'Quote', x: 539, y: 93, w: 40, h: 40, label: "'", subLabel: '"', code: 52 },
    { id: 'IntlRo', x: 585, y: 93, w: 40, h: 40, label: '\\', subLabel: '|', code: 49 },
    { id: 'Enter', x: 631, y: 47, w: 54, h: 86, label: 'Enter', code: 40 },
    { id: 'PageUp', x: 691, y: 93, w: 40, h: 40, label: 'PgUp', code: 75 },

    // Row 3 (Shift / Bottom-Alpha Row)
    { id: 'ShiftLeft', x: 1, y: 139, w: 93, h: 40, label: 'Shift', code: 225 },
    { id: 'KeyZ', x: 100, y: 139, w: 40, h: 40, label: 'Z', code: 29 },
    { id: 'KeyX', x: 146, y: 139, w: 40, h: 40, label: 'X', code: 27 },
    { id: 'KeyC', x: 192, y: 139, w: 40, h: 40, label: 'C', code: 6 },
    { id: 'KeyV', x: 238, y: 139, w: 40, h: 40, label: 'V', code: 25 },
    { id: 'KeyB', x: 284, y: 139, w: 40, h: 40, label: 'B', code: 5 },
    { id: 'KeyN', x: 330, y: 139, w: 40, h: 40, label: 'N', code: 17 },
    { id: 'KeyM', x: 376, y: 139, w: 40, h: 40, label: 'M', code: 16 },
    { id: 'Comma', x: 422, y: 139, w: 40, h: 40, label: ',', subLabel: '<', code: 54 },
    { id: 'Period', x: 468, y: 139, w: 40, h: 40, label: '.', subLabel: '>', code: 55 },
    { id: 'Slash', x: 514, y: 139, w: 40, h: 40, label: '/', subLabel: '?', code: 56 },
    { id: 'ShiftRight', x: 560, y: 139, w: 79, h: 40, label: 'Shift', code: 229 },
    { id: 'ArrowUp', x: 645, y: 139, w: 40, h: 40, label: '↑', code: 82 },
    { id: 'PageDown', x: 691, y: 139, w: 40, h: 40, label: 'PgDn', code: 78 },

    // Row 4 (Modifiers / Spacebar Row)
    { id: 'ControlLeft', x: 1, y: 185, w: 48, h: 40, label: 'Ctrl', code: 224 },
    { id: 'MetaLeft', x: 55, y: 185, w: 48, h: 40, label: 'Win', code: 227 },
    { id: 'AltLeft', x: 109, y: 185, w: 48, h: 40, label: 'Alt', code: 226 },
    { id: 'Space', x: 163, y: 185, w: 292, h: 40, label: 'Space', code: 44 },
    { id: 'AltRight', x: 461, y: 185, w: 40, h: 40, label: 'Alt', code: 230 },
    { id: 'Fn', x: 507, y: 185, w: 40, h: 40, label: 'Fn', code: 254, isSpecial: true },
    { id: 'ControlRight', x: 553, y: 185, w: 40, h: 40, label: 'Ctrl', code: 228 },
    { id: 'ArrowLeft', x: 599, y: 185, w: 40, h: 40, label: '←', code: 80 },
    { id: 'ArrowDown', x: 645, y: 185, w: 40, h: 40, label: '↓', code: 81 },
    { id: 'ArrowRight', x: 691, y: 185, w: 40, h: 40, label: '→', code: 79 }
  ]
};

// Standard key picker categories for remap modal
export const REMAP_KEY_CATEGORIES = [
  {
    name: 'Alphanumeric',
    keys: [
      { label: 'A', code: 4 }, { label: 'B', code: 5 }, { label: 'C', code: 6 }, { label: 'D', code: 7 },
      { label: 'E', code: 8 }, { label: 'F', code: 9 }, { label: 'G', code: 10 }, { label: 'H', code: 11 },
      { label: 'I', code: 12 }, { label: 'J', code: 13 }, { label: 'K', code: 14 }, { label: 'L', code: 15 },
      { label: 'M', code: 16 }, { label: 'N', code: 17 }, { label: 'O', code: 18 }, { label: 'P', code: 19 },
      { label: 'Q', code: 20 }, { label: 'R', code: 21 }, { label: 'S', code: 22 }, { label: 'T', code: 23 },
      { label: 'U', code: 24 }, { label: 'V', code: 25 }, { label: 'W', code: 26 }, { label: 'X', code: 27 },
      { label: 'Y', code: 28 }, { label: 'Z', code: 29 },
      { label: '1', code: 30 }, { label: '2', code: 31 }, { label: '3', code: 32 }, { label: '4', code: 33 },
      { label: '5', code: 34 }, { label: '6', code: 35 }, { label: '7', code: 36 }, { label: '8', code: 37 },
      { label: '9', code: 38 }, { label: '0', code: 39 }
    ]
  },
  {
    name: 'Function Keys',
    keys: [
      { label: 'F1', code: 58 }, { label: 'F2', code: 59 }, { label: 'F3', code: 60 }, { label: 'F4', code: 61 },
      { label: 'F5', code: 62 }, { label: 'F6', code: 63 }, { label: 'F7', code: 64 }, { label: 'F8', code: 65 },
      { label: 'F9', code: 66 }, { label: 'F10', code: 67 }, { label: 'F11', code: 68 }, { label: 'F12', code: 69 }
    ]
  },
  {
    name: 'Navigation & Editing',
    keys: [
      { label: 'Esc', code: 41 }, { label: 'Enter', code: 40 }, { label: 'Backspace', code: 42 }, { label: 'Tab', code: 43 },
      { label: 'Space', code: 44 }, { label: 'Insert', code: 73 }, { label: 'Delete', code: 76 },
      { label: 'Home', code: 74 }, { label: 'End', code: 77 }, { label: 'PgUp', code: 75 }, { label: 'PgDn', code: 78 },
      { label: '←', code: 80 }, { label: '↑', code: 82 }, { label: '↓', code: 81 }, { label: '→', code: 79 }
    ]
  },
  {
    name: 'Modifiers',
    keys: [
      { label: 'L-Ctrl', code: 224 }, { label: 'L-Shift', code: 225 }, { label: 'L-Alt', code: 226 }, { label: 'L-Win', code: 227 },
      { label: 'R-Ctrl', code: 228 }, { label: 'R-Shift', code: 229 }, { label: 'R-Alt', code: 230 }, { label: 'Caps Lock', code: 57 }
    ]
  },
  {
    name: 'Multimedia & Audio',
    keys: [
      { label: 'Vol +', code: 128 }, { label: 'Vol -', code: 129 }, { label: 'Mute', code: 127 },
      { label: 'Play/Pause', code: 205 }, { label: 'Next Track', code: 181 }, { label: 'Prev Track', code: 182 },
      { label: 'Calculator', code: 148 }
    ]
  }
];

export const MK12_LED_INDEX = {
  Escape: 1, Digit1: 7, Digit2: 13, Digit3: 19, Digit4: 25, Digit5: 31, Digit6: 37, Digit7: 43, Digit8: 49, Digit9: 55,
  Digit0: 61, Minus: 67, Equal: 73, Backspace: 79, LED_Mode: 85,
  Tab: 2, KeyQ: 8, KeyW: 14, KeyE: 20, KeyR: 26, KeyT: 32, KeyY: 38, KeyU: 44, KeyI: 50, KeyO: 56, KeyP: 62,
  BracketLeft: 68, BracketRight: 74, Insert: 86,
  CapsLock: 3, KeyA: 9, KeyS: 15, KeyD: 21, KeyF: 27, KeyG: 33, KeyH: 39, KeyJ: 45, KeyK: 51, KeyL: 57,
  Semicolon: 63, Quote: 69, IntlRo: 75, Enter: 81, PageUp: 87,
  ShiftLeft: 4, KeyZ: 16, KeyX: 22, KeyC: 28, KeyV: 34, KeyB: 40, KeyN: 46, KeyM: 52, Comma: 58, Period: 64, Slash: 70,
  ShiftRight: 76, ArrowUp: 82, PageDown: 88,
  ControlLeft: 5, MetaLeft: 17, AltLeft: 23, Space: 41, AltRight: 59, Fn: 65, ControlRight: 71,
  ArrowLeft: 77, ArrowDown: 83, ArrowRight: 89
};
