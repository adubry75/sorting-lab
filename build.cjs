const fs=require('node:fs');const path=require('node:path');
let html=fs.readFileSync(path.join(__dirname,'page.html'),'utf8');
for(const [token,file] of [['STYLES','style.css'],['LICENSE','LICENSE'],['ENGINE','engine.js'],['AUDIO','audio.js'],['APP','app.js']])html=html.replace('/*'+token+'*/',()=>fs.readFileSync(path.join(__dirname,file),'utf8'));
fs.mkdirSync(path.join(__dirname,'dist'),{recursive:true});fs.writeFileSync(path.join(__dirname,'dist/index.html'),html);
fs.writeFileSync(path.join(__dirname,'index.html'),html);
console.log('Built dist/index.html — standalone, no external dependencies.');
