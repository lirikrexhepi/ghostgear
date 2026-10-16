export const LIGHT_EFFECTS = [
  { id: 'LightOff', name: 'Off', index: 0 },
  { id: 'LightAlwaysOn', name: 'Static', index: 1 },
  { id: 'LightBreath', name: 'Breathing', index: 2 },
  { id: 'LightNeon', name: 'Neon', index: 3 },
  { id: 'LightWave', name: 'Wave', index: 4 },
  { id: 'LightRipple', name: 'Ripple', index: 5 },
  { id: 'LightRaindrop', name: 'Raindrop', index: 6 },
  { id: 'LightSnake', name: 'Snake', index: 7 },
  { id: 'LightPressAction', name: 'Reactive', index: 8 },
  { id: 'LightConverage', name: 'Converge', index: 9 },
  { id: 'LightSineWave', name: 'Sine Wave', index: 10 },
  { id: 'LightKaleidoscope', name: 'Kaleidoscope', index: 11 },
  { id: 'LightLineWave', name: 'Line Wave', index: 12 },
  { id: 'LightUserDefine', name: 'Custom', index: 13 },
  { id: 'LightLaser', name: 'Laser', index: 14 },
  { id: 'LightCircleWave', name: 'Circle Wave', index: 15 },
  { id: 'LightDazzing', name: 'Dazzle', index: 16 },
  { id: 'LightRainDown', name: 'Rain', index: 17 },
  { id: 'LightMeteor', name: 'Meteor', index: 18 },
  { id: 'LightPressActionOff', name: 'Reactive Off', index: 19 },
  { id: 'LightTrain', name: 'Train', index: 23 },
  { id: 'LightFireWorks', name: 'Fireworks', index: 24 }
];

export class MK12Protocol {
  static REPORT_SIZE = 64;
  static RESPONSE_DELAY_MS = 150;

  static CMD_SET_PROFILE = 0x05;
  static CMD_GET_PROFILE = 0x85;
  static CMD_SET_LEDPARAM = 0x07;
  static CMD_GET_LEDPARAM = 0x87;
  static CMD_SET_DEBOUNCE = 0x11;
  static CMD_GET_DEBOUNCE = 0x91;
  static CMD_SET_SLEEPTIME = 0x12;
  static CMD_GET_SLEEPTIME = 0x92;

  static CMD_SET_KEY = 0x13;
  static CMD_SET_KEYMAP = 0x09;
  static CMD_GET_KEYMAP = 0x89;
  static KEYMAP_ENTRIES = 126;
  static KEYMAP_PAGES = 8;
  static KEYMAP_PACKET_DATA = 56;
  static CONSUMER = { 205: [3, 0, 205, 0], 181: [3, 0, 181, 0], 182: [3, 0, 182, 0], 148: [3, 0, 146, 1] };
  static CMD_SET_PERKEY = 0x0c;
  static PERKEY_LEDS = 128;
  static PERKEY_PACKET_DATA = 56;
  static EFFECT_CUSTOM = 13;

  static MAX_SPEED = 7;
  static MAX_BRIGHT = 4;
  static DAZZLE_FLAG = 8;
  static NORMAL_FLAG = 7;

  static checksum(packet, length) {
    let sum = 0;
    for (let i = 0; i < length; i += 1) sum += packet[i];
    return (0xff - sum) & 0xff;
  }

  static finalize(packet, checksumAt) {
    packet[checksumAt] = this.checksum(packet, checksumAt);
    return packet;
  }

  static buildGetPacket(cmd) {
    const packet = new Uint8Array(this.REPORT_SIZE);
    packet[0] = cmd;
    return this.finalize(packet, 7);
  }

  static buildSetLedPacket({ effectIndex = 4, speed = 4, bright = 4, dazzle = true, rgb = 0x00ffcc }) {
    const packet = new Uint8Array(this.REPORT_SIZE);
    packet[0] = this.CMD_SET_LEDPARAM;
    packet[1] = effectIndex;
    packet[2] = this.MAX_SPEED - Math.min(this.MAX_SPEED, Math.max(0, speed));
    packet[3] = Math.min(this.MAX_BRIGHT, Math.max(0, bright));
    packet[4] = dazzle ? this.DAZZLE_FLAG : this.NORMAL_FLAG;
    packet[5] = (rgb >> 16) & 0xff;
    packet[6] = (rgb >> 8) & 0xff;
    packet[7] = rgb & 0xff;
    return this.finalize(packet, 8);
  }

  static entryForCode(code) {
    return this.CONSUMER[code] ? Uint8Array.from(this.CONSUMER[code]) : Uint8Array.from([0, 0, code & 0xff, 0]);
  }

  static codeForEntry(entry) {
    if (entry[0] === 0 && entry[1] === 0 && entry[3] === 0) return entry[2];
    const hit = Object.entries(this.CONSUMER).find(([, e]) => e[0] === entry[0] && e[1] === entry[1] && e[2] === entry[2] && e[3] === entry[3]);
    return hit ? Number(hit[0]) : null;
  }

