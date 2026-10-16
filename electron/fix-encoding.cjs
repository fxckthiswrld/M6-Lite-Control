const fs=require('node:fs');
const replacements={
  'âŒ‚':String.fromCodePoint(0x2302),'âŒ':String.fromCodePoint(0x2301),'âŒ˜':String.fromCodePoint(0x2318),'â˜¼':String.fromCodePoint(0x263c),'âš™':String.fromCodePoint(0x2699),
  'Â·':String.fromCodePoint(0xb7),'â†’':String.fromCodePoint(0x2192),'â–¦':String.fromCodePoint(0x25a6),'â€”':String.fromCodePoint(0x2014),'â€“':String.fromCodePoint(0x2013),
  'âˆ’':String.fromCodePoint(0x2212),'Ã—':String.fromCodePoint(0xd7),'Â':'','âœ“':String.fromCodePoint(0x2713),'âš ':String.fromCodePoint(0x26a0)
};
for(const file of ['ui.jsx','renderer.js','ui-bridge.js','key-tester.js']){
  const path=__dirname+'/'+file;let text=fs.readFileSync(path,'utf8');
  for(const [bad,good] of Object.entries(replacements))text=text.split(bad).join(good);
  fs.writeFileSync(path,text,'utf8');
}
