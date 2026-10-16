'use strict';
const fs=require('node:fs'),path=require('node:path');
function installBackground({app,Tray,Menu,nativeImage,dialog},win,{executable=process.execPath,args=process.argv}={}){
 const preference=path.join(app.getPath('userData'),'background-preferences.json');
 let quitting=false,tray;
 const show=()=>{if(win.isDestroyed())return;if(win.isMinimized())win.restore();win.show();win.focus();};
 const startup=()=>app.getLoginItemSettings({path:executable,args:['--background']}).openAtLogin;
 const setStartup=enabled=>{
  app.setLoginItemSettings({openAtLogin:enabled,path:executable,args:['--background']});
  fs.mkdirSync(path.dirname(preference),{recursive:true});
  fs.writeFileSync(preference,JSON.stringify({startup:enabled},null,2));
 };
 // A real tray icon must exist before intercepting Close, to avoid hiding an
 // unreachable application if shell integration is unavailable.
 const pixels=Buffer.alloc(32*32*4);
 for(let y=0;y<32;y++)for(let x=0;x<32;x++){
  const i=(y*32+x)*4,lit=x>3&&x<28&&y>7&&y<25;
  pixels[i]=lit?235:22;pixels[i+1]=lit?165:18;pixels[i+2]=lit?70:14;pixels[i+3]=255;
  if(lit&&x%6===0&&y<20)pixels.fill(35,i,i+3);
 }
 const iconPath=path.join(__dirname,'logo256.ico');
 const icon=fs.existsSync(iconPath)&&nativeImage.createFromPath?nativeImage.createFromPath(iconPath):nativeImage.createFromBitmap(pixels,{width:32,height:32});
 tray=new Tray(icon);
 tray.setToolTip('M6 Lite Control — running in background');
 const refresh=()=>tray.setContextMenu(Menu.buildFromTemplate([
  {label:'Open M6 Lite Control',click:show},
  {label:'Start with Windows',type:'checkbox',enabled:app.isPackaged,checked:app.isPackaged&&startup(),click:item=>{
   try{setStartup(item.checked);}catch(error){dialog.showErrorBox('Windows startup',error.message);}refresh();
  }},
  {type:'separator'},
  {label:'Exit',click:()=>app.quit()}
 ]));
 tray.on('double-click',show);
 if(app.isPackaged){
  try{
   const saved=fs.existsSync(preference)?JSON.parse(fs.readFileSync(preference,'utf8')):{startup:true};
   // Re-register the current executable after a portable-build upgrade.
   setStartup(saved.startup===true);
  }catch(error){dialog.showErrorBox('Windows startup',error.message);}
 }
 refresh();
 win.on('close',event=>{if(!quitting){event.preventDefault();win.hide();}});
 app.on('before-quit',()=>{quitting=true;});
 app.on('will-quit',()=>tray.destroy());
 app.on('activate',show);
 if(!args.includes('--background')&&!args.includes('-auto'))show();
 return {show,isQuitting:()=>quitting};
}
module.exports={installBackground};
