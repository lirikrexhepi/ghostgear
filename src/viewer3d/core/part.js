import * as THREE from 'three';

export class Part {
  constructor({ id, name, kind, object, meshes, materials, nav, press, apply }) {
    this.id = id;
    this.name = name || id;
    this.kind = kind;
    this.object = object;
    this.meshes = meshes || [];
    this.materials = materials || [];
    this.baseColors = this.materials.map(m => m.color.clone());
    this.nav = nav || { x: 0, y: 0 };
    this.press = 0;
    this.pressTarget = 0;
    this.pressRate = 26;
    this.hover = 0;
    this.hoverTarget = 0;
    this.selected = 0;
    this.selectedTarget = 0;
    this.highlight = 0;
    this.highlightTarget = 0;
    this.highlightColor = new THREE.Color('#FFB020');
    this.disabled = false;
    this.pressDepth = press && press.depth != null ? press.depth : 3.6;
    this.applyPress = apply || null;
    this.active = false;
    this.pinned = false;
    this.label = null;
  }

  settled() {
    return (
      Math.abs(this.press - this.pressTarget) < 0.002 &&
      Math.abs(this.hover - this.hoverTarget) < 0.004 &&
      Math.abs(this.selected - this.selectedTarget) < 0.004 &&
      Math.abs(this.highlight - this.highlightTarget) < 0.004
    );
  }
}

const tintAccum = new THREE.Color();
const tintTemp = new THREE.Color();

export class PartAnimator {
  constructor(theme, onChange) {
    this.parts = new Map();
    this.active = [];
    this.theme = theme;
    this.onChange = onChange;
    this.hoverColor = new THREE.Color(theme.interaction.hover);
    this.selectedColor = new THREE.Color(theme.interaction.selected);
    this.reduceMotion = false;
  }

  add(part) {
    this.parts.set(part.id, part);
    this.refresh(part);
  }

  setTheme(theme) {
    this.theme = theme;
    this.hoverColor.set(theme.interaction.hover);
    this.selectedColor.set(theme.interaction.selected);
    this.parts.forEach(p => this.refresh(p));
  }

  wake(part) {
    if (part.active) return;
    part.active = true;
    this.active.push(part);
    this.onChange();
  }

  setPress(part, target, instant) {
    part.pressTarget = target;
    if (instant || this.reduceMotion) {
      part.press = target;
      this.refresh(part);
      this.onChange();
      return;
    }
    this.wake(part);
  }

  setHover(part, target) {
    part.hoverTarget = target;
    this.wake(part);
  }

  setSelected(part, target) {
    part.selectedTarget = target;
    this.wake(part);
  }

  setHighlight(part, target) {
    part.highlightTarget = target;
    this.wake(part);
  }

  step(dt) {
    if (this.active.length === 0) return false;
    const fast = this.reduceMotion;
    for (let i = this.active.length - 1; i >= 0; i -= 1) {
      const p = this.active[i];
      const kp = fast ? 1 : 1 - Math.exp(-dt * p.pressRate);
      const kh = fast ? 1 : 1 - Math.exp(-dt * 16);
      p.press += (p.pressTarget - p.press) * kp;
      p.hover += (p.hoverTarget - p.hover) * kh;
      p.selected += (p.selectedTarget - p.selected) * kh;
      p.highlight += (p.highlightTarget - p.highlight) * kh;
      if (p.settled()) {
        p.press = p.pressTarget;
        p.hover = p.hoverTarget;
        p.selected = p.selectedTarget;
        p.highlight = p.highlightTarget;
        p.active = false;
        this.active[i] = this.active[this.active.length - 1];
        this.active.pop();
      }
      this.refresh(p);
    }
    return this.active.length > 0;
  }

  refresh(part) {
    if (part.applyPress) part.applyPress(part, part.press);
    const wh = part.hover;
    const ws = part.selected;
    const wl = part.highlight;
    const total = wh + ws + wl;
    const mul = part.disabled ? 0.72 : 1;
    let amount = 0;
    if (total > 0.0005) {
      tintAccum.setRGB(0, 0, 0);
      tintAccum.r += this.hoverColor.r * wh + this.selectedColor.r * ws + part.highlightColor.r * wl;
      tintAccum.g += this.hoverColor.g * wh + this.selectedColor.g * ws + part.highlightColor.g * wl;
      tintAccum.b += this.hoverColor.b * wh + this.selectedColor.b * ws + part.highlightColor.b * wl;
      tintAccum.multiplyScalar(1 / total);
      amount = Math.min(1, wh * 0.34 + ws * 0.62 + wl * 0.7);
    }
    const glow = wh * 0.05 + ws * 0.16 + wl * 0.4;
    if (part.setTint) {
      if (amount > 0) {
        part.setTint(
          mul * (1 - amount) + tintAccum.r * amount + tintAccum.r * glow,
          mul * (1 - amount) + tintAccum.g * amount + tintAccum.g * glow,
          mul * (1 - amount) + tintAccum.b * amount + tintAccum.b * glow
        );
      } else {
        part.setTint(mul, mul, mul);
      }
    }
    for (let i = 0; i < part.materials.length; i += 1) {
      const m = part.materials[i];
      const base = part.baseColors[i];
      m.color.copy(base).multiplyScalar(mul);
      if (amount > 0) {
        tintTemp.copy(tintAccum);
        m.color.lerp(tintTemp, amount);
        if (m.emissive) m.emissive.copy(tintAccum).multiplyScalar(glow);
      } else if (m.emissive) {
        m.emissive.setRGB(0, 0, 0);
      }
    }
  }

  dispose() {
    this.parts.clear();
    this.active.length = 0;
  }
}
