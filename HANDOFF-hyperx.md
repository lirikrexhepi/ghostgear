# Handoff: HyperX Cloud III support in Ghost Gear

## Project

- Path: `C:/Users/PC/.gemini/antigravity/scratch/gear-hub-web` (vanilla JS + Vite, no git). Dev server: `npx vite --port 5175`.
- Read `README.md` first. It documents the structure and the two protocols already done (MK12 keyboard, VXE R1 SE+ mouse).
- Conventions: no code comments at all, Geist font only, minimal UI copy, everything in `src/styles/app.css`.

## The headset

- Wired HyperX Cloud III, plugged in over USB: `VID 0x03F0`, `PID 0x089D`.
- Interface `MI_03` has the HID collections. `COL04` is vendor-defined (the config channel), `COL01` is consumer control (volume and mute keys).
- NGENUITY is installed. Its "HyperX Virtual Audio Device" is a software DTS driver, so DTS spatial audio can't be done from a browser. Don't try.

## What is already known

- HeadsetControl (`lib/devices/hyperx_cloud_3.hpp` in github.com/Sapd/HeadsetControl) supports this exact PID.
- It only knows sidetone (mic monitoring), and only as on/off.
- The command is a feature report of `MSG_SIZE = 62` bytes: `[0x20, 0x86, on]`, where byte 0 is the report ID `0x20`.

## Plan

1. **Confirm the vendor collection (read-only).** Read its usage page, usage and feature-report sizes. A ready PowerShell script for this is `scratchpad/probe-scripts/caps.ps1` from the previous session; if it's gone, reuse the approach (`HidP_GetCaps` via Add-Type).
2. **Add sidetone as the first real feature:**
   - Device class `src/devices/headset/cloud3-device.js` extending `BaseDevice`. Use `this.write()`, which serializes I/O; `sendFeatureReport(0x20, ...)` takes the 61-byte payload after the report ID.
   - Registry entry in `src/devices/registry.js` with a filter on that vendor usage page.
   - Type `'headset'`.
3. **Find more features.** Check HeadsetControl's other HyperX files (e.g. `hyperx_cloud_alpha_wireless.hpp`) for sibling commands such as mic mute LED, sidetone level, EQ and auto-off. Then confirm them on this headset, read-only first.
4. **If that isn't enough, capture NGENUITY's traffic:** use USBPcap + Wireshark while the user toggles one setting at a time.
   - Always capture a change and then its revert.
   - Ask the user before any write. Space writes out (one per second or more) and send nothing speculative. A burst of probe writes once hung the keyboard's config interface until a replug.
5. **UI.**
   - Home card: add a photo in `src/assets/images/` and use it in `home-view.js` (`statsHtml` / image pick by type).
   - Device page: `src/ui/views/device-view.js` picks sections by `device.type`. Add a `'headset'` branch with one section, `src/ui/sections/headset.js`, following `keyboard-settings.js` (header, groups, `toggle`/`slider` from `src/ui/controls.js`).
   - The user does NOT want a 3D headset model yet. Show a static product image in the stage area instead of mounting `mountDevice3D` for headsets.
6. **Features with no verified command:** don't show them. Or mark them "Not saved yet" the way the mouse Buttons screen does. Never fake success.

## Done when

The headset appears after "Add device", mic monitoring toggles on the real headset and survives a reconnect, and the card can be removed (hover ×, already built). Update `README.md` with the verified packet table.
