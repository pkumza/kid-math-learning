/* Reusable recorded phrases and numbers for exploration with changing values. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const acorn=require('../../.tts-tools/node_modules/acorn');
const ROOT=path.resolve(__dirname,'../..');
const clips=JSON.parse(fs.readFileSync(path.join(ROOT,'narration/script.json')));
const old=fs.existsSync(path.join(ROOT,'narration/parts.json'))?JSON.parse(fs.readFileSync(path.join(ROOT,'narration/parts.json'))):[];
const previous=new Map(old.map(c=>[c.text,c]));
const parts=new Map();
function clean(s){return s.replace(/<[^>]*>/g,'').replace(/[A-Za-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]+/g,'').replace(/[^\p{Script=Han}\d.×÷+−=□⭕🔷🔺⭐]/gu,'');}
function add(s){s=clean(s);if(!s||s.length>150)return;parts.set(s,{text:s,spokenText:previous.get(s)?.spokenText,audioVersion:previous.get(s)?.audioVersion,file:'narration/parts/'+crypto.createHash('sha256').update(s).digest('hex').slice(0,20)+'.mp3',fragment:true});}
function fragments(s){s=s.replace(/<[^>]*>/g,'');for(const fragment of s.split(/[\d\s。，、！？；：,.!?;:（）()“”「」…～]+/))if(/[\p{Script=Han}]/u.test(fragment))add(fragment);}
function walk(n){if(!n||typeof n!=='object')return;if(n.type==='Literal'&&typeof n.value==='string'&&/[\p{Script=Han}]/u.test(n.value))fragments(n.value);if(n.type==='TemplateElement')fragments(n.value.cooked||'');for(const v of Object.values(n)){if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v);}}
const levels=JSON.parse(fs.readFileSync(path.join(ROOT,'narration/coverage.json')));
for(const l of levels.filter(l=>l.number<=50))for(const m of fs.readFileSync(path.join(ROOT,l.file),'utf8').matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g))if(!m[1].includes('src='))walk(acorn.parse(m[2],{ecmaVersion:'latest'}));
for(const c of clips)fragments(c.text);
for(const s of ['零','一','二','三','四','五','六','七','八','九','十','百','千','万','亿','点','负','分之','乘以','除以','加','减','等于','空格','圆形','菱形','三角形','星星'])add(s);
const digits='零一二三四五六七八九';
for(const digit of digits.slice(1))for(const unit of ['百','千','万','亿'])add(digit+unit);
for(let n=10;n<100;n++)add((n>=20?digits[Math.floor(n/10)]:'')+'十'+(n%10?digits[n%10]:''));
fs.mkdirSync(path.join(ROOT,'narration/parts'),{recursive:true});
fs.writeFileSync(path.join(ROOT,'narration/parts.json'),JSON.stringify([...parts.values()],null,2)+'\n');
const greeting='欢迎来到运算王国！点一张卡片，开始冒险吧！';
if(!clips.some(c=>c.text===greeting))clips.push({text:greeting,levels:[0],file:'narration/audio/'+crypto.createHash('sha256').update(greeting).digest('hex').slice(0,20)+'.mp3'});
fs.writeFileSync(path.join(ROOT,'narration/script.json'),JSON.stringify(clips,null,2)+'\n');
console.log(clips.length+' full utterances; '+parts.size+' reusable phrases and numbers.');
