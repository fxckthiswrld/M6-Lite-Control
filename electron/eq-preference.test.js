'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {EqPreference}=require('./eq-preference');
test('EQ resume survives a new instance and explicit disable survives another',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'eq-pref-'));
 try{const first=new EqPreference(root);assert.equal(first.read(),false);first.write(true);const next=new EqPreference(root);assert.equal(next.read(),true);next.write(false);assert.equal(new EqPreference(root).read(),false);assert.throws(()=>next.write('true'));}finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('invalid preference never turns on audio capture',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'eq-pref-'));
 try{const pref=new EqPreference(root);fs.writeFileSync(pref.file,'{broken');assert.equal(pref.read(),false);fs.writeFileSync(pref.file,'{"resume":"true"}');assert.equal(pref.read(),false);}finally{fs.rmSync(root,{recursive:true,force:true});}
});
