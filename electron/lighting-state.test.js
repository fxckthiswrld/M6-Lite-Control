'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {normalize,effectiveKeyColor,updateSection}=require('./lighting-state');

test('single light overlays selected keys while base sections remain enabled',()=>{
  const state=normalize({backLight:{enabled:true,mode:'stream'},underLight:{enabled:true,mode:'gradient'},singleLight:{enabled:true,keys:{A:'#ff00ff'}}});
  assert.equal(effectiveKeyColor(state,'A'),'#FF00FF');
  assert.equal(effectiveKeyColor(state,'S'),null);
  assert.equal(state.backLight.mode,'stream');
  assert.equal(state.underLight.mode,'gradient');
});

test('disabled single light exposes no overlay',()=>{
  assert.equal(effectiveKeyColor({singleLight:{enabled:false,keys:{A:'#ffffff'}}},'A'),null);
});

test('section updates preserve the other lighting layers',()=>{
  const state={backLight:{enabled:true,mode:'normal'},underLight:{enabled:true,mode:'breath'},singleLight:{enabled:true,keys:{A:'#112233'}}};
  const next=updateSection(state,'singleLight',{keys:{A:'#445566',D:'#abcdef'}});
  assert.equal(next.backLight.mode,'normal');
  assert.equal(next.underLight.mode,'breath');
  assert.equal(next.singleLight.keys.D,'#ABCDEF');
});

test('unknown modes and colors are rejected',()=>{
  assert.throws(()=>normalize({backLight:{mode:'static'}}),/Unsupported Back Light/);
  assert.throws(()=>normalize({singleLight:{keys:{A:'red'}}}),/Invalid Single Light/);
});

test('editing an overlay preserves brightness, speed and unrecognized section settings without aliasing',()=>{
  const state={backLight:{enabled:true,mode:'stream',brightness:70,speed:3,extra:{direction:1}},underLight:{enabled:true,mode:'breath',brightness:25},singleLight:{enabled:true,brightness:80,keys:{A:'#112233'}}};
  const before=structuredClone(state);
  const next=updateSection(state,'singleLight',{keys:{A:'#445566'}});
  assert.deepEqual(next.backLight,state.backLight);
  assert.deepEqual(next.underLight,state.underLight);
  assert.equal(next.singleLight.brightness,80);
  next.backLight.extra.direction=2;
  assert.deepEqual(state,before);
});
