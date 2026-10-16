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

function mark(strokes, depth) {
  const shapes = strokes.map(pts => new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))));
  const geo = new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: false });
  geo.translate(0, 0, -depth / 2);
  geo.rotateY(Math.PI / 2);
  return geo;
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
  const accentMat = track(new THREE.MeshStandardMaterial({ color: H.accent, roughness: 0.38, metalness: 0.1, emissive: H.accent, emissiveIntensity: 0.28 }));
  const baffleMat = track(new THREE.MeshStandardMaterial({ color: H.baffle, roughness: 0.95, metalness: 0, side: THREE.DoubleSide }));
  const micMat = track(new THREE.MeshStandardMaterial({ color: H.shell, roughness: 0.5, metalness: 0.1 }));

  const plateMat = track(new THREE.MeshPhysicalMaterial({ color: H.plate, roughness: 0.28, metalness: 0.25, clearcoat: 0.9, clearcoatRoughness: 0.2 }));
  const shellGeo = track(slab(32, 34, 2.2, 14, 8));
  const plateGeo = track(slab(27, 29, 2.2, 1.6, 0));
  const cushionGeo = track(slab(31, 33, 2.2, 8, 5, { a: 19, b: 21 }));
  const baffleGeo = track(new THREE.ShapeGeometry(new THREE.Shape(superellipse(19.5, 21.5, 2.2)), 48));
  baffleGeo.rotateY(Math.PI / 2);
  const rimGeo = track(new THREE.TorusGeometry(28, 0.9, 12, 120));
  rimGeo.rotateY(Math.PI / 2);
  const lipGeo = track(slab(18.4, 20.4, 2.2, 0.8, 0, { a: 17.2, b: 19.2 }));
  const logoGeo = track(
    mark(
      [
        [[-11, -13], [-6, -13], [11, 13], [6, 13]],
        [[11, -13], [6, -13], [-11, 13], [-6, 13]],
        [[-14, -2], [-9, -2], [-9, 2], [-14, 2]]
      ],
      1.2
    )
  );

  function cup(side) {
    const g = new THREE.Group();
    g.name = side === 1 ? 'cupRight' : 'cupLeft';
    g.add(new THREE.Mesh(shellGeo, shellMat));
    const plate = new THREE.Mesh(plateGeo, plateMat);
    plate.position.x = 15.4;
    g.add(plate);
    const rim = new THREE.Mesh(rimGeo, metalMat);
    rim.position.x = 17;
    g.add(rim);
    const logo = new THREE.Mesh(logoGeo, accentMat);
    logo.position.x = 17;
    g.add(logo);
    const cushion = new THREE.Mesh(cushionGeo, padMat);
    cushion.position.x = -22;
    g.add(cushion);
    const baffle = new THREE.Mesh(baffleGeo, baffleMat);
    baffle.position.x = -24;
    g.add(baffle);
    const lining = new THREE.Mesh(lipGeo, accentMat);
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

  for (const z of [-1, 1]) {
    const stitch = new THREE.Mesh(track(tube(bandPts, 1.1, false, 160)), accentMat);
    stitch.position.z = z * 15.2;
    root.add(stitch);
  }

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
    for (const z of [-1, 1]) {
      const armPts = [
        new THREE.Vector3(side * CUP_X, sliderTopY - 14, 0),
        new THREE.Vector3(side * CUP_X, sliderTopY - 24, z * 10),
        new THREE.Vector3(side * CUP_X, CUP_Y + 38, z * 30),
        new THREE.Vector3(side * CUP_X, CUP_Y + 8, z * 41)
      ];
      const arm = new THREE.Mesh(track(tube(armPts, 3.1, false, 60)), accentMat);
      root.add(arm);
      const pivot = new THREE.Mesh(track(new THREE.CylinderGeometry(6.2, 6.2, 7, 28)), shellMat);
      pivot.rotation.x = Math.PI / 2;
      pivot.position.set(side * CUP_X, CUP_Y + 8, z * 41);
      root.add(pivot);
    }
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
  const tip = new THREE.Mesh(track(new THREE.CapsuleGeometry(5.6, 14, 10, 24)), micMat);
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
      plateMat.color.set(N.plate);
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
