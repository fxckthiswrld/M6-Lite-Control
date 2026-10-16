'use strict';
const fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
const {HeAdapter}=require('./he-adapter');
const root=path.resolve(__dirname,'../backups');
const backup=path.join(root,'lighting-full-'+randomUUID());fs.mkdirSync(backup,{recursive:true});
new HeAdapter(root).transaction(device=>{for(const kind of [1,2,4,24,25,26,6,7,9,17])fs.writeFileSync(path.join(backup,`init-${kind}.bin`),device.readInit(kind));});
console.log(backup);
