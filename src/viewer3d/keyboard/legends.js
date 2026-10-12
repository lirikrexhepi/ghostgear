import { CAP_PROFILE, KEY_PITCH } from './keycap-geometry.js';

export const LEGEND_PX_PER_UNIT = 200;
const FONT_STACK = "Orbitron, 'Geist', 'Segoe UI', system-ui, sans-serif";

export function ensureLegendFont() {
  if (typeof document === 'undefined' || !document.fonts || !document.fonts.load) return Promise.resolve();
  return Promise.all([
    document.fonts.load('600 40px Orbitron'),
    document.fonts.load('500 40px Orbitron')
  ]).catch(() => undefined);
}

function iconArrow(ctx, s, dir) {
  const a = s * 0.34;
  ctx.beginPath();
  ctx.moveTo(-a, 0);
  ctx.lineTo(a, 0);
  ctx.moveTo(a * 0.15, -a * 0.8);
  ctx.lineTo(a, 0);
  ctx.lineTo(a * 0.15, a * 0.8);
  ctx.stroke();
}

const ICONS = {
  leftArrow(ctx, s) {
    ctx.save();
    ctx.rotate(Math.PI);
    iconArrow(ctx, s);
    ctx.restore();
  },
  rightArrow(ctx, s) {
    iconArrow(ctx, s);
  },
  upArrow(ctx, s) {
    ctx.save();
    ctx.rotate(-Math.PI / 2);
    iconArrow(ctx, s);
    ctx.restore();
  },
  downArrow(ctx, s) {
    ctx.save();
    ctx.rotate(Math.PI / 2);
    iconArrow(ctx, s);
    ctx.restore();
  },
  brightnessDown(ctx, s) {
    sun(ctx, s * 0.12, s * 0.2, 6);
  },
  brightnessUp(ctx, s) {
    sun(ctx, s * 0.18, s * 0.3, 8);
  },
  taskView(ctx, s) {
    const w = s * 0.5;
    ctx.strokeRect(-w * 0.5, -w * 0.38, w * 0.62, w * 0.76);
    ctx.strokeRect(w * 0.18, -w * 0.38 + w * 0.2, w * 0.36, w * 0.56);
  },
  search(ctx, s) {
    const r = s * 0.17;
    ctx.beginPath();
    ctx.arc(-r * 0.3, -r * 0.3, r, 0, Math.PI * 2);
    ctx.moveTo(r * 0.45, r * 0.45);
    ctx.lineTo(r * 1.5, r * 1.5);
    ctx.stroke();
  },
  grid(ctx, s) {
    const g = s * 0.1;
    for (let i = -1; i <= 1; i += 1) {
      for (let j = -1; j <= 1; j += 1) {
        ctx.fillRect(i * g * 1.6 - g * 0.4, j * g * 1.6 - g * 0.4, g * 0.8, g * 0.8);
      }
    }
  },
  sleep(ctx, s) {
    const r = s * 0.24;
    ctx.beginPath();
    ctx.arc(0, 0, r, Math.PI * 0.35, Math.PI * 1.65, false);
    ctx.arc(r * 0.35, -r * 0.1, r * 0.78, Math.PI * 1.55, Math.PI * 0.45, true);
    ctx.stroke();
  },
  prev(ctx, s) {
    tri(ctx, s, -1);
  },
  next(ctx, s) {
    tri(ctx, s, 1);
  },
  playPause(ctx, s) {
    const a = s * 0.2;
    ctx.beginPath();
    ctx.moveTo(-a * 1.3, -a);
    ctx.lineTo(-a * 0.1, 0);
    ctx.lineTo(-a * 1.3, a);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(a * 0.5, -a);
    ctx.lineTo(a * 0.5, a);
    ctx.moveTo(a * 1.2, -a);
    ctx.lineTo(a * 1.2, a);
    ctx.stroke();
  },
  mute(ctx, s) {
    speaker(ctx, s, 0);
  },
  volDown(ctx, s) {
    speaker(ctx, s, 1);
  },
  volUp(ctx, s) {
    speaker(ctx, s, 2);
  },
  bulb(ctx, s) {
    const r = s * 0.2;
    ctx.beginPath();
    ctx.arc(0, -r * 0.2, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -r * 0.2, r * 0.45, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 1.35, -r * 0.2 + Math.sin(a) * r * 1.35);
      ctx.lineTo(Math.cos(a) * r * 1.7, -r * 0.2 + Math.sin(a) * r * 1.7);
      ctx.stroke();
    }
  },
  tabIcon(ctx, s) {
    const a = s * 0.3;
    ctx.beginPath();
    ctx.moveTo(-a, -a * 0.3);
    ctx.lineTo(a, -a * 0.3);
    ctx.moveTo(a * 0.55, -a * 0.75);
    ctx.lineTo(a, -a * 0.3);
    ctx.moveTo(a, a * 0.3);
    ctx.lineTo(-a, a * 0.3);
    ctx.moveTo(-a * 0.55, a * 0.75);
    ctx.lineTo(-a, a * 0.3);
    ctx.stroke();
  },
  lockIcon(ctx, s) {
    const r = s * 0.13;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillRect(-r * 0.25, -r * 0.25, r * 0.5, r * 0.5);
  },
  enterIcon(ctx, s) {
    const a = s * 0.3;
    ctx.beginPath();
    ctx.moveTo(a, -a * 0.7);
    ctx.lineTo(a, a * 0.2);
    ctx.lineTo(-a, a * 0.2);
    ctx.moveTo(-a * 0.35, -a * 0.35);
    ctx.lineTo(-a, a * 0.2);
    ctx.lineTo(-a * 0.35, a * 0.75);
    ctx.stroke();
  },
  shiftIcon(ctx, s) {
    const a = s * 0.28;
    ctx.beginPath();
    ctx.moveTo(0, -a);
    ctx.lineTo(a, 0);
    ctx.lineTo(a * 0.45, 0);
    ctx.lineTo(a * 0.45, a * 0.9);
    ctx.lineTo(-a * 0.45, a * 0.9);
    ctx.lineTo(-a * 0.45, 0);
    ctx.lineTo(-a, 0);
    ctx.closePath();
    ctx.stroke();
  },
  caret(ctx, s) {
    const a = s * 0.18;
    ctx.beginPath();
    ctx.moveTo(-a, a * 0.5);
    ctx.lineTo(0, -a * 0.5);
    ctx.lineTo(a, a * 0.5);
    ctx.stroke();
  },
  optionKey(ctx, s) {
    const a = s * 0.2;
    ctx.beginPath();
    ctx.moveTo(-a * 1.3, -a * 0.6);
    ctx.lineTo(-a * 0.3, -a * 0.6);
    ctx.lineTo(a * 0.4, a * 0.6);
    ctx.lineTo(a * 1.3, a * 0.6);
    ctx.moveTo(a * 0.2, -a * 0.6);
    ctx.lineTo(a * 1.3, -a * 0.6);
    ctx.stroke();
  },
  cmdKey(ctx, s) {
    const a = s * 0.16;
    ctx.beginPath();
    ctx.rect(-a, -a, a * 2, a * 2);
    ctx.stroke();
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([i, j]) => {
      ctx.beginPath();
      ctx.arc(i * a * 1.35, j * a * 1.35, a * 0.55, 0, Math.PI * 2);
      ctx.stroke();
    });
  },
  lightUp(ctx, s) {
    sun(ctx, s * 0.14, s * 0.26, 8);
  },
  lightDown(ctx, s) {
    sun(ctx, s * 0.1, s * 0.2, 6);
  },
  bt1(ctx, s) {
    bluetooth(ctx, s, '1');
  },
  bt2(ctx, s) {
    bluetooth(ctx, s, '2');
  },
  bt3(ctx, s) {
    bluetooth(ctx, s, '3');
  },
  ring24(ctx, s) {
    const r = s * 0.17;
    ctx.beginPath();
    ctx.arc(0, 0, r, Math.PI * 0.2, Math.PI * 1.8);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
    ctx.stroke();
  }
};

