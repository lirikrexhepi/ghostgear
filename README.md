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
| 173 | sleep time, in units of 10 s (30 s = 3 ... 30 min = 180) | pair |
| 181 | sensor block: sleep enabled, sleep time (units of 10 s), sensor mode (0 basic, 1 competitive) | 3 pairs |
| 76 | DPI light: mode (1 steady, 2 breathing), brightness (16/128/255), speed (1/3/5), enabled | 4 pairs |
| 96, 100, 104, 108, 112, 116 | buttons left, right, middle, rear side, front side, bottom | `[class, v1, v2, 85 - (class+v1+v2)]` |

Button actions: left `[1,1,0]`, right `[1,2,0]`, middle `[1,4,0]`, back `[1,8,0]`, forward `[1,16,0]`, DPI cycle `[2,1,0]`, DPI up `[2,2,0]`, DPI down `[2,3,0]`, disabled `[0,0,0]`.

Other commands (same 16-byte frame, data from byte 5): `22` set ultra long range (length 10, byte 5 = 0/1), `23` get it, `18` firmware version (`byte5.byte6` in hex, so `3.00`), `16` CID/MID, `5` start pairing (length 2, `[cid, mid]`), `6` pairing status, `4` battery, `3` online. Never send `9` (factory reset) or `13` (USB upgrade).

The Windows config channel is the `0xFF02` collection (report 8, 16 bytes), not `0xFF04`, when talking to the dongle outside Chrome.

Writes are read-modify-write so neighbouring fields are preserved.

All of the above was written and read back on the real mouse (2026-10-16), then restored.

### MK12 per-key lighting and keymap (frames identical to Sharkfin's, captured 2026-10-16)

Same feature report as above. Checksum at byte 7 is `0xFF - sum(bytes 0..6)`.

| Command | Frame |
| --- | --- |
| Per-key colours `0x0C` | 7 packets, 100 ms apart. Header `[0x0C, 0, 0x80, 0x01, seq, 0, 0, checksum]` then 56 data bytes. The 384 data bytes are R, G, B for LED 0-127. Needs effect 13 (custom) active. |
| Read keymap `0x89` | `[0x89, layer, page]`, pages 0-7, 16 entries of 4 bytes per page. Response starts after the report ID byte, no echo. |
| Set one key `0x13` | `[0x13, layer, matrixIndex, 0, 0, 0, 0, checksum, entry x4]` |
| Write whole layer `0x09` | 9 packets, 100 ms apart. Header `[0x09, layer, 0xF8, 0x01, seq, 0, 0, checksum]`, 56 data bytes, 126 entries of 4 bytes. |

Key entry is `[0, 0, usageCode, 0]` for keyboard codes and `[3, 0, lo, hi]` for consumer codes. The LED index and the matrix index are the same: `col * 6 + visualRow + 1`, table in `MK12_LED_INDEX`.

The per-key colours cannot be read back. Do not send flash writes closer than about 4 s apart. A remap test that did a keymap write twice in quick succession hung the config interface until the keyboard was replugged, so hardware remapping stays off (`supports.keymap`) until it is re-verified.

## HyperX Cloud III protocol (verified on hardware, 2026-10-12)

Interface 3, collection 2 (`COL02`), usage page `0x01C0`, usage `1`. Feature report 62 bytes (report ID `0x20` + 61-byte payload).

| Command | Bytes | Notes |
| --- | --- | --- |
| SET sidetone | `[0x20, 0x86, on, 0...]` | `on` is `1` for enabled, `0` for disabled |
| GET sidetone | `[0x20]` feature report read | returns `[0x20, 0x86, on, 0...]` |

## Not yet sent to hardware

- MK12 key remapping: frames are known and match Sharkfin's, but hardware writes are off until the hang above is understood.
