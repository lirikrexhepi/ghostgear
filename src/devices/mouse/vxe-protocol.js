import { PAW3395SE_DPI } from './vxe-dpi-table.js';

export const VXE = {
  REPORT_ID: 8,
  CMD_SET: 7,
  CMD_GET: 8,
  ADDR: {
    reportRate: 0,
    silentHeight: 10,
    dpi: [12, 20, 28, 36],
    debounce: 169,
    motionSync: 171,
    angleSnap: 175,
    ripple: 177
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
