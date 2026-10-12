import * as THREE from 'three';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { MK12_KEYS, MK12_UNITS_WIDE, MK12_ROWS } from './layout.js';
import { KEY_PITCH, CAP_PROFILE, buildCapGeometry } from './keycap-geometry.js';
import { keyCanvasSize, paintKeyCanvas, ensureLegendFont, LEGEND_PX_PER_UNIT } from './legends.js';
import { Part } from '../core/part.js';

export const KEYBOARD_DIMENSIONS = {
  caseWidth: 320,
  caseDepth: 110,
  caseCorner: 9,
  slabThickness: 40,
  bevel: 1.4,
  recessWidth: 308.4,
  recessDepth: 98.4,
  recessCorner: 3,
  recessFloor: -2.5,
  capBase: 0.2,
  tiltDeg: 5,
  frontRimHeight: 14,
  keyBlockShiftZ: -1.45,
  keyTravel: 3.6,
  portPanelWidth: 68,
  portPanelHeight: 17,
  portPanelProtrusion: 4.5
};

function roundedRectShape(w, d, r) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -d / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + d - r);
  s.absarc(x + w - r, y + d - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + d);
  s.absarc(x + r, y + d - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

function roundedRectPath(w, d, r, oy = 0) {
  const p = new THREE.Path();
  const x = -w / 2;
  const y = -d / 2 + oy;
  p.moveTo(x + r, y);
  p.lineTo(x + w - r, y);
  p.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  p.lineTo(x + w, y + d - r);
  p.absarc(x + w - r, y + d - r, r, 0, Math.PI / 2, false);
  p.lineTo(x + r, y + d);
  p.absarc(x + r, y + d - r, r, Math.PI / 2, Math.PI, false);
  p.lineTo(x, y + r);
  p.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return p;
}

function buildCaseSlab(D, tiltRad, baseHeight) {
  const b = D.bevel;
  const shape = roundedRectShape(D.caseWidth - 2 * b, D.caseDepth - 2 * b, D.caseCorner - b);
  const hole = roundedRectPath(D.recessWidth + 2 * b, D.recessDepth + 2 * b, D.recessCorner + b, -D.keyBlockShiftZ);
  hole.closePath?.();
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: D.slabThickness,
    bevelEnabled: true,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: 4,
    curveSegments: 18
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -(D.slabThickness + b), 0);
  geo.rotateX(tiltRad);
  geo.translate(0, baseHeight, 0);
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i += 1) {
    if (pos.getY(i) < 0) pos.setY(i, 0);
  }
  pos.needsUpdate = true;
  const creased = toCreasedNormals(geo, Math.PI / 5);
  geo.dispose();
  return creased;
}

