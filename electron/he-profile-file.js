'use strict';
const layout=require('./keyboard-layout.json');
const {fields}=require('./he-protocol');
const FORMAT='m6-lite-plus-he',VERSION=1;
function exportProfile(profile,layer){
  return {format:FORMAT,version:VERSION,model:'M6 Lite+',vendorId:0x2233,productId:0x006b,units:'mm',sourceProfile:`M${layer+1}`,
    keys:layout.map(({id,row,col})=>{const key=profile.keys.find(k=>k.row===row&&k.col===col);
      return {id,rtOn:!!key.rtOn,...Object.fromEntries(fields.map(f=>[f,key[f]/500]))};})};
}
function validateProfile(document){
  if(!document||document.format!==FORMAT||document.version!==VERSION||document.model!=='M6 Lite+'||document.vendorId!==0x2233||document.productId!==0x006b||document.units!=='mm')
    throw new Error('Incompatible HE profile format or keyboard model');
  if(!Array.isArray(document.keys)||document.keys.length!==layout.length)throw new Error('Profile must contain all 64 physical switches');
  const seen=new Set();
  return document.keys.map(key=>{
    const physical=layout.find(k=>k.id===key?.id);
    if(!physical||seen.has(key.id))throw new Error('Unknown or duplicated switch');seen.add(key.id);
    if(typeof key.rtOn!=='boolean')throw new Error('Invalid Rapid Trigger flag');
    const result={row:physical.row,col:physical.col,rtOn:Number(key.rtOn)};
    for(const field of fields){const value=key[field],raw=value*500;
      if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>3.3||Math.abs(raw-Math.round(raw))>1e-7)throw new Error(`Invalid ${field} at ${key.id}: expected 0-3.3 mm in 0.002 mm increments`);
      result[field]=Math.round(raw);
    }
    return result;
  });
}
module.exports={exportProfile,validateProfile};
