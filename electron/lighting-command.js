'use strict';
// Static evidence only: M6UP.MB_NormallyViewModel.PageThread_Proc.
// Not connected to the device adapter until a M6 Lite+ capture confirms it.
function encodeNormalCandidate(template,{mode,customRgb,color}) {
 if(!Buffer.isBuffer(template)||template.length!==20)throw new TypeError('Expected a 20-byte original payload');
 if(!Number.isInteger(mode)||mode<0||mode>255)throw new RangeError('Invalid mode byte');
 if(typeof customRgb!=='boolean')throw new TypeError('Custom RGB must be boolean');
 if(typeof color!=='string'||!/^#[0-9a-f]{6}$/i.test(color))throw new TypeError('Expected #RRGGBB');
 const result=Buffer.from(template);
 result[0]=8;result[1]=5;result[2]=mode;result[8]=Number(customRgb);
 Buffer.from(color.slice(1),'hex').copy(result,9);
 return result;
}
// Values recovered from MB_MODE_CMD; these are not a firmware capability list.
const BACK_LIGHT_MODE=Object.freeze({eq:1,normal:2,breath:3,gradient:4,stream:5,star:6,roll:7});
function encodeStreamCandidate(template,{direction,speed,customRgb,color}) {
 if(typeof direction!=='boolean')throw new TypeError('Direction must be boolean');
 if(!Number.isInteger(speed)||speed<0||speed>65535)throw new RangeError('Expected raw uint16 speed');
 const result=encodeNormalCandidate(template,{mode:BACK_LIGHT_MODE.stream,customRgb,color});
 result[3]=Number(direction);
 result.writeUInt16LE(speed,4);
 return result;
}
module.exports={encodeNormalCandidate,encodeStreamCandidate,BACK_LIGHT_MODE};
