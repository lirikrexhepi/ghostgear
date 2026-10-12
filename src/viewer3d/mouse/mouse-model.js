import * as THREE from 'three';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';
import { Part } from '../core/part.js';
import { MOUSE_DIMENSIONS, MOUSE_SIDE_BUTTONS } from './mouse-spec.js';
import { X2_SCAN } from './x2-scan.js';

const clamp01 = v => Math.min(1, Math.max(0, v));
const lerp = (a, b, k) => a + (b - a) * k;
const smoothstep = (a, b, v) => {
  const k = clamp01((v - a) / (b - a));
  return k * k * (3 - 2 * k);
};

function search(arr, v) {
  let lo = 0;
  let hi = arr.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] <= v) lo = mid;
    else hi = mid;
  }
  return lo;
}

function fixWinding(geo, cx, cy, cz) {
  const pos = geo.getAttribute('position');
  const idx = geo.getIndex();
  let score = 0;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  for (let i = 0; i < idx.count; i += 3) {
    a.fromBufferAttribute(pos, idx.getX(i));
    b.fromBufferAttribute(pos, idx.getX(i + 1));
    c.fromBufferAttribute(pos, idx.getX(i + 2));
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    ab.cross(ac);
    score += ab.x * ((a.x + b.x + c.x) / 3 - cx) + ab.y * ((a.y + b.y + c.y) / 3 - cy) + ab.z * ((a.z + b.z + c.z) / 3 - cz);
  }
  if (score < 0) flipWinding(geo);
}

function flipWinding(geo) {
  const arr = geo.getIndex().array;
  for (let i = 0; i < arr.length; i += 3) {
    const t = arr[i + 1];
    arr[i + 1] = arr[i + 2];
    arr[i + 2] = t;
  }
  geo.getIndex().needsUpdate = true;
}

function mirrorX(geo) {
  const g = geo.clone();
  g.scale(-1, 1, 1);
  flipWinding(g);
  return g;
}

