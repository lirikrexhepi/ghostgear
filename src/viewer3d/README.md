# viewer3d

Procedural three.js models of the Meetion MK12 (white), VXE Dragonfly R1 SE+ (white) and HyperX Cloud III (black and red, display only, orbit and auto-rotate), driven by app state. No pre-made assets, no extra dependencies beyond `three`.

```js
import { createDeviceViewer } from './viewer3d/index.js';

const viewer = createDeviceViewer(container, {
  device: 'keyboard',
  theme: 'light',
  fallbackImage: pngUrl,
  describe: id => assignmentFor(id),
  onClick: (id, { button, shiftKey, ctrlKey }) => {},
  onHover: id => {},
  onSelectionChange: ids => {}
});
```

Dev page: `npm run dev`, then `/viewer-dev.html` (add `?device=keyboard&solo=1` for a bare stage). Tests: `npm run test:3d` (needs the dev server on 5174 or `VIEWER_URL`, and Chrome/Edge; uses `playwright-core`).

App wrapper: `src/ui/components/device-3d.js` (`mountDevice3D(container, device)`), lazy-loads the module and keeps the PNG as the placeholder/fallback. Not yet wired into the existing panels.

## API

| Method | Notes |
| --- | --- |
| `on(name, fn)` | `hover`, `click`, `selection`, `scroll`, `blocked`, `contextlost`, `contextrestored`, `ready`. Returns an unsubscribe. |
| `select(ids)`, `clearSelection()`, `getSelection()` | Shift/Ctrl-click multi-selects on the keyboard. |
| `highlight(id, color?)`, `clearHighlight(id?)` | Persistent tint, distinct from hover/selected. |
| `press(id)`, `release(id)`, `tap(id, ms)` | Programmatic press. |
| `setLabel(id, text)` | Keyboard: repaints the keycap legend. Mouse: HTML pin over the part. |
| `setDisabled(ids)` | Dimmed, not selectable, emits `blocked` on click. |
| `setRGB(color \| null, brightness)` | Keyboard underglow through the gaps. |
| `setTheme('light' \| 'dark', colorOverrides?)` | Scene lighting and optional theme color overrides. |
| `setView(name \| {az, el}, {animate})`, `resetView()` | `home top front side back bottom`. |
| `setAutoRotate(on)`, `setLiveInput(on)`, `scrollWheel(rad)` | |
| `locatePart(id)` | Screen position, size and whether a click there resolves to the id. |
| `exportGLB()` | `Promise<Blob>`. Hit proxies are excluded. |
| `setInsets({ right, reserve })` | Shifts the model left of a side panel with an animated view offset. `reserve` is the width always kept free when framing. |
| `setInteractive(on)` | Turns hover and click on parts off for display-only screens. |
| `snapshot({ width, height })` | Transparent PNG data URL of the home view. |
| `release()` | Parks the viewer in the pool instead of disposing it. Called automatically when its container leaves the DOM. |
| `dispose()` | Frees geometry, materials, textures, context, listeners. |

`prewarmDeviceViewer(device)` builds a viewer offscreen, uploads textures, compiles shaders, and parks it. `acquireDeviceViewer(container, options)` reuses the parked one, so opening a device takes about 75 ms.

Part ids reuse the ids already in `mk12-layout.js` (`KeyboardEvent.code`-style: `Escape`, `KeyQ`, `LED_Mode`, ...) and the mouse ids already used by the keymap panel: `btn_left`, `btn_right`, `btn_middle` (wheel click), `btn_forward`, `btn_back`, `btn_dpi`, plus `wheel_scroll`. Each keyboard part also has QMK-style `name` (`KC_A`). `wheel_scroll` is not clickable; it fires from wheel events over the wheel and `scrollWheel()`.

Live input: keyboard maps `event.code`; mouse maps `mousedown/up` buttons 0-4 and wheel. The DPI button and Fn are invisible to the browser and are never driven live.

## Where the numbers come from

Labels: **photo** = the six reference images, **research** = web source, **assumed**.

### Keyboard

