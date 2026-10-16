'use strict';
const FFT_SIZE=2048;
// Mono PCM at 44100 Hz. Periodic Hann window, amplitude normalized to
// BASS_ChannelGetData(BASS_DATA_FFT2048) using synthetic native-BASS fixtures.
function computeEqFft(samples){
 if(!(samples instanceof Float32Array)||samples.length!==FFT_SIZE)throw new TypeError('Expected 2048 mono Float32 PCM samples');
 const real=new Float64Array(FFT_SIZE),imag=new Float64Array(FFT_SIZE);
 for(let i=0;i<FFT_SIZE;i++){
  if(!Number.isFinite(samples[i])||Math.abs(samples[i])>1)throw new RangeError('PCM samples must be finite and normalized to -1..1');
  real[i]=samples[i]*(0.5-0.5*Math.cos(2*Math.PI*i/FFT_SIZE));
 }
 for(let i=1,j=0;i<FFT_SIZE;i++){let bit=FFT_SIZE>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){[real[i],real[j]]=[real[j],real[i]];}}
 for(let size=2;size<=FFT_SIZE;size<<=1){
  const angle=-2*Math.PI/size,stepR=Math.cos(angle),stepI=Math.sin(angle);
  for(let start=0;start<FFT_SIZE;start+=size){let wr=1,wi=0;for(let j=0;j<size/2;j++){
   const a=start+j,b=a+size/2,tr=wr*real[b]-wi*imag[b],ti=wr*imag[b]+wi*real[b];
   real[b]=real[a]-tr;imag[b]=imag[a]-ti;real[a]+=tr;imag[a]+=ti;
   const next=wr*stepR-wi*stepI;wi=wr*stepI+wi*stepR;wr=next;
  }}
 }
 const bins=new Float32Array(FFT_SIZE/2);for(let i=0;i<bins.length;i++)bins[i]=Math.hypot(real[i],imag[i])*(i===0?2:4)/FFT_SIZE;
 return bins;
}
module.exports={FFT_SIZE,computeEqFft};
