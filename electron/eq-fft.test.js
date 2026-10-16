'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {computeEqFft}=require('./eq-fft'),{computeEqBands}=require('./eq-bands');
for(const name of ['silence','bin43','offbin','mixed','stereo-same','stereo-opposite','stereo-left'])test(`FFT matches native BASS fixture: ${name}`,()=>{
 const pcm=new Float32Array(require(`../analysis-tools/eq-fixtures/${name}-pcm.json`)),reference=require(`../analysis-tools/eq-fixtures/${name}-bass.json`).bins,actual=computeEqFft(pcm);
 for(let i=0;i<actual.length;i++)assert.ok(Math.abs(actual[i]-reference[i])<0.00001,`Bin ${i}: ${actual[i]} vs ${reference[i]}`);
 for(const style of [1,2])assert.deepEqual(computeEqBands(actual,{style}),computeEqBands(new Float32Array(reference),{style}));
});
test('FFT leaves PCM intact and rejects invalid frames',()=>{
 const pcm=new Float32Array(2048),before=pcm.slice();computeEqFft(pcm);assert.deepEqual(pcm,before);
 for(const bad of [[],new Float32Array(1024),new Float32Array(2048).fill(NaN),new Float32Array(2048).fill(1.1)])assert.throws(()=>computeEqFft(bad));
});