function sun(ctx, r, rays, n) {
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * (r + rays * 0.28), Math.sin(a) * (r + rays * 0.28));
    ctx.lineTo(Math.cos(a) * (r + rays * 0.6), Math.sin(a) * (r + rays * 0.6));
    ctx.stroke();
  }
}

function tri(ctx, s, dir) {
  const a = s * 0.16;
  ctx.beginPath();
  ctx.moveTo(dir * a * 0.9, -a);
  ctx.lineTo(-dir * a * 0.1, 0);
  ctx.lineTo(dir * a * 0.9, a);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(dir * a * 2.2, -a);
  ctx.lineTo(dir * a * 1.2, 0);
  ctx.lineTo(dir * a * 2.2, a);
  ctx.closePath();
  ctx.stroke();
  ctx.translate(-dir * a, 0);
}

function speaker(ctx, s, waves) {
  const a = s * 0.16;
  ctx.beginPath();
  ctx.moveTo(-a * 1.4, -a * 0.5);
  ctx.lineTo(-a * 0.6, -a * 0.5);
  ctx.lineTo(a * 0.3, -a * 1.1);
  ctx.lineTo(a * 0.3, a * 1.1);
  ctx.lineTo(-a * 0.6, a * 0.5);
  ctx.lineTo(-a * 1.4, a * 0.5);
  ctx.closePath();
  ctx.stroke();
  for (let i = 0; i < waves; i += 1) {
    ctx.beginPath();
    ctx.arc(a * 0.3, 0, a * (0.8 + i * 0.7), -0.7, 0.7);
    ctx.stroke();
  }
}