function createShell(D) {
  const S = X2_SCAN;
  const L = D.length;
  const z0 = -L / 2;
  const tOf = z => (z - z0) / L;
  const zOf = t => z0 + t * L;
  const za = zOf(S.spineT0);
  const zb = zOf(S.spineT1);

  const px = [0];
  const pz = [z0];
  S.outline.forEach(([t, h]) => {
    px.push(-h);
    pz.push(zOf(t));
  });
  px.push(0);
  pz.push(-z0);
  const arc = [0];
  for (let i = 1; i < px.length; i += 1) arc.push(arc[i - 1] + Math.hypot(px[i] - px[i - 1], pz[i] - pz[i - 1]));
  const total = arc[arc.length - 1];

  const M = S.meridianCount;
  const K = S.meridianSamples;
  const mr = new Float32Array(M * K);
  const my = new Float32Array(M * K);
  const mlen = new Float32Array(M);
  for (let i = 0; i < M * K; i += 1) {
    mr[i] = S.meridians[i * 2] / S.scale;
    my[i] = S.meridians[i * 2 + 1] / S.scale;
  }
  for (let i = 0; i < M; i += 1) {
    for (let k = 1; k < K; k += 1) {
      const a = i * K + k;
      mlen[i] += Math.hypot(mr[a] - mr[a - 1], my[a] - my[a - 1]);
    }
  }

  function outlineAt(s) {
    const sc = Math.min(total, Math.max(0, s));
    const i = Math.min(arc.length - 2, search(arc, sc));
    const k = clamp01((sc - arc[i]) / (arc[i + 1] - arc[i] || 1));
    return { x: lerp(px[i], px[i + 1], k), z: lerp(pz[i], pz[i + 1], k) };
  }

  function sAtZ(z) {
    const i = Math.min(pz.length - 2, search(pz, z));
    const k = clamp01((z - pz[i]) / (pz[i + 1] - pz[i] || 1));
    return lerp(arc[i], arc[i + 1], k);
  }

  function sAtX(x) {
    let lo = 0;
    let hi = sAtZ(za);
    for (let i = 0; i < 40; i += 1) {
      const mid = (lo + hi) / 2;
      if (-outlineAt(mid).x < x) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  }

  function frame(s) {
    const P = outlineAt(s);
    const cz = Math.min(zb, Math.max(za, P.z));
    const dx = -P.x;
    const dz = cz - P.z;
    const dmax = Math.max(1e-6, Math.hypot(dx, dz));
    const g = clamp01(s / total) * (M - 1);
    const i0 = Math.min(M - 2, Math.floor(g));
    const k = g - i0;
    return { s, P, t: tOf(P.z), cz, ux: -dx / dmax, uz: -dz / dmax, dmax, i0, k, len: lerp(mlen[i0], mlen[i0 + 1], k) };
  }

  function sample(f, m) {
    const g = clamp01(m) * (K - 1);
    const j = Math.min(K - 2, Math.floor(g));
    const q = g - j;
    const a = f.i0 * K + j;
    const b = a + K;
    return [
      lerp(lerp(mr[a], mr[a + 1], q), lerp(mr[b], mr[b + 1], q), f.k),
      lerp(lerp(my[a], my[a + 1], q), lerp(my[b], my[b + 1], q), f.k)
    ];
  }

  function pointAt(f, m, out = new THREE.Vector3()) {
    const [r, y] = sample(f, m);
    return out.set(f.ux * r, y, f.cz + f.uz * r);
  }

  function mWhere(f, value) {
    let prev = value(0);
    for (let j = 1; j < K; j += 1) {
      const m = j / (K - 1);
      const cur = value(m);
      if ((prev <= 0) !== (cur <= 0)) {
        let lo = (j - 1) / (K - 1);
        let hi = m;
        for (let i = 0; i < 30; i += 1) {
          const mid = (lo + hi) / 2;
          if ((value(lo) <= 0) === (value(mid) <= 0)) lo = mid;
          else hi = mid;
        }
        return (lo + hi) / 2;
      }
      prev = cur;
    }
    return 1;
  }

  const mAtY = (f, y) => mWhere(f, m => sample(f, m)[1] - y);
  const mAtZ = (f, z) => mWhere(f, m => pointAt(f, m).z - z);

  function finishGrid(pos, rows, cols) {
    const idx = [];
    for (let r = 0; r < rows - 1; r += 1) {
      for (let c = 0; c < cols - 1; c += 1) {
        const a = r * cols + c;
        idx.push(a, a + 1, a + cols + 1, a, a + cols + 1, a + cols);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setIndex(idx);
    fixWinding(geo, 0, 12, 0);
    geo.computeVertexNormals();
    const nrm = geo.getAttribute('normal');
    for (let i = 0; i < nrm.count; i += 1) {
      if (Math.abs(pos[i * 3]) < 1e-4) {
        const ny = nrm.getY(i);
        const nz = nrm.getZ(i);
        const len = Math.hypot(ny, nz) || 1;
        nrm.setXYZ(i, 0, ny / len, nz / len);
      }
    }
    return geo;
  }

  function grid({ s0, s1, m0, m1, J = D.meridianSteps, transform }) {
    const rows = Math.max(2, Math.ceil((s1 - s0) / D.sStep)) + 1;
    const cols = J + 1;
    const pos = new Float32Array(rows * cols * 3);
    const v = new THREE.Vector3();
    for (let i = 0; i < rows; i += 1) {
      const f = frame(s0 + ((s1 - s0) * i) / (rows - 1));
      const a = typeof m0 === 'function' ? m0(f) : m0;
      const b = typeof m1 === 'function' ? m1(f) : m1;
      for (let j = 0; j < cols; j += 1) {
        pointAt(f, a + ((b - a) * j) / J, v);
        if (transform) transform(v, f);
        pos[(i * cols + j) * 3] = v.x;
        pos[(i * cols + j) * 3 + 1] = v.y;
        pos[(i * cols + j) * 3 + 2] = v.z;
      }
    }
    return finishGrid(pos, rows, cols);
  }

  return { total, frame, pointAt, mAtY, mAtZ, sAtX, sAtZ, grid, finishGrid, zOf };
}

function traceRoundedRect(p, w, h, r) {
  const x = -w / 2;
  const y = -h / 2;
  p.moveTo(x + r, y);
  p.lineTo(x + w - r, y);
  p.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  p.lineTo(x + w, y + h - r);
  p.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  p.lineTo(x + r, y + h);
  p.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  p.lineTo(x, y + r);
  p.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  p.closePath();
}

function roundedRectShape2D(w, h, r) {
  const s = new THREE.Shape();
  traceRoundedRect(s, w, h, r);
  return s;
}

function crescentShape2D(halfChord, sagitta, skirt) {
  const yc = (halfChord * halfChord - sagitta * sagitta) / (2 * sagitta);
  const R = yc + sagitta;
  const s = new THREE.Shape();
  s.moveTo(-halfChord, skirt);
  s.lineTo(halfChord, skirt);
  s.lineTo(halfChord, 0);
  s.absarc(0, yc, R, Math.atan2(-yc, halfChord), Math.atan2(-yc, -halfChord), true);
  s.lineTo(-halfChord, skirt);
  s.closePath();
  return s;
}

function ringShape2D(w, h, r, wall) {
  const s = roundedRectShape2D(w, h, r);
  const hole = new THREE.Path();
  traceRoundedRect(hole, w - 2 * wall, h - 2 * wall, Math.max(0.5, r - wall));
  s.holes.push(hole);
  return s;
}

function makeTireTexture(maxAnisotropy) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(0, 0, 512, 64);
  ctx.fillStyle = '#0a0a0a';
  const ribs = 44;
  for (let i = 0; i < ribs; i += 1) ctx.fillRect((i / ribs) * 512, 0, 512 / ribs / 2, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function makeTextTexture(text, maxAnisotropy) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 144;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#2b2b2e';
  ctx.font = '500 104px "Geist", "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if ('letterSpacing' in ctx) ctx.letterSpacing = '10px';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 4);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function buildMouseModel({ theme, maxAnisotropy = 8, dimensions = {} }) {
  const D = { ...MOUSE_DIMENSIONS, ...dimensions };
  const T = theme.mouse;
  const root = new THREE.Group();
  root.name = 'VXE_R1_SE_PLUS';
  const disposables = [];
  const track = o => {
    disposables.push(o);
    return o;
  };
  const stdMat = (color, roughness = 0.62, extra = {}) =>
    track(new THREE.MeshPhysicalMaterial({ color, roughness, metalness: 0, sheen: 0.35, sheenRoughness: 0.7, sheenColor: '#ffffff', emissive: '#000000', ...extra }));
  const plainMat = (color, roughness = 0.7) =>
    track(new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, emissive: '#000000' }));

  const shell = createShell(D);
  const { frame, pointAt, mAtY, mAtZ, sAtX, grid, sAtZ, zOf } = shell;
  const lift = D.bottomLift;
  const seam = D.seamHalfGap;
  const zSplit = zOf(D.splitT);
  const sSplit = sAtZ(zSplit);
  const zSlot0 = zOf(D.slotT0);
  const zSlot1 = zOf(D.slotT1);
  const mBtn = f => mAtY(f, lerp(D.btnSeamFrontY, D.btnSeamSideY, smoothstep(0, D.splitT, f.t)));
  const gapAt = z => lerp(D.stripHalf, seam, smoothstep(zSlot1, zSlot1 + 1.2, z));

  const bodyMat = stdMat(T.body, 0.66);
  const underlayMat = plainMat(T.underlay, 0.9);
  underlayMat.side = THREE.DoubleSide;

  const addPair = (geoL, mat, name) => {
    track(geoL);
    const geoR = track(mirrorX(geoL));
    const l = new THREE.Mesh(geoL, mat);
    const r = new THREE.Mesh(geoR, mat);
    l.name = `${name}L`;
    r.name = `${name}R`;
    root.add(l, r);
    return [l, r];
  };

  const [, lowerR] = addPair(grid({ s0: 0, s1: sSplit, m0: 0, m1: mBtn }), bodyMat, 'shellLower');
  addPair(grid({ s0: sSplit, s1: shell.total, m0: 0, m1: 1 }), bodyMat, 'shellRear');

  const underGeo = grid({ s0: 0, s1: Math.min(shell.total, sSplit + 1.4), m0: f => mBtn(f) - 0.6 / f.len, m1: 1 });
  {
    const pos = underGeo.getAttribute('position');
    const nrm = underGeo.getAttribute('normal');
    for (let i = 0; i < pos.count; i += 1) {
      pos.setXYZ(
        i,
        pos.getX(i) - nrm.getX(i) * D.underlayDepth,
        pos.getY(i) - nrm.getY(i) * D.underlayDepth,
        pos.getZ(i) - nrm.getZ(i) * D.underlayDepth
      );
    }
    pos.needsUpdate = true;
  }
  addPair(underGeo, underlayMat, 'underlay');

  const stripA = D.stripHalf - seam;
  {
    const K = 10;
    const J = 36;
    const pos = new Float32Array((K + 1) * (J + 1) * 3);
    const v = new THREE.Vector3();
    for (let k = 0; k <= K; k += 1) {
      const xc = -stripA + (2 * stripA * k) / K;
      const f = frame(sAtX(Math.abs(xc)));
      const m0 = mBtn(f) + 0.4 / f.len;
      const m1 = mAtZ(f, zSlot0 - 2 * seam);
      for (let j = 0; j <= J; j += 1) {
        pointAt(f, m0 + ((m1 - m0) * j) / J, v);
        const o = (k * (J + 1) + j) * 3;
        pos[o] = xc;
        pos[o + 1] = v.y;
        pos[o + 2] = v.z;
      }
    }
    const stripMesh = new THREE.Mesh(track(shell.finishGrid(pos, K + 1, J + 1)), bodyMat);
    stripMesh.name = 'frontStrip';
    root.add(stripMesh);
  }

  const fSplit = frame(sSplit);
  const hingeY = pointAt(fSplit, 1).y * 0.95;
  const hingePivot = new THREE.Vector3(0, hingeY, zSplit);
  const btnGeoL = grid({
    s0: sAtX(D.stripHalf),
    s1: sSplit,
    m0: f => mBtn(f) + 0.4 / f.len,
    m1: 1,
    transform: v => {
      v.x = Math.min(v.x, -gapAt(v.z));
      v.z = Math.min(v.z, zSplit - 2 * seam);
    }
  });
  const btnGeoR = mirrorX(btnGeoL);
  btnGeoL.translate(-hingePivot.x, -hingePivot.y, -hingePivot.z);
  btnGeoR.translate(-hingePivot.x, -hingePivot.y, -hingePivot.z);
  track(btnGeoL);
  track(btnGeoR);

  function makeButton(geo, left) {
    const matBtn = stdMat(T.body, 0.66);
    const mesh = new THREE.Mesh(geo, matBtn);
    mesh.name = left ? 'buttonL' : 'buttonR';
    mesh.userData.partId = left ? 'btn_left' : 'btn_right';
    const pivot = new THREE.Group();
    pivot.position.copy(hingePivot);
    pivot.add(mesh);
    root.add(pivot);
    return { mesh, pivot, mat: matBtn };
  }

  const parts = [];
  const pickables = [];
  const proxyMat = track(new THREE.MeshBasicMaterial({ visible: false }));

  const btnL = makeButton(btnGeoL, true);
  const btnR = makeButton(btnGeoR, false);
  const pressAngle = 0.026;
  [
    { b: btnL, id: 'btn_left', name: 'Left button', nav: { x: -1, y: 0 } },
    { b: btnR, id: 'btn_right', name: 'Right button', nav: { x: 1, y: 0 } }
  ].forEach(({ b, id, name, nav }) => {
    pickables.push(b.mesh);
    parts.push(
      new Part({
        id,
        name,
        kind: 'button',
        object: b.pivot,
        meshes: [b.mesh],
        materials: [b.mat],
        nav,
        apply: (p, v) => {
          b.pivot.rotation.x = -pressAngle * v;
        }
      })
    );
  });

  const fWheel = frame(sAtZ(zOf(D.wheelT)));
  const wheelTopY = pointAt(fWheel, 1).y;
  const wheelGroup = new THREE.Group();
  const wheelCenterY = wheelTopY + D.wheelProtrusion - D.wheelRadius;
  wheelGroup.position.set(0, wheelCenterY, zOf(D.wheelT));
  root.add(wheelGroup);
  const wheelSpin = new THREE.Group();
  wheelGroup.add(wheelSpin);

  const tireTex = track(makeTireTexture(maxAnisotropy));
  const tireMat = track(new THREE.MeshStandardMaterial({ color: '#ffffff', map: tireTex, roughness: 0.78, metalness: 0, emissive: '#000000' }));
  const hubMat = stdMat(T.wheelHub, 0.5);
  const wheelGeo = track(new THREE.CylinderGeometry(D.wheelRadius, D.wheelRadius, D.wheelWidth * 0.62, 72, 1, false));
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMesh = new THREE.Mesh(wheelGeo, [tireMat, hubMat, hubMat]);
  wheelMesh.name = 'wheel';
  wheelMesh.userData.partId = 'btn_middle';
  wheelSpin.add(wheelMesh);
  const hubGeo = track(new THREE.CylinderGeometry(D.wheelRadius - 0.9, D.wheelRadius - 0.9, D.wheelWidth, 56, 1, false));
  hubGeo.rotateZ(Math.PI / 2);
  const hubMesh = new THREE.Mesh(hubGeo, hubMat);
  hubMesh.userData.partId = 'btn_middle';
  wheelSpin.add(hubMesh);
  pickables.push(wheelMesh, hubMesh);

  const wheelProxy = new THREE.Mesh(track(new THREE.BoxGeometry(D.wheelWidth + 3, 6, 22)), proxyMat);
  wheelProxy.position.set(0, D.wheelRadius - D.wheelProtrusion, 0);
  wheelProxy.userData.partId = 'btn_middle';
  wheelProxy.visible = false;
  wheelGroup.add(wheelProxy);
  pickables.push(wheelProxy);

  parts.push(
    new Part({
      id: 'btn_middle',
      name: 'Wheel click',
      kind: 'button',
      object: wheelGroup,
      meshes: [wheelMesh, hubMesh, wheelProxy],
      materials: [tireMat, hubMat],
      nav: { x: 0, y: 0 },
      apply: (p, v) => {
        wheelGroup.position.y = wheelCenterY - 0.9 * v;
      }
    })
  );
  parts.push(
    new Part({
      id: 'wheel_scroll',
      name: 'Wheel scroll',
      kind: 'wheel',
      object: wheelSpin,
      meshes: [],
      materials: [],
      nav: { x: 0, y: -0.7 },
      apply: null
    })
  );

  const fTip = frame(0);
  const ledM = mAtZ(fTip, zOf(D.ledT));
  const ledP = pointAt(fTip, ledM);
  const ledAhead = pointAt(fTip, ledM + 0.6 / fTip.len);
  const slitMat = plainMat('#2b2b2b', 0.4);
  const slit = new THREE.Mesh(track(new THREE.BoxGeometry(3.2, 0.12, 0.75)), slitMat);
  slit.position.set(0, ledP.y + 0.04, ledP.z);
  slit.rotation.x = -Math.atan2(ledAhead.y - ledP.y, ledAhead.z - ledP.z);
  root.add(slit);

  MOUSE_SIDE_BUTTONS.forEach((def, i) => {
    const mat = stdMat(T.black, 0.5, { sheen: 0.05 });
    const len = (def.t1 - def.t0) * D.length - 1.0;
    const s = sAtZ(zOf((def.t0 + def.t1) / 2));
    const f = frame(s);
    const e = mAtY(f, def.y);
    const de = 0.3 / f.len;
    const p = pointAt(f, e);
    const ps = pointAt(frame(s + 0.3), e).sub(pointAt(frame(s - 0.3), e)).normalize();
    const pe = pointAt(f, e + de).sub(pointAt(f, e - de)).normalize();
    const normal = new THREE.Vector3().crossVectors(ps, pe).normalize();
    if (normal.x > 0) normal.negate();
    const yAxis = new THREE.Vector3().crossVectors(normal, ps).normalize();
    if (yAxis.y < 0) yAxis.negate();
    const xAxis = new THREE.Vector3().crossVectors(yAxis, normal).normalize();
    const geo = track(
      new THREE.ExtrudeGeometry(roundedRectShape2D(len, def.size, 1.9), {
        depth: 1.4,
        bevelEnabled: true,
        bevelThickness: 0.45,
        bevelSize: 0.45,
        bevelSegments: 3,
        curveSegments: 10
      })
    );
    geo.translate(0, 0, -0.9);
    const group = new THREE.Group();
    group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, normal));
    group.position.copy(p);
    const base = p.clone();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = def.id;
    mesh.userData.partId = def.id;
    group.add(mesh);
    root.add(group);
    pickables.push(mesh);
    const proxy = new THREE.Mesh(track(new THREE.BoxGeometry(len + 3, def.size + 4, 5)), proxyMat);
    proxy.position.set(0, 0, 1);
    proxy.userData.partId = def.id;
    proxy.visible = false;
    group.add(proxy);
    pickables.push(proxy);
    parts.push(
      new Part({
        id: def.id,
        name: def.name,
        kind: 'button',
        object: group,
        meshes: [mesh, proxy],
        materials: [mat],
        nav: { x: -2, y: 0.5 + i * 0.9 },
        apply: (pp, v) => {
          group.position.copy(base).addScaledVector(normal, -0.9 * v);
        }
      })
    );
  });

  const usbY = D.usbY;
  const usbP = pointAt(fTip, mAtY(fTip, usbY));
  const usb = new THREE.Mesh(
    track(new THREE.ExtrudeGeometry(roundedRectShape2D(8.6, 2.8, 1.3), { depth: 0.8, bevelEnabled: false, curveSegments: 10 })),
    plainMat('#050505', 0.6)
  );
  usb.position.set(0, usbY, usbP.z - 0.25);
  root.add(usb);

  const baseRing = [];
  {
    const steps = 160;
    for (let i = 0; i <= steps; i += 1) {
      const f = frame((shell.total * i) / steps);
      const p = pointAt(f, 0);
      baseRing.push(new THREE.Vector2(p.x, p.z));
    }
    for (let i = steps - 1; i > 0; i -= 1) baseRing.push(new THREE.Vector2(-baseRing[i].x, baseRing[i].y));
  }
  const bottomGeo = track(new THREE.ShapeGeometry(new THREE.Shape(baseRing), 6));
  bottomGeo.rotateX(Math.PI / 2);
  bottomGeo.translate(0, lift, 0);
  const bottomMat = plainMat(T.black, 0.7);
  const bottom = new THREE.Mesh(bottomGeo, bottomMat);
  bottom.name = 'bottom';
  root.add(bottom);

  const underside = new THREE.Group();
  underside.name = 'underside';
  root.add(underside);
  const feetMat = stdMat(T.feet, 0.35, { sheen: 0 });
  const addPad = (shape2D, t, flipY = false) => {
    const g = track(new THREE.ExtrudeGeometry(shape2D, { depth: 0.5, bevelEnabled: false, curveSegments: 24 }));
    if (flipY) {
      g.rotateZ(Math.PI);
      g.translate(0, 0, 0.5);
    }
    g.rotateX(Math.PI / 2);
    g.translate(0, lift + 0.06, 0);
    const m = new THREE.Mesh(g, feetMat);
    m.position.set(0, 0, zOf(t));
    underside.add(m);
  };
  addPad(crescentShape2D(19, 9, 5), 0.13);
  addPad(crescentShape2D(20, 9, 5), 0.84, true);
  addPad(ringShape2D(17, 17, 6, 3.2), 0.4);

  const sensorZ = zOf(0.4);
  const sensorGeo = track(new THREE.ExtrudeGeometry(roundedRectShape2D(9.5, 9.5, 3), { depth: 0.2, bevelEnabled: false, curveSegments: 10 }));
  sensorGeo.rotateX(Math.PI / 2);
  sensorGeo.translate(0, lift + 0.03, 0);
  const sensor = new THREE.Mesh(sensorGeo, plainMat(T.sensorWindow, 0.25));
  sensor.position.set(0, 0, sensorZ);
  underside.add(sensor);
  const lens = new THREE.Mesh(track(new THREE.CylinderGeometry(2.4, 2.4, 0.3, 28)), plainMat('#050505', 0.15));
  lens.position.set(0, lift - 0.1, sensorZ);
  underside.add(lens);

  const dpiMat = stdMat(T.black, 0.5, { sheen: 0 });
  const dpiGeo = track(new THREE.ExtrudeGeometry(roundedRectShape2D(7, 4, 1.6), { depth: 0.9, bevelEnabled: false, curveSegments: 8 }));
  dpiGeo.rotateX(Math.PI / 2);
  dpiGeo.translate(0, lift + 0.3, 0);
  const dpiGroup = new THREE.Group();
  dpiGroup.position.set(0, 0, zOf(0.7));
  const dpiMesh = new THREE.Mesh(dpiGeo, dpiMat);
  dpiMesh.name = 'btn_dpi';
  dpiMesh.userData.partId = 'btn_dpi';
  dpiGroup.add(dpiMesh);
  const dpiProxy = new THREE.Mesh(track(new THREE.BoxGeometry(12, 4, 9)), proxyMat);
  dpiProxy.position.set(0, -0.5, 0);
  dpiProxy.userData.partId = 'btn_dpi';
  dpiProxy.visible = false;
  dpiGroup.add(dpiProxy);
  underside.add(dpiGroup);
  pickables.push(dpiMesh, dpiProxy);
  parts.push(
    new Part({
      id: 'btn_dpi',
      name: 'DPI button',
      kind: 'button',
      object: dpiGroup,
      meshes: [dpiMesh, dpiProxy],
      materials: [dpiMat],
      nav: { x: 0, y: 2.2 },
      apply: (p, v) => {
        dpiGroup.position.y = 0.7 * v;
      }
    })
  );

  const textures = [tireTex];
  {
    root.updateMatrixWorld(true);
    const s = sAtZ(zOf(0.24));
    const f = frame(s);
    const p = pointAt(f, mAtY(f, 5.6));
    const textTex = track(makeTextTexture('VXE R1 SE+', maxAnisotropy));
    textures.push(textTex);
    const textMat = track(
      new THREE.MeshStandardMaterial({
        map: textTex,
        transparent: true,
        roughness: 0.6,
        metalness: 0,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -4
      })
    );
    const decalGeo = track(new DecalGeometry(lowerR, new THREE.Vector3(-p.x, p.y, p.z), new THREE.Euler(0, Math.PI / 2, 0), new THREE.Vector3(17, 2.4, 6)));
    const decal = new THREE.Mesh(decalGeo, textMat);
    decal.name = 'sideText';
    root.add(decal);
  }

  const bounds = new THREE.Box3().setFromObject(root);
  const wheelState = { angle: 0 };

  return {
    kind: 'mouse',
    root,
    parts,
    pickables,
    bounds,
    footprint: { width: D.width + 14, depth: D.length + 14 },
    dimensions: D,
    home: { azimuthDeg: 215, elevationDeg: 38, fov: 28, padding: 1.55, thumbPadding: 0.92 },
    fontReady: Promise.resolve(),
    textures,
    wheelState,
    scrollWheel(deltaRad) {
      wheelState.angle += deltaRad;
      wheelSpin.rotation.x = wheelState.angle;
    },
    setRGB(color, brightness = 1) {
      if (color == null) {
        slitMat.emissive.setRGB(0, 0, 0);
        return;
      }
      slitMat.emissive.set(color).multiplyScalar(Math.max(0, brightness));
    },
    setTheme(nextTheme) {
      const M = nextTheme.mouse;
      bodyMat.color.set(M.body);
      btnL.mat.color.set(M.body);
      btnR.mat.color.set(M.body);
      underlayMat.color.set(M.underlay);
      bottomMat.color.set(M.black);
      parts.forEach(p => {
        if (p.id === 'btn_left' || p.id === 'btn_right') p.baseColors[0].set(M.body);
        else if (p.kind === 'button' && p.id !== 'btn_middle') p.baseColors[0].set(M.black);
      });
    },
    setLabel() {
      return false;
    },
    repaint() {},
    dispose() {
      disposables.forEach(o => o.dispose && o.dispose());
      disposables.length = 0;
    }
  };
}
