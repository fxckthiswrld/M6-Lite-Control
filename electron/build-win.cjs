'use strict';
const fs=require('node:fs');
const path=require('node:path');
require('./build-ui.cjs');
const root=__dirname;
const pkg=require('./package.json');
const destination=path.join(root,'..','dist',`M6-Lite-Control-${pkg.version}-win32-x64`);
if(process.platform!=='win32'||process.arch!=='x64')throw new Error('Build on Windows x64 using the installed Electron distribution');
fs.mkdirSync(destination,{recursive:true});
fs.cpSync(path.join(root,'node_modules','electron','dist'),destination,{recursive:true});
const application=path.join(destination,'resources','app');
fs.mkdirSync(application,{recursive:true});
for(const name of ['logo256.ico','ui-bridge.js','ui.bundle.js','ui.generated.css','ui.css','ui-overrides.css','device-settings.js','eq-preference.js','eq-host.js','eq-ui.js','eq-device-session.js','eq-spectrum.js','eq-fft.js','eq-bands.js','eq-audio-capture.js','eq-audio-worklet.js','background-lifecycle.js','lighting-single.js','lighting-underlight.js','lighting-backlight.js','lighting-brightness.js','key-event-log.js','key-tester.js','preset-off.js','single-instance.js','main.js','preload.js','renderer.js','index.html','style.css','features.json','media-actions.json','device-state.js','hardware.js','transport.js','calibration.js','calibration-telemetry.js','calibration-key-order.json','he-adapter.js','he-device.js','device-memory.js','he-profile-file.js','key-programming.js','m6up-commands.js','he-protocol.js','hid-frame.js','mag-command.js','keyboard-layout.json'])
  fs.copyFileSync(path.join(root,name),path.join(application,name));
fs.cpSync(path.join(root,'keyboard-tester'),path.join(application,'keyboard-tester'),{recursive:true});
fs.cpSync(path.join(root,'fonts'),path.join(application,'fonts'),{recursive:true});
fs.writeFileSync(path.join(application,'package.json'),JSON.stringify({name:pkg.name,version:pkg.version,main:pkg.main,dependencies:pkg.dependencies},null,2));
const copied=new Set();
function dependency(name) {
  if(copied.has(name))return;
  const source=path.join(root,'node_modules',name);
  const metadata=JSON.parse(fs.readFileSync(path.join(source,'package.json'),'utf8'));
  fs.cpSync(source,path.join(application,'node_modules',name),{recursive:true});
  copied.add(name);
  for(const child of Object.keys(metadata.dependencies||{}))dependency(child);
}
dependency('node-hid'); // React and HeroUI are bundled into ui.bundle.js.
require('./check-package.cjs').checkPackage(application);
fs.renameSync(path.join(destination,'electron.exe'),path.join(destination,'M6 Lite Control.exe'));
fs.writeFileSync(path.join(destination,'README.txt'),
 'M6 Lite Control — Hall Effect preview\r\n\r\nRun M6 Lite Control.exe. Keep this whole folder together. Closing the window keeps the app in the tray; use Exit to quit. Start with Windows can be toggled in the tray menu.\r\n'+
 'Reads M1/M2 from M6 Lite+ and verifies individual/all-switch HE writes by readback.\r\n'+
 'Device backups are written to the application user-data folder before changes.\r\n'+
 'Snap Tap and SOCD pairs support M1/M2 with verified readback. Individual keyboard/mouse DKS and original WASD preset are verified. HE applies only through Apply / Apply to all, with multiple-switch selection; HE JSON import/export is supported. Full DKS, calibration and restart remain in development.\r\n'+
 'RT persistence was verified on 2026-10-20 after physically disconnecting USB, with no replay on reconnect. Saves answer device CRC requests before readback and wait for SAVE_END. Back Light brightness supports Refresh / Apply with verified readback; its persistence after a power cycle is not yet verified. Normal / Stream / Breath / Gradient / Star / Roll switching is available with Apply effect. Custom RGB and color editing are available for Normal, Stream, Breath and Roll; Star uses direct color. Apply color verifies readback and preserves other sections. Apply speed supports all five dynamic Back Light effects using original MMPanel ranges. Stream and Roll support Reverse / Apply direction. Under Light has an independent Stream/Breath/Star/Gradient/Normal selector with Apply Under Light. Under Light Normal supports direct color, Breath supports Custom RGB / Apply Under Light color. Under Light speed supports Breath, Gradient, Stream and Star with original MMPanel ranges. EQ starts with Apply effect and continues in the tray; switching effects or Exit stops the stream. EQ resumes on the next app launch after successful streaming. Selecting another effect cancels EQ resume. Gain controls are intentionally omitted. Under Light brightness/enable/sync and Single Light Normal RGB are supported.\r\n');
console.log(path.join(destination,'M6 Lite Control.exe'));

require('node:child_process').execFileSync(process.execPath,[path.join(root,'stamp-icon.cjs'),path.join(destination,'M6 Lite Control.exe')],{stdio:'inherit'});
