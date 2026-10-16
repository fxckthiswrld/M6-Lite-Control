'use strict';
// The renderer stays alive in the tray; the worklet never records audio to disk.
globalThis.eqLighting=(()=>{
 const capture=new EqAudioCapture();let active=false,pending=null,stopping=null;
 const status=text=>{document.getElementById('lighting-mode-status').textContent=text;};
 async function stop(forget=false){
  if(stopping)return stopping;
  stopping=(async()=>{active=false;await capture.stop();if(pending)await pending;const result=await window.keyboard.eqStop(forget);if(!result.ok)throw Error(result.error);return result;})();
  try{return await stopping;}finally{stopping=null;}
 }
 async function fail(error){try{await stop();status(`EQ stopped: ${error?.message||'System audio capture ended'}`);}catch(restore){status(`EQ recovery required: ${restore.message}`);}}
 async function start(){
  if(active)return;
  const result=await window.keyboard.eqStart();if(!result.ok)throw Error(result.error);
  try{
   active=true;
   await capture.start(frame=>{
    if(!active||pending)return;
    pending=window.keyboard.eqFrame(frame).then(reply=>{if(!reply.ok)throw Error(reply.error);}).catch(error=>{queueMicrotask(()=>void fail(error));}).finally(()=>{pending=null;});
   },error=>void fail(error));
  }catch(error){await stop();throw error;}
 }
 async function resume(){
  const preference=await window.keyboard.eqPreference();
  if(!preference.ok){status(preference.error);return;}
  if(!preference.result.resume)return;
  try{await start();status('EQ resumed automatically. System audio stays active in the tray.');}
  catch(error){status(`EQ could not resume: ${error.message}. Select EQ and Apply effect to retry.`);}
 }
 return {start,stop,resume,isActive:()=>active};
})();
