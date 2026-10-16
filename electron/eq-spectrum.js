'use strict';
// Recovered from MMPanel.MMEQ.mVfQz6BU2A, 14-band branch:
// header cases 663/247, samples 419/720/531/173. Not connected to HID yet:
// live spectrum capture and audio-to-band parity remain to be verified.
const BAND_COUNT=14;
function encodeEqSpectrum(levels){
 if(!Array.isArray(levels)&&!(levels instanceof Uint8Array))throw new TypeError('Expected 14 spectrum levels');
 if(levels.length!==BAND_COUNT)throw new RangeError('Expected 14 spectrum levels');
 for(let i=0;i<BAND_COUNT;i++)if(!Number.isInteger(levels[i])||levels[i]<0||levels[i]>255)throw new RangeError('Spectrum levels must be integers from 0 to 255');
 const command=Buffer.alloc(20);command.set([8,0x26]);command.set(levels,2);return command;
}
module.exports={BAND_COUNT,encodeEqSpectrum};
