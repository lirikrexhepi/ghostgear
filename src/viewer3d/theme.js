export const VIEWER_THEME = {
  keyboard: {
    keycapBase: '#F4EDEB',
    keycapAccent: '#B1A7A6',
    legendOnBase: '#3F3637',
    legendOnAccent: '#2E2627',
    case: '#E4DFDE',
    caseBottom: '#CDC5C3',
    plate: '#242020',
    feet: '#B8AEAC',
    sliderKnob: '#E8731C',
    portPanel: '#DAD4D2',
    ledGreen: '#3DDC63',
    ledRed: '#FF3B30'
  },
  mouse: {
    body: '#F2F2F2',
    black: '#111111',
    underlay: '#1C1C1C',
    wheelTire: '#141414',
    wheelHub: '#E6E6E6',
    feet: '#EDEDED',
    sensorWindow: '#1A1A1A',
    led: '#7CF2A5'
  },
  headset: {
    shell: '#1d1d21',
    pad: '#1f1f23',
    baffle: '#2a2a2e',
    metal: '#5a5d63',
    accent: '#E31B23'
  },
  interaction: {
    hover: '#8FB8FF',
    selected: '#2F7BFF',
    highlight: '#FFB020'
  },
  scene: {
    light: {
      environmentIntensity: 0.43,
      keyIntensity: 0.9,
      fillIntensity: 0.3,
      rimIntensity: 0.45,
      shadowOpacity: 0.28
    },
    dark: {
      environmentIntensity: 0.43,
      keyIntensity: 0.9,
      fillIntensity: 0.3,
      rimIntensity: 0.55,
      shadowOpacity: 0.6
    }
  }
};

export function cloneTheme() {
  return JSON.parse(JSON.stringify(VIEWER_THEME));
}
