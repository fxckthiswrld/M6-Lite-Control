const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {applyFps,readSettings}=require('./device-settings');
const {applyPerformanceMode}=require('./device-settings');
for(const mode of [0,1,2])test(`Performance mode ${mode} preserves FPS and unrelated bytes`,async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'m6-mode-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const raw=Buffer.alloc(24);raw[3]=(mode+1)%3;raw[12]=1;raw[23]=97;const original=Buffer.from(raw);let sends=0;
 const adapter={transaction:fn=>fn({readInit:kind=>kind===1?Buffer.from(raw):Buffer.alloc(kind===6?228:24),send:payload=>{sends++;assert.equal(payload[5],mode);assert.equal(payload[14],1);payload.copy(raw,0,2,16);}})};
 const result=await applyPerformanceMode(adapter,root,mode,{wait:async()=>{}});
 const expected=Buffer.from(original);expected[3]=mode;assert.deepEqual(raw,expected);
 assert.equal(result.performanceName,['BeastMode','EyeMode','DevMode'][mode]);assert.equal(sends,1);
 assert.equal((await applyPerformanceMode(adapter,root,mode,{wait:async()=>{}})).changed,false);assert.equal(sends,1);
});
test('Performance mode does not read the HID interface after the rebooting write',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'m6-mode-reconnect-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const sections=Object.fromEntries([1,2,4,24,25,26,6,7,9,17].map(k=>[k,Buffer.alloc(k===6?228:k===1?24:20)]));
 let rebooted=false;
 const adapter={transaction:action=>action({
  readInit:k=>{if(rebooted)throw Error('configuration interface is reconnecting');return Buffer.from(sections[k]);},
  send:payload=>{payload.copy(sections[1],0,2,16);rebooted=true;}
 })};
 const result=await applyPerformanceMode(adapter,root,1,{wait:async()=>{}});
 assert.equal(result.verified,true);
 assert.equal(result.reconnectPending,true);
});
test('performance mode rejects invalid values before hardware access',async()=>{
 for(const value of [-1,3,0.5,'1',null])await assert.rejects(applyPerformanceMode({transaction:()=>assert.fail('No USB access')},'',value),/Select BeastMode/);
});
for(const fault of ['none','reconnect','ignored','neighbor','write-error'])test(`FPS Enhance: ${fault}`,async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'m6-fps-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const sections=Object.fromEntries([1,2,4,24,25,26,6,7,9,17].map(k=>[k,Buffer.alloc(k===6?228:k===1?24:20)]));
 sections[1][23]=91;const original=Buffer.from(sections[1]);let sends=0,unavailable=0;
 const adapter={transaction:action=>{if(unavailable-->0)throw Error('Reconnecting');return action({
 readInit:k=>Buffer.from(sections[k]),send:p=>{sends++;assert.deepEqual([...p.subarray(0,2)],[8,2]);assert.equal(p.length,20);
  if(fault!=='ignored'||sends>1)p.copy(sections[1],0,2,16);
  if(fault==='neighbor')sections[24][0]=1;
  if(fault==='reconnect'&&sends===1)unavailable=2;
  if(fault==='write-error'&&sends===1)throw Error('Disconnected after write');
 }});}};
 if(['ignored','neighbor'].includes(fault)){
  await assert.rejects(applyFps(adapter,root,true,{wait:async()=>{}}),fault==='neighbor'?/Restoration failed/:/Original device settings restored/);
  assert.equal(sends,2);assert.deepEqual(sections[1],original);
 }else{
  const result=await applyFps(adapter,root,true,{wait:async()=>{}});assert.equal(result.verified,true);assert.equal(sends,1);
  const expected=Buffer.from(original);expected[12]=1;assert.deepEqual(sections[1],expected);
  const again=await applyFps(adapter,root,true,{wait:async()=>{}});assert.equal(again.changed,false);assert.equal(sends,1);
 }
});
test('FPS validation rejects invalid requests and short config',async()=>{
 assert.throws(()=>readSettings(Buffer.alloc(13)),/Incomplete/);
 assert.equal(readSettings(Buffer.alloc(14,7)).canEditFps,false);
 await assert.rejects(applyFps({transaction:()=>assert.fail('No hardware access')},'',1),/enabled or disabled/);
});
