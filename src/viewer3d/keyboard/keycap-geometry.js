import * as THREE from 'three';

export const KEY_PITCH = 19.05;

export const CAP_PROFILE = {
  gap: 1.3,
  wallInset: 1.15,
  topInset: 2.35,
  filletRadius: 1.15,
  cornerBottom: 2.4,
  cornerTop: 3.6,
  dishDepth: 0.85,
  dishInset: 4.4,
  topShift: 0.5,
  rows: [
    { height: 8.8, tilt: 8 },
    { height: 8.2, tilt: 4.5 },
    { height: 7.8, tilt: 1 },
    { height: 7.8, tilt: -2.5 },
    { height: 8.0, tilt: -6 }
  ]
};

const CORNER_SEGMENTS = 4;

function leftOf(v) {
  return { x: -v.y, y: v.x };
}

function polygonRing(points, inset, radius) {
  const n = points.length;
  const out = [];
  const shifted = [];
  for (let i = 0; i < n; i += 1) {
    const prev = points[(i + n - 1) % n];
    const cur = points[i];
    const next = points[(i + 1) % n];
    const a = { x: cur.x - prev.x, y: cur.y - prev.y };
    const b = { x: next.x - cur.x, y: next.y - cur.y };
    const la = Math.hypot(a.x, a.y);
    const lb = Math.hypot(b.x, b.y);
    a.x /= la;
    a.y /= la;
    b.x /= lb;
    b.y /= lb;
    const na = leftOf(a);
    const nb = leftOf(b);
    shifted.push({
      x: cur.x + (na.x + nb.x) * inset,
      y: cur.y + (na.y + nb.y) * inset,
      a,
      b
    });
  }
  for (let i = 0; i < n; i += 1) {
    const s = shifted[i];
    const { a, b } = s;
    const cross = a.x * b.y - a.y * b.x;
    const r = radius;
    const t1 = { x: s.x - a.x * r, y: s.y - a.y * r };
    const t2 = { x: s.x + b.x * r, y: s.y + b.y * r };
    const la = leftOf(a);
    const sign = cross >= 0 ? 1 : -1;
    const c = { x: t1.x + la.x * r * sign, y: t1.y + la.y * r * sign };
    let a1 = Math.atan2(t1.y - c.y, t1.x - c.x);
    let a2 = Math.atan2(t2.y - c.y, t2.x - c.x);
    let da = a2 - a1;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    for (let j = 0; j <= CORNER_SEGMENTS; j += 1) {
      const ang = a1 + (da * j) / CORNER_SEGMENTS;
      out.push({ x: c.x + Math.cos(ang) * r, y: c.y + Math.sin(ang) * r });
    }
  }
  return out;
}

function rectCorners(w, d) {
  const hx = w / 2;
  const hz = d / 2;
  return [
    { x: -hx, y: -hz },
    { x: hx, y: -hz },
    { x: hx, y: hz },
    { x: -hx, y: hz }
  ];
}

function isoEnterCorners(topW, stemW, totalD) {
  const hx = topW / 2;
  const hz = totalD / 2;
  const stemLeft = hx - stemW;
  return [
    { x: -hx, y: -hz },
    { x: hx, y: -hz },
    { x: hx, y: hz },
    { x: stemLeft, y: hz },
    { x: stemLeft, y: 0 },
    { x: -hx, y: 0 }
  ];
}

function orient(points) {
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const p = points[i];
    const q = points[(i + 1) % points.length];
    area += p.x * q.y - q.x * p.y;
  }
  return area > 0 ? points : points.slice().reverse();
}

