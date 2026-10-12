import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { VIEWER_THEME, cloneTheme } from '../theme.js';
import { PartAnimator } from './part.js';
import { buildKeyboardModel } from '../keyboard/keyboard-model.js';
import { buildMouseModel } from '../mouse/mouse-model.js';
import { KEY_ID_BY_EVENT_CODE } from '../keyboard/layout.js';

const DRAG_THRESHOLD_PX = 4;
const MOUSE_BUTTON_IDS = ['btn_left', 'btn_middle', 'btn_right', 'btn_back', 'btn_forward'];

const VIEW_PRESETS = {
  keyboard: {
    home: null,
    top: { az: 0, el: 89.5 },
    front: { az: 0, el: 14 },
    back: { az: 180, el: 14 },
    side: { az: 90, el: 10 },
    bottom: { az: 0, el: 60 }
  },
  mouse: {
    home: null,
    top: { az: 0, el: 89.5 },
    front: { az: 180, el: 12 },
    back: { az: 0, el: 12 },
    side: { az: 270, el: 6 },
    bottom: { az: 215, el: -70 }
  }
};

function mergeDeep(target, src) {
  if (!src) return target;
  Object.keys(src).forEach(key => {
    if (src[key] && typeof src[key] === 'object' && !Array.isArray(src[key])) {
      if (!target[key]) target[key] = {};
      mergeDeep(target[key], src[key]);
    } else {
      target[key] = src[key];
    }
  });
  return target;
}

function createShadowTexture(width, depth, rounded) {
  const px = 256;
  const aspect = width / depth;
  const w = aspect >= 1 ? px : Math.round(px * aspect);
  const h = aspect >= 1 ? Math.round(px / aspect) : px;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const steps = 24;
  const margin = Math.min(w, h) * 0.28;
  for (let i = 0; i < steps; i += 1) {
    const k = i / (steps - 1);
    const inset = margin * (1 - k);
    const rw = w - inset * 2;
    const rh = h - inset * 2;
    const r = Math.min(rw, rh) * rounded;
    ctx.fillStyle = `rgba(0,0,0,${(0.9 / steps) * (0.35 + k)})`;
    ctx.beginPath();
    ctx.roundRect(inset, inset, rw, rh, r);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && c.getContext('webgl2')) || !!(window.WebGLRenderingContext && c.getContext('webgl'));
  } catch (e) {
    return false;
  }
}

function mountFallback(container, options) {
  const img = document.createElement('img');
  img.src = options.fallbackImage || '';
  img.alt = options.fallbackAlt || '';
  img.style.cssText = 'width:100%;height:100%;object-fit:contain;display:block;';
  if (options.fallbackImage) container.appendChild(img);
  const noop = () => {};
  return {
    isFallback: true,
    device: options.device,
    on: () => noop,
    select: noop,
    clearSelection: noop,
    getSelection: () => [],
    highlight: noop,
    clearHighlight: noop,
    press: noop,
    release: noop,
    tap: noop,
    setLabel: noop,
    setDisabled: noop,
    setRGB: noop,
    setTheme: noop,
    setView: noop,
    resetView: noop,
    getPartIds: () => [],
    scrollWheel: noop,
    exportGLB: () => Promise.reject(new Error('WebGL unavailable')),
    dispose() {
      img.remove();
    }
  };
}

const pool = new Map();
let parkingEl = null;

function getParking() {
  if (!parkingEl || !parkingEl.isConnected) {
    parkingEl = document.createElement('div');
    parkingEl.setAttribute('aria-hidden', 'true');
    parkingEl.style.cssText =
      'position:fixed;left:-10000px;top:0;width:1200px;height:700px;pointer-events:none;visibility:hidden;';
    document.body.appendChild(parkingEl);
  }
  return parkingEl;
}

export function acquireDeviceViewer(container, options = {}) {
  const device = options.device === 'mouse' ? 'mouse' : 'keyboard';
  const parked = pool.get(device);
  console.log('ACQUIRE', device, !!parked, performance.now());
  if (parked) {
    pool.delete(device);
    if (parked.attach(container, options)) return parked;
  }
  return createDeviceViewer(container, options);
}

export async function snapshotDevice(device, options = {}) {
  await prewarmDeviceViewer(device, options);
  const viewer = pool.get(device);
  return viewer ? viewer.snapshot(options) : null;
}

export function prewarmDeviceViewer(device, options = {}) {
  console.log('PREWARM', device, performance.now());
  if (pool.has(device)) return Promise.resolve();
  if (!hasWebGL()) return Promise.resolve();
  const viewer = createDeviceViewer(getParking(), { ...options, device, autoRotate: false });
  if (viewer.isFallback) return Promise.resolve();
  viewer.release();
  return viewer.warmup();
}

