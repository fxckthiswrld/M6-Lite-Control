const {test}=require('node:test'),assert=require('node:assert/strict');
const {claimInstance}=require('./single-instance');
test('duplicate instance quits before initialization and registers no handlers',()=>{
 let quits=0,registered=0;
 assert.equal(claimInstance({requestSingleInstanceLock:()=>false,quit:()=>quits++,on:()=>registered++},{}),false);
 assert.equal(quits,1);assert.equal(registered,0);
});
test('second launch restores and focuses the original window; early launch is harmless',()=>{
 let handler,windows=[],calls=[];
 assert.equal(claimInstance({requestSingleInstanceLock:()=>true,on:(event,fn)=>{assert.equal(event,'second-instance');handler=fn;}},{getAllWindows:()=>windows}),true);
 handler();assert.deepEqual(calls,[]);
 windows=[{isDestroyed:()=>false,isMinimized:()=>true,restore:()=>calls.push('restore'),show:()=>calls.push('show'),focus:()=>calls.push('focus')}];
 handler();assert.deepEqual(calls,['restore','show','focus']);
});