export function buildKeyboardModel({ theme, maxAnisotropy = 8, dimensions = {} }) {
  const D = { ...KEYBOARD_DIMENSIONS, ...dimensions };
  const T = theme.keyboard;
  const tilt = (D.tiltDeg * Math.PI) / 180;
  const baseHeight = D.frontRimHeight + (D.caseDepth / 2) * Math.sin(tilt);

  const root = new THREE.Group();
  root.name = 'MK12';
  const disposables = [];
  const track = obj => {
    disposables.push(obj);
    return obj;
  };

  const caseMat = track(new THREE.MeshStandardMaterial({ color: T.case, roughness: 0.46, metalness: 0.0 }));
  const slabGeo = track(buildCaseSlab(D, tilt, baseHeight));
  const slab = new THREE.Mesh(slabGeo, caseMat);
  slab.name = 'case';
  root.add(slab);

  const tiltGroup = new THREE.Group();
  tiltGroup.name = 'tilt';
  tiltGroup.rotation.x = tilt;
  tiltGroup.position.y = baseHeight;
  root.add(tiltGroup);

  const plateMat = track(
    new THREE.MeshStandardMaterial({ color: T.plate, roughness: 0.8, metalness: 0.0, emissive: '#000000' })
  );
  const plateGeo = track(new THREE.BoxGeometry(D.recessWidth - 0.4, 6, D.recessDepth - 0.4));
  const plate = new THREE.Mesh(plateGeo, plateMat);
  plate.position.set(0, D.recessFloor - 3, D.keyBlockShiftZ);
  plate.name = 'plate';
  tiltGroup.add(plate);

  const panelMat = track(new THREE.MeshStandardMaterial({ color: T.portPanel, roughness: 0.5 }));
  const panelGeo = track(new THREE.BoxGeometry(D.portPanelWidth, D.portPanelHeight, D.portPanelProtrusion));
  const panel = new THREE.Mesh(panelGeo, panelMat);
  panel.position.set(0, -2.5 - D.portPanelHeight / 2 + 1.2, -D.caseDepth / 2 - D.portPanelProtrusion / 2 + 1.2);
  panel.name = 'portPanel';
  tiltGroup.add(panel);

  const darkMat = track(new THREE.MeshStandardMaterial({ color: '#141212', roughness: 0.7 }));
  const knobMat = track(new THREE.MeshStandardMaterial({ color: T.sliderKnob, roughness: 0.55 }));
  const faceZ = panel.position.z - D.portPanelProtrusion / 2 - 0.02;
  const usbGeo = track(new THREE.BoxGeometry(9.2, 3.2, 0.4));
  const usb = new THREE.Mesh(usbGeo, darkMat);
  usb.position.set(0, panel.position.y + 0.5, faceZ);
  tiltGroup.add(usb);
  const trackGeo = track(new THREE.BoxGeometry(15, 4.2, 0.4));
  const knobGeo = track(new THREE.BoxGeometry(5, 2.8, 0.8));
  [-22, 22].forEach((x, i) => {
    const t = new THREE.Mesh(trackGeo, darkMat);
    t.position.set(x, panel.position.y + 0.5, faceZ);
    tiltGroup.add(t);
    const knob = new THREE.Mesh(knobGeo, knobMat);
    knob.position.set(x + (i === 0 ? -3.5 : 3.5), panel.position.y + 0.5, faceZ - 0.3);
    tiltGroup.add(knob);
  });

  const ledGeo = track(new THREE.CylinderGeometry(0.9, 0.9, 0.5, 14));
  const ledMats = [T.ledGreen, T.ledGreen, T.ledRed].map(c => track(new THREE.MeshBasicMaterial({ color: c })));
  [85, 96.5, 108].forEach((x, i) => {
    const led = new THREE.Mesh(ledGeo, ledMats[i]);
    led.position.set(x, 1.3, -D.caseDepth / 2 + 3.1);
    tiltGroup.add(led);
  });

  const keyBlockW = MK12_UNITS_WIDE * KEY_PITCH;
  const keyBlockD = MK12_ROWS * KEY_PITCH;
  const capGeoCache = new Map();
  const getCapGeo = (key) => {
    const cacheKey = `${key.w}|${key.h}|${key.shape || 'rect'}|${key.profileRow}|${key.stemW || ''}`;
    let geo = capGeoCache.get(cacheKey);
    if (!geo) {
      geo = track(
        buildCapGeometry({
          widthU: key.w,
          depthU: key.h,
          shape: key.shape || 'rect',
          stemU: key.stemW || 1.25,
          rowIndex: key.profileRow
        })
      );
      capGeoCache.set(cacheKey, geo);
    }
    return geo;
  };

  const proxyMat = track(new THREE.MeshBasicMaterial({ visible: false }));
  const parts = [];
  const pickables = [];
  const keyRecords = [];
  const capColors = { base: T.keycapBase, accent: T.keycapAccent };
  const labels = new Map();

  const keyGroupParent = new THREE.Group();
  keyGroupParent.name = 'keys';
  tiltGroup.add(keyGroupParent);

  const PAD = 8;
  const atlasW = MK12_UNITS_WIDE * LEGEND_PX_PER_UNIT + MK12_UNITS_WIDE * PAD * 2;
  const cells = MK12_KEYS.map(key => ({ key, ...keyCanvasSize(key) }));
  const order = cells.slice().sort((a, b) => b.height - a.height || b.width - a.width);
  let shelfX = 0;
  let shelfY = 0;
  let shelfH = 0;
  order.forEach(c => {
    const cw = c.width + PAD * 2;
    const ch = c.height + PAD * 2;
    if (shelfX + cw > atlasW) {
      shelfX = 0;
      shelfY += shelfH;
      shelfH = 0;
    }
    c.x = shelfX + PAD;
    c.y = shelfY + PAD;
    shelfX += cw;
    shelfH = Math.max(shelfH, ch);
  });
  const atlasH = shelfY + shelfH;
  const atlas = document.createElement('canvas');
  atlas.width = atlasW;
  atlas.height = atlasH;
  const atlasCtx = atlas.getContext('2d');
  const scratch = document.createElement('canvas');
  const atlasTex = track(new THREE.CanvasTexture(atlas));
  atlasTex.colorSpace = THREE.SRGBColorSpace;
  atlasTex.anisotropy = maxAnisotropy;
  atlasTex.generateMipmaps = true;
  atlasTex.minFilter = THREE.LinearMipmapLinearFilter;
  atlasTex.magFilter = THREE.LinearFilter;
  const capMat = track(
    new THREE.MeshStandardMaterial({
      color: '#ffffff',
      map: atlasTex,
      vertexColors: true,
      roughness: 0.58,
      metalness: 0.0
    })
  );
  const cellByKey = new Map(cells.map(c => [c.key.id, c]));

  MK12_KEYS.forEach(key => {
    const group = new THREE.Group();
    group.name = key.id;
    const cx = (key.x + key.w / 2) * KEY_PITCH - keyBlockW / 2;
    const cz = (key.row + key.h / 2) * KEY_PITCH - keyBlockD / 2 + D.keyBlockShiftZ;
    group.position.set(cx, D.capBase, cz);
    keyGroupParent.add(group);

    const cell = cellByKey.get(key.id);
    const geometry = track(getCapGeo(key).clone());
    const uv = geometry.getAttribute('uv');
    for (let i = 0; i < uv.count; i += 1) {
      const u = uv.getX(i);
      const v = uv.getY(i);
      uv.setXY(i, (cell.x + u * cell.width) / atlasW, 1 - (cell.y + (1 - v) * cell.height) / atlasH);
    }
    uv.needsUpdate = true;
    const tint = new THREE.Float32BufferAttribute(new Float32Array(geometry.getAttribute('position').count * 3).fill(1), 3);
    geometry.setAttribute('color', tint);

    const mesh = new THREE.Mesh(geometry, capMat);
    mesh.name = `${key.id}:cap`;
    mesh.userData.partId = key.id;
    group.add(mesh);
    pickables.push(mesh);

    const proxies = [];
    const addProxy = (w, d, px, pz) => {
      const geo = track(new THREE.BoxGeometry(w, 5.5, d));
      const p = new THREE.Mesh(geo, proxyMat);
      p.position.set(px, 2.2, pz);
      p.userData.partId = key.id;
      p.userData.isProxy = true;
      p.visible = false;
      group.add(p);
      pickables.push(p);
      proxies.push(p);
    };
    if (key.shape === 'iso-enter') {
      const topW = key.w * KEY_PITCH;
      const stemW = key.stemW * KEY_PITCH;
      addProxy(topW * 0.99, KEY_PITCH * 0.99, 0, -KEY_PITCH / 2);
      addProxy(stemW * 0.99, KEY_PITCH * 0.99, (topW - stemW) / 2, KEY_PITCH / 2);
    } else {
      addProxy(key.w * KEY_PITCH * 0.99, key.h * KEY_PITCH * 0.99, 0, 0);
    }

    const part = new Part({
      id: key.id,
      name: key.name,
      kind: 'key',
      object: group,
      meshes: [mesh],
      materials: [],
      nav: { x: key.x + key.w / 2, y: key.row + key.h / 2 },
      press: { depth: D.keyTravel },
      apply: (p, v) => {
        group.position.y = D.capBase - p.pressDepth * v;
      }
    });
    part.colorGroup = key.colorGroup;
    part.setTint = (r, g, b) => {
      const arr = tint.array;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i] = r;
        arr[i + 1] = g;
        arr[i + 2] = b;
      }
      tint.needsUpdate = true;
    };
    parts.push(part);
    keyRecords.push({ key, cell, part, proxies });
  });

  const lightGeo = track(new THREE.PlaneGeometry(1, 1));
  lightGeo.rotateX(-Math.PI / 2);
  const lightMat = track(
    new THREE.MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false
    })
  );
  const keyLights = new THREE.InstancedMesh(lightGeo, lightMat, MK12_KEYS.length);
  keyLights.name = 'backlight';
  const lightIndex = new Map();
  const lm = new THREE.Matrix4();
  const black = new THREE.Color(0, 0, 0);
  MK12_KEYS.forEach((key, i) => {
    const cx = (key.x + key.w / 2) * KEY_PITCH - keyBlockW / 2;
    const cz = (key.row + key.h / 2) * KEY_PITCH - keyBlockD / 2 + D.keyBlockShiftZ;
    lm.makeScale(key.w * KEY_PITCH + 1.2, 1, key.h * KEY_PITCH + 1.2);
    lm.setPosition(cx, D.recessFloor + 0.06, cz);
    keyLights.setMatrixAt(i, lm);
    keyLights.setColorAt(i, black);
    lightIndex.set(key.id, i);
  });
  keyLights.instanceMatrix.needsUpdate = true;
  keyLights.instanceColor.needsUpdate = true;
  keyLights.frustumCulled = false;
  tiltGroup.add(keyLights);
  const lightColor = new THREE.Color();

  const state = { theme, capColors, labels };

  const legendInk = group => (group === 'accent' ? T.legendOnAccent : T.legendOnBase);

  function paintCell(rec) {
    const colorKey = rec.key.colorGroup;
    const c = rec.cell;
    scratch.width = c.width;
    scratch.height = c.height;
    paintKeyCanvas(scratch, rec.key, {
      capColor: state.capColors[colorKey],
      ink: legendInk(colorKey),
      override: state.labels.has(rec.key.id) ? state.labels.get(rec.key.id) : undefined
    });
    atlasCtx.fillStyle = state.capColors[colorKey];
    atlasCtx.fillRect(c.x - PAD, c.y - PAD, c.width + PAD * 2, c.height + PAD * 2);
    atlasCtx.drawImage(scratch, c.x, c.y);
  }

  function repaintRecord(rec) {
    paintCell(rec);
    atlasTex.needsUpdate = true;
  }

  function repaintAll() {
    keyRecords.forEach(paintCell);
    atlasTex.needsUpdate = true;
  }

  repaintAll();
  const fontReady = ensureLegendFont().then(() => repaintAll());

  const bounds = new THREE.Box3().setFromObject(root);

  return {
    kind: 'keyboard',
    root,
    parts,
    pickables,
    bounds,
    footprint: { width: D.caseWidth + 40, depth: D.caseDepth + 40 },
    dimensions: D,
    home: { azimuthDeg: 0, elevationDeg: 52, fov: 28, padding: 1.44, thumbPadding: 1.04 },
    fontReady,
    textures: [atlasTex],
    setRGB(color, brightness = 1) {
      if (color == null) {
        plateMat.emissive.setRGB(0, 0, 0);
        plateMat.emissiveIntensity = 1;
        return;
      }
      plateMat.emissive.set(color);
      plateMat.emissiveIntensity = Math.max(0, brightness) * 1.6;
    },
    setKeyLight(id, r, g, b) {
      const i = lightIndex.get(id);
      if (i == null) return;
      keyLights.setColorAt(i, lightColor.setRGB(r, g, b));
      keyLights.instanceColor.needsUpdate = true;
    },
    clearKeyLights() {
      for (let i = 0; i < MK12_KEYS.length; i += 1) keyLights.setColorAt(i, black);
      keyLights.instanceColor.needsUpdate = true;
    },
    setTheme(nextTheme) {
      const K = nextTheme.keyboard;
      state.capColors.base = K.keycapBase;
      state.capColors.accent = K.keycapAccent;
      caseMat.color.set(K.case);
      plateMat.color.set(K.plate);
      panelMat.color.set(K.portPanel);
      knobMat.color.set(K.sliderKnob);
      ledMats[0].color.set(K.ledGreen);
      ledMats[1].color.set(K.ledGreen);
      ledMats[2].color.set(K.ledRed);
      Object.assign(T, K);
      repaintAll();
    },
    setLabel(id, text) {
      const rec = keyRecords.find(r => r.key.id === id);
      if (!rec) return false;
      if (text == null || text === '') state.labels.delete(id);
      else state.labels.set(id, String(text));
      repaintRecord(rec);
      return true;
    },
    repaint: repaintAll,
    tapSlot(id) {
      return keyRecords.find(r => r.key.id === id) || null;
    },
    dispose() {
      disposables.forEach(o => o.dispose && o.dispose());
      disposables.length = 0;
      keyRecords.length = 0;
    }
  };
}
