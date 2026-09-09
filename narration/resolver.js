/* Offline recordings: whole sentences first, recorded phrases for changing numbers. */
(function(){
 'use strict';
 const digits='零一二三四五六七八九';
 function integer(value){
  let n=Number(value);if(!Number.isSafeInteger(n)||n<0)return null;
  if(n<10)return digits[n];
  function small(v){let s='',zero=false;for(let place=1000;place>=1;place/=10){const d=Math.floor(v/place)%10;if(d){if(zero)s+='零';s+=digits[d]+({1000:'千',100:'百',10:'十',1:''}[place]);zero=false;}else if(s&&v%place)zero=true;}return s;}
  function large(v){if(v<10000)return small(v);const unit=v>=100000000?100000000:10000;const hi=Math.floor(v/unit),lo=v%unit;return large(hi)+(unit===10000?'万':'亿')+(lo?(lo<unit/10?'零':'')+large(lo):'');}
  return large(n).replace(/^一十/,'十');
 }
 function number(raw){const [whole,decimal]=raw.split('.');const head=integer(whole);return head===null?'':head+(decimal?'点'+[...decimal].map(d=>digits[Number(d)]).join(''):'');}
 const symbols={'□':'空格','⭕':'圆形','🔷':'菱形','🔺':'三角形','⭐':'星星','🌙':'月亮','🍎':'苹果','🍐':'梨','🍓':'草莓','🍇':'葡萄','🍌':'香蕉','🐰':'兔子','🐻':'熊','🟡':'圆形','×':'乘以','÷':'除以','+':'加','−':'减','-':'减','=':'等于'};
 function canonical(text){
  return String(text).replace(/<[^>]*>/g,'').replace(/(\d+)\s*\/\s*(\d+)/g,(_,a,b)=>number(b)+'分之'+number(a))
   .replace(/[A-Za-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]+(?:\s+[A-Za-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]+)*/g,m=>{if(m==='Boss')return '大挑战';const letters={L:'艾尔',A:'诶',B:'比',C:'西',O:'欧'},chars=[...m.replace(/\s/g,'')];return chars.every(c=>letters[c])?chars.map(c=>letters[c]).join(''):'';})
   .replace(/□|⭕|🔷|🔺|⭐|🌙|🍎|🍐|🍓|🍇|🍌|🐰|🐻|🟡|×|÷|\+|−|-|=/gu,m=>symbols[m])
   .replace(/\d+(?:\.\d+)?/g,number).replace(/[^\p{Script=Han}]/gu,'');
 }
 let whole=null,parts=null,sourceFull=null,sourceParts=null;
 function prepare(){
  if(sourceFull===window.LESSON_AUDIO&&sourceParts===window.LESSON_AUDIO_PARTS)return;
  sourceFull=window.LESSON_AUDIO;sourceParts=window.LESSON_AUDIO_PARTS;
  whole=new Map();parts=new Map();
  for(const [t,file] of Object.entries(sourceFull||{}))whole.set(canonical(t),file);
  for(const [t,file] of Object.entries(sourceParts||{})){const key=canonical(t);if(!key)continue;const lead=key[0];if(!parts.has(lead))parts.set(lead,[]);parts.get(lead).push({key,file});}
  for(const list of parts.values())list.sort((a,b)=>b.key.length-a.key.length);
 }
 function resolve(text){
  prepare();if(sourceFull?.[text])return [sourceFull[text]];
  const key=canonical(text);if(!key)return [];
  if(whole.has(key))return [whole.get(key)];
  // Dynamic programming avoids a longest-prefix match stranding a later word.
  const paths=new Array(key.length+1);paths[key.length]=[];
  for(let i=key.length-1;i>=0;i--)for(const part of parts.get(key[i])||[]){
   const end=i+part.key.length;if(key.startsWith(part.key,i)&&paths[end]){
    const candidate=[part.file,...paths[end]];
    if(!paths[i]||candidate.length<paths[i].length)paths[i]=candidate;
   }
  }
  return paths[0]||null;
 }
 window.NarrationResolver={resolve,canonical,integer};
})();
