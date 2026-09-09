const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {JSDOM,VirtualConsole}=require('../../.tts-tools/node_modules/jsdom');
const dir=path.resolve(__dirname,'..');let checked=0;
for(let lessonIndex=0;lessonIndex<6;lessonIndex++){
 const errors=[],players=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM('<div id="app"></div>',{url:'http://local.test/forest-math/',runScripts:'outside-only',virtualConsole:vc}),w=dom.window,d=w.document;
 w.Audio=class{constructor(src){this.src=src;assert(fs.existsSync(path.join(dir,src)));}play(){players.push(this);return Promise.resolve();}pause(){this.paused=true;}};
 for(const file of ['lessons.js','audio/manifest.js','core.js'])w.eval(fs.readFileSync(path.join(dir,file),'utf8'));
 const lesson=w.FOREST_LESSONS[lessonIndex];w.LESSON_CONFIG=lesson;w.Forest.explore(lesson.id);w.Forest.current(lesson.id,'practice',0);
 w.eval(fs.readFileSync(path.join(dir,'game.js'),'utf8'));
 const click=selector=>{const b=d.querySelector(selector);assert(b,selector);assert(!b.disabled,selector);b.click();};
 function fill(q,value){if(q.mode==='choice')click(`[data-action="choice"][data-value="${value}"]`);else if(q.mode==='place'){for(let n=0;n<Number(value);n++)click('[data-action="place-item"][data-side="source"]');}else{click('[data-key="clear"]');for(const n of String(value))click(`[data-key="${n}"]`);}}
 for(const q of [...lesson.practice,...lesson.challenge]){
  assert(!d.querySelector('[data-action="feedback-replay"]'),'no answer replay before solving');
  for(const line of q.story)click('[data-action="story-next"]');
  const wrong=q.mode==='choice'?q.options.find(o=>o.value!==q.answer).value:0;
  fill(q,wrong);let before=players.length;click('[data-action="submit"]');assert.equal(players.length,before,'wrong answer must not play success');
  assert(!d.querySelector('[data-action="feedback-replay"]'));
  fill(q,q.answer);const muted=q.id==='r1';if(muted)click('#soundButton');
  before=players.length;click('[data-action="submit"]');assert.equal(players.length,before+(muted?0:1));
  if(!muted)assert.equal(players.at(-1).src,w.FOREST_AUDIO[q.successSpeech]);
  if(muted)click('#soundButton');
  click('[data-action="feedback-replay"]');assert.equal(players.at(-1).src,w.FOREST_AUDIO[q.successSpeech]);
  const success=players.at(-1);click('[data-action="next"]');assert(success.paused,'next stops previous answer audio');checked++;
 }
 assert.equal(players.at(-1).src,w.FOREST_AUDIO[lesson.done.speech]);assert(w.Forest.isComplete(lesson,w.Forest.progress(lesson.id)));
 assert.deepEqual(errors,[]);dom.window.close();
}
console.log(`${checked} correct answers and 6 completions: recorded audio, replay, wrong-answer isolation, mute and next-page cancellation passed.`);
