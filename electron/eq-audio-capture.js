'use strict';
// Browser-side loopback lifecycle. The main process must explicitly provide
// system loopback in its display-media handler; never falls back to microphone.
class EqAudioCapture {
 constructor(){this.generation=0;this.resources=null;this.state='stopped';}
 async start(onFrame,onEnded=()=>{}){
  if(typeof onFrame!=='function')throw new TypeError('Expected an audio frame callback');
  await this.stop();const generation=++this.generation;this.state='starting';
  let stream,context,node,source,mute;
  let releasing;
  const release=()=>releasing||(releasing=(async()=>{if(stream)for(const track of stream.getTracks()){track.onended=null;track.stop();}if(node){node.port.onmessage=null;node.disconnect();}source?.disconnect();mute?.disconnect();if(context&&context.state!=='closed')await context.close();})());
  try{
   stream=await navigator.mediaDevices.getDisplayMedia({audio:true,video:true});
   if(generation!==this.generation){await release();return false;}
   if(!stream.getAudioTracks().length)throw new Error('Windows system audio loopback is unavailable');
   // Electron needs a display source for loopback acquisition. No video frame
   // is consumed: stop video immediately and use an audio-only stream below.
   for(const track of stream.getVideoTracks())track.stop();
   context=new AudioContext({sampleRate:44100});
   if(context.sampleRate!==44100)throw new Error('EQ requires a 44100 Hz audio context');
   await context.audioWorklet.addModule(new URL('eq-audio-worklet.js',location.href));
   if(generation!==this.generation){await release();return false;}
   source=context.createMediaStreamSource(new MediaStream(stream.getAudioTracks()));
   node=new AudioWorkletNode(context,'eq-audio-frames');mute=context.createGain();mute.gain.value=0;
   node.port.onmessage=event=>{if(generation===this.generation&&this.state==='running'){try{onFrame(event.data);}catch(error){void this.stop();onEnded(error);}}};
   source.connect(node);node.connect(mute);mute.connect(context.destination);
   for(const track of stream.getAudioTracks())track.onended=()=>{if(generation===this.generation){void this.stop();onEnded();}};
   this.resources={release,stream,context};await context.resume();
   if(generation!==this.generation){await release();return false;}
   this.state='running';return true;
  }catch(error){await release();if(generation===this.generation){this.resources=null;this.state='stopped';}throw error;}
 }
 async stop(){++this.generation;this.state='stopped';const resources=this.resources;this.resources=null;if(resources)await resources.release();}
}
globalThis.EqAudioCapture=EqAudioCapture;
