const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('../../.tts-tools/node_modules/jsdom');
(async()=>{
 const dom=new JSDOM('<button id="muteBtn">🔊</button><div class="pill">下一步</div>',{runScripts:'outside-only'}),w=dom.window;
 const players=[];w.LESSON_AUDIO={'测试':'narration/audio/test.mp3','新一句':'narration/audio/new.mp3'};
 w.Audio=class{constructor(src){this.src=src;players.push(this);}play(){return Promise.resolve();}pause(){this.paused=true;}};
 w.eval(fs.readFileSync(path.join(__dirname,'../player.js'),'utf8'));
 w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 const n=w.LessonNarrator;n.say('测试');assert.equal(players[0].src,'narration/audio/test.mp3');
 const stale=players[0].onerror;n.say('新一句');assert(players[0].paused);stale();assert(!w.document.querySelector('[role="status"]').textContent);
 w.document.querySelector('#muteBtn').click();assert(players[1].paused);
 w.document.querySelector('#muteBtn').textContent='🔇';n.say('测试');assert.equal(players.length,2);
 w.document.querySelector('#muteBtn').textContent='🔊';n.say('新一句');
 w.document.querySelector('.pill').click();assert(players[2].paused);
 n.say('测试');w.dispatchEvent(new w.Event('pagehide'));assert(players[3].paused);
 n.say('测试');players[4].onerror();assert(w.document.querySelector('[role="status"]').textContent.includes('没读出来'));
 // Queued fragments stop as one utterance; stale ended events cannot restart an old queue.
 w.NarrationResolver={resolve:()=>['a.mp3','b.mp3','c.mp3']};
 const base=players.length;n.say('动态句子');const oldEnd=players[base].onended;
 assert.equal(players.length,base+3);assert.equal(players[base+1].preload,'auto');
 players[base].onended();assert.equal(players[base].src,'b.mp3');
 n.stop();assert(players[base].paused);oldEnd();assert.equal(players[base+2].onended,undefined);
 n.say('动态句子');const before=players.length;n.say('新的动态句子');
 assert(players[before-3].paused);w.document.querySelector('#muteBtn').click();assert(players[before].paused);
 dom.window.close();console.log('Player: replace, stale errors, mute, navigation, pagehide and failure feedback passed.');
})();
