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
