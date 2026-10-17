'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require.resolve('./renderer.js'),'utf8');
function harness(active,reply={ok:true},readError=false){
  const elements=new Map();let reads=0;const sent=[];
  const context=vm.createContext({profile:null,busy:false,calibrationActive:active,calibrationStateKnown:true,
    $:id=>{if(!elements.has(id))elements.set(id,{});return elements.get(id);},
    setBusy:value=>{context.busy=value;},
    setCalibrationActive:value=>{context.calibrationActive=value;},
    setTimeout:fn=>fn(),
    refreshCalibration:async()=>{reads++;assert.equal(context.busy,true);if(readError)throw Error('Read failed');context.$('calibration-status').textContent='Read 64 switches.';},
    window:{keyboard:{calibrationCommand:async command=>{sent.push(command);return reply;}}}
  });
  vm.runInContext(source.slice(source.indexOf('async function readCalibrationAfterReconnect('),source.indexOf("$('calibration-start').onclick=")),context);
  return {context,sent,reads:()=>reads};
}
test('Finish and Cancel refresh directly while UI controls remain locked',async()=>{
  for(const command of [2,3]){
    const h=harness(true);await h.context.calibrationCommand(command);
    assert.deepEqual(h.sent,[command]);assert.equal(h.reads(),1);
    assert.equal(h.context.calibrationActive,false);assert.equal(h.context.busy,false);
    assert.match(h.context.$('calibration-status').textContent,/Read 64/);
  }
});
test('failed finish keeps the session active; failed read does not resend finish',async()=>{
  const failed=harness(true,{ok:false,error:'Disconnected'});
  await failed.context.calibrationCommand(2);
  assert.equal(failed.context.calibrationActive,true);assert.equal(failed.reads(),0);
  const read=harness(true,{ok:true},true);await read.context.calibrationCommand(2);
  assert.equal(read.context.calibrationActive,false);assert.equal(read.context.busy,false);
  assert.match(read.context.$('calibration-status').textContent,/Read failed/);
  await read.context.calibrationCommand(2);assert.deepEqual(read.sent,[2]);
});
test('duplicate start and finish without an active session send nothing',async()=>{
  const active=harness(true);await active.context.calibrationCommand(1);assert.deepEqual(active.sent,[]);
  const idle=harness(false);await idle.context.calibrationCommand(2);await idle.context.calibrationCommand(3);assert.deepEqual(idle.sent,[]);
});

test('reconnect retries only reads and stops polling before Finish readback',async()=>{
 const h=harness(true);let attempts=0,stopped=0;
 h.context.stopCalibrationPoll=()=>stopped++;
 h.context.refreshCalibration=async()=>{assert.equal(stopped,1);if(++attempts<3)throw Error('Device reconnecting');h.context.$('calibration-status').textContent='Ranges verified.';};
 await h.context.calibrationCommand(2);
 assert.deepEqual(h.sent,[2]);assert.equal(attempts,3);assert.equal(h.context.busy,false);
 assert.match(h.context.$('calibration-status').textContent,/Ranges verified/);
});

test('exhausted reconnect reads retain pending verification, never repeat Finish',async()=>{
 const h=harness(true,{ok:true},true);await h.context.calibrationCommand(2);
 assert.equal(h.reads(),5);assert.deepEqual(h.sent,[2]);
 assert.match(h.context.$('calibration-status').textContent,/readback is pending.*Refresh calibration.*Do not repeat Finish/);
});

test('renderer reload restores active session and failure blocks commands until retry',async()=>{
 const h=harness(false);const c=h.context;
 c.updateSelectedCalibrationButton=()=>{};
 let polls=0;c.startCalibrationPoll=()=>polls++;
 c.window.keyboard.calibrationState=async()=>({ok:true,result:{active:true,selectedId:'2:1'}});
 vm.runInContext(source.slice(source.indexOf('async function restoreCalibrationState('),source.indexOf('async function calibrationCommand(')),c);
 await c.restoreCalibrationState();
 assert.equal(c.calibrationActive,true);assert.equal(c.calibrationStateKnown,true);
 assert.match(c.$('calibration-status').textContent,/session was restored/);
 assert.match(c.$('calibration-status').textContent,/Press only 2:1/);assert.equal(polls,1);
 c.window.keyboard.calibrationState=async()=>({ok:false,error:'IPC failed'});
 await c.restoreCalibrationState();assert.equal(c.calibrationStateKnown,false);
 await c.calibrationCommand(2);assert.deepEqual(h.sent,[]);
 c.window.keyboard.calibrationState=async()=>({ok:true,result:{active:true}});
 await c.restoreCalibrationState();await c.calibrationCommand(3);
 assert.deepEqual(h.sent,[3]);assert.equal(c.calibrationActive,false);
});

function pollingHarness(){
 const elements=new Map();let tick;
 const element=()=>({textContent:'',dataset:{},style:{},appendChild(){},replaceChildren(){}});
 const context=vm.createContext({busy:false,Map,
  $:id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);},
  document:{createElement:element,createDocumentFragment:element},
  setInterval:fn=>{tick=fn;return 1;},clearInterval(){},window:{keyboard:{}}
 });
 vm.runInContext(source.slice(source.indexOf('let calibrationActive='),source.indexOf('function setCalibrationActive(')),context);
 vm.runInContext(source.slice(source.indexOf('async function refreshCalibration('),source.indexOf("$('calibration-read').onclick=")),context);
 vm.runInContext('calibrationActive=true;startCalibrationPoll();',context);
 return {context,tick:()=>tick()};
}

test('successful polling distinguishes fresh reads from changed sensor ranges',async()=>{
 const h=pollingHarness(),c=h.context;
 const data={layout:[{id:'0:0',row:0,col:0,label:'Esc',x:0,y:0,width:40}],records:[{min:1800,max:2600,model:0,rangeStatus:'ok'}],readAt:'2026-10-17T10:00:00.000Z'};
 c.window.keyboard.readCalibration=async()=>({ok:true,result:data});
 await h.tick();assert.match(c.$('calibration-read-status').textContent,/Successful reads: 1.*First reading/);
 data.readAt='2026-10-17T10:00:01.000Z';
 await h.tick();assert.match(c.$('calibration-read-status').textContent,/10:00:01.*Successful reads: 2.*previous read: 0\/1/);
 data.records[0].max=2700;
 await h.tick();assert.match(c.$('calibration-read-status').textContent,/Successful reads: 3.*previous read: 1\/1/);
 c.window.keyboard.readCalibration=async()=>({ok:false,error:'Timed out'});
 await h.tick();assert.match(c.$('calibration-read-status').textContent,/Read failed: Timed out/);
 c.window.keyboard.readCalibration=async()=>({ok:true,result:data});
 await h.tick();assert.match(c.$('calibration-read-status').textContent,/Successful reads: 4.*previous read: 0\/1/);
});

test('slow polls do not overlap and late replies cannot overwrite Finish state',async()=>{
 const h=pollingHarness(),c=h.context;let resolve,reads=0;
 c.window.keyboard.readCalibration=()=>{reads++;return new Promise(done=>{resolve=done;});};
 const pending=h.tick();await h.tick();assert.equal(reads,1);
 c.stopCalibrationPoll();c.$('calibration-read-status').textContent='Finish readback';
 resolve({ok:false,error:'Stale poll failure'});await pending;
 assert.equal(c.$('calibration-read-status').textContent,'Finish readback');
});
