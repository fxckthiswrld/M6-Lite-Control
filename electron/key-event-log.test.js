'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{KeyEventLog}=require('./key-event-log');
test('capture records overlapping keys and repeats without duplicating held state',()=>{
 const log=new KeyEventLog();log.start(0);log.accept('keydown',{code:'KeyA'},1);log.accept('keydown',{code:'KeyD'},2);log.accept('keydown',{code:'KeyD',repeat:true},3);
 assert.deepEqual(log.snapshot().held,['KeyA','KeyD']);log.accept('keyup',{code:'KeyD'},4);assert.deepEqual(log.snapshot().held,['KeyA']);assert.equal(log.events[3].repeat,true);
});
test('focus loss records interruption without fabricating key releases',()=>{
 const log=new KeyEventLog();log.start(0);log.accept('keydown',{code:'KeyA'},1);log.stop('focus-lost',2);log.accept('keyup',{code:'KeyA'},3);
 assert.equal(log.events.length,3);assert.deepEqual(log.events[2].unreleased,['KeyA']);assert.deepEqual(log.snapshot().held,[]);assert.equal(log.active,false);
});
test('unmatched releases and bounded logs remain explicit',()=>{
 const log=new KeyEventLog(3);log.start(0);log.accept('keyup',{code:'KeyD'},1);log.accept('keydown',{code:'KeyA'},2);log.accept('keyup',{code:'KeyA'},3);
 assert.equal(log.dropped,1);assert.equal(log.events[0].unmatchedRelease,true);assert.equal(log.events.length,3);
 const snapshot=log.snapshot();snapshot.events[0].code='Changed';assert.equal(log.events[0].code,'KeyD');assert.equal(snapshot.identifiesDevice,false);
});
