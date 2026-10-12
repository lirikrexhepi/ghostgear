const ROW_TO_PROFILE = [0, 1, 2, 3, 4];

function k(id, name, x, row, w, group, legend, extra = {}) {
  return { id, name, x, row, w, h: 1, colorGroup: group, legend, profileRow: ROW_TO_PROFILE[row], ...extra };
}

const B = 'base';
const A = 'accent';

export const MK12_KEYS = [
  k('Escape', 'KC_ESC', 0, 0, 1, B, { tl: 'esc', bl: '~', br: '`' }),
  k('Digit1', 'KC_1', 1, 0, 1, B, { tl: '1', tr: '!', bl: 'brightnessDown', br: 'F1' }),
  k('Digit2', 'KC_2', 2, 0, 1, B, { tl: '2', tr: '@', bl: 'brightnessUp', br: 'F2' }),
  k('Digit3', 'KC_3', 3, 0, 1, B, { tl: '3', tr: '#', bl: 'taskView', br: 'F3' }),
  k('Digit4', 'KC_4', 4, 0, 1, B, { tl: '4', tr: '$', bl: 'search', br: 'F4' }),
  k('Digit5', 'KC_5', 5, 0, 1, A, { tl: '5', tr: '%', bl: 'grid', br: 'F5' }),
  k('Digit6', 'KC_6', 6, 0, 1, A, { tl: '6', tr: '^', bl: 'sleep', br: 'F6' }),
  k('Digit7', 'KC_7', 7, 0, 1, A, { tl: '7', tr: '&', bl: 'prev', br: 'F7' }),
  k('Digit8', 'KC_8', 8, 0, 1, A, { tl: '8', tr: '*', bl: 'playPause', br: 'F8' }),
  k('Digit9', 'KC_9', 9, 0, 1, B, { tl: '9', tr: '(', bl: 'next', br: 'F9' }),
  k('Digit0', 'KC_0', 10, 0, 1, B, { tl: '0', tr: ')', bl: 'mute', br: 'F10' }),
  k('Minus', 'KC_MINS', 11, 0, 1, B, { tl: '-', tr: '_', bl: 'volDown', br: 'F11' }),
  k('Equal', 'KC_EQL', 12, 0, 1, B, { tl: '=', tr: '+', bl: 'volUp', br: 'F12' }),
  k('Backspace', 'KC_BSPC', 13, 0, 2, A, { tl: ['leftArrow', 'backspace'], br: 'del' }),
  k('LED_Mode', 'RGB_MOD', 15, 0, 1, A, { c: 'bulb' }, { special: true }),

  k('Tab', 'KC_TAB', 0, 1, 1.5, A, { tl: ['tab', 'tabIcon'], br: 'lockIcon' }),
  k('KeyQ', 'KC_Q', 1.5, 1, 1, B, { tl: 'Q' }),
  k('KeyW', 'KC_W', 2.5, 1, 1, B, { tl: 'W', bl: 'upArrow' }),
  k('KeyE', 'KC_E', 3.5, 1, 1, B, { tl: 'E' }),
  k('KeyR', 'KC_R', 4.5, 1, 1, B, { tl: 'R' }),
  k('KeyT', 'KC_T', 5.5, 1, 1, B, { tl: 'T' }),
  k('KeyY', 'KC_Y', 6.5, 1, 1, B, { tl: 'Y' }),
  k('KeyU', 'KC_U', 7.5, 1, 1, B, { tl: 'U' }),
  k('KeyI', 'KC_I', 8.5, 1, 1, B, { tl: 'I', bl: 'bt1' }),
  k('KeyO', 'KC_O', 9.5, 1, 1, B, { tl: 'O', bl: 'bt2' }),
  k('KeyP', 'KC_P', 10.5, 1, 1, B, { tl: 'P', bl: 'bt3' }),
  k('BracketLeft', 'KC_LBRC', 11.5, 1, 1, B, { tl: '{', bl: '[', br: 'ring24' }),
  k('BracketRight', 'KC_RBRC', 12.5, 1, 1, B, { tl: '}', bl: ']' }),
  k('Enter', 'KC_ENT', 13.5, 1, 1.5, A, { tc: ['enterIcon', 'enter'] }, { shape: 'iso-enter', h: 2, stemW: 1.25 }),
  k('Insert', 'KC_INS', 15, 1, 1, A, { tl: 'ins', bl: 'Scr Lk' }),

  k('CapsLock', 'KC_CAPS', 0, 2, 1.75, A, { tl: 'caps' }),
  k('KeyA', 'KC_A', 1.75, 2, 1, B, { tl: 'A' }),
  k('KeyS', 'KC_S', 2.75, 2, 1, B, { tl: 'S' }),
  k('KeyD', 'KC_D', 3.75, 2, 1, B, { tl: 'D' }),
  k('KeyF', 'KC_F', 4.75, 2, 1, B, { tl: 'F' }),
  k('KeyG', 'KC_G', 5.75, 2, 1, B, { tl: 'G' }),
  k('KeyH', 'KC_H', 6.75, 2, 1, B, { tl: 'H' }),
  k('KeyJ', 'KC_J', 7.75, 2, 1, B, { tl: 'J' }),
  k('KeyK', 'KC_K', 8.75, 2, 1, B, { tl: 'K' }),
  k('KeyL', 'KC_L', 9.75, 2, 1, B, { tl: 'L' }),
  k('Semicolon', 'KC_SCLN', 10.75, 2, 1, B, { tl: ':', bl: ';' }),
  k('Quote', 'KC_QUOT', 11.75, 2, 1, B, { tl: '"', bl: "'" }),
  k('Backslash', 'KC_NUHS', 12.75, 2, 1, B, { tl: '|', bl: '\\' }),
  k('PageUp', 'KC_PGUP', 15, 2, 1, A, { tl: 'pgup', bl: 'home' }),

  k('ShiftLeft', 'KC_LSFT', 0, 3, 2.25, A, { ml: ['shiftIcon', 'shift'] }),
  k('KeyZ', 'KC_Z', 2.25, 3, 1, B, { tl: 'Z' }),
  k('KeyX', 'KC_X', 3.25, 3, 1, B, { tl: 'X' }),
  k('KeyC', 'KC_C', 4.25, 3, 1, B, { tl: 'C' }),
  k('KeyV', 'KC_V', 5.25, 3, 1, B, { tl: 'V' }),
  k('KeyB', 'KC_B', 6.25, 3, 1, B, { tl: 'B' }),
  k('KeyN', 'KC_N', 7.25, 3, 1, B, { tl: 'N' }),
  k('KeyM', 'KC_M', 8.25, 3, 1, B, { tl: 'M' }),
  k('Comma', 'KC_COMM', 9.25, 3, 1, B, { tl: '<', bl: ',' }),
  k('Period', 'KC_DOT', 10.25, 3, 1, B, { tl: '>', bl: '.' }),
  k('Slash', 'KC_SLSH', 11.25, 3, 1, B, { tl: '?', bl: '/' }),
  k('ShiftRight', 'KC_RSFT', 12.25, 3, 1.75, A, { ml: ['shiftIcon', 'shift'] }),
  k('ArrowUp', 'KC_UP', 14, 3, 1, B, { tl: 'upArrow', bl: 'lightUp' }),
  k('PageDown', 'KC_PGDN', 15, 3, 1, A, { tl: 'pgdn', bl: 'end' }),

  k('ControlLeft', 'KC_LCTL', 0, 4, 1.25, A, { tl: 'ctrl', bl: 'caret' }),
  k('MetaLeft', 'KC_LGUI', 1.25, 4, 1.25, A, { tl: 'win', bl: 'optionKey' }),
  k('AltLeft', 'KC_LALT', 2.5, 4, 1.25, A, { tl: 'alt', bl: 'cmdKey' }),
  k('Space', 'KC_SPC', 3.75, 4, 6.25, B, { r: 'brand' }),
  k('AltRight', 'KC_RALT', 10, 4, 1, A, { tl: 'alt', bl: 'cmdKey' }),
  k('Fn', 'MO_FN', 11, 4, 1, A, { tl: 'fn' }, { special: true }),
  k('ControlRight', 'KC_RCTL', 12, 4, 1, A, { tl: 'ctrl', bl: 'caret' }),
  k('ArrowLeft', 'KC_LEFT', 13, 4, 1, B, { tl: 'leftArrow', bl: 'lightDown' }),
  k('ArrowDown', 'KC_DOWN', 14, 4, 1, B, { tl: 'downArrow', bl: 'lightDown' }),
  k('ArrowRight', 'KC_RGHT', 15, 4, 1, B, { tl: 'rightArrow', bl: 'lightUp' })
];

export const MK12_UNITS_WIDE = 16;
export const MK12_ROWS = 5;

export const KEY_ID_BY_EVENT_CODE = (() => {
  const map = {};
  MK12_KEYS.forEach(key => {
    map[key.id] = key.id;
  });
  map.NumpadEnter = 'Enter';
  map.IntlBackslash = 'Backslash';
  map.ContextMenu = 'Fn';
  map.Delete = 'Backspace';
  return map;
})();
