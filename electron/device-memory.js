'use strict';
const {decodeInputReport}=require('./hid-frame');

// QC64.NavigationViewModel.NAVI_OFF_SAVE_CMD sends DRIVER_ED.
// HidRcvProc answers host-cache CRC requests through TFdLn1YB0L(command, 0, crc).
// SAVE_END is a device response, not the command used to start a save.
const CRC_SECTIONS=new Map([[0xc1,{kind:2,length:4768}],[0xc2,{kind:4,length:4768}],
  [0xc9,{kind:25,length:980}],[0xca,{kind:26,length:980}]]);

// Vendor sRgQl3BT7I: non-reflected CRC32, little-endian words, no final XOR.
// These are host-cache tags (the vendor hashes BinaryFormatter files). We hash
// our raw snapshots, excluding the device's old cache tag and transfer padding.
function cacheCrc(bytes){
  let crc=0xffffffff;
  for(let offset=0;offset<bytes.length;offset+=4){
    let word=0;
    for(let byte=0;byte<4;byte++)word|=(bytes[offset+byte]||0)<<(byte*8);
    crc^=word;
    for(let bit=0;bit<32;bit++)crc=(crc<<1)^((crc&0x80000000)?0x04c11db7:0);
  }
  return crc>>>0;
}

function saveDeviceMemory(device,sections,{timeoutMs=5000,now=Date.now,trace=()=>{},requireCrc=false}={}){
  const tags=new Map();
  for(const [command,{kind,length}] of CRC_SECTIONS){
    const raw=sections.get(kind);
    if(!Buffer.isBuffer(raw)||raw.length<length)throw Error(`Missing device-memory backup (${kind})`);
    tags.set(command,cacheCrc(raw.subarray(0,length)));
  }
  // A setting write can already have queued a CRC request. Never drain here:
  // dropping that request leaves the firmware waiting for its cache tag.
  const send=payload=>{trace({direction:'out',hex:payload.toString('hex')});device.send(payload);};
  const start=Buffer.alloc(20);start.set([8,0xf2]);send(start);
  const deadline=now()+timeoutMs,answered=new Set();
  let frames=0;
  while(now()<deadline&&frames<256){
    const report=Buffer.from(device.handle.readTimeout(Math.min(100,Math.max(1,deadline-now()))));
    if(!report.length)continue;
    frames++;
    const payload=decodeInputReport(report);
    trace({direction:'in',hex:payload.toString('hex')});
    if(payload[0]===0&&tags.has(payload[1])){
      // A batch may queue the same request more than once; answer consistently.
      const reply=Buffer.alloc(20);reply.set([8,payload[1],0]);reply.writeUInt32LE(tags.get(payload[1]),3);
      send(reply);answered.add(payload[1]);
    }else if((payload[0]===0||payload[0]===8)&&payload[1]===0xfe&&(!requireCrc||answered.size>0)){
      return {acknowledged:true,command:'DRIVER_ED',completion:'SAVE_END',
        crcCommands:[...answered],persistenceVerified:false};
    }
  }
  throw Error('Keyboard did not confirm SAVE_END; settings may be lost after disconnecting USB');
}
module.exports={cacheCrc,saveDeviceMemory};
