import { MeetionMK12Device } from './keyboard/mk12-device.js';
import { VXER1Device } from './mouse/vxe-r1-device.js';
import { Cloud3Device } from './headset/cloud3-device.js';

export class DeviceRegistry {
  static DRIVERS = [
    {
      name: 'Meetion MK12',
      type: 'keyboard',
      vendorId: 0x3151,
      productId: 0x4015,
      usagePage: 0xFFFF,
      usage: 0x0002,
      driverClass: MeetionMK12Device
    },
    {
      name: 'VXE R1 Series Mouse',
      type: 'mouse',
      vendorId: 0x373B,
      productId: 0x1085,
      usagePage: 0xFF04,
      usage: 0x0002,
      driverClass: VXER1Device
    },
    {
      name: 'HyperX Cloud III',
      type: 'headset',
      vendorId: 0x03F0,
      productId: 0x089D,
      usagePage: 0x01C0,
      usage: 0x0001,
      driverClass: Cloud3Device
    }
  ];

  static getHidFilters() {
    return this.DRIVERS.map(d => {
      const filter = { vendorId: d.vendorId };
      if (d.productId) filter.productId = d.productId;
      if (d.usagePage) filter.usagePage = d.usagePage;
      if (d.usage) filter.usage = d.usage;
      return filter;
    });
  }

  static createFromHidDevice(hidDevice) {
    const match = this.DRIVERS.find(d => 
      d.vendorId === hidDevice.vendorId && 
      (!d.productId || d.productId === hidDevice.productId) &&
      (!d.usagePage || (hidDevice.collections && hidDevice.collections.some(c => c.usagePage === d.usagePage)))
    );

    if (match) {
      return new match.driverClass({
        id: `hid_${hidDevice.vendorId}_${hidDevice.productId}`,
        hidDevice,
        isMock: false
      });
    }

    if (hidDevice.vendorId === 0x3151) {
      return new MeetionMK12Device({
        id: `hid_mk12_${Date.now()}`,
        hidDevice,
        isMock: false
      });
    }

    if (hidDevice.vendorId === 0x03F0) {
      return new Cloud3Device({
        id: `hid_cloud3_${Date.now()}`,
        hidDevice,
        isMock: false
      });
    }

    return null;
  }

  static createMockDevice(type = 'keyboard') {
    if (type === 'keyboard') {
      return new MeetionMK12Device({
        id: 'mock_mk12',
        isMock: true,
        isOnline: true,
        battery: 92
      });
    } else if (type === 'mouse') {
      return new VXER1Device({
        id: 'mock_vxe_r1',
        isMock: true,
        isOnline: true,
        battery: 85
      });
    } else {
      return new Cloud3Device({
        id: 'mock_cloud3',
        isMock: true,
        isOnline: true,
        battery: 100
      });
    }
  }
}
