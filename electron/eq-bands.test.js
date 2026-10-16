'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{computeEqBands,BOUNDARIES}=require('./eq-bands');
test('Silence stays silent in both recovered EQ styles',()=>{for(const style of [1,2])assert.deepEqual([...computeEqBands(new Float32Array(1024),{style,mainGain:255})],Array(14).fill(0));});
test('Every band boundary maps an isolated FFT peak to only its own output',()=>{
 for(let band=0;band<14;band++){const fft=new Float32Array(1024);fft[BOUNDARIES[band]]=1;const levels=computeEqBands(fft);for(let i=0;i<14;i++)assert.equal(levels[i],i===band?255:0);}
});
test('DC and bins above the final boundary do not affect output',()=>{const fft=new Float32Array(1024);fft[0]=100;fft[931]=100;fft[1023]=100;assert.deepEqual([...computeEqBands(fft)],Array(14).fill(0));});
test('Raw style uses band peak rather than sum, with truncation',()=>{const fft=new Float32Array(1024);fft[1]=0.125;fft[2]=0.25;assert.equal(computeEqBands(fft)[0],108);});
test('Root style applies its noise floor before gain',()=>{const fft=new Float32Array(1024);fft[2]=0.25;assert.equal(computeEqBands(fft,{style:2})[0],172);fft[2]=0.0001;assert.equal(computeEqBands(fft,{style:2})[0],0);});
test('Group gain affects mapped bands only and saturation never wraps',()=>{const fft=new Float32Array(1024).fill(0.125),base=computeEqBands(fft),boost=computeEqBands(fft,{groupGains:[127,0,0,0,0,0,0,0]});assert.equal(boost[0],255);assert.equal(boost[1],255);assert.deepEqual(boost.subarray(2),base.subarray(2));});
test('Malformed or incompatible FFT input is rejected',()=>{for(const fft of [[],new Float32Array(512),new Float32Array(1024).fill(NaN),new Float32Array(1024).fill(-1)])assert.throws(()=>computeEqBands(fft));for(const options of [{sampleRate:48000},{style:0},{mainGain:1.5},{groupGains:[1]},{groupGains:Array(8)}])assert.throws(()=>computeEqBands(new Float32Array(1024),options));});

test('Negative group gain attenuates rather than wrapping to positive',()=>{const fft=new Float32Array(1024).fill(0.125);const base=computeEqBands(fft),quiet=computeEqBands(fft,{groupGains:[-4,0,0,0,0,0,0,0]});assert.ok(quiet[0]<base[0]);assert.deepEqual(quiet.subarray(2),base.subarray(2));});
