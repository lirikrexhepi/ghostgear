// Apple-style Continuous Corner Squircle Generator
// Extracted from Apple Liquid UI (geometry/squircle.ts + squircle/vanilla.ts)

const toRad = (deg) => (deg * Math.PI) / 180;

const FRAMES = [
  { u: { x: 1, y: 0 }, v: { x: 0, y: 1 } },
  { u: { x: 0, y: 1 }, v: { x: -1, y: 0 } },
  { u: { x: -1, y: 0 }, v: { x: 0, y: -1 } },
  { u: { x: 0, y: -1 }, v: { x: 1, y: 0 } },
];

export function cornerList(radius) {
  return typeof radius === 'number'
    ? [radius, radius, radius, radius]
    : [radius[0], radius[1], radius[2], radius[3]];
}

export function isCircle(shape) {
  if (Math.abs(shape.width - shape.height) > 0.5) return false;
  const budget = Math.min(shape.width, shape.height) / 2;
  return cornerList(shape.radius).every((r) => r >= budget);
}

function arcCurve(from, to, center, radius) {
  const a0 = Math.atan2(from.y - center.y, from.x - center.x);
  let sweep = Math.atan2(to.y - center.y, to.x - center.x) - a0;
  while (sweep > Math.PI) sweep -= Math.PI * 2;
  while (sweep < -Math.PI) sweep += Math.PI * 2;
  const k = (4 / 3) * Math.tan(sweep / 4) * radius;
  const a1 = a0 + sweep;
  return [
    from,
    { x: from.x - k * Math.sin(a0), y: from.y + k * Math.cos(a0) },
    { x: to.x + k * Math.sin(a1), y: to.y - k * Math.cos(a1) },
    to,
  ];
}

function transition(r, xi, p) {
  const t = toRad(45 * xi);
  const c = r * Math.tan(t / 2) * Math.cos(t);
  const arcStart = { x: p - r + r * Math.sin(t), y: r - r * Math.cos(t) };
  const b = (arcStart.x - c) / 3;
  return [{ x: 0, y: 0 }, { x: 2 * b, y: 0 }, { x: 3 * b, y: 0 }, arcStart];
}

function cornerFor(radius, smoothing, alongBudget, acrossBudget) {
  const r = Math.max(0, Math.min(radius, alongBudget, acrossBudget));
  if (r === 0) return { along: 0, across: 0, curves: [] };
  const xiA = Math.max(0, Math.min(smoothing, alongBudget / r - 1));
  const xiB = Math.max(0, Math.min(smoothing, acrossBudget / r - 1));
  const along = (1 + xiA) * r;
  const across = (1 + xiB) * r;
  const mirror = (p) => ({ x: along - p.y, y: across - p.x });
  const head = transition(r, xiA, along);
  const tail = transition(r, xiB, across);
  const tailCurve = [mirror(tail[3]), mirror(tail[2]), mirror(tail[1]), mirror(tail[0])];
  const curves = [head];
  const arcFrom = head[3];
  const arcTo = tailCurve[0];
  if (Math.hypot(arcTo.x - arcFrom.x, arcTo.y - arcFrom.y) > 1e-9) {
    curves.push(arcCurve(arcFrom, arcTo, { x: along - r, y: r }, r));
  }
  curves.push(tailCurve);
  return { along, across, curves: curves.filter((c) => Math.hypot(c[3].x - c[0].x, c[3].y - c[0].y) > 1e-9) };
}

const NEIGHBOURS = {
  tl: { x: 'tr', y: 'bl' },
  tr: { x: 'tl', y: 'br' },
  bl: { x: 'br', y: 'tl' },
  br: { x: 'bl', y: 'tr' },
};

function distribute(width, height, radius) {
  const [tl, tr, br, bl] = cornerList(radius);
  const radii = { tl, tr, bl, br };
  const out = {};
  const order = ['tl', 'tr', 'bl', 'br'].sort((a, b) => radii[b] - radii[a]);
  for (const name of order) {
    const r = radii[name];
    const axis = (other, key) => {
      if (r === 0 && radii[other] === 0) return 0;
      const side = key === 'x' ? width : height;
      const claimed = out[other];
      return claimed ? side - claimed[key] : (r / (r + radii[other])) * side;
    };
    const x = axis(NEIGHBOURS[name].x, 'x');
    const y = axis(NEIGHBOURS[name].y, 'y');
    radii[name] = Math.min(r, x, y);
    out[name] = { radius: radii[name], x, y };
  }
  return out;
}

