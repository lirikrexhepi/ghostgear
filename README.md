# Ghost Gear

A zero-install WebHID driver for the Meetion MK12 keyboard and VXE R1 SE+ mouse. No telemetry, no background services.

## Run

```bash
npm run dev
```

Open the printed URL in Chrome or Edge, then **Add device**. Without hardware, the demo devices on the home screen open the full UI.

## Structure

```text
src/
  main.js                   view router, 3D prewarm at idle
  core/                     event bus, state, WebHID manager
  devices/
    base-device.js          serialized feature-report I/O, request/response helper
    keyboard/mk12-*.js      MK12 protocol, driver, layout
    mouse/*.js              VXE R1 SE+ (UI state only, see below)
  ui/
    app-shell.js            header
    controls.js             segmented, slider, switch, rows
    toast.js
    views/home-view.js      device cards
    views/device-view.js    persistent 3D stage, section tabs, inspector
    sections/               keys, lighting, keyboard settings, buttons, dpi, mouse settings
    components/device-3d.js lazy loader and viewer pool for the 3D module
  viewer3d/                 procedural three.js models, see src/viewer3d/README.md
  styles/app.css            the only stylesheet
tests/                      Playwright (playwright-core + installed Chrome) checks and tools
```

## MK12 protocol (verified on hardware, 2026-10-12)

Interface 2, usage page `0xFFFF`, usage `2`. 64-byte feature report, report ID 0. Matches the Yichip/RongYuan family documented in [epomaker-he75-linux](https://github.com/D1d1HUB/epomaker-he75-linux).

| Command | Bytes | Checksum |
| --- | --- | --- |
| GET (`0x85` profile, `0x87` LED, `0x91` debounce, `0x92` sleep) | `[cmd]` | at byte 7 |
| SET LED `0x07` | `[0x07, effect, 7-speed, bright, 0x08 rainbow / 0x07 color, R, G, B]` | at byte 8 |
| SET debounce `0x11` | `[0x11, 0, ms]` | at byte 7 |
| SET sleep `0x12` | 4 × uint16 LE seconds at bytes 8-15 | at byte 7 |

Checksum is `(0xFF - sum(bytes[0..n-1])) & 0xFF`. Read the response about 150 ms after the GET: `[reportId, echo, data...]`. The device rejects packets without a valid checksum, which is why lighting never worked before.

Brightness: the UI caps at 4. The keyboard itself reported 7 and accepted 5. A burst of test writes with brightness 6 stopped the config interface responding until the keyboard was replugged, so the cap stays conservative until that's understood.

## VXE R1 SE+ protocol (from ATK's hub.atk.pro bundle, reads verified on hardware)

Dongle `373B:1085`, filter usage page `0xFF04` / usage 2. Commands go out as output report 8 (16 bytes) and come back as input report 8 with the command echoed in byte 0.

`[cmd, status, addrHi, addrLo, len, data x10, check]`, check = `85 - (8 + sum(bytes 0..14))`. `7` = set EEPROM, `8` = get EEPROM. Never send `9` (factory reset).

| Address | Field | Encoding |
| --- | --- | --- |
| 0-9 | report rate, stage count, active stage, ... | `[value, 85 - value]` pairs, rate codes 1000=1 500=2 250=4 125=8 |
| 10 | lift-off height | pair |
| 12, 20, 28, 36 | DPI stages, 2 per address | `[x, y, ex, 85 - (x+y+ex)]`, PAW3395 SE table in `vxe-dpi-table.js`, `ex` bits 1 and 5 double the value above 10000 |
| 169 / 171 / 175 / 177 | debounce / motion sync / angle snapping / ripple | pair |

Writes are read-modify-write so neighbouring fields are preserved.

## HyperX Cloud III protocol (verified on hardware, 2026-10-12)

Interface 3, collection 2 (`COL02`), usage page `0x01C0`, usage `1`. Feature report 62 bytes (report ID `0x20` + 61-byte payload).

| Command | Bytes | Notes |
| --- | --- | --- |
| SET sidetone | `[0x20, 0x86, on, 0...]` | `on` is `1` for enabled, `0` for disabled |
| GET sidetone | `[0x20]` feature report read | returns `[0x20, 0x86, on, 0...]` |

## Not yet sent to hardware

- MK12 key remapping: the key-matrix command isn't known.
- Mouse button remapping, sleep time, long-range mode: these go through other commands in ATK's code that aren't decoded yet.
