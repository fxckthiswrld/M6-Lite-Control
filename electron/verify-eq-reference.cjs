'use strict';
// Executes the recovered C# state-machine blocks for the 14-band branch in an
// isolated JS context. This is a decompiled reference, not the original binary.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {computeEqBands}=require('./eq-bands');
const root=path.resolve(__dirname,'..'),cases=JSON.parse(fs.readFileSync(path.join(root,'lighting-eq-cases.json'))),runtime=JSON.parse(fs.readFileSync(path.join(root,'lighting-eq-runtime-state.json')))['MMPanel.MMEQ'];
const cache=new Map();
function block(state){
 if(cache.has(state))return cache.get(state);
 let source=cases[state]|| (state===0?cases.default:null);if(!source)throw Error('Missing reference state '+state);
 source=source.replace(/^(?:case \d+|default):/,'').replaceAll('GBOTrcg9PF9uDgAjgVD()','true').replaceAll('Kji3OyggjlBtFlowEoA()','null');
 source=source.replace(/ODCIT4B9u12aKEqtAC4\.aHejadkLo\((KHfrOOEryY\[num52\]), ODCIT4B9u12aKEqtAC4\.iePJKTfUL5\)/g,'Math.sqrt($1)');
 source=source.replace(/goto case (\d+);/g,'num4=$1;return;').replace(/\bnum3\b/g,'num4').replace(/\b(?:continue|break);/g,'return;').replace(/\b(\d+)u\b/g,'$1');
 source=source.replaceAll('.Length','.length');
 source=source.replace(/\(double\)\(int\)/g,'').replace(/\(double\)/g,'');
 source=source.replace(/(array\[num19\]\s*=)\s*\(int\)\(([^;]+)\);/g,'$1 Math.trunc($2);');
 if(/aHejadkLo|goto |hidDev|Thread|URIrn|new /.test(source))throw Error('Unisolated operation in reference state '+state);
 const script=new vm.Script('(function(){'+source+'})()');cache.set(state,script);return script;
}
function reference(fft,options){
 const context={Math,KHfrOOEryY:fft,fastConn:{eq_spec_style:options.style,main_gain:options.mainGain,spec_gain:options.groupGains,light_sync_state:0},array6:Array(14).fill(0),array:Array(14).fill(0)};
 for(const [key,value]of Object.entries(runtime))if(typeof value==='number'||Array.isArray(value)&&value.every(x=>typeof x==='number'))context[key]=value;
 for(const name of ['num11','num17','num24','num37','num7','num19','num42'])context[name]=0;
 context.num52=1;context.num4=91;
 vm.createContext(context);let steps=0;const visited=new Set();
 while(context.num4!==200){if(++steps>40000)throw Error('Reference did not terminate');const state=context.num4;visited.add(state);try{block(state).runInContext(context);}catch(error){throw Error(error.message+'; last states '+[...visited].slice(-25).join(',')+'; bin='+context.num52+' band='+context.num24);}}
 return {levels:context.array.map(x=>x===0?0:x),steps,visited:[...visited]};
}
let seed=0x64;function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
const report={reference:'Decompiled vendor state machine; not original binary execution',cases:0,visited:new Set()};
try{
 for(const style of [1,2])for(let sample=0;sample<30;sample++){
  const fft=new Float32Array(1024);for(let i=0;i<fft.length;i++)fft[i]=sample===0?0:sample===1?(i===90?0.125:0):rand()*(sample%3===0?0.0001:0.05);
  const options={style,mainGain:sample%4?0:5,groupGains:Array.from({length:8},()=>sample%5?0:Math.floor(rand()*9)-4)};
  const expected=reference(fft,options);for(const x of expected.visited)report.visited.add(x);
  assert.deepEqual([...computeEqBands(fft,options)],expected.levels,`Style ${style}, sample ${sample}`);report.cases++;
 }
 report.ok=true;
}catch(error){report.ok=false;report.error=error.stack;process.exitCode=1;}
report.visited=[...report.visited].sort((a,b)=>a-b);fs.writeFileSync(path.join(root,'lighting-eq-reference-verification.json'),JSON.stringify(report,null,2));console.log(report);
