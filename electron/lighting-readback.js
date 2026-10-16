'use strict';
// Candidate sequential layout derived from M6UP mix_buttom and mb_light.
// Structural agreement with INIT6 is not controlled hardware verification.
const names=['normal','breath','gradient','stream','star','roll','ripple','wind','wave','ladder','rain','cross','bump','wv','rotation','blink','donut','love','moba','fps','helix'];
// mix_buttom has 21 mb_light records: 8 + 21*10 = 218 bytes.
// Remaining 10 bytes have unknown meaning; preserve them without assuming padding.
function decodeBackLightCandidate(raw){
 if(!Buffer.isBuffer(raw)||raw.length!==228)throw new RangeError('Expected observed 228-byte INIT6 section');
 const effects={};
 names.forEach((name,index)=>{
  const offset=8+index*10,record=raw.subarray(offset,offset+10);
  effects[name]={offset,directionRaw:record[0],reserved:record[1],customRgbRaw:record[2],color:'#'+record.subarray(3,6).toString('hex').toUpperCase(),speed1Raw:record.readUInt16LE(6),speed2Raw:record.readUInt16LE(8)};
 });
 return {verification:'static-layout-candidate',modeRaw:raw[0],associateRaw:raw[1],eqRaw:raw.subarray(2,8).toString('hex'),effects,tailHex:raw.subarray(218).toString('hex')};
}
function decodeUnderLightCandidate(raw){
 if(!Buffer.isBuffer(raw)||raw.length!==108)throw new RangeError('Expected observed 108-byte INIT9 section');
 const effects={};
 const order=['breath','gradient','stream','star','apmGradient','apmStream','normal','blink','apmReptile','timer','bump','lazer','horse'];
 order.forEach((name,index)=>{
  const offset=2+index*8,record=raw.subarray(offset,offset+8);
  effects[name]={offset,customRgbRaw:record[0],color:'#'+record.subarray(1,4).toString('hex').toUpperCase(),speed1Raw:record.readUInt16LE(4),speed2Raw:record.readUInt16LE(6)};
 });
 return {verification:'static-layout-candidate',modeRaw:raw[0],reserved:raw[1],effects,tailHex:raw.subarray(106).toString('hex')};
}
function decodeLightConfigCandidate(raw){
 if(!Buffer.isBuffer(raw)||raw.length!==24)throw new RangeError('Expected observed 24-byte INIT17 section');
 // Only names shared by QC64 and M6UP. Bytes 12/13 differ between families.
 const names=['baohe_r','baohe_g','baohe_b','sw_bright','highlight','buttom_actived','top_actived','enter_actived','enter_unify','circle_actived','circle_bright','circle_sync',null,null,'mt_breath_speed','mt_gradient_speed','me_argb_speed','me_spread_speed'];
 const fields={};names.forEach((name,offset)=>{if(name)fields[name]={offset,raw:raw[offset]};});
 return {verification:'static-layout-candidate',fields,familyDependentHex:raw.subarray(12,14).toString('hex'),tailHex:raw.subarray(18).toString('hex')};
}
module.exports={decodeBackLightCandidate,decodeUnderLightCandidate,decodeLightConfigCandidate};
