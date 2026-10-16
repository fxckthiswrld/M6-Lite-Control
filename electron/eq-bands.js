'use strict';
// Source-derived QC64 14-band calculation, for FFT2048 at 44100 Hz.
// Not a general analyser: other sample rates and FFT normalizations require
// independent verification against BASS. No audio capture or USB writes here.
const BOUNDARIES=Object.freeze([2,3,4,5,6,8,11,16,22,32,45,64,90,930]);
const GROUPS=Object.freeze([0,0,1,1,2,2,3,3,4,4,5,5,6,7]);
const RAW_GAIN=[1.7,1.7,1.7,1,1,1,2,2,2,2,2,2,2,2];
const ROOT_GAIN=[1.5,1.5,1.5,1.5,1.5,1.5,1.5,1.5,1.5,1.5,1.5,1.5,1.5,2];
const FLOOR=[0.05,0.05,0.05,0.04,0.04,0.04,0.03,0.03,0.03,0.03,0.03,0.02,0.02,0.02];
function computeEqBands(fft,{style=1,mainGain=0,groupGains=Array(8).fill(0),sampleRate=44100}={}){
 if(!(fft instanceof Float32Array)||fft.length!==1024)throw new TypeError('Expected 1024 Float32 FFT bins');
 if(sampleRate!==44100)throw new RangeError('Only the recovered 44100 Hz mapping is supported');
 if(style!==1&&style!==2)throw new RangeError('Expected EQ style 1 or 2');
 if(!Number.isInteger(mainGain)||mainGain<0||mainGain>255)throw new RangeError('Main gain must be a byte');
 if(!Array.isArray(groupGains)||groupGains.length!==8||Array.from(groupGains).some(x=>!Number.isInteger(x)||x< -128||x>127))throw new RangeError('Expected eight signed byte gains');
 for(let i=0;i<fft.length;i++)if(!Number.isFinite(fft[i])||fft[i]<0)throw new RangeError('FFT bins must be finite and nonnegative');
 const levels=new Uint8Array(14);let start=1;
 for(let band=0;band<14;band++){
  let peak=0;for(let i=start;i<=BOUNDARIES[band];i++)peak=Math.max(peak,fft[i]);
  if(style===2)peak=Math.sqrt(peak)-FLOOR[band];
  const gain=(style===1?RAW_GAIN:ROOT_GAIN)[band]+mainGain*(style===1?0.2:0.015)+groupGains[GROUPS[band]]*(style===1?0.4:0.04);
  levels[band]=Math.max(0,Math.min(255,Math.trunc(peak*gain*255)));start=BOUNDARIES[band]+1;
 }
 return levels;
}
module.exports={computeEqBands,BOUNDARIES,GROUPS};
