const fs=require('node:fs'),path=require('node:path');
const acorn=require('../../.tts-tools/node_modules/acorn');
const ROOT=path.resolve(__dirname,'../..');
const levels=[{number:0,file:'index.html'},...JSON.parse(fs.readFileSync(path.join(ROOT,'narration/coverage.json')))];
function walk(n,fn){if(!n||typeof n!=='object')return;fn(n);for(const v of Object.values(n)){if(Array.isArray(v))v.forEach(x=>walk(x,fn));else if(v&&typeof v==='object')walk(v,fn);}}
function patch(source){
 const edits=[];walk(acorn.parse(source,{ecmaVersion:'latest'}),n=>{
  if(n.type==='FunctionDeclaration'&&n.id.name==='say')edits.push({at:n.body.start,end:n.body.end,text:`{ if(!muted && window.LessonNarrator) window.LessonNarrator.say(${n.params[0].name}); }`});
  if(n.type==='FunctionDeclaration'&&n.id.name==='show'&&!source.slice(n.body.start,n.body.end).includes('LessonNarrator'))edits.push({at:n.body.start+1,text:'if(window.LessonNarrator)window.LessonNarrator.stop();'});
 });
 for(const e of edits.sort((a,b)=>b.at-a.at))source=source.slice(0,e.at)+e.text+source.slice(e.end??e.at);
 return source;
}
for(const f of ['lesson-engine.js','lesson-batch-61-66.js']){const p=path.join(ROOT,f);fs.writeFileSync(p,patch(fs.readFileSync(p,'utf8')));}
for(const level of levels){
 const p=path.join(ROOT,level.file);let html=fs.readFileSync(p,'utf8');
 html=html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/g,(all,attrs,body)=>attrs.includes('src=')?all:`<script${attrs}>${patch(body)}</script>`);
 if(!html.includes('narration/player.js'))html=html.replace('</head>','<script src="narration/manifest.js"></script>\n<script src="narration/player.js"></script>\n</head>');
 if(!html.includes('narration/resolver.js'))html=html.replace('<script src="narration/player.js">','<script src="narration/parts.js"></script>\n<script src="narration/resolver.js"></script>\n<script src="narration/player.js">');
 fs.writeFileSync(p,html);
}
console.log('Narration hooks installed in all 80 lessons and homepage.');