export function createDeviceViewer(initialContainer, userOptions = {}) {
  let container = initialContainer;
  const options = {
    device: 'keyboard',
    theme: 'light',
    fallbackImage: null,
    fallbackAlt: '',
    autoRotate: true,
    autoRotateIdleMs: 4000,
    enableLiveInput: false,
    tooltip: true,
    describe: null,
    partNames: null,
    multiSelect: true,
    clearOnEmptyClick: false,
    maxPixelRatio: 1.75,
    insetRight: 0,
    reserveRight: null,
    dimensions: {},
    colors: null,
    onHover: null,
    onClick: null,
    onSelectionChange: null,
    onScroll: null,
    ...userOptions
  };

  if (!hasWebGL()) return mountFallback(container, options);

  const themeData = cloneTheme();
  mergeDeep(themeData, options.colors);
  const listeners = { hover: new Set(), click: new Set(), selection: new Set(), scroll: new Set(), blocked: new Set(), contextlost: new Set(), contextrestored: new Set(), ready: new Set() };
  const emit = (name, ...args) => {
    listeners[name].forEach(fn => fn(...args));
  };

  const doc = container.ownerDocument;
  const host = doc.createElement('div');
  host.className = 'gh-viewer-host';
  host.style.cssText = 'position:absolute;inset:0;overflow:hidden;';
  if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
  container.appendChild(host);
  container.tabIndex = container.tabIndex >= 0 ? container.tabIndex : 0;
  container.setAttribute('role', 'application');
  container.setAttribute(
    'aria-label',
    options.device === 'keyboard' ? 'Interactive 3D keyboard' : 'Interactive 3D mouse'
  );

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false
    });
  } catch (e) {
    host.remove();
    return mountFallback(container, options);
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;outline:none;';
  host.appendChild(canvas);

  const overlay = doc.createElement('div');
  overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;';
  host.appendChild(overlay);

  const tooltip = doc.createElement('div');
  tooltip.setAttribute('aria-hidden', 'true');
  tooltip.style.cssText =
    'position:absolute;left:0;top:0;transform:translate(-9999px,-9999px);padding:6px 10px;border-radius:10px;background:rgba(17,17,17,0.92);color:#fff;font:500 12px/1.3 Geist,system-ui,sans-serif;white-space:nowrap;pointer-events:none;opacity:0;transition:opacity 120ms;box-shadow:0 6px 18px rgba(0,0,0,0.25);';
  overlay.appendChild(tooltip);

  const live = doc.createElement('div');
  live.setAttribute('aria-live', 'polite');
  live.setAttribute('role', 'status');
  live.style.cssText = 'position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;';
  host.appendChild(live);

  const fallbackImg = doc.createElement('img');
  fallbackImg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;display:none;';
  if (options.fallbackImage) fallbackImg.src = options.fallbackImage;
  fallbackImg.alt = options.fallbackAlt;
  host.appendChild(fallbackImg);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 5, 4000);
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envTarget.texture;

  const keyLight = new THREE.DirectionalLight('#ffffff', 1.6);
  keyLight.position.set(-140, 320, 220);
  const fillLight = new THREE.DirectionalLight('#f3f6ff', 0.5);
  fillLight.position.set(260, 140, 120);
  const rimLight = new THREE.DirectionalLight('#ffffff', 0.9);
  rimLight.position.set(40, 150, -300);
  const underLight = new THREE.DirectionalLight('#ffffff', 0.7);
  underLight.position.set(60, -260, 120);
  scene.add(keyLight, fillLight, rimLight, underLight);

  const builder = options.device === 'mouse' ? buildMouseModel : buildKeyboardModel;
  const model = builder({ theme: themeData, maxAnisotropy: maxAniso, dimensions: options.dimensions });
  scene.add(model.root);
  if (options.partNames) {
    model.parts.forEach(p => {
      if (options.partNames[p.id]) p.name = options.partNames[p.id];
    });
  }

  const shadowTex = createShadowTexture(model.footprint.width, model.footprint.depth, 0.28);
  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.32 });
  const shadowMesh = new THREE.Mesh(new THREE.PlaneGeometry(model.footprint.width, model.footprint.depth), shadowMat);
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.y = -0.05;
  shadowMesh.renderOrder = -1;
  shadowMesh.userData.noExport = true;
  scene.add(shadowMesh);

  let themeName = options.theme === 'dark' ? 'dark' : 'light';

  function applySceneTheme() {
    const s = themeData.scene[themeName];
    scene.environmentIntensity = s.environmentIntensity;
    keyLight.intensity = s.keyIntensity;
    fillLight.intensity = s.fillIntensity;
    rimLight.intensity = s.rimIntensity;
    shadowMat.opacity = s.shadowOpacity;
  }
  applySceneTheme();

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.09;
  controls.enablePan = false;
  controls.rotateSpeed = 0.75;
  controls.zoomSpeed = 0.8;
  controls.autoRotateSpeed = 1.2;
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE };

  const target = new THREE.Vector3();
  const homeDir = new THREE.Vector3();
  let homeDistance = 400;
  let userMovedCamera = false;

  const corners = Array.from({ length: 8 }, () => new THREE.Vector3());
  const tmpV = new THREE.Vector3();
  const tmpV2 = new THREE.Vector3();
  const tmpV3 = new THREE.Vector3();

  function dirFromAngles(azDeg, elDeg, out) {
    const az = (azDeg * Math.PI) / 180;
    const el = (elDeg * Math.PI) / 180;
    return out.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  }

  function fitDistance(dir, padding) {
    const b = model.bounds;
    const cx = (b.min.x + b.max.x) / 2;
    const cy = (b.min.y + b.max.y) / 2;
    const cz = (b.min.z + b.max.z) / 2;
    target.set(cx, cy, cz);
    let i = 0;
    [b.min.x, b.max.x].forEach(x => {
      [b.min.y, b.max.y].forEach(y => {
        [b.min.z, b.max.z].forEach(z => {
          corners[i].set(x, y, z);
          i += 1;
        });
      });
    });
    tmpV.copy(target).addScaledVector(dir, 1000);
    const saved = camera.position.clone();
    const savedQuat = camera.quaternion.clone();
    camera.position.copy(tmpV);
    camera.up.set(0, 1, 0);
    camera.lookAt(target);
    camera.updateMatrixWorld(true);
    const inv = camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    const tanV = Math.tan((camera.fov * Math.PI) / 360);
    const tanH = tanV * fitAspect;
    let need = 0;
    corners.forEach(c => {
      tmpV2.copy(c).applyMatrix4(inv);
      const depthBeyond = -tmpV2.z - 1000;
      need = Math.max(need, Math.abs(tmpV2.x) / tanH - depthBeyond, Math.abs(tmpV2.y) / tanV - depthBeyond);
    });
    camera.position.copy(saved);
    camera.quaternion.copy(savedQuat);
    return need * padding;
  }

  function resolvePreset(name) {
    if (name === 'home' || !VIEW_PRESETS[options.device][name]) {
      return { az: model.home.azimuthDeg, el: model.home.elevationDeg };
    }
    return VIEW_PRESETS[options.device][name];
  }

  let camAnim = null;
  const sphStart = new THREE.Spherical();
  const sphEnd = new THREE.Spherical();
  const sphNow = new THREE.Spherical();
  const offsetTmp = new THREE.Vector3();

  function setCamera({ az, el, distance, animate = true }) {
    const dir = dirFromAngles(az, el, tmpV3);
    const dist = distance != null ? distance : fitDistance(dir, model.home.padding);
    sphEnd.setFromVector3(offsetTmp.copy(dir).multiplyScalar(dist));
    if (!animate || reducedMotion) {
      controls.target.copy(target);
      camera.position.copy(target).add(offsetTmp.setFromSpherical(sphEnd));
      camera.lookAt(target);
      controls.update();
      camAnim = null;
      invalidate();
      return;
    }
    offsetTmp.copy(camera.position).sub(controls.target);
    sphStart.setFromVector3(offsetTmp);
    camAnim = { t: 0, duration: 0.55 };
    invalidate();
  }

  let reducedMotion = false;
  const mq = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

  const animator = new PartAnimator(themeData, () => invalidate());
  model.parts.forEach(p => animator.add(p));

  function applyReducedMotion() {
    reducedMotion = !!(mq && mq.matches);
    animator.reduceMotion = reducedMotion;
    controls.autoRotate = false;
    controls.enableDamping = !reducedMotion;
  }
  applyReducedMotion();
  const onMotionChange = () => {
    applyReducedMotion();
    scheduleAutoRotate();
  };
  if (mq && mq.addEventListener) mq.addEventListener('change', onMotionChange);

  const partsById = animator.parts;
  const selection = [];
  const disabled = new Set();

  function describe(id) {
    const part = partsById.get(id);
    if (!part) return '';
    const extra = options.describe ? options.describe(id, part) : null;
    return extra == null ? '' : String(extra);
  }

  function announce(text) {
    live.textContent = text;
  }

  function setSelection(ids, silent) {
    const next = ids.filter(id => partsById.has(id));
    const changed = next.length !== selection.length || next.some((id, i) => id !== selection[i]);
    if (!changed) return;
    selection.forEach(id => {
      if (!next.includes(id)) animator.setSelected(partsById.get(id), 0);
    });
    next.forEach(id => animator.setSelected(partsById.get(id), 1));
    selection.length = 0;
    next.forEach(id => selection.push(id));
    if (!silent) {
      const copy = selection.slice();
      if (options.onSelectionChange) options.onSelectionChange(copy);
      emit('selection', copy);
      const first = selection[0] ? partsById.get(selection[0]) : null;
      announce(first ? `${first.name} selected${describe(first.id) ? `, ${describe(first.id)}` : ''}` : 'Selection cleared');
    }
  }

  let hoveredId = null;
  function setHover(id, clientX, clientY) {
    if (id !== hoveredId) {
      if (hoveredId) animator.setHover(partsById.get(hoveredId), 0);
      hoveredId = id;
      if (id) animator.setHover(partsById.get(id), 1);
      canvas.style.cursor = id ? (disabled.has(id) ? 'not-allowed' : 'pointer') : draggingNow ? 'grabbing' : 'grab';
      if (options.onHover) options.onHover(id);
      emit('hover', id);
      updateTooltipContent();
    }
    if (id && options.tooltip) placeTooltip(clientX, clientY);
    else tooltip.style.opacity = '0';
  }

  function updateTooltipContent() {
    if (!hoveredId || !options.tooltip) {
      tooltip.style.opacity = '0';
      return;
    }
    const part = partsById.get(hoveredId);
    const extra = describe(hoveredId);
    tooltip.textContent = extra ? `${part.name}  →  ${extra}` : part.name;
  }

  function placeTooltip(clientX, clientY) {
    const r = host.getBoundingClientRect();
    const x = Math.min(Math.max(clientX - r.left + 14, 4), Math.max(4, r.width - 160));
    const y = Math.max(clientY - r.top - 36, 4);
    tooltip.style.transform = `translate(${x}px,${y}px)`;
    tooltip.style.opacity = '1';
  }

  let fitAspect = 1;
  let intro = null;
  const introSize = new THREE.Vector3();

  function applyIntro(k) {
    const e = k * k * k * (k * (k * 6 - 15) + 10);
    const u = 1 - e;
    model.bounds.getSize(introSize);
    const span = Math.max(introSize.x, introSize.z);
    const p0x = -span * 1.05;
    const p0y = 0;
    const p0z = span * 0.42;
    const c1x = -span * 0.55;
    const c1y = span * 0.16;
    const c1z = -span * 0.5;
    const c2x = -span * 0.08;
    const c2y = span * 0.12;
    const c2z = -span * 0.3;
    const a0 = u * u * u;
    const a1 = 3 * u * u * e;
    const a2 = 3 * u * e * e;
    model.root.position.set(a0 * p0x + a1 * c1x + a2 * c2x, a0 * p0y + a1 * c1y + a2 * c2y, a0 * p0z + a1 * c1z + a2 * c2z);
    model.root.rotation.y = 0.55 * u;
    model.root.rotation.z = -0.05 * u;
    shadowMesh.position.x = model.root.position.x;
    shadowMesh.position.z = model.root.position.z;
    shadowMesh.rotation.z = model.root.rotation.y;
    shadowMat.opacity = themeData.scene[themeName].shadowOpacity * (1 - Math.min(1, model.root.position.y / (span * 0.2)) * 0.6);
  }

  function startIntro() {
    if (reducedMotion) return;
    intro = { start: 0, duration: 1.7 };
    applyIntro(0);
    host.style.transition = 'none';
    host.style.opacity = '0';
    invalidate();
  }
  let shiftCurrent = 0;
  let shiftTarget = 0;
  let shiftAnimating = false;

  function applyShift() {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    if (shiftCurrent > 0.25) camera.setViewOffset(w, h, shiftCurrent, 0, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }
  let pixelRatio = Math.min(window.devicePixelRatio || 1, options.maxPixelRatio);
  let prevFrameTs = 0;
  let slowFrames = 0;
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  function pickAt(clientX, clientY) {
    if (options.interactive === false) return null;
    const r = canvas.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return null;
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(model.pickables, false);
    for (let i = 0; i < hits.length; i += 1) {
      const id = hits[i].object.userData.partId;
      if (id) return id;
    }
    return null;
  }

  let needsRender = true;
  let rafId = 0;
  let lastTime = 0;
  let onScreen = true;
  let tabVisible = !doc.hidden;
  let contextLost = false;
  let autoRotateTimer = 0;
  let disposed = false;
  let autoRotating = false;

  function isActive() {
    return onScreen && tabVisible && !contextLost && !disposed;
  }

  function invalidate() {
    needsRender = true;
    if (!rafId && isActive()) {
      lastTime = performance.now();
      rafId = requestAnimationFrame(frame);
    }
  }

  function scheduleAutoRotate() {
    clearTimeout(autoRotateTimer);
    autoRotating = false;
    controls.autoRotate = false;
    if (!options.autoRotate || reducedMotion || disposed) return;
    autoRotateTimer = setTimeout(() => {
      autoRotating = true;
      controls.autoRotate = true;
      invalidate();
    }, options.autoRotateIdleMs);
  }

  const labels = new Map();
  const labelBox = new THREE.Box3();

  function updateLabels() {
    if (labels.size === 0) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    labels.forEach((el, id) => {
      const part = partsById.get(id);
      labelBox.makeEmpty();
      part.meshes.forEach(m => {
        if (!m.userData.isProxy && m.geometry) labelBox.expandByObject(m);
      });
      if (labelBox.isEmpty()) labelBox.setFromObject(part.object);
      labelBox.getCenter(tmpV);
      tmpV.project(camera);
      const x = (tmpV.x * 0.5 + 0.5) * w;
      const y = (-tmpV.y * 0.5 + 0.5) * h;
      el.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%)`;
    });
  }

  function frame(now) {
    rafId = 0;
    if (!isActive()) return;
    const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
    lastTime = now;
    if (prevFrameTs) {
      slowFrames = now - prevFrameTs > 30 ? slowFrames + 1 : Math.max(0, slowFrames - 1);
      if (slowFrames > 20 && pixelRatio > 1) {
        pixelRatio = Math.max(1, pixelRatio - 0.25);
        slowFrames = 0;
        renderer.setPixelRatio(pixelRatio);
        renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
        needsRender = true;
      }
    }
    prevFrameTs = now;
    let again = false;
    if (camAnim) {
      camAnim.t += dt / camAnim.duration;
      const k = Math.min(1, camAnim.t);
      const e = k * k * (3 - 2 * k);
      let dAz = sphEnd.theta - sphStart.theta;
      while (dAz > Math.PI) dAz -= Math.PI * 2;
      while (dAz < -Math.PI) dAz += Math.PI * 2;
      sphNow.radius = sphStart.radius + (sphEnd.radius - sphStart.radius) * e;
      sphNow.phi = sphStart.phi + (sphEnd.phi - sphStart.phi) * e;
      sphNow.theta = sphStart.theta + dAz * e;
      controls.target.copy(target);
      camera.position.copy(target).add(offsetTmp.setFromSpherical(sphNow));
      camera.lookAt(target);
      if (k >= 1) camAnim = null;
      again = true;
      needsRender = true;
    }
    if (shiftAnimating) {
      shiftCurrent += (shiftTarget - shiftCurrent) * (1 - Math.exp(-dt * 11));
      if (Math.abs(shiftTarget - shiftCurrent) < 0.3) {
        shiftCurrent = shiftTarget;
        shiftAnimating = false;
      }
      applyShift();
      needsRender = true;
      again = again || shiftAnimating;
    }
    if (intro) {
      if (!intro.start) {
        intro.start = now;
        host.style.transition = 'opacity 380ms ease-out';
        host.style.opacity = '1';
      }
      const k = Math.min(1, (now - intro.start) / 1000 / intro.duration);
      applyIntro(k);
      if (k >= 1) intro = null;
      needsRender = true;
      again = true;
    }
    if (animator.step(dt)) again = true;
    if (model.step && model.step(dt)) again = true;
    const moved = controls.update(dt);
    if (moved || autoRotating) {
      needsRender = true;
      again = true;
    }
    if (needsRender) {
      renderer.render(scene, camera);
      updateLabels();
      needsRender = false;
    }
    if (again) {
      if (!rafId) rafId = requestAnimationFrame(frame);
    } else if (!rafId) {
      prevFrameTs = 0;
    }
  }

  controls.addEventListener('change', () => invalidate());
  controls.addEventListener('start', () => {
    userMovedCamera = true;
    autoRotating = false;
    controls.autoRotate = false;
    clearTimeout(autoRotateTimer);
    camAnim = null;
    invalidate();
  });
  controls.addEventListener('end', () => {
    scheduleAutoRotate();
    invalidate();
  });

  function resize() {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const reserve = Math.min(options.reserveRight != null ? options.reserveRight : options.insetRight || 0, w * 0.5);
    fitAspect = Math.max(1, w - reserve) / h;
    shiftTarget = Math.min(options.insetRight || 0, w * 0.5) / 2;
    if (!shiftAnimating) shiftCurrent = shiftTarget;
    applyShift();
    dirFromAngles(model.home.azimuthDeg, model.home.elevationDeg, homeDir);
    homeDistance = fitDistance(homeDir, model.home.padding);
    controls.minDistance = homeDistance * 0.28;
    controls.maxDistance = homeDistance * 2.4;
    controls.minPolarAngle = 0;
    controls.maxPolarAngle = options.device === 'keyboard' ? (Math.PI / 180) * 88 : Math.PI;
    if (!userMovedCamera) {
      controls.target.copy(target);
      camera.position.copy(target).addScaledVector(homeDir, homeDistance);
      camera.lookAt(target);
      controls.update();
    } else {
      controls.target.copy(target);
    }
    invalidate();
  }

  const resizeObserver = new ResizeObserver(() => {
    if (!container.isConnected) {
      api.release();
      return;
    }
    resize();
  });
  resizeObserver.observe(container);

  const io = typeof IntersectionObserver === 'function'
    ? new IntersectionObserver(entries => {
        onScreen = entries[entries.length - 1].isIntersecting;
        if (onScreen) invalidate();
      })
    : null;
  if (io) io.observe(container);

  const onVisibility = () => {
    tabVisible = !doc.hidden;
    if (tabVisible) invalidate();
  };
  doc.addEventListener('visibilitychange', onVisibility);

  const onContextLost = e => {
    e.preventDefault();
    contextLost = true;
    if (options.fallbackImage) {
      fallbackImg.style.display = 'block';
      canvas.style.visibility = 'hidden';
    }
    emit('contextlost');
  };
  const onContextRestored = () => {
    contextLost = false;
    fallbackImg.style.display = 'none';
    canvas.style.visibility = '';
    model.repaint();
    emit('contextrestored');
    invalidate();
  };
  canvas.addEventListener('webglcontextlost', onContextLost);
  canvas.addEventListener('webglcontextrestored', onContextRestored);

  const pointer = { x: 0, y: 0, downX: 0, downY: 0, down: false, dragged: false, pressId: null, hoverDirty: false, rafQueued: false, pointerId: null };
  let draggingNow = false;

  function runHover() {
    pointer.rafQueued = false;
    if (!pointer.hoverDirty || disposed) return;
    pointer.hoverDirty = false;
    if (pointer.down && pointer.dragged) return;
    setHover(pickAt(pointer.x, pointer.y), pointer.x, pointer.y);
  }

  function queueHover() {
    pointer.hoverDirty = true;
    if (pointer.rafQueued) return;
    pointer.rafQueued = true;
    requestAnimationFrame(runHover);
  }

  const onWheelCapture = e => {
    if (options.device !== 'mouse') return;
    const id = pickAt(e.clientX, e.clientY);
    if (id === 'btn_middle' || id === 'wheel_scroll') {
      e.preventDefault();
      e.stopImmediatePropagation();
      api.scrollWheel(Math.sign(e.deltaY) * 0.45, { source: 'pointer' });
    }
  };
  canvas.addEventListener('wheel', onWheelCapture, { passive: false, capture: true });

  const onPointerDown = e => {
    if (e.pointerType === 'mouse' && e.button > 2) return;
    pointer.down = true;
    pointer.dragged = false;
    pointer.downX = e.clientX;
    pointer.downY = e.clientY;
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.pointerId = e.pointerId;
    pointer.button = e.button;
    const id = pickAt(e.clientX, e.clientY);
    pointer.pressId = id;
    if (id && !disabled.has(id)) animator.setPress(partsById.get(id), 1);
    container.focus({ preventScroll: true });
  };

  const onPointerMove = e => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    if (pointer.down && !pointer.dragged) {
      const dx = e.clientX - pointer.downX;
      const dy = e.clientY - pointer.downY;
      if (dx * dx + dy * dy > DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) {
        pointer.dragged = true;
        draggingNow = true;
        canvas.style.cursor = 'grabbing';
        if (pointer.pressId) animator.setPress(partsById.get(pointer.pressId), 0);
        setHover(null);
      }
    }
    if (!pointer.down || !pointer.dragged) queueHover();
  };

  const finishPointer = (e, cancelled) => {
    if (!pointer.down) return;
    const wasDragged = pointer.dragged;
    const pressId = pointer.pressId;
    pointer.down = false;
    pointer.dragged = false;
    pointer.pressId = null;
    draggingNow = false;
    if (pressId) animator.setPress(partsById.get(pressId), 0);
    canvas.style.cursor = hoveredId ? 'pointer' : 'grab';
    if (cancelled || wasDragged) return;
    const upId = pickAt(e.clientX, e.clientY);
    if (upId && upId === pressId) {
      activate(upId, { button: e.button, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey || e.metaKey, source: 'pointer' });
    } else if (!upId && !pressId && options.clearOnEmptyClick) {
      setSelection([]);
    }
  };

  const onPointerUp = e => finishPointer(e, false);
  const onPointerCancel = e => finishPointer(e, true);
  const onPointerLeave = () => {
    if (!pointer.down) setHover(null);
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerCancel);
  canvas.addEventListener('pointerleave', onPointerLeave);
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.style.cursor = 'grab';

  function activate(id, info) {
    const part = partsById.get(id);
    if (!part) return;
    if (disabled.has(id)) {
      emit('blocked', id);
      announce(`${part.name} cannot be remapped`);
      return;
    }
    if (options.onClick) options.onClick(id, info);
    emit('click', id, info);
    if (part.kind === 'wheel') return;
    const multi = options.multiSelect && options.device === 'keyboard' && (info.shiftKey || info.ctrlKey);
    if (multi) {
      const idx = selection.indexOf(id);
      if (idx >= 0) setSelection(selection.filter(x => x !== id));
      else setSelection(selection.concat(id));
    } else {
      setSelection([id]);
    }
  }

  function navigate(dx, dy) {
    const currentId = selection[selection.length - 1] || hoveredId;
    const list = Array.from(partsById.values()).filter(p => p.kind !== 'wheel' || options.device === 'mouse');
    if (!currentId) return list[0] ? list[0].id : null;
    const cur = partsById.get(currentId);
    let best = null;
    let bestScore = Infinity;
    list.forEach(p => {
      if (p === cur) return;
      const vx = p.nav.x - cur.nav.x;
      const vy = p.nav.y - cur.nav.y;
      const along = vx * dx + vy * dy;
      if (along <= 0.15) return;
      const perp = Math.abs(vx * dy - vy * dx);
      const score = along + perp * 2.2;
      if (score < bestScore) {
        bestScore = score;
        best = p;
      }
    });
    return best ? best.id : currentId;
  }

  const onKeyDown = e => {
    if (e.target !== container) return;
    const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (arrows[e.code]) {
      e.preventDefault();
      const id = navigate(arrows[e.code][0], arrows[e.code][1]);
      if (id) setSelection([id]);
    } else if (e.code === 'Enter' || e.code === 'Space') {
      e.preventDefault();
      const id = selection[selection.length - 1];
      if (id) {
        api.tap(id, 140);
        activate(id, { button: 0, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, source: 'keyboard' });
      }
    } else if (e.code === 'Escape') {
      setSelection([]);
    }
  };
  container.addEventListener('keydown', onKeyDown);

  const livePressed = new Set();
  const onLiveKeyDown = e => {
    if (e.repeat || e.target === container) return;
    const id = KEY_ID_BY_EVENT_CODE[e.code];
    if (!id || !partsById.has(id)) return;
    livePressed.add(id);
    animator.setPress(partsById.get(id), 1);
  };
  const onLiveKeyUp = e => {
    const id = KEY_ID_BY_EVENT_CODE[e.code];
    if (!id || !livePressed.has(id)) return;
    livePressed.delete(id);
    animator.setPress(partsById.get(id), 0);
  };
  const onLiveMouseDown = e => {
    if (canvas.contains(e.target)) return;
    const id = MOUSE_BUTTON_IDS[e.button];
    if (id && partsById.has(id)) animator.setPress(partsById.get(id), 1);
  };
  const onLiveMouseUp = e => {
    const id = MOUSE_BUTTON_IDS[e.button];
    if (id && partsById.has(id)) animator.setPress(partsById.get(id), 0);
  };
  const onLiveWheel = e => {
    if (canvas.contains(e.target)) return;
    api.scrollWheel(Math.sign(e.deltaY) * 0.45, { source: 'live' });
  };
  const onLiveBlur = () => {
    livePressed.forEach(id => animator.setPress(partsById.get(id), 0));
    livePressed.clear();
  };

  let liveBound = false;
  function bindLive(on) {
    if (on === liveBound) return;
    liveBound = on;
    const fn = on ? 'addEventListener' : 'removeEventListener';
    if (options.device === 'keyboard') {
      window[fn]('keydown', onLiveKeyDown);
      window[fn]('keyup', onLiveKeyUp);
      window[fn]('blur', onLiveBlur);
    } else {
      window[fn]('mousedown', onLiveMouseDown);
      window[fn]('mouseup', onLiveMouseUp);
      window[fn]('wheel', onLiveWheel, { passive: true });
    }
  }
  bindLive(!!options.enableLiveInput);

  const exporter = new GLTFExporter();
  const originalNames = new Map();
  model.parts.forEach(p => originalNames.set(p.id, p.name));
  const labeledKeys = new Set();
  let parked = false;

  const api = {
    isFallback: false,
    device: options.device,
    on(name, fn) {
      if (!listeners[name]) throw new Error(`Unknown event "${name}"`);
      listeners[name].add(fn);
      return () => listeners[name].delete(fn);
    },
    getPartIds() {
      return Array.from(partsById.keys());
    },
    getPart(id) {
      const p = partsById.get(id);
      return p ? { id: p.id, name: p.name, kind: p.kind, colorGroup: p.colorGroup || null, disabled: disabled.has(id) } : null;
    },
    getSelection() {
      return selection.slice();
    },
    select(ids, opts = {}) {
      const list = Array.isArray(ids) ? ids : [ids];
      setSelection(list.filter(id => !disabled.has(id)), !!opts.silent);
    },
    clearSelection(opts = {}) {
      setSelection([], !!opts.silent);
    },
    highlight(id, color) {
      const p = partsById.get(id);
      if (!p) return;
      if (color) p.highlightColor.set(color);
      else p.highlightColor.set(themeData.interaction.highlight);
      animator.setHighlight(p, 1);
    },
    clearHighlight(id) {
      if (id) {
        const p = partsById.get(id);
        if (p) animator.setHighlight(p, 0);
      } else {
        partsById.forEach(p => animator.setHighlight(p, 0));
      }
    },
    press(id) {
      const p = partsById.get(id);
      if (p) animator.setPress(p, 1);
    },
    tap(id, ms = 130) {
      const p = partsById.get(id);
      if (!p) return;
      animator.setPress(p, 1);
      setTimeout(() => {
        if (!disposed) animator.setPress(p, 0);
      }, ms);
    },
    setLabel(id, text) {
      const p = partsById.get(id);
      if (!p) return false;
      if (options.device === 'keyboard') {
        if (text == null || text === '') labeledKeys.delete(id);
        else labeledKeys.add(id);
        const ok = model.setLabel(id, text);
        p.label = text || null;
        invalidate();
        return ok;
      }
      const existing = labels.get(id);
      if (text == null || text === '') {
        if (existing) {
          existing.remove();
          labels.delete(id);
        }
        p.label = null;
      } else {
        const el = existing || doc.createElement('div');
        el.textContent = String(text);
        el.style.cssText =
          'position:absolute;left:0;top:0;padding:3px 8px;border-radius:999px;background:rgba(255,255,255,0.92);color:#111;font:600 11px/1.3 Geist,system-ui,sans-serif;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.18);pointer-events:none;';
        if (!existing) {
          overlay.appendChild(el);
          labels.set(id, el);
        }
        p.label = String(text);
      }
      invalidate();
      return true;
    },
    setDisabled(ids) {
      const next = new Set(ids || []);
      partsById.forEach((p, id) => {
        const isOff = next.has(id);
        if (isOff !== disabled.has(id)) {
          p.disabled = isOff;
          animator.refresh(p);
        }
      });
      disabled.clear();
      next.forEach(id => {
        if (partsById.has(id)) disabled.add(id);
      });
      setSelection(selection.filter(id => !disabled.has(id)));
      invalidate();
    },
    setRGB(color, brightness = 1) {
      model.setRGB(color, brightness);
      invalidate();
    },
    setTheme(name, colorOverrides) {
      if (name === 'light' || name === 'dark') themeName = name;
      if (colorOverrides) {
        mergeDeep(themeData, colorOverrides);
        model.setTheme(themeData);
        animator.setTheme(themeData);
      }
      applySceneTheme();
      invalidate();
    },
    setView(name, opts = {}) {
      const preset = typeof name === 'string' ? resolvePreset(name) : name;
      userMovedCamera = name !== 'home';
      setCamera({ az: preset.az, el: preset.el, distance: preset.distance, animate: opts.animate !== false });
    },
    resetView() {
      userMovedCamera = false;
      setCamera({ az: model.home.azimuthDeg, el: model.home.elevationDeg, animate: true });
      scheduleAutoRotate();
    },
    setAutoRotate(on) {
      options.autoRotate = !!on;
      scheduleAutoRotate();
    },
    setLiveInput(on) {
      bindLive(!!on);
    },
    scrollWheel(deltaRad, info = {}) {
      if (!model.scrollWheel) return;
      model.scrollWheel(deltaRad);
      const p = partsById.get('wheel_scroll');
      if (p) {
        if (options.onScroll) options.onScroll('wheel_scroll', deltaRad);
        emit('scroll', 'wheel_scroll', deltaRad, info);
      }
      invalidate();
    },
    snapshot({ width = 720, height = 480, padding } = {}) {
      const prevPR = renderer.getPixelRatio();
      const prevW = canvas.width / prevPR;
      const prevH = canvas.height / prevPR;
      const prevAspect = camera.aspect;
      const prevFit = fitAspect;
      const prevPos = camera.position.clone();
      const prevQuat = camera.quaternion.clone();
      renderer.setPixelRatio(1);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      fitAspect = camera.aspect;
      camera.clearViewOffset();
      camera.updateProjectionMatrix();
      dirFromAngles(model.home.azimuthDeg, model.home.elevationDeg, tmpV3);
      const dist = fitDistance(tmpV3, padding != null ? padding : model.home.thumbPadding || model.home.padding);
      camera.position.copy(target).addScaledVector(tmpV3, dist);
      camera.lookAt(target);
      camera.updateMatrixWorld(true);
      renderer.render(scene, camera);
      const url = canvas.toDataURL('image/png');
      renderer.setPixelRatio(prevPR);
      renderer.setSize(prevW, prevH, false);
      camera.aspect = prevAspect;
      fitAspect = prevFit;
      camera.position.copy(prevPos);
      camera.quaternion.copy(prevQuat);
      applyShift();
      needsRender = true;
      return url;
    },
    getPartLayout() {
      return Array.from(partsById.values()).map(p => ({ id: p.id, x: p.nav.x, y: p.nav.y }));
    },
    setPartTint(id, r, g, b) {
      const p = partsById.get(id);
      if (p && p.setTint) p.setTint(r, g, b);
      invalidate();
    },
    setPartLight(id, r, g, b) {
      if (model.setKeyLight) model.setKeyLight(id, r, g, b);
      invalidate();
    },
    clearPartLights() {
      if (model.clearKeyLights) model.clearKeyLights();
      invalidate();
    },
    resetPartTints() {
      partsById.forEach(p => animator.refresh(p));
      invalidate();
    },
    setInteractive(on) {
      options.interactive = !!on;
      if (!on) setHover(null);
      canvas.style.cursor = 'grab';
    },
    setInsets({ right = 0, reserve, animate = true } = {}) {
      options.insetRight = right;
      if (reserve != null) options.reserveRight = reserve;
      shiftAnimating = animate && !reducedMotion;
      resize();
      if (!shiftAnimating) {
        shiftCurrent = shiftTarget;
        applyShift();
      }
      invalidate();
    },
    setContactShadow(on) {
      shadowMesh.visible = !!on;
      invalidate();
    },
    locatePart(id) {
      const part = partsById.get(id);
      if (!part) return null;
      camera.updateMatrixWorld(true);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const rect = canvas.getBoundingClientRect();
      const box = new THREE.Box3();
      const screen = new THREE.Box2();
      screen.makeEmpty();
      const samples = [];
      part.meshes.forEach(m => {
        if (m.userData.isProxy || !m.geometry) return;
        m.updateWorldMatrix(true, false);
        const pos = m.geometry.getAttribute('position');
        const step = Math.max(1, Math.floor(pos.count / 60));
        for (let i = 0; i < pos.count; i += step) {
          const v = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
          samples.push(v);
          box.expandByPoint(v);
          const p = v.clone().project(camera);
          screen.expandByPoint(new THREE.Vector2((p.x * 0.5 + 0.5) * w, (-p.y * 0.5 + 0.5) * h));
        }
      });
      const centerWorld = box.getCenter(new THREE.Vector3());
      const cands = [centerWorld].concat(samples);
      let found = null;
      for (let i = 0; i < cands.length && !found; i += 1) {
        const p = cands[i].clone().project(camera);
        if (p.x < -1 || p.x > 1 || p.y < -1 || p.y > 1) continue;
        const cx = rect.left + (p.x * 0.5 + 0.5) * w;
        const cy = rect.top + (-p.y * 0.5 + 0.5) * h;
        if (pickAt(cx, cy) === id) found = { x: cx, y: cy };
      }
      const sz = screen.isEmpty() ? { x: 0, y: 0 } : screen.getSize(new THREE.Vector2());
      return { reachable: !!found, x: found ? found.x : null, y: found ? found.y : null, width: sz.x, height: sz.y };
    },
    pickAtClient(x, y) {
      return pickAt(x, y);
    },
    getCameraState() {
      const off = camera.position.clone().sub(controls.target);
      const s = new THREE.Spherical().setFromVector3(off);
      return { distance: s.radius, azimuthDeg: (s.theta * 180) / Math.PI, polarDeg: (s.phi * 180) / Math.PI };
    },
    renderNow() {
      controls.update();
      renderer.render(scene, camera);
      return canvas;
    },
    readPixel(clientX, clientY) {
      const gl = renderer.getContext();
      const r = canvas.getBoundingClientRect();
      const px = Math.round(((clientX - r.left) / r.width) * canvas.width);
      const py = canvas.height - Math.round(((clientY - r.top) / r.height) * canvas.height) - 1;
      renderer.render(scene, camera);
      const out = new Uint8Array(4);
      gl.readPixels(px, py, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, out);
      return Array.from(out);
    },
    debug: { scene, camera, renderer, keyLight, fillLight, rimLight, shadowMat, controls, model },
    warmup() {
      return model.fontReady.then(
        () =>
          new Promise(resolve => {
            const texs = model.textures || [];
            let i = 0;
            const step = () => {
              if (disposed) {
                resolve();
                return;
              }
              const end = Math.min(texs.length, i + 5);
              for (; i < end; i += 1) renderer.initTexture(texs[i]);
              if (i < texs.length) {
                setTimeout(step, 0);
              } else {
                try {
                  renderer.render(scene, camera);
                } catch (e) {
                  resolve();
                  return;
                }
                resolve();
              }
            };
            step();
          })
      );
    },
    attach(newContainer, newOptions = {}) {
      if (disposed) return false;
      container.removeEventListener('keydown', onKeyDown);
      parked = false;
      container = newContainer;
      const { device: ignored, ...rest } = newOptions;
      Object.assign(options, rest);
      if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
      container.appendChild(host);
      container.tabIndex = container.tabIndex >= 0 ? container.tabIndex : 0;
      container.setAttribute('role', 'application');
      container.setAttribute(
        'aria-label',
        options.device === 'keyboard' ? 'Interactive 3D keyboard' : 'Interactive 3D mouse'
      );
      container.addEventListener('keydown', onKeyDown);
      resetState();
      if (options.partNames) {
        model.parts.forEach(p => {
          if (options.partNames[p.id]) p.name = options.partNames[p.id];
        });
      }
      resizeObserver.disconnect();
      resizeObserver.observe(container);
      if (io) {
        io.disconnect();
        io.observe(container);
      }
      onScreen = true;
      themeName = options.theme === 'dark' ? 'dark' : 'light';
      applySceneTheme();
      bindLive(!!options.enableLiveInput);
      resize();
      scheduleAutoRotate();
      startIntro();
      invalidate();
      return true;
    },
    release(id) {
      if (typeof id === 'string') {
        const p = partsById.get(id);
        if (p) animator.setPress(p, 0);
        return;
      }
      if (disposed || parked) return;
      resetState();
      bindLive(false);
      clearTimeout(autoRotateTimer);
      autoRotating = false;
      controls.autoRotate = false;
      container.removeEventListener('keydown', onKeyDown);
      container = getParking();
      container.appendChild(host);
      resizeObserver.disconnect();
      resizeObserver.observe(container);
      if (io) {
        io.disconnect();
        io.observe(container);
      }
      onScreen = false;
      options.onHover = null;
      options.onClick = null;
      options.onSelectionChange = null;
      options.onScroll = null;
      options.describe = null;
      options.partNames = null;
      options.interactive = true;
      options.insetRight = 0;
      options.reserveRight = null;
      const existing = pool.get(options.device);
      if (existing && existing !== api) {
        api.dispose();
        return;
      }
      pool.set(options.device, api);
      parked = true;
    },
    async exportGLB() {
      const buffer = await new Promise((resolve, reject) => {
        exporter.parse(model.root, resolve, reject, { binary: true, onlyVisible: true });
      });
      return new Blob([buffer], { type: 'model/gltf-binary' });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (pool.get(options.device) === api) pool.delete(options.device);
      cancelAnimationFrame(rafId);
      clearTimeout(autoRotateTimer);
      bindLive(false);
      resizeObserver.disconnect();
      if (io) io.disconnect();
      doc.removeEventListener('visibilitychange', onVisibility);
      if (mq && mq.removeEventListener) mq.removeEventListener('change', onMotionChange);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      canvas.removeEventListener('wheel', onWheelCapture, true);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerCancel);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      container.removeEventListener('keydown', onKeyDown);
      controls.dispose();
      animator.dispose();
      model.dispose();
      shadowTex.dispose();
      shadowMat.dispose();
      shadowMesh.geometry.dispose();
      envTarget.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      host.remove();
      Object.keys(listeners).forEach(k => listeners[k].clear());
    }
  };

  function resetState() {
    selection.length = 0;
    disabled.clear();
    hoveredId = null;
    camAnim = null;
    userMovedCamera = false;
    livePressed.forEach(id => animator.setPress(partsById.get(id), 0));
    livePressed.clear();
    partsById.forEach(p => {
      p.press = 0;
      p.pressTarget = 0;
      p.hover = 0;
      p.hoverTarget = 0;
      p.selected = 0;
      p.selectedTarget = 0;
      p.highlight = 0;
      p.highlightTarget = 0;
      p.disabled = false;
      p.label = null;
      p.name = originalNames.get(p.id);
      animator.refresh(p);
    });
    labeledKeys.forEach(id => model.setLabel(id, null));
    labeledKeys.clear();
    labels.forEach(el => el.remove());
    labels.clear();
    model.setRGB(null);
    tooltip.style.opacity = '0';
    canvas.style.cursor = 'grab';
    pointer.down = false;
    pointer.dragged = false;
    pointer.pressId = null;
  }

  resize();
  scheduleAutoRotate();
  if (container !== parkingEl) startIntro();
  model.fontReady.then(() => invalidate());
  emit('ready');
  invalidate();
  return api;
}

export { VIEWER_THEME };
