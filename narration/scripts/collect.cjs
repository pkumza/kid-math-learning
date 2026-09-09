const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const {JSDOM,VirtualConsole}=require('../../.tts-tools/node_modules/jsdom');
const acorn=require('../../.tts-tools/node_modules/acorn');
const ROOT=path.resolve(__dirname,'../..');
const index=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const levels=[...index.matchAll(/<a class="stop[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map(m=>({file:m[1],number:Number(m[2].match(/<div class="num">(\d+)<\/div>/)?.[1])})).filter(l=>l.number>0).sort((a,b)=>a.number-b.number);
const resolveOnly=process.argv.includes('--resolve-only');
const checkMode=process.argv.includes('--check')||resolveOnly;
const previous=new Map((fs.existsSync(path.join(ROOT,'narration/script.json'))?JSON.parse(fs.readFileSync(path.join(ROOT,'narration/script.json'),'utf8')):[]).map(c=>[c.text,c.spokenText]));
const catalog=new Map(),report=[],audit=[];
function walk(n,fn){if(!n||typeof n!=='object')return;fn(n);for(const [k,v] of Object.entries(n)){if(k==='start'||k==='end')continue;if(Array.isArray(v))v.forEach(x=>walk(x,fn));else if(v&&typeof v==='object')walk(v,fn);}}
function patch(source,statics){const edits=[];walk(acorn.parse(source,{ecmaVersion:'latest'}),n=>{
 if(n.type==='FunctionDeclaration'&&n.id.name==='say') edits.push({a:n.body.start,b:n.body.end,text:checkMode?' { window.__capture('+n.params[0].name+'); '+source.slice(n.body.start+1,n.body.end-1)+' }':'{ if(!muted) window.__capture('+n.params[0].name+'); }'});
 if(n.type==='CallExpression'&&n.callee.name==='say'&&n.arguments[0]?.type==='Literal'&&typeof n.arguments[0].value==='string')statics.push(n.arguments[0].value);
});for(const edit of edits.sort((a,b)=>b.a-a.a))source=source.slice(0,edit.a)+edit.text+source.slice(edit.b);return source;}
for(const level of levels){
 const texts=new Set(),statics=[],errors=[],timers=[];
 const add=t=>{if(typeof t==='string'&&t.trim())texts.add(t);};
 let html=fs.readFileSync(path.join(ROOT,level.file),'utf8');
 html=html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/g,(_,attrs,body)=>{const src=attrs.match(/src="([^"]+)"/);if(src){if(resolveOnly&&['narration/manifest.js','narration/parts.js'].includes(src[1])){const isPart=src[1].includes('parts');const rows=JSON.parse(fs.readFileSync(path.join(ROOT,'narration/'+(isPart?'parts':'script')+'.json')));return '<script>window.'+(isPart?'LESSON_AUDIO_PARTS':'LESSON_AUDIO')+'='+JSON.stringify(Object.fromEntries(rows.map(c=>[c.text,c.file])))+'</script>';}if(src[1].startsWith('narration/'))return checkMode?'<script>'+fs.readFileSync(path.join(ROOT,src[1]),'utf8')+'</script>':'';body=fs.readFileSync(path.join(ROOT,src[1]),'utf8');}return '<script>'+patch(body,statics)+'</script>';});
 const vc=new VirtualConsole();vc.on('jsdomError',e=>{if(e.type!=='not-implemented')errors.push(e.message);});
 const dom=new JSDOM(html,{runScripts:'dangerously',url:'http://local.test/'+encodeURI(level.file),virtualConsole:vc,beforeParse(w){
 w.__capture=add;w.__exhaustive=process.argv.includes('--exhaustive');w.__recordFinite=process.argv.includes('--record-finite');
 let randomSeed=level.number;w.Math.random=()=>{randomSeed=(Math.imul(randomSeed,1664525)+1013904223)>>>0;return randomSeed/4294967296;};w.Audio=class{constructor(src){if(!resolveOnly&&!fs.existsSync(path.join(ROOT,src)))throw Error('Missing MP3 '+src);}play(){return Promise.resolve();}pause(){}};w.scrollTo=()=>{};w.requestAnimationFrame=()=>0;
 let timerId=0;const alive=new Set();
 w.setTimeout=(fn)=>{const id=++timerId;alive.add(id);timers.push(()=>{if(alive.delete(id)&&typeof fn==='function')fn();});return id;};
 w.clearTimeout=id=>alive.delete(id);
 w.setInterval=(fn)=>{const id=++timerId;alive.add(id);const tick=()=>{if(!alive.has(id))return;fn();if(alive.has(id))timers.push(tick);};timers.push(tick);return id;};
 w.clearInterval=id=>alive.delete(id);
 w.speechSynthesis={getVoices:()=>[],cancel(){},speak(){throw Error('Uncaptured speech');}};
 w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>{}});
 }});
 const w=dom.window,d=w.document,click=el=>{if(el&&!el.disabled)el.click();};
 click(d.querySelector('#startBtn'));
 const cfg=w.LESSON_CONFIG;
 if(cfg){
  d.querySelectorAll('.reveal-card').forEach(click);click(d.querySelector('#toPractice'));
  for(const q of [...cfg.practice,...cfg.challenge]){
   const hint=d.querySelector('.hint-btn')||d.querySelector('#qHint button');click(hint);
   const opts=[...d.querySelectorAll('#options button')];
   if(!opts.length)throw Error('No question options '+level.file);
   click(opts.find(b=>b.textContent!==String(q.answer)));
   click(opts.find(b=>b.textContent===String(q.answer)));
   click(d.querySelector('#nextLevel'));
  }
 }else if(level.number<=50){
  require('./explore-early.cjs')({w,d,click,level,timers,add});
 }else{
  // Cover all finite exploration controls and both correct/incorrect choices.
  for(let pass=0;pass<3;pass++){
   [...d.querySelectorAll('button')].filter(b=>!['startBtn','toPractice','nextLevel','again','homeBtn','nextChapter','muteBtn'].includes(b.id)&&!b.classList.contains('pill')&&!b.classList.contains('opt')&&!b.closest('#done')).forEach(click);
  }
  if(level.number===69){if(w.eval('approxAns(MODES.mul)')!==80)throw Error('Multiplication estimate must keep multiplier 4');d.querySelectorAll('[data-mode]').forEach(b=>{click(b);click(d.querySelector('#revealBtn'));});}
  if(level.number===68){for(let r=2;r<=8;r++){const slider=d.querySelector('#slider');slider.value=r;slider.dispatchEvent(new w.Event('input'));click(d.querySelector('#magic'));}}
  w.eval('startPractice()');
  const qs=w.eval('typeof LEVELS!=="undefined"?LEVELS:PROB');
  for(let i=0;i<qs.length;i++){
   w.eval(`pi=${i};answered=false;renderLevel()`);
   click(d.querySelector('#qHint button'));
   const opts=[...d.querySelectorAll('#options button')], ans=String(qs[i].ans??qs[i].approx);
   click(opts.find(b=>b.textContent!==ans));click(opts.find(b=>b.textContent===ans));
  }
  w.eval('finish()');
 }
 click(d.querySelector('#again'));
 for(const fn of timers.splice(0)){if(typeof fn==='function')fn();}
 statics.forEach(add);
 if(checkMode){for(const text of texts){const sources=w.LessonNarrator?.resolve(text);if(!sources)throw Error('Missing narration: '+level.file+' '+text);audit.push({level:level.number,text,sources});}}
 if(errors.length)throw Error(level.file+': '+errors.join('\n'));
 for(const text of texts){if(!catalog.has(text))catalog.set(text,{text,spokenText:previous.get(text),levels:[],file:'narration/audio/'+crypto.createHash('sha256').update(text).digest('hex').slice(0,20)+'.mp3'});catalog.get(text).levels.push(level.number);}
 report.push({...level,clips:texts.size});console.log(level.number,level.file,texts.size);
 dom.window.close();
}
if(!checkMode) fs.writeFileSync(path.join(ROOT,'narration/script.json'),JSON.stringify([...catalog.values()],null,2)+'\n');
if(!checkMode) fs.writeFileSync(path.join(ROOT,'narration/coverage.json'),JSON.stringify(report,null,2)+'\n');
console.log('Unique clips:',catalog.size);

if(checkMode)fs.writeFileSync(path.join(ROOT,'narration/coverage-audit.json'),JSON.stringify({exhaustive:process.argv.includes('--exhaustive'),utterances:audit.length,records:audit},null,2)+'\n');
