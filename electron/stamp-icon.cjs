require('rcedit').rcedit(process.argv[2],{icon:require('path').join(__dirname,'logo256.ico'),
  'version-string':{
    ProductName:'M6 Lite Control',FileDescription:'M6 Lite Control',CompanyName:'M.M Studio',
    InternalName:'M6LiteControl',OriginalFilename:'M6 Lite Control.exe',ProductVersion:'0.10.2'
  }
}).catch(error=>{console.error(error);process.exitCode=1;});
