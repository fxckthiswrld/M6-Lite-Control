'use strict';
// QC64 mag_cal_val_t: model, reserved, min LE16, max LE16. INIT kind 24.
function parseCalibration(raw) {
  if (!Buffer.isBuffer(raw) || raw.length !== 420) throw new Error('Expected 420 calibration bytes');
  return Array.from({length:70}, (_,index) => {
    const offset=index*6, min=raw.readUInt16LE(offset+2), max=raw.readUInt16LE(offset+4);
    return {row:Math.floor(index/14),col:index%14,model:raw[offset],reserved:raw[offset+1],min,max,
      rangeStatus:min===2000&&max===2200?'not-calibrated':min===0&&max===0?'empty':max>min?'ok':'error'};
  });
}
function visibleCalibrationRecords(records, keyboardLayout) {
  if(!Array.isArray(records)||!Array.isArray(keyboardLayout)||keyboardLayout.length!==64) throw new Error('Expected 64-key calibration layout');
  return keyboardLayout.map(key=>{const record=records.find(r=>r.row===key.row&&r.col===key.col);if(!record)throw new Error(`Missing calibration record for ${key.id}`);return {...key,...record};});
}
// MAG_MODEL (0x33), KEY_MODEL_SINGLE_SET transfers a 64-byte switch-model
// table in four blocks. This selects switch models (NUOMI/FAN in the vendor
// page), not the scope of manual calibration (0x30). Do not use it to start
// single-switch calibration. Table ordering is PHY_KEY_LIST, not raw INIT24.
function encodeSingleModel(models) {
  if (!Buffer.isBuffer(models) || models.length !== 64) throw new RangeError('Calibration model table must contain 64 bytes');
  return Array.from({length:4}, (_,block) => {
    const payload=Buffer.alloc(20); payload.set([8,51,1,block]);
    models.copy(payload,4,block*16,block*16+16); return payload;
  });
}
// Offline preparation only: the firmware may alter ranges when a model changes.
// expectedModels lists model bytes, not a promised complete calibration readback.
function prepareModelChange(raw, physicalKeys, selectedIds, model) {
  const records=parseCalibration(raw);
  if(!Array.isArray(physicalKeys)||physicalKeys.length!==64)throw new Error('Expected 64 physical keys');
  if(!Array.isArray(selectedIds)||selectedIds.length===0)throw new Error('Select at least one switch');
  if(![0,1].includes(model))throw new Error('Unsupported switch model');
  const seen=new Set();
  for(const key of physicalKeys){
    if(!key||!Number.isInteger(key.row)||!Number.isInteger(key.col)||key.row<0||key.row>4||key.col<0||key.col>13||key.id!==`${key.row}:${key.col}`||seen.has(key.id))throw new Error('Invalid physical key map');
    seen.add(key.id);
  }
  const selected=new Set(selectedIds);
  for(const id of selected)if(!seen.has(id))throw new Error('Unknown physical switch');
  const original=Buffer.from(physicalKeys.map(k=>records[k.row*14+k.col].model));
  const expectedModels=Buffer.from(original),changes=[];
  physicalKeys.forEach((key,index)=>{
    if(selected.has(key.id)&&original[index]!==model){expectedModels[index]=model;changes.push({id:key.id,physicalIndex:index,recordIndex:key.row*14+key.col,before:original[index],after:model});}
  });
  return {changes,originalModels:original,expectedModels,
    packets:changes.length?encodeSingleModel(expectedModels):[],
    restorePackets:changes.length?encodeSingleModel(original):[],
    calibrationPreservationVerified:false};
}
function compareCalibration(before, after, keyboardLayout) {
  const oldRecords=parseCalibration(before),newRecords=parseCalibration(after);
  const visible=visibleCalibrationRecords(newRecords,keyboardLayout);
  const changedRecords=[];
  for(let index=0;index<70;index++){
    if(before.subarray(index*6,index*6+6).equals(after.subarray(index*6,index*6+6)))continue;
    const old=oldRecords[index],current=newRecords[index];
    const key=keyboardLayout.find(k=>k.row===current.row&&k.col===current.col);
    changedRecords.push({index,id:key?.id??null,label:key?.label??null,
      before:old,after:current,
      rangeChanged:old.min!==current.min||old.max!==current.max,
      modelChanged:old.model!==current.model,reservedChanged:old.reserved!==current.reserved});
  }
  const changedKeys=changedRecords.filter(r=>r.id!==null);
  return {unchanged:changedRecords.length===0,changedRecords,changedKeys,
    unchangedKeyCount:visible.length-changedKeys.length,
    hiddenRecordChanges:changedRecords.filter(r=>r.id===null).length,
    savedOkCount:visible.filter(r=>r.rangeStatus==='ok').length};
}
module.exports={parseCalibration,visibleCalibrationRecords,encodeSingleModel,prepareModelChange,compareCalibration};
