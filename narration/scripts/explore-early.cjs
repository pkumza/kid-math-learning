/* Execute the original handlers in jsdom; captures narration, not a browser test. */
module.exports = ({w,d,click,level,timers,add}) => {
 const flush=()=>{for(let n=0;timers.length&&n<100;n++){const jobs=timers.splice(0);for(const f of jobs)if(typeof f==='function')f();}};
 const evaluate=code=>w.eval(code);
 const controls=()=>[...d.querySelectorAll('button')].filter(b=>!['startBtn','toPractice','nextLevel','again','homeBtn','nextChapter','muteBtn'].includes(b.id)&&!b.classList.contains('pill')&&!b.classList.contains('opt')&&!b.closest('#practice,#done'));
 for(let pass=0;pass<4;pass++){for(const b of controls()){click(b);flush();}}
 for(const input of d.querySelectorAll('input[type=range],select')){
  const values=input.tagName==='SELECT'?[...input.options].map(o=>o.value):Array.from({length:Math.min(150,Math.floor((Number(input.max||100)-Number(input.min||0))/Number(input.step||1))+1)},(_,i)=>Number(input.min||0)+i*Number(input.step||1));
  for(const v of values){input.value=v;input.dispatchEvent(new w.Event('input'));input.dispatchEvent(new w.Event('change'));flush();}
 }
 // Static data also includes alternatives that random demonstrations do not always draw.
 for(const name of ['SCENES','SHAPES','MOMENTS','EX','RULES','MODES']){
  const data=evaluate(`typeof ${name}==='undefined'?null:${name}`);
  function visit(v){if(!v||typeof v!=='object')return;for(const [k,x] of Object.entries(v)){if(['voice','say','intro','sayQ','sayWin','hint','reveal'].includes(k)&&typeof x==='string')add(x);else visit(x);}}
  visit(data);
 }
 if(w.__exhaustive||(w.__recordFinite&&![10,15,26,28,30].includes(level.number)))require('./explore-all-states.cjs')({w,d,click,flush,evaluate,level});
 evaluate('startPractice()');flush();
 const groups=evaluate(`typeof BASIC!=='undefined'?[{phase:'basic',qs:BASIC},{phase:'chal',qs:CHAL}]:[{qs:typeof LEVELS!=='undefined'?LEVELS:typeof PROB!=='undefined'?PROB:typeof LV!=='undefined'?LV:[{},{},{}]}]`);
 for(const group of groups)for(let i=0;i<group.qs.length;i++){
  const q=group.qs[i];
  evaluate(`${group.phase?`phase='${group.phase}';`:''}pi=${i};answered=false;renderLevel()`);flush();
  click(d.querySelector('#qHint button'));flush();
  if(level.number===2){evaluate(`choosePair('${q.smart==='front'?'back':'front'}');choosePair('${q.smart}')`);flush();}
  // Re-render for every option so success on an earlier option does not suppress other feedback.
  const opts=[...d.querySelectorAll('#options button')];
  for(let j=0;j<opts.length;j++){evaluate('answered=false');opts[j].disabled=false;click(opts[j]);flush();}
  if(level.number===11&&i===2){for(const b of d.querySelectorAll('.shape-box.pick')){evaluate('answered=false');click(b);flush();}}
 }
 evaluate('finish()');flush();
};