  static buildGetKeymapPacket(layer, page) {
    const packet = new Uint8Array(this.REPORT_SIZE);
    packet[0] = this.CMD_GET_KEYMAP;
    packet[1] = layer;
    packet[2] = page;
    return this.finalize(packet, 7);
  }

  static buildSetKeyPacket(layer, index, entry) {
    const packet = new Uint8Array(this.REPORT_SIZE);
    packet[0] = this.CMD_SET_KEY;
    packet[1] = layer;
    packet[2] = index;
    this.finalize(packet, 7);
    packet.set(entry, 8);
    return packet;
  }

  static buildSetKeymapPackets(layer, entries) {
    const total = this.KEYMAP_ENTRIES * 4;
    const data = new Uint8Array(total);
    entries.slice(0, this.KEYMAP_ENTRIES).forEach((entry, i) => data.set(entry, i * 4));
    const count = Math.ceil(total / this.KEYMAP_PACKET_DATA);
    const packets = [];
    for (let seq = 0; seq < count; seq += 1) {
      const packet = new Uint8Array(this.REPORT_SIZE);
      packet[0] = this.CMD_SET_KEYMAP;
      packet[1] = layer;
      packet[2] = total & 0xff;
      packet[3] = total >> 8;
      packet[4] = seq;
      this.finalize(packet, 7);
      packet.set(data.subarray(seq * this.KEYMAP_PACKET_DATA, (seq + 1) * this.KEYMAP_PACKET_DATA), 8);
      packets.push(packet);
    }
    return packets;
  }

  static parseKeymapPage(bytes) {
    if (!bytes) return null;
    const offset = bytes.length >= 65 ? 1 : 0;
    const entries = [];
    for (let k = 0; k < 16; k += 1) entries.push(Uint8Array.from(bytes.subarray(offset + k * 4, offset + k * 4 + 4)));
    return entries;
  }

  static buildPerKeyPackets(colors) {
    const total = this.PERKEY_LEDS * 3;
    const data = new Uint8Array(total);
    colors.forEach((rgb, led) => {
      if (led < 0 || led >= this.PERKEY_LEDS) return;
      data[led * 3] = rgb[0] & 0xff;
      data[led * 3 + 1] = rgb[1] & 0xff;
      data[led * 3 + 2] = rgb[2] & 0xff;
    });
    const count = Math.ceil(total / this.PERKEY_PACKET_DATA);
    const packets = [];
    for (let seq = 0; seq < count; seq += 1) {
      const packet = new Uint8Array(this.REPORT_SIZE);
      packet[0] = this.CMD_SET_PERKEY;
      packet[2] = total & 0xff;
      packet[3] = total >> 8;
      packet[4] = seq;
      this.finalize(packet, 7);
      packet.set(data.subarray(seq * this.PERKEY_PACKET_DATA, (seq + 1) * this.PERKEY_PACKET_DATA), 8);
      packets.push(packet);
    }
    return packets;
  }

  static buildSetDebouncePacket(ms) {
    const packet = new Uint8Array(this.REPORT_SIZE);
    packet[0] = this.CMD_SET_DEBOUNCE;
    packet[1] = 0;
    packet[2] = Math.max(1, Math.min(30, Math.round(ms)));
    return this.finalize(packet, 7);
  }

  static buildSetSleepPacket({ timeBT = 180, time24 = 180, deepBT = 720, deep24 = 720 }) {
    const packet = new Uint8Array(this.REPORT_SIZE);
    packet[0] = this.CMD_SET_SLEEPTIME;
    [timeBT, time24, deepBT, deep24].forEach((v, i) => {
      packet[8 + i * 2] = v & 0xff;
      packet[9 + i * 2] = (v >> 8) & 0xff;
    });
    return this.finalize(packet, 7);
  }

  static payload(bytes, cmd) {
    if (!bytes) return null;
    for (let i = 0; i < 2 && i < bytes.length; i += 1) {
      if (bytes[i] === cmd) return bytes.subarray(i + 1);
    }
    return null;
  }

  static parseLedPacket(bytes) {
    const d = this.payload(bytes, this.CMD_GET_LEDPARAM);
    if (!d || d.length < 7) return null;
    const effect = LIGHT_EFFECTS.find(e => e.index === d[0]);
    return {
      effectIndex: effect ? effect.index : 4,
      effectId: effect ? effect.id : 'LightWave',
      speed: this.MAX_SPEED - Math.min(this.MAX_SPEED, d[1]),
      bright: Math.min(this.MAX_BRIGHT, d[2]),
      dazzle: (d[3] & 0x0f) === this.DAZZLE_FLAG,
      rgb: (d[4] << 16) | (d[5] << 8) | d[6]
    };
  }

  static parseDebouncePacket(bytes) {
    const d = this.payload(bytes, this.CMD_GET_DEBOUNCE);
    if (!d || d.length < 2) return null;
    return d[1] || null;
  }

  static parseSleepPacket(bytes) {
    const d = this.payload(bytes, this.CMD_GET_SLEEPTIME);
    if (!d || d.length < 8) return null;
    const u16 = i => d[i] | (d[i + 1] << 8);
    return { timeBT: u16(0), time24: u16(2), deepBT: u16(4), deep24: u16(6) };
  }
}
