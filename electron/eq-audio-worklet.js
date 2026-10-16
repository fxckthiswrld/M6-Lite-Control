/* global AudioWorkletProcessor, registerProcessor */
'use strict';
class EqAudioFrames extends AudioWorkletProcessor {
 constructor(){super();this.frame=new Float32Array(2048);this.used=0;}
 process(inputs){
  const channels=inputs[0];if(!channels?.length)return true;
  const length=channels[0].length;
  for(let i=0;i<length;i++){
   let value=0;for(const channel of channels)value+=channel[i]||0;
   this.frame[this.used++]=Math.max(-1,Math.min(1,value/channels.length));
   if(this.used===2048){this.port.postMessage(this.frame,[this.frame.buffer]);this.frame=new Float32Array(2048);this.used=0;}
  }
  return true;
 }
}
registerProcessor('eq-audio-frames',EqAudioFrames);
