'use strict';
function claimInstance(app,BrowserWindow){
 if(!app.requestSingleInstanceLock()){app.quit();return false;}
 app.on('second-instance',()=>{
  const win=BrowserWindow.getAllWindows().find(w=>!w.isDestroyed());
  if(!win)return;
  if(win.isMinimized())win.restore();
  win.show();win.focus();
 });
 return true;
}
module.exports={claimInstance};
