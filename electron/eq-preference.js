'use strict';
const fs=require('node:fs'),path=require('node:path');
class EqPreference {
 constructor(directory){this.file=path.join(directory,'eq-preference.json');}
 read(){try{return JSON.parse(fs.readFileSync(this.file,'utf8')).resume===true;}catch(error){if(error.code==='ENOENT'||error instanceof SyntaxError)return false;throw error;}}
 write(resume){if(typeof resume!=='boolean')throw Error('Expected EQ resume boolean');fs.mkdirSync(path.dirname(this.file),{recursive:true});const temp=this.file+'.tmp';fs.writeFileSync(temp,JSON.stringify({resume},null,2));fs.renameSync(temp,this.file);return resume;}
}
module.exports={EqPreference};
