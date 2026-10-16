const { app, BrowserWindow, ipcMain, dialog, Tray, Menu, nativeImage, desktopCapturer } = require('electron');
app.setName('M6 Lite Control');
app.name='M6 Lite Control';
app.setAppUserModelId('com.mmstudio.m6litecontrol');
if(require('./single-instance').claimInstance(app,BrowserWindow)){
const fs=require('node:fs');
const path = require('node:path');
const features = require('./features.json');
const state = require('./device-state');
const hardware = require('./hardware');
const { M6UPTransport } = require('./transport');
const { HeAdapter } = require('./he-adapter');
const heAdapter = new HeAdapter(path.join(app.getPath('userData'), 'device-backups'));
const transport = new M6UPTransport(heAdapter);
let eqHost=null,usbOperations=0,deviceSettingsBusy=false;
async function usbOrError(action, fallback, {exclusive=false}={}) {
  if(deviceSettingsBusy||(exclusive&&usbOperations>0))return {ok:false,error:'Wait for the current device operation to finish.'};
  if(eqHost?.active())return {ok:false,error:"Select another Back Light effect to stop EQ before editing device settings."};
  if(exclusive)deviceSettingsBusy=true;
  usbOperations++;
  try { return { ok: true, result: await action() }; }
  catch (error) { return { ok: false, error: error.message, local: fallback }; }
  finally { usbOperations--;if(exclusive)deviceSettingsBusy=false; }
}

function createWindow() {
  Menu.setApplicationMenu(null);
  const win = new BrowserWindow({ title: 'M6 Lite Control', icon: path.join(__dirname, 'logo256.ico'), autoHideMenuBar: true, show: false, width: 1280, height: 820, backgroundColor: '#080b11', webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
  require('./background-lifecycle').installBackground({app,Tray,Menu,nativeImage,dialog},win);
  eqHost=require('./eq-host').installEqHost({ipcMain,desktopCapturer,app,dialog},win,heAdapter,path.join(app.getPath('userData'),'device-backups'),()=>usbOperations>0);
  win.on('page-title-updated',(event)=>{event.preventDefault();win.setTitle('M6 Lite Control');});
  win.setTitle('M6 Lite Control');
  win.loadFile(path.join(__dirname, 'index.html'));
}

ipcMain.handle('keyboard:save-memory', async () => usbOrError(() => heAdapter.saveToDeviceMemory(), null));
ipcMain.handle('keyboard:read-device-settings', async()=>usbOrError(()=>heAdapter.transaction(d=>require('./device-settings').readSettings(d.readInit(1))),null));
ipcMain.handle('keyboard:set-fps-enhance', async(_event,enabled)=>usbOrError(()=>require('./device-settings').applyFps(heAdapter,heAdapter.backupDir,enabled),null,{exclusive:true}));
ipcMain.handle('keyboard:set-performance-mode', async(_event,mode)=>usbOrError(()=>require('./device-settings').applyPerformanceMode(heAdapter,heAdapter.backupDir,mode),null,{exclusive:true}));
ipcMain.handle('keyboard:read-brightness', async () => usbOrError(() => heAdapter.readBrightness(), null));
ipcMain.handle('keyboard:set-brightness', async (_event,value) => usbOrError(() => heAdapter.setBrightness(value), null));
ipcMain.handle('keyboard:set-underlight-brightness', async (_event,value) => usbOrError(() => heAdapter.setUnderLightBrightness(value), null));
ipcMain.handle('keyboard:set-backlight-enabled', async (_event,value) => usbOrError(() => heAdapter.setBackLightEnabled(value), null));
ipcMain.handle('keyboard:read-backlight', async () => usbOrError(() => heAdapter.readBackLight(), null));
ipcMain.handle('keyboard:read-underlight', async () => usbOrError(() => heAdapter.readUnderLight(), null));
ipcMain.handle('keyboard:set-underlight-mode', async (_event,value) => usbOrError(() => heAdapter.setUnderLightMode(value), null));
ipcMain.handle('keyboard:set-underlight-color', async (_event,value) => usbOrError(() => heAdapter.setUnderLightColor(value), null));
ipcMain.handle('keyboard:set-underlight-speed', async (_event,value) => usbOrError(() => heAdapter.setUnderLightSpeed(value), null));
ipcMain.handle('keyboard:set-backlight-mode', async (_event,value) => usbOrError(() => heAdapter.setBackLightMode(value), null));
ipcMain.handle('keyboard:set-backlight-color', async (_event,value) => usbOrError(() => heAdapter.setBackLightColor(value), null));
ipcMain.handle('keyboard:set-backlight-speed', async (_event,value) => usbOrError(() => heAdapter.setBackLightSpeed(value), null));
ipcMain.handle('keyboard:set-backlight-direction', async (_event,value) => usbOrError(() => heAdapter.setBackLightDirection(value), null));
ipcMain.handle('keyboard:read-calibration', async () => usbOrError(() => heAdapter.readCalibration(), null));
ipcMain.handle('keyboard:calibration-state', async () => usbOrError(() => heAdapter.calibrationState(), null));
ipcMain.handle('keyboard:calibration-command', async (_event, command) => usbOrError(() => heAdapter.calibrationCommand(command), null));
ipcMain.handle('keyboard:calibrate-selected', async (_event, id) => usbOrError(() => heAdapter.calibrateSelected(id), null));
ipcMain.handle('keyboard:read-profile', async (_event, layer) => usbOrError(() => heAdapter.readProfile(layer), null));
ipcMain.handle('keyboard:export-he', async (event,layer)=>usbOrError(async()=>{
  if(![0,1].includes(layer))throw new Error('Select M1 or M2');
  const selected=await dialog.showSaveDialog(BrowserWindow.fromWebContents(event.sender),{title:'Export HE profile',defaultPath:`M6-Lite-HE-M${layer+1}.json`,filters:[{name:'HE profile JSON',extensions:['json']}]});
  if(selected.canceled)return {canceled:true};
  const document=heAdapter.exportHeProfile(layer);
  fs.writeFileSync(selected.filePath,JSON.stringify(document,null,2)+'\n','utf8');return {path:selected.filePath};
},null));
ipcMain.handle('keyboard:import-he', async (event,layer)=>usbOrError(async()=>{
  if(![0,1].includes(layer))throw new Error('Select M1 or M2');
  const selected=await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender),{title:`Import HE into M${layer+1}`,properties:['openFile'],filters:[{name:'HE profile JSON',extensions:['json']}]});
  if(selected.canceled)return {canceled:true};
  const file=selected.filePaths[0];if(fs.statSync(file).size>128*1024)throw new Error('HE profile file is too large');
  return heAdapter.importHeProfile(layer,JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'')));
},null));
ipcMain.handle('keyboard:read-programming', async (_event, layer) => usbOrError(() => heAdapter.readProgramming(layer), null));
ipcMain.handle('keyboard:set-pair', async (_event, request) => usbOrError(() => heAdapter.setPair(request), null));
ipcMain.handle('keyboard:set-remap', async (_event, request) => usbOrError(() => heAdapter.setRemap(request), null));
ipcMain.handle('keyboard:set-hotkey', async (_event, request) => usbOrError(() => heAdapter.setHotKey(request), null));
ipcMain.handle('keyboard:set-media', async (_event, request) => usbOrError(() => heAdapter.setMedia(request), null));
ipcMain.handle('keyboard:set-modify', async (_event, request) => usbOrError(() => heAdapter.setModify(request), null));
ipcMain.handle('keyboard:set-layer-assignment', async (_event, request) => usbOrError(() => heAdapter.setLayerAssignment(request), null));
ipcMain.handle('keyboard:reset-programming-key', async (_event, request) => usbOrError(() => heAdapter.resetProgrammingKey(request), null));
ipcMain.handle('keyboard:set-key-enabled', async (_event, request) => usbOrError(() => heAdapter.setKeyEnabled(request), null));
ipcMain.handle('keyboard:set-dks', async (_event, request) => usbOrError(() => heAdapter.setDks(request), null));
ipcMain.handle('keyboard:set-dks-all', async (_event, request) => usbOrError(() => heAdapter.setDksAll(request), null));
ipcMain.handle('keyboard:set-dks-wasd', async (_event, request) => usbOrError(() => heAdapter.setDksWasd(request), null));
ipcMain.handle('keyboard:preset-off', async (_event, request) => usbOrError(() => heAdapter.presetOff(request), null));
ipcMain.handle('keyboard:quick-preset', async (_event, request) => usbOrError(() => heAdapter.setQuickPreset(request), null));
ipcMain.handle('keyboard:save-selected', async (_event, key) => usbOrError(() => transport.saveSelectedKey(key), null));
ipcMain.handle('keyboard:apply-all', async (_event, settings) => usbOrError(() => transport.applyToAll(settings), null));
ipcMain.handle('keyboard:restart', async () => usbOrError(() => transport.restart(), null));
ipcMain.handle('keyboard:calibrate', async () => usbOrError(() => transport.calibrate(), null));
ipcMain.handle('keyboard:profile', async (_event, profile) => ({ ok: true, operation: 'profile', profile: state.setProfile(profile) }));
ipcMain.handle('keyboard:programming', async (_event, config) => usbOrError(() => transport.programming(config), state.update('programming', config)));
ipcMain.handle('keyboard:lighting', async (_event, config) => usbOrError(() => transport.lighting(config), state.update('lighting', config)));
ipcMain.handle('keyboard:settings', async (_event, config) => usbOrError(() => transport.settings(config), state.update('settings', config)));
ipcMain.handle('keyboard:state', async () => state.snapshot());
ipcMain.handle('app:features', async () => features);
ipcMain.handle('hardware:devices', async () => hardware.list());
ipcMain.handle('hardware:connect', async (_event, kind) => (eqHost?.active()?Promise.reject(new Error('Stop EQ before reconnecting')):hardware.connect(kind)));
ipcMain.handle('hardware:status', async () => hardware.status());
ipcMain.handle('hardware:read-status', async () => hardware.readStatus());
app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

ipcMain.handle('keyboard:return-standard', async (_event, request) => usbOrError(() => heAdapter.returnToStandard(request), null));

ipcMain.handle('keyboard:set-underlight-enabled', async (_event,value) => usbOrError(() => heAdapter.setUnderLightEnabled(value), null));

ipcMain.handle('keyboard:set-underlight-sync', async (_event,value) => usbOrError(() => heAdapter.setUnderLightSync(value), null));

ipcMain.handle('keyboard:read-single-light', async () => usbOrError(() => heAdapter.readSingleLight(), null));
ipcMain.handle('keyboard:set-single-light', async (_event,value) => usbOrError(() => heAdapter.setSingleLight(value), null));

}