export function buildCapGeometry({ widthU = 1, depthU = 1, shape = 'rect', stemU = 1.25, rowIndex = 2 }) {
  const P = CAP_PROFILE;
  const row = P.rows[Math.min(rowIndex, P.rows.length - 1)];
  const w = widthU * KEY_PITCH - P.gap;
  const d = depthU * KEY_PITCH - P.gap;
  const corners = orient(
    shape === 'iso-enter'
      ? isoEnterCorners(w, stemU * KEY_PITCH - P.gap, d)
      : rectCorners(w, d)
  );

  const h = row.height;
  const f = P.filletRadius;
  const dw = P.wallInset;
  const tanTilt = Math.tan((row.tilt * Math.PI) / 180);
  const rings = [];

  const addRing = (inset, y, radiusT, extraDepth = 0) => {
    rings.push({ inset, y, radius: radiusT, extra: extraDepth });
  };

  const cornerAt = inset => {
    const t = Math.min(1, inset / P.topInset);
    const r = P.cornerBottom + (P.cornerTop - P.cornerBottom) * t;
    return Math.max(0.35, r - inset * 0.55);
  };

  addRing(0, 0, cornerAt(0));
  addRing(dw * 0.5, (h - f) * 0.5, cornerAt(dw * 0.5));
  addRing(dw, h - f, cornerAt(dw));
  const filletSteps = 4;
  for (let i = 1; i <= filletSteps; i += 1) {
    const a = ((Math.PI / 2) * i) / filletSteps;
    const inset = dw + f * (1 - Math.cos(a));
    const y = h - f + f * Math.sin(a);
    addRing(inset, y, cornerAt(inset));
  }
  const dishRings = 3;
  for (let i = 1; i <= dishRings; i += 1) {
    const t = i / dishRings;
    const inset = P.topInset + (P.dishInset - 0) * t;
    const depth = P.dishDepth * (0.5 - 0.5 * Math.cos(Math.PI * t));
    addRing(inset, h - depth, Math.max(0.5, cornerAt(P.topInset) - 0.4 * t));
  }

  const loops = rings.map(r => polygonRing(corners, r.inset, r.radius));
  const perRing = loops[0].length;

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  loops[0].forEach(p => {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.y);
    maxZ = Math.max(maxZ, p.y);
  });
  const spanX = maxX - minX;
  const spanZ = maxZ - minZ;

  const positions = [];
  const uvs = [];
  const topY = [];
  loops.forEach((loop, ri) => {
    const ring = rings[ri];
    const heightFrac = ring.y / h;
    loop.forEach(p => {
      const shift = P.topShift * heightFrac;
      const tilt = -p.y * tanTilt * heightFrac;
      positions.push(p.x, ring.y + tilt, p.y - shift);
      uvs.push((p.x - minX) / spanX, 1 - (p.y - minZ) / spanZ);
    });
    topY.push(ring.y);
  });

  const indices = [];
  for (let r = 0; r < loops.length - 1; r += 1) {
    for (let i = 0; i < perRing; i += 1) {
      const j = (i + 1) % perRing;
      const a = r * perRing + i;
      const b = r * perRing + j;
      const c = (r + 1) * perRing + j;
      const e = (r + 1) * perRing + i;
      indices.push(a, b, c, a, c, e);
    }
  }

  const innerLoop = loops[loops.length - 1];
  const contour = innerLoop.map(p => new THREE.Vector2(p.x, p.y));
  const tris = THREE.ShapeUtils.triangulateShape(contour, []);
  const base = (loops.length - 1) * perRing;
  tris.forEach(t => indices.push(base + t[0], base + t[1], base + t[2]));

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const normal = geometry.getAttribute('normal');
  const idx = geometry.getIndex();
  const sideRing = Math.floor(perRing / 2);
  const probe = (loops.length - 1) * perRing + sideRing;
  if (normal.getY(probe) < 0) {
    const arr = idx.array;
    for (let i = 0; i < arr.length; i += 3) {
      const t = arr[i + 1];
      arr[i + 1] = arr[i + 2];
      arr[i + 2] = t;
    }
    idx.needsUpdate = true;
    geometry.computeVertexNormals();
  }

  geometry.userData.footprint = { minX, maxX, minZ, maxZ, width: spanX, depth: spanZ };
  geometry.userData.topInset = P.topInset;
  geometry.userData.height = h;
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
