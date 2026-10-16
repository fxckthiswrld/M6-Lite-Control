const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('keyboard', {
  saveToDeviceMemory: () => ipcRenderer.invoke('keyboard:save-memory'),
  returnToStandard: request => ipcRenderer.invoke('keyboard:return-standard', request),
  mediaActions: [
  {
    "id": "VOL_MUTE",
    "label": "Mute",
    "index": 1,
    "data": 1
  },
  {
    "id": "SAVE",
    "label": "Save",
    "index": 255,
    "data": 5
  },
  {
    "id": "CALC",
    "label": "Calculator",
    "index": 1,
    "data": 16
  },
  {
    "id": "WWW_FORWARD",
    "label": "Browser forward",
    "index": 2,
    "data": 8
  },
  {
    "id": "REDO",
    "label": "Redo",
    "index": 255,
    "data": 6
  },
  {
    "id": "VOL_UP",
    "label": "Volume up",
    "index": 1,
    "data": 2
  },
  {
    "id": "COMPUTER",
    "label": "This PC",
    "index": 1,
    "data": 8
  },
  {
    "id": "NULL",
    "label": "No action",
    "index": 1,
    "data": 0
  },
  {
    "id": "PASTE",
    "label": "Paste",
    "index": 255,
    "data": 2
  },
  {
    "id": "PLAY_PREVIOUS",
    "label": "Previous track",
    "index": 1,
    "data": 64
  },
  {
    "id": "WWW_BACK",
    "label": "Browser back",
    "index": 2,
    "data": 4
  },
  {
    "id": "VOL_DOWN",
    "label": "Volume down",
    "index": 1,
    "data": 4
  },
  {
    "id": "COPY",
    "label": "Copy",
    "index": 255,
    "data": 1
  },
  {
    "id": "PLAY",
    "label": "Play / pause",
    "index": 1,
    "data": 32
  },
  {
    "id": "MAIN_PAGE",
    "label": "Browser home",
    "index": 2,
    "data": 2
  },
  {
    "id": "CANCEL",
    "label": "Cancel (vendor action)",
    "index": 255,
    "data": 3
  },
  {
    "id": "PLAY_NEXT",
    "label": "Next track",
    "index": 1,
    "data": 128
  },
  {
    "id": "CUT",
    "label": "Cut",
    "index": 255,
    "data": 4
  }
],
  readCalibration: () => ipcRenderer.invoke('keyboard:read-calibration'),
  calibrationState: () => ipcRenderer.invoke('keyboard:calibration-state'),
  calibrationCommand: command => ipcRenderer.invoke('keyboard:calibration-command', command),
  calibrateSelected: id => ipcRenderer.invoke('keyboard:calibrate-selected', id),
  readProfile: layer => ipcRenderer.invoke('keyboard:read-profile', layer),
  exportHe: layer => ipcRenderer.invoke('keyboard:export-he', layer),
  importHe: layer => ipcRenderer.invoke('keyboard:import-he', layer),
  readProgramming: layer => ipcRenderer.invoke('keyboard:read-programming', layer),
  setPair: request => ipcRenderer.invoke('keyboard:set-pair', request),
  setRemap: request => ipcRenderer.invoke('keyboard:set-remap', request),
  setHotKey: request => ipcRenderer.invoke('keyboard:set-hotkey', request),
  setMedia: request => ipcRenderer.invoke('keyboard:set-media', request),
  setModify: request => ipcRenderer.invoke('keyboard:set-modify', request),
  setLayerAssignment: request => ipcRenderer.invoke('keyboard:set-layer-assignment', request),
  resetProgrammingKey: request => ipcRenderer.invoke('keyboard:reset-programming-key', request),
  setKeyEnabled: request => ipcRenderer.invoke('keyboard:set-key-enabled', request),
  readDeviceSettings: () => ipcRenderer.invoke('keyboard:read-device-settings'),
  setFpsEnhance: enabled => ipcRenderer.invoke('keyboard:set-fps-enhance', enabled),
  setPerformanceMode: mode => ipcRenderer.invoke('keyboard:set-performance-mode', mode),
  setDksWasd: request => ipcRenderer.invoke('keyboard:set-dks-wasd', request),
  setDksAll: request => ipcRenderer.invoke('keyboard:set-dks-all', request),
  presetOff: request => ipcRenderer.invoke('keyboard:preset-off', request),
  quickPreset: request => ipcRenderer.invoke('keyboard:quick-preset', request),
  setDks: request => ipcRenderer.invoke('keyboard:set-dks', request),
  saveSelected: key => ipcRenderer.invoke('keyboard:save-selected', key),
  applyAll: settings => ipcRenderer.invoke('keyboard:apply-all', settings),
  restart: () => ipcRenderer.invoke('keyboard:restart')
  ,calibrate: options => ipcRenderer.invoke('keyboard:calibrate', options)
  ,setProfile: profile => ipcRenderer.invoke('keyboard:profile', profile)
  ,setProgramming: config => ipcRenderer.invoke('keyboard:programming', config)
  ,readSingleLight: () => ipcRenderer.invoke('keyboard:read-single-light')
  ,setSingleLight: value => ipcRenderer.invoke('keyboard:set-single-light', value)
  ,setBackLightEnabled: value => ipcRenderer.invoke('keyboard:set-backlight-enabled', value)
  ,readBrightness: () => ipcRenderer.invoke('keyboard:read-brightness')
  ,setBrightness: value => ipcRenderer.invoke('keyboard:set-brightness', value)
  ,setUnderLightSync: value => ipcRenderer.invoke('keyboard:set-underlight-sync', value)
  ,setUnderLightEnabled: value => ipcRenderer.invoke('keyboard:set-underlight-enabled', value)
  ,setUnderLightBrightness: value => ipcRenderer.invoke('keyboard:set-underlight-brightness', value)
  ,readBackLight: () => ipcRenderer.invoke('keyboard:read-backlight')
  ,readUnderLight: () => ipcRenderer.invoke('keyboard:read-underlight')
  ,setUnderLightMode: value => ipcRenderer.invoke('keyboard:set-underlight-mode', value)
  ,setUnderLightColor: value => ipcRenderer.invoke('keyboard:set-underlight-color', value)
  ,setUnderLightSpeed: value => ipcRenderer.invoke('keyboard:set-underlight-speed', value)
  ,setBackLightMode: value => ipcRenderer.invoke('keyboard:set-backlight-mode', value)
  ,setBackLightColor: value => ipcRenderer.invoke('keyboard:set-backlight-color', value)
  ,setBackLightSpeed: value => ipcRenderer.invoke('keyboard:set-backlight-speed', value)
  ,setBackLightDirection: value => ipcRenderer.invoke('keyboard:set-backlight-direction', value)
  ,setLighting: config => ipcRenderer.invoke('keyboard:lighting', config)
  ,setSettings: config => ipcRenderer.invoke('keyboard:settings', config)
  ,getState: () => ipcRenderer.invoke('keyboard:state')
  ,getFeatures: () => ipcRenderer.invoke('app:features')
  ,eqStart: () => ipcRenderer.invoke('eq:start')
  ,eqPreference: () => ipcRenderer.invoke('eq:preference')
  ,eqStop: forget => ipcRenderer.invoke('eq:stop', forget)
  ,eqFrame: frame => ipcRenderer.invoke('eq:frame', frame)
  ,devices: () => ipcRenderer.invoke('hardware:devices')
  ,connect: kind => ipcRenderer.invoke('hardware:connect', kind)
  ,hardwareStatus: () => ipcRenderer.invoke('hardware:status')
  ,hardwareReadStatus: () => ipcRenderer.invoke('hardware:read-status')
});
