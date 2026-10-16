import { PAW3395SE_DPI } from './vxe-dpi-table.js';

export const VXE = {
  REPORT_ID: 8,
  CMD_SET: 7,
  CMD_GET: 8,
  CMD_ONLINE: 3,
  CMD_BATTERY: 4,
  CMD_PAIR: 5,
  CMD_PAIR_STATUS: 6,
  CMD_CIDMID: 16,
  CMD_VERSION: 18,
  CMD_FAR_SET: 22,
  CMD_FAR_GET: 23,
  ADDR: {
    reportRate: 0,
    silentHeight: 10,
    dpi: [12, 20, 28, 36],
    dpiLight: 76,
    debounce: 169,
    motionSync: 171,
    sleep: 173,
    angleSnap: 175,
    ripple: 177,
    performance: 181,
    buttons: [96, 100, 104, 108, 112, 116]
  },
  SLEEP_SECONDS: { '30s': 30, '1min': 60, '2min': 120, '3min': 180, '5min': 300, '20min': 1200, '25min': 1500, '30min': 1800 },
  LIGHT_MODE: { always: 1, breathing: 2 },
  LIGHT_BRIGHTNESS: { min: 16, medium: 128, max: 255 },
  LIGHT_SPEED: { slowest: 1, medium: 3, fastest: 5 },
  ACTIONS: {
    'Left Click': [1, 1, 0],
    'Right Click': [1, 2, 0],
    'Middle Click': [1, 4, 0],
    Back: [1, 8, 0],
    Forward: [1, 16, 0],
    'DPI Cycle': [2, 1, 0],
    'DPI Up': [2, 2, 0],
    'DPI Down': [2, 3, 0],
    Disabled: [0, 0, 0]
  },
  RATE_CODE: { 125: 8, 250: 4, 500: 2, 1000: 1 },
  HIGH: 10000
};

export function buildFrame(cmd, address, length, data = []) {
  const f = new Uint8Array(16);
  f[0] = cmd;
  f[2] = (address >> 8) & 0xff;
  f[3] = address & 0xff;
  f[4] = length;
  data.forEach((v, i) => {
    if (i < 10) f[5 + i] = v & 0xff;
  });
  let sum = VXE.REPORT_ID;
  for (let i = 0; i < 15; i += 1) sum += f[i];
  f[15] = (85 - (sum & 0xff)) & 0xff;
  return f;
}

export const check = v => (85 - (v & 0xff)) & 0xff;

export function reverseLookup(table, value, fallback) {
  const hit = Object.entries(table).find(([, v]) => v === value);
  return hit ? hit[0] : fallback;
}

export function encodeAction(action) {
  const code = VXE.ACTIONS[action];
  if (!code) return null;
  return [...code, check(code[0] + code[1] + code[2])];
}

export function decodeAction(cls, v1, v2) {
  const hit = Object.entries(VXE.ACTIONS).find(([, c]) => c[0] === cls && c[1] === v1 && c[2] === v2);
  return hit ? hit[0] : null;
}

export function rateFromCode(code) {
  const hit = Object.entries(VXE.RATE_CODE).find(([, c]) => c === code);
  return hit ? Number(hit[0]) : 1000;
}

export function decodeDpi(x, ex) {
  const row = PAW3395SE_DPI.find(r => r[0] === x);
  if (!row) return null;
  return (ex >> 1) & 1 && row[2] ? row[1] * 2 : row[1];
}

export function encodeDpi(dpi) {
  let v = Math.round(dpi / 50) * 50;
  if (v > VXE.HIGH && v % 100 !== 0) v += 50;
  const high = v > VXE.HIGH ? 1 : 0;
  const row = high ? PAW3395SE_DPI.find(r => r[2] && r[1] * 2 === v) : PAW3395SE_DPI.find(r => r[1] === v);
  if (!row) return null;
  return { x: row[0], y: row[0], ex: (high << 5) | (high << 1) };
}