function bluetooth(ctx, s, digit) {
  const a = s * 0.2;
  ctx.beginPath();
  ctx.moveTo(-a * 0.8, -a * 0.6);
  ctx.lineTo(a * 0.6, a * 0.6);
  ctx.lineTo(0, a * 1.2);
  ctx.lineTo(0, -a * 1.2);
  ctx.lineTo(a * 0.6, -a * 0.6);
  ctx.lineTo(-a * 0.8, a * 0.6);
  ctx.stroke();
  ctx.save();
  ctx.font = `600 ${s * 0.2}px ${FONT_STACK}`;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillText(digit, a * 0.95, a * 1.35);
  ctx.restore();
}

function measure(ctx, item, fontPx) {
  if (ICONS[item]) return fontPx * 0.95;
  return ctx.measureText(item).width;
}

function drawItem(ctx, item, x, y, fontPx, ink, align) {
  const advance = measure(ctx, item, fontPx);
  const left = align === 'right' ? x - advance : align === 'center' ? x - advance / 2 : x;
  if (ICONS[item]) {
    ctx.save();
    ctx.translate(left + advance / 2, y + fontPx * 0.42);
    ctx.strokeStyle = ink;
    ctx.fillStyle = ink;
    ctx.lineWidth = Math.max(1.4, fontPx * 0.085);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ICONS[item](ctx, fontPx * 1.7);
    ctx.restore();
  } else {
    ctx.fillStyle = ink;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText(item, left, y);
  }
  return advance;
}

function drawRun(ctx, items, x, y, fontPx, ink, align) {
  const list = Array.isArray(items) ? items : [items];
  const gap = fontPx * 0.35;
  const widths = list.map(i => measure(ctx, i, fontPx));
  const total = widths.reduce((a, b) => a + b, 0) + gap * (list.length - 1);
  let cursor = align === 'right' ? x - total : align === 'center' ? x - total / 2 : x;
  list.forEach((item, i) => {
    drawItem(ctx, item, cursor, y, fontPx, ink, 'left');
    cursor += widths[i] + gap;
  });
}

