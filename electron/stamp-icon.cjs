const pkg=require('./package.json');
require('rcedit').rcedit(process.argv[2],{icon:require('path').join(__dirname,'logo256.ico'),
  'file-version':`${pkg.version}.0`,'product-version':`${pkg.version}.0`,
  'version-string':{
    ProductName:'M6 Lite Control',FileDescription:'M6 Lite Control',CompanyName:'M.M Studio',
    InternalName:'M6LiteControl',OriginalFilename:'M6 Lite Control.exe',FileVersion:pkg.version,ProductVersion:pkg.version
  }
}).catch(error=>{console.error(error);process.exitCode=1;});
