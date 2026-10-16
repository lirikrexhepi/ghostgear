import * as THREE from 'three';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

const CUP_X = 96;
const CUP_Y = 56;

function superellipse(a, b, n, steps = 112) {
  const pts = [];
  for (let i = 0; i < steps; i += 1) {
    const t = (i / steps) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    pts.push(new THREE.Vector2(a * Math.sign(c) * Math.abs(c) ** (2 / n), b * Math.sign(s) * Math.abs(s) ** (2 / n)));
  }
  return pts;
}

function slab(a, b, n, depth, bevel, hole) {
  const shape = new THREE.Shape(superellipse(a, b, n));
  if (hole) shape.holes.push(new THREE.Path(superellipse(hole.a, hole.b, n)));
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 8,
    curveSegments: 64
  });
  geo.translate(0, 0, -depth / 2);
  geo.rotateY(Math.PI / 2);
  return toCreasedNormals(geo, Math.PI / 4);
}

function tube(points, radius, closed = false, segments = 120) {
  const curve = new THREE.CatmullRomCurve3(points, closed, 'catmullrom', 0.5);
  return new THREE.TubeGeometry(curve, segments, radius, 20, closed);
}

export function buildHeadsetModel({ theme }) {
  const H = theme.headset;
  const root = new THREE.Group();
  root.name = 'headset';
  const disposables = [];
  const track = o => {
    disposables.push(o);
    return o;
  };

  const shellMat = track(new THREE.MeshPhysicalMaterial({ color: H.shell, roughness: 0.42, metalness: 0.05, clearcoat: 0.5, clearcoatRoughness: 0.35 }));
  const padMat = track(new THREE.MeshStandardMaterial({ color: H.pad, roughness: 0.82, metalness: 0 }));
  const metalMat = track(new THREE.MeshStandardMaterial({ color: H.metal, roughness: 0.34, metalness: 0.85 }));
  const bandMat = track(new THREE.MeshStandardMaterial({ color: H.pad, roughness: 0.7, metalness: 0 }));
  const accentMat = track(new THREE.MeshStandardMaterial({ color: H.accent, roughness: 0.38, metalness: 0.1, emissive: H.accent, emissiveIntensity: 0.12 }));
  const baffleMat = track(new THREE.MeshStandardMaterial({ color: H.baffle, roughness: 0.95, metalness: 0, side: THREE.DoubleSide }));
  const micMat = track(new THREE.MeshStandardMaterial({ color: H.shell, roughness: 0.5, metalness: 0.1 }));

  const shellGeo = track(slab(30, 36, 2.7, 14, 8));
  const plateGeo = track(slab(25, 30.5, 2.7, 1.6, 0));
  const cushionGeo = track(slab(29, 34, 2.6, 8, 5, { a: 18, b: 23 }));
  const baffleGeo = track(new THREE.ShapeGeometry(new THREE.Shape(superellipse(18.5, 23.5, 2.6)), 48));
  baffleGeo.rotateY(Math.PI / 2);
  const ringGeo = track(new THREE.TorusGeometry(20, 1.3, 16, 120));
  ringGeo.rotateY(Math.PI / 2);
  ringGeo.scale(1, 1.18, 1);
  const innerRingGeo = track(slab(17.4, 22.4, 2.6, 0.8, 0, { a: 16.2, b: 21.2 }));
  const logoGeo = track(new THREE.CylinderGeometry(5.4, 5.4, 1.2, 40));
  logoGeo.rotateZ(Math.PI / 2);

  function cup(side) {
    const g = new THREE.Group();
    g.name = side === 1 ? 'cupRight' : 'cupLeft';
    const shell = new THREE.Mesh(shellGeo, shellMat);
    g.add(shell);
    const plate = new THREE.Mesh(plateGeo, padMat);
    plate.position.x = 15.4;
    g.add(plate);
    const ring = new THREE.Mesh(ringGeo, accentMat);
    ring.position.x = 16.8;
    g.add(ring);
    const logo = new THREE.Mesh(logoGeo, accentMat);
    logo.position.x = 16.8;
    g.add(logo);
    const cushion = new THREE.Mesh(cushionGeo, padMat);
    cushion.position.x = -22;
    g.add(cushion);
    const baffle = new THREE.Mesh(baffleGeo, baffleMat);
    baffle.position.x = -24;
    g.add(baffle);
    const lining = new THREE.Mesh(innerRingGeo, accentMat);
    lining.position.x = -29.4;
    g.add(lining);
    g.position.set(side * CUP_X, CUP_Y, 0);
    if (side === -1) g.scale.x = -1;
    return g;
  }
  root.add(cup(1), cup(-1));

  const bandCenterY = 72;
  const bandRx = 100;
  const bandRy = 112;
  const bandPts = [];
  const a0 = (22 * Math.PI) / 180;
  const a1 = Math.PI - a0;
  for (let i = 0; i <= 60; i += 1) {
    const t = a0 + ((a1 - a0) * i) / 60;
    bandPts.push(new THREE.Vector3(Math.cos(t) * bandRx, bandCenterY + Math.sin(t) * bandRy, 0));
  }
  const band = new THREE.Mesh(track(tube(bandPts, 7.5, false, 160)), bandMat);
  band.scale.z = 2.1;
  root.add(band);

  const padPts = [];
  const p0 = (52 * Math.PI) / 180;
  const p1 = Math.PI - p0;
  for (let i = 0; i <= 40; i += 1) {
    const t = p0 + ((p1 - p0) * i) / 40;
    padPts.push(new THREE.Vector3(Math.cos(t) * (bandRx - 8), bandCenterY + Math.sin(t) * (bandRy - 8), 0));
  }
  const pad = new THREE.Mesh(track(tube(padPts, 6, false, 100)), padMat);
  pad.scale.z = 2.5;
  root.add(pad);

  const stripePts = bandPts.filter((_, i) => i > 14 && i < 46).map(p => new THREE.Vector3(p.x * 1.0, p.y + 2.2, 0));
  const stripe = new THREE.Mesh(track(tube(stripePts, 1.6, false, 100)), accentMat);
  stripe.scale.z = 3.6;
  stripe.position.z = 0;
  root.add(stripe);

  const sliderTopY = bandCenterY + Math.sin(a0) * bandRy;
  for (const side of [1, -1]) {
    const slider = new THREE.Mesh(track(new THREE.CylinderGeometry(4.2, 4.2, 22, 28)), metalMat);
    slider.position.set(side * CUP_X, sliderTopY - 6, 0);
    root.add(slider);
    const collar = new THREE.Mesh(track(new THREE.TorusGeometry(5.2, 1.2, 12, 40)), accentMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.set(side * CUP_X, sliderTopY + 5, 0);
    root.add(collar);
    const link = new THREE.Mesh(track(new THREE.CylinderGeometry(5.6, 5.6, 10, 28)), shellMat);
    link.position.set(side * CUP_X, sliderTopY + 14, 0);
    root.add(link);
    const archPts = [];
    for (let i = 0; i <= 36; i += 1) {
      const t = (i / 36) * Math.PI;
      archPts.push(new THREE.Vector3(side * CUP_X, CUP_Y + Math.sin(t) * 49, -Math.cos(t) * 41));
    }
    const arch = new THREE.Mesh(track(tube(archPts, 3.3, false, 90)), metalMat);
    root.add(arch);
    for (const z of [-1, 1]) {
      const pivot = new THREE.Mesh(track(new THREE.CylinderGeometry(5.4, 5.4, 6, 28)), metalMat);
      pivot.rotation.x = Math.PI / 2;
      pivot.position.set(side * CUP_X, CUP_Y, z * 40);
      root.add(pivot);
      const cap = new THREE.Mesh(track(new THREE.CylinderGeometry(2.4, 2.4, 6.6, 20)), accentMat);
      cap.rotation.x = Math.PI / 2;
      cap.position.set(side * CUP_X, CUP_Y, z * 40);
      root.add(cap);
    }
    const knuckle = new THREE.Mesh(track(new THREE.SphereGeometry(4.6, 24, 16)), metalMat);
    knuckle.position.set(side * CUP_X, CUP_Y + 49, 0);
    root.add(knuckle);
    const feeder = new THREE.Mesh(track(tube([new THREE.Vector3(side * CUP_X, sliderTopY + 18, 0), new THREE.Vector3(side * CUP_X, CUP_Y + 49, 0)], 3.3, false, 4)), metalMat);
    root.add(feeder);
  }

  const port = new THREE.Mesh(track(new THREE.CylinderGeometry(4.6, 4.6, 6, 28)), padMat);
  port.rotation.z = Math.PI / 2;
  port.position.set(-CUP_X - 20, CUP_Y - 22, -22);
  root.add(port);
  const micPts = [
    new THREE.Vector3(-CUP_X - 20, CUP_Y - 26, -26),
    new THREE.Vector3(-CUP_X - 33, CUP_Y - 29, -12),
    new THREE.Vector3(-CUP_X - 38, CUP_Y - 31, 14),
    new THREE.Vector3(-CUP_X - 30, CUP_Y - 29, 42),
    new THREE.Vector3(-CUP_X - 10, CUP_Y - 22, 62),
    new THREE.Vector3(-CUP_X + 10, CUP_Y - 14, 70)
  ];
  const boom = new THREE.Mesh(track(tube(micPts, 2.7, false, 80)), micMat);
  root.add(boom);
  const tip = new THREE.Mesh(track(new THREE.CapsuleGeometry(5.4, 13, 10, 24)), micMat);
  const tipDir = micPts[5].clone().sub(micPts[4]).normalize();
  tip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tipDir);
  tip.position.copy(micPts[5]).addScaledVector(tipDir, 6);
  root.add(tip);
  const tipBand = new THREE.Mesh(track(new THREE.TorusGeometry(5.5, 0.9, 10, 36)), accentMat);
  tipBand.quaternion.copy(tip.quaternion);
  tipBand.rotateX(Math.PI / 2);
  tipBand.position.copy(micPts[5]).addScaledVector(tipDir, 0.5);
  root.add(tipBand);

  root.updateMatrixWorld(true);
  const raw = new THREE.Box3().setFromObject(root);
  root.position.y = -raw.min.y;
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root);

  return {
    kind: 'headset',
    root,
    parts: [],
    pickables: [],
    bounds,
    footprint: { width: 250, depth: 120 },
    dimensions: {},
    home: { azimuthDeg: 28, elevationDeg: 14, fov: 28, padding: 1.3, thumbPadding: 0.92 },
    fontReady: Promise.resolve(),
    textures: [],
    scrollWheel() {},
    setRGB() {},
    setTheme(nextTheme) {
      const N = nextTheme.headset;
      shellMat.color.set(N.shell);
      micMat.color.set(N.shell);
      padMat.color.set(N.pad);
      bandMat.color.set(N.pad);
      metalMat.color.set(N.metal);
      baffleMat.color.set(N.baffle);
      accentMat.color.set(N.accent);
      accentMat.emissive.set(N.accent);
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