| Item | Value | Source |
| --- | --- | --- |
| Layout, 68 keys, 5 rows, right-hand column | see `keyboard/layout.js` | photo (top view, counted key by key) |
| Enter | ISO-shaped (1.5u top, 1.25u stem), with 2.25u LShift, 1.75u RShift, 1.5u Tab, 1.75u Caps | photo. Hybrid: ISO enter but ANSI-width shifts, no extra key beside LShift |
| Bottom row | 1.25 / 1.25 / 1.25 / 6.25 / 1 / 1 / 1 / 1 / 1 / 1 | photo |
| Accent keys | Tab, Caps, both Shifts, Enter, Backspace, RGB key, Ins, PgUp, PgDn, Ctrl/Win/Alt (left), Alt/Fn/Ctrl (right), 5-8 | photo, key by key (`colorGroup` in layout) |
| Keycap `#F4EDEB`, accent `#B1A7A6` | | given by you |
| Case `#E4DFDE`, legend `#3F3637` / `#2E2627` | | photo sampled (case ~`#DEDBDC`-`#EFEBEA`, legend darkest ~`#342929`) |
| Key pitch 19.05 mm | | standard |
| Case 320 mm wide | | research, single source (your spec), photo aspect agrees |
| Case depth 110 mm | | photo aspect (2.93:1 at 320 wide). Your 116.5 mm disagrees; `caseDepth` in `KEYBOARD_DIMENSIONS` |
| Typing angle 5 deg, front rim 14 mm, caps ~8 mm | | assumed; total height with caps ~32 mm vs your 40 mm (if that includes extended feet) |
| Keycap profile (heights 8.8 to 7.8 mm, row tilts, 1.3 mm gap, 13 mm top face, 0.85 mm dish) | | photo for proportions, otherwise assumed |
| Rear port panel 68 x 17 mm with two orange sliders and USB-C | | photo 1 and 2 |
| Indicator LEDs (green, green, red) | | photo |
| Legend font | Orbitron (loaded from Google Fonts) approximates the photo's face | assumed |
| Legend icons | simplified vector approximations | photo, approximate |

### Mouse

| Item | Value | Source |
| --- | --- | --- |
| 120.6 x 64.0 x 37.7 mm | | research ([caseking](https://www.caseking.de/en/vxe-dragonfly-r1-se-wireless-gaming-mouse-paw3395-se-ultra-light-white/GAMO-1396.html), [mouselog](https://mouselog.jp/en/products/VXE%20Dragonfly%20R1%20SE) list 120.6 x 64.1 x 37.6) |
| Top outline (37 stations of half-width) | `MOUSE_HALF_WIDTH_BY_T` | photo (top view, extracted by thresholding, rescaled to 64 mm) |
| Button seam at 42% of length, wheel at 20%, wheel slot ~10 mm | | photo (top view) |
| Two left side buttons, positions along length | `MOUSE_SIDE_BUTTONS` | photo (top view); height on the wall assumed |
| Side profile / hump (peak at 62% of length) | `MOUSE_HEIGHT_BY_T` | assumed. No side photo; 3/4 photos only qualitatively agree |
| Cross-section (vertical wall, superellipse n=2.6 top) | | assumed |
| Wheel 16.8 mm dia, 6 mm wide, black tire, light hubs | | photo for colors, size assumed |
| USB-C at the front, 9.1 x 3.3 mm | | photo (position), size assumed |
| Underside: sensor window, 5 PTFE feet, DPI button | | assumed. No underside photo supplied; positions are placeholders |
| Body `#F2F2F2`, black `#111111` | | your rendering note |

Research could not confirm: hump position, side-button count (photos show two), underside layout, MK12 weight or key count. Sources returned only retailer spec lists.

## Tuning

- Colors: `theme.js` is the single place (`VIEWER_THEME`). Pass `colors: {...}` to `createDeviceViewer` or `setTheme(name, overrides)`.
- Dimensions: `KEYBOARD_DIMENSIONS`, `CAP_PROFILE`, `MOUSE_DIMENSIONS`, or pass `dimensions` to the factory.
- Lighting is calibrated so a top-facing cap renders at its hex under `NoToneMapping`: base `#F4EDEB` measures `#F2ECEA`, accent `#B1A7A6` measures `#B3AAA9` at the top-down camera. Change lights and re-run `tests/calibrate.mjs`.

## Performance notes

- 80 draw calls, about 32k triangles. 68 keycap meshes share one material and one legend atlas (200 px per unit); hover and selection tint through per-key vertex colors.
- Measured on an RTX 5060 at 2400x1350 while orbiting: 4.2 ms median frame, nothing over 20 ms (`tests/perf.mjs`).
- Pixel ratio is capped at 1.75 and steps down if frames stay over 30 ms.
- Renders only when something changed. Auto-rotate renders continuously while it runs; it stops on interaction, when off-screen, and when the tab is hidden.
- Context loss shows the PNG, restore repaints.

## Known inaccuracies

- Mouse profile height, hump and underside are assumed; silhouette from the top matches the photo, but side silhouette is unverified.
- Mouse nose is blunter and taller than photo 5 suggests; wheel slot is a flat dark underlay rather than a modeled housing.
- Keycap sculpt is generic; real caps look more pillowy and have row-specific legends placement differences.
- Legend icons and font are approximations. No back-lit legends.
- Keyboard underside and feet are not modeled.
- Photos are retail renders, not calipered; nothing here is measured.
