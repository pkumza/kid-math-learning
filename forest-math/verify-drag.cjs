// Exercise the real event handlers without a browser; geometry is a controlled stub.
const vm = require('node:vm');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const events = {}, winEvents = {};
function node(dataset = {}) {
  const classes = new Set();
  return { dataset, innerHTML: '', style: {}, disabled: false, textContent: '🌰',
    classList: { add: x => classes.add(x), remove: x => classes.delete(x), toggle: (x, on) => on ? classes.add(x) : classes.delete(x), contains: x => classes.has(x) },
    setAttribute() {}, removeAttribute() {}, focus() {}, remove() { this.removed = true; },
    setPointerCapture(id) { this.capture = id; }, hasPointerCapture(id) { return this.capture === id; }, releasePointerCapture() { this.capture = null; },
    closest(selector) { return selector === '[data-drop]' ? (dataset.drop ? this : null) : this; }
  };
}
const source = node({ drop: 'source' }), target = node({ drop: 'target' });
const elements = Object.fromEntries(['app','playCard','answerSection','soundButton','voiceMessage','storageWarning'].map(id => [id, node()]));
elements.app.addEventListener = (name, fn) => events[name] = fn;
elements.playCard.contains = el => el === source || el === target;
elements.playCard.querySelector = selector => selector.startsWith('[data-drop=') ? (selector.includes('target') ? target : source) : null;
elements.playCard.querySelectorAll = () => [source, target];
let hit = target, ghost;
const q = { id:'test', mode:'place', max:12, icon:'🌰', unit:'颗', q:'一袋几颗？', story:[{text:'两袋十颗', label:'两袋',visual:{text:'袋＋袋＝10'}}], hint:'分一分', answer:5, solution:'每袋五颗' };
const F = { escape:String, progress:() => ({phase:'practice',index:0,solved:[]}), state:{sound:false}, storageAvailable:true, current(){}, stopSpeech(){}, speak:()=>({ok:true}), objects:()=>'', checkAnswer:(_, a)=>Number(a)===5, solve(){} };
vm.runInNewContext(fs.readFileSync(__dirname+'/game.js','utf8'), { window:{Forest:F,LESSON_CONFIG:{id:'test',practice:[q],challenge:[q]},addEventListener:(n,f)=>winEvents[n]=f},document:{getElementById:id=>elements[id],querySelectorAll:()=>[],addEventListener(){},createElement:()=>ghost=node(),body:{append(){}},elementFromPoint:()=>hit},performance:{now:()=>100},AbortController });
function click(action, side, detail=0) { events.click({target:node({action,side}),detail,preventDefault(){}}); }
click('story-next');
function amount() { return Number((elements.answerSection.innerHTML || elements.playCard.innerHTML).match(/<span class="zone-amount">(\d+) 颗<\/span>/g)[1].match(/>(\d+)/)[1]); }
function start(side='source', id=1) { const item=node({side}); events.pointerdown({target:item,pointerId:id,isPrimary:true,button:0,clientX:10,clientY:10}); return item; }
function move(id=1) { events.pointermove({pointerId:id,clientX:100,clientY:100}); }
function end(id=1) { events.pointerup({pointerId:id,clientX:100,clientY:100,preventDefault(){}}); }
assert.equal(amount(),0);
let item=start(); move(); assert(target.classList.contains('drop-ready')); end(); assert.equal(amount(),1); assert(ghost.removed); assert.equal(item.capture,null);
click('place-item','source',1); assert.equal(amount(),1,'drag must not also click');
hit=source; start('target'); move(); end(); assert.equal(amount(),0,'reverse drag');
hit=null; start(); move(); end(); assert.equal(amount(),0,'outside drop');
hit=source; start(); move(); end(); assert.equal(amount(),0,'same tray drop');
hit=target; start(); move(); events.pointercancel({pointerId:1}); end(); assert.equal(amount(),0,'cancel does not transfer');
start(); move(); events.pointercancel({pointerId:2}); end(); assert.equal(amount(),1,'another finger cannot cancel the active drag');
start(); move(); winEvents.blur(); end(); assert.equal(amount(),1,'blur cancels');
start(); end(); click('place-item','source',1); assert.equal(amount(),2,'tap transfers once');
for(let i=0;i<20;i++) click('place-item','source'); assert.equal(amount(),12,'upper bound');
for(let i=0;i<20;i++) click('place-item','target'); assert.equal(amount(),0,'lower bound');
for(let i=0;i<5;i++) click('place-item','source'); click('submit');
click('place-item','source'); assert.equal(amount(),5,'solved answer is locked');
assert(elements.answerSection.innerHTML.includes('✓ 对上啦'));
console.log('拖拽事件核验通过：正向、反向、落空、同盘、取消、多指、失焦、轻点、防重复、边界和提交锁定。');