function squircleSegments(shape) {
  const { width: w, height: h } = shape;
  const smoothing = shape.smoothing ?? 1;
  const spread = distribute(w, h, shape.radius);
  const corners = [
    cornerFor(spread.tr.radius, smoothing, spread.tr.x, spread.tr.y),
    cornerFor(spread.br.radius, smoothing, spread.br.y, spread.br.x),
    cornerFor(spread.bl.radius, smoothing, spread.bl.y, spread.bl.x),
    cornerFor(spread.tl.radius, smoothing, spread.tl.y, spread.tl.x),
  ];
  const starts = [
    { x: w - corners[0].along, y: 0 },
    { x: w, y: h - corners[1].along },
    { x: corners[2].along, y: h },
    { x: 0, y: corners[3].along },
  ];
  const segments = [];
  for (let i = 0; i < 4; i++) {
    const { u, v } = FRAMES[i];
    const origin = starts[i];
    const place = (p) => ({ x: origin.x + u.x * p.x + v.x * p.y, y: origin.y + u.y * p.x + v.y * p.y });
    let end = origin;
    for (const c of corners[i].curves) {
      const to = place(c[3]);
      segments.push({ kind: 'cubic', from: place(c[0]), c1: place(c[1]), c2: place(c[2]), to });
      end = to;
    }
    const next = starts[(i + 1) % 4];
    if (Math.hypot(next.x - end.x, next.y - end.y) > 1e-6) segments.push({ kind: 'line', from: end, to: next });
  }
  return segments;
}

const num = (n) => String(Math.round(n * 1000) / 1000);

export function squirclePath(shape, offset = 0) {
  if (shape.width <= 0 || shape.height <= 0) return '';
  const pt = (p) => `${num(p.x + offset)} ${num(p.y + offset)}`;
  const segments = squircleSegments(shape);
  if (segments.length === 0) return '';
  let d = `M${pt(segments[0].from)}`;
  for (const s of segments) {
    if (s.kind === 'line') d += `L${pt(s.to)}`;
    else d += `C${pt(s.c1)} ${pt(s.c2)} ${pt(s.to)}`;
  }
  return `${d}Z`;
}

function paint(el, width, height, options) {
  if (width <= 0 || height <= 0) return;
  const shape = { width, height, radius: options.radius, smoothing: options.smoothing ?? 1 };
  if (isCircle(shape)) {
    el.style.clipPath = '';
    el.style.setProperty('-webkit-clip-path', '');
    el.style.borderRadius = '9999px';
    return;
  }
  const pathData = squirclePath(shape);
  if (pathData) {
    const clip = `path('${pathData}')`;
    el.style.clipPath = clip;
    el.style.setProperty('-webkit-clip-path', clip);
  }
}

export function squircle(el, options = { radius: 16 }) {
  if (!el) return () => {};
  const fallback = typeof options.radius === 'number' ? `${options.radius}px` : options.radius.map((r) => `${r}px`).join(' ');
  el.style.borderRadius = fallback;
  paint(el, el.offsetWidth, el.offsetHeight, options);
  const ro = new ResizeObserver((entries) => {
    const box = entries[0]?.borderBoxSize?.[0];
    if (box) paint(el, box.inlineSize, box.blockSize, options);
    else paint(el, el.offsetWidth, el.offsetHeight, options);
  });
  ro.observe(el, { box: 'border-box' });
  return () => ro.disconnect();
}

export function squircleAll(selector = '[data-squircle]') {
  const stops = Array.from(document.querySelectorAll(selector)).map((el) => {
    const radius = Number(el.dataset.squircle) || 16;
    const smoothing = el.dataset.smoothing === undefined ? 1 : Number(el.dataset.smoothing);
    return squircle(el, { radius, smoothing });
  });
  return () => stops.forEach((stop) => stop());
}