function drawBrand(ctx, rightEdge, y, h, ink) {
  const s = h;
  ctx.save();
  ctx.font = `600 ${s * 0.82}px ${FONT_STACK}`;
  const textW = ctx.measureText('MEETION').width;
  ctx.restore();
  const x = rightEdge - (s * 1.08 + textW);
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(s * 0.45, -s * 0.18);
  ctx.lineTo(s * 0.9, 0);
  ctx.lineTo(s * 0.8, s * 0.6);
  ctx.lineTo(s * 0.45, s * 0.98);
  ctx.lineTo(s * 0.1, s * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.0)';
  ctx.restore();
  ctx.save();
  ctx.fillStyle = ink;
  ctx.font = `600 ${s * 0.82}px ${FONT_STACK}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText('MEETION', x + s * 1.08, y + s * 0.36);
  ctx.restore();
}

export function keyCanvasSize(key) {
  return {
    width: Math.round(LEGEND_PX_PER_UNIT * key.w),
    height: Math.round(LEGEND_PX_PER_UNIT * key.h)
  };
}

export function paintKeyCanvas(canvas, key, { capColor, ink, override }) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = capColor;
  ctx.fillRect(0, 0, W, H);

  const footprintW = key.w * KEY_PITCH - CAP_PROFILE.gap;
  const footprintH = key.h * KEY_PITCH - CAP_PROFILE.gap;
  const ppmX = W / footprintW;
  const ppmY = H / footprintH;
  const topInset = CAP_PROFILE.topInset + 0.9;
  const left = topInset * ppmX;
  const top = (topInset - CAP_PROFILE.topShift * 0.5) * ppmY;
  const right = W - topInset * ppmX;
  const bottom = H - (topInset + CAP_PROFILE.topShift * 0.5) * ppmY;

  const primaryPx = 4.5 * ppmY;
  const secondaryPx = 2.7 * ppmY;
  const legend = { ...key.legend };
  if (override != null) {
    legend.tl = override;
    legend.tc = undefined;
    legend.c = undefined;
  }

  const avail = right - left;
  const draw = (items, px, x, y, align, weight = 600) => {
    if (items == null) return;
    ctx.font = `${weight} ${px}px ${FONT_STACK}`;
    const list = Array.isArray(items) ? items : [items];
    const gap = px * 0.35;
    const total = list.reduce((a, i) => a + measure(ctx, i, px), 0) + gap * (list.length - 1);
    let size = px;
    if (total > avail) {
      size = (px * avail) / total;
      ctx.font = `${weight} ${size}px ${FONT_STACK}`;
    }
    drawRun(ctx, items, x, y, size, ink, align);
  };

  const isEnter = key.shape === 'iso-enter';
  const rowH = isEnter ? H / 2 : H;
  const lowerBottom = isEnter ? top + rowH - topInset * ppmY * 0.5 - CAP_PROFILE.topShift * ppmY : bottom;

  draw(legend.tl, primaryPx, left, top, 'left');
  draw(legend.tr, primaryPx, right, top, 'right');
  draw(legend.tc, primaryPx, (left + right) / 2, top + primaryPx * 0.15, 'center');
  draw(legend.ml, primaryPx * 0.95, left, (top + bottom) / 2 - primaryPx * 0.5, 'left');
  draw(legend.bl, secondaryPx, left, lowerBottom - secondaryPx, 'left', 500);
  draw(legend.br, isEnter ? primaryPx * 0.85 : secondaryPx, right, isEnter ? top + primaryPx * 1.9 : bottom - secondaryPx, 'right', 500);
  if (legend.c) {
    ctx.font = `600 ${primaryPx}px ${FONT_STACK}`;
    drawRun(ctx, legend.c, (left + right) / 2, (top + bottom) / 2 - primaryPx * 0.5, primaryPx, ink, 'center');
  }
  if (legend.r === 'brand') {
    drawBrand(ctx, right - 1.2 * ppmX, (top + bottom) / 2 - 1.2 * ppmY, 2.6 * ppmY, ink);
  }
}
