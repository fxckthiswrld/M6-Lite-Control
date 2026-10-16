'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'eq-audio-capture.js'),'utf8');
function setup(getStream){
 const tracks=['audio','video'].map(kind=>({kind,readyState:'live',stop(){this.readyState='ended';}}));
 const stream={getTracks:()=>tracks,getAudioTracks:()=>tracks.filter(t=>t.kind==='audio'),getVideoTracks:()=>tracks.filter(t=>t.kind==='video')};
 const nodes=[];class Node{constructor(){this.port={};nodes.push(this);}connect(){}disconnect(){this.disconnected=true;}}
 const contexts=[];class Context{constructor(){this.state='suspended';this.sampleRate=44100;this.audioWorklet={addModule:async()=>{}};contexts.push(this);}createMediaStreamSource(){return new Node();}createGain(){const n=new Node();n.gain={};return n;}async resume(){this.state='running';}async close(){this.state='closed';}}
 const scope={navigator:{mediaDevices:{getDisplayMedia:()=>getStream?getStream(stream):Promise.resolve(stream)}},AudioContext:Context,AudioWorkletNode:Node,MediaStream:class{},URL,location:{href:'file:///test/index.html'}};
 vm.createContext(scope);vm.runInContext(source,scope);return {capture:new scope.EqAudioCapture(),tracks,nodes,contexts,stream};
}
test('Capture stop closes tracks/context and drops queued frames',async()=>{const {capture,tracks,nodes,contexts}=setup();let count=0;await capture.start(()=>count++);const node=nodes.find(n=>n.port.onmessage),callback=node.port.onmessage;callback({data:new Float32Array(2048)});assert.equal(count,1);await capture.stop();callback({data:new Float32Array(2048)});assert.equal(count,1);assert.ok(tracks.every(t=>t.readyState==='ended'));assert.equal(contexts[0].state,'closed');await capture.stop();});
test('Stopping during acquisition disposes the delayed stream',async()=>{let resolve;const {capture,tracks}=setup(stream=>new Promise(r=>{resolve=()=>r(stream);}));const start=capture.start(()=>assert.fail('Late frame'));await new Promise(setImmediate);await capture.stop();resolve();assert.equal(await start,false);assert.ok(tracks.every(t=>t.readyState==='ended'));assert.equal(capture.state,'stopped');});
test('Missing system audio fails without a microphone fallback',async()=>{const {capture,tracks}=setup(stream=>Promise.resolve({...stream,getAudioTracks:()=>[]}));await assert.rejects(capture.start(()=>{}),/loopback is unavailable/);assert.ok(tracks.every(t=>t.readyState==='ended'));assert.equal(capture.resources,null);});
test('Frame consumer failure stops capture and reports the error',async()=>{const {capture,nodes,tracks}=setup();let error;await capture.start(()=>{throw Error('consumer failed');},e=>{error=e;});nodes.find(n=>n.port.onmessage).port.onmessage({data:new Float32Array(2048)});await new Promise(setImmediate);assert.match(error.message,/consumer failed/);assert.equal(capture.state,'stopped');assert.ok(tracks.every(t=>t.readyState==='ended'));});
test('Worklet assembles exact frames and downmixes stereo without retaining sent buffers',()=>{
 let Processor;const frames=[];const scope={AudioWorkletProcessor:class{constructor(){this.port={postMessage:frame=>frames.push(frame)};}},registerProcessor:(_name,type)=>{Processor=type;},Float32Array};vm.createContext(scope);vm.runInContext(fs.readFileSync(path.join(__dirname,'eq-audio-worklet.js'),'utf8'),scope);
 const p=new Processor();for(let i=0;i<16;i++)p.process([[new Float32Array(128).fill(0.75),new Float32Array(128).fill(-0.25)]]);assert.equal(frames.length,1);assert.ok(frames[0].every(x=>x===0.25));
 for(let i=0;i<16;i++)p.process([[new Float32Array(128)]]);assert.equal(frames.length,2);assert.ok(frames[1].every(x=>x===0));assert.ok(frames[0].every(x=>x===0.25));
});
