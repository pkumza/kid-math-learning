/* 无依赖核验：node forest-math/verify.cjs */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const dir = __dirname;
let checks = 0;
function test(name, run) { run(); checks++; console.log('✓ ' + name); }
function boot({ raw, blocked = false, noChinese = false, file = false, hash = '', recorded = false } = {}) {
  let stored = raw; const spoken = [], events = [];
  const window = { dispatchEvent: e => events.push(e) };
  const localStorage = {
    getItem() { if (blocked) throw new Error('blocked'); return stored || null; },
    setItem(key, value) { if (blocked) throw new Error('blocked'); assert.equal(key, 'forest-math:v1'); stored = value; }
  };
  const speechSynthesis = { getVoices: () => [{ lang: noChinese ? 'en-US' : 'zh-CN' }], cancel() {}, speak: u => spoken.push(u) };
  class SpeechSynthesisUtterance { constructor(text) { this.text = text; } }
  class CustomEvent { constructor(type) { this.type = type; } }
  const players = [];
  if (recorded) {
    window.FOREST_AUDIO = { '测试配音': 'audio/test.mp3' };
    window.Audio = class { constructor(src) { this.src = src; players.push(this); } play() { this.played = true; return { catch() {} }; } pause() { this.paused = true; } };
  }
  Object.assign(window, { speechSynthesis, SpeechSynthesisUtterance });
  const context = vm.createContext({ window, localStorage, speechSynthesis, SpeechSynthesisUtterance, CustomEvent, location: { protocol: file ? 'file:' : 'http:', hash } });
  for (const file of ['lessons.js', 'core.js']) vm.runInContext(fs.readFileSync(path.join(dir, file), 'utf8'), context, { filename: file });
  return { F: window.Forest, lessons: window.FOREST_LESSONS, stored: () => stored, spoken, events, window, players };
}
test('本地配音优先，重听/静音中止旧音频，迟到的错误不干扰新音频', () => {
  const b = boot({ recorded: true });
  assert(b.F.speak('测试配音').ok); assert.equal(b.spoken.length, 0);
  assert.equal(b.players[0].src, 'audio/test.mp3');
  const staleError = b.players[0].onerror;
  b.F.speak('测试配音'); assert(b.players[0].paused);
  staleError(); assert.equal(b.events.length, 0);
  b.players[1].onerror(); assert.equal(b.events.length, 1);
  b.F.speak('测试配音'); b.F.toggleSound(); assert(b.players[2].paused);
  assert.equal(b.F.speak('测试配音').reason, 'muted'); assert.equal(b.players.length, 3);
});
const { F, lessons } = boot();
test('6 关、24 道基础题、7 道挑战题；第 6 关为困难关', () => {
  assert.equal(lessons.length, 6);
  assert.equal(lessons.flatMap(l => l.practice).length, 24);
  assert.equal(lessons.flatMap(l => l.challenge).length, 7);
  assert.equal(lessons[5].hard, true);
  for (const l of lessons) { assert.equal(l.practice.length, 4); assert.ok(l.challenge.length >= 1 && l.challenge.length <= 2); assert.ok(l.explore.hint); }
});
const expected = [5,5,25,120,35, 5,5,1,20,11, 10,30,3,80,70, 7,7,30,85,45, 7,5,3,8,9, 4,12,40,12,5,60];
let offset = 0;
for (const l of lessons) for (const q of [...l.practice, ...l.challenge]) {
  const expectedAnswer = expected[offset++];
  test(l.title + ' ' + q.id + '：答案、题目结构与操作范围', () => {
    assert.equal(Number(q.answer), expectedAnswer);
    assert.equal(F.evaluate(q.math), expectedAnswer);
    assert.ok(q.q && q.hint && q.hints.length && q.solution);
    assert.ok(q.story.length >= 1 && q.story.length <= 4);
    assert.ok(['number', 'place', 'choice'].includes(q.mode));
    assert.equal(F.checkAnswer(q, q.answer), true);
    assert.equal(F.checkAnswer(q, ''), false);
    assert.equal(F.checkAnswer(q, String(Number(q.answer) + 1)), false);
    if (q.mode === 'place') assert.ok(Number(q.answer) >= 0 && Number(q.answer) <= q.max);
    if (q.mode === 'choice') {
      assert.equal(q.options.filter(o => o.value === q.answer).length, 1);
      assert.equal(new Set(q.options.map(o => o.value)).size, q.options.length);
      for (const o of q.options) if (o.value !== q.answer) assert.ok(o.reason);
    }
    for (const c of q.story) {
      assert.ok(c.text && c.label && c.visual);
      if ('amount' in c.visual && c.visual.amount !== null) {
        assert.ok(Number.isInteger(c.visual.amount) && c.visual.amount >= 0);
        const p = F.packages(c.visual.amount);
        assert.equal(p.hundreds * 100 + p.tens * 10 + p.singles, c.visual.amount);
      }
    }
  });
}
test('31 道题的 id 不重复', () => { const ids = lessons.flatMap(l => [...l.practice, ...l.challenge]).map(q => q.id); assert.equal(new Set(ids).size, 31); });
test('不能靠跳到挑战或完成页提前拿贴纸', () => {
  const l = lessons[0];
  assert.equal(F.isComplete(l, F.progress(l.id)), false);
  F.current(l.id, 'done', 0);
  F.solve(l.id, l.challenge[0].id);
  assert.equal(F.isComplete(l, F.progress(l.id)), false);
  for (const q of l.practice) F.solve(l.id, q.id);
  assert.equal(F.isComplete(l, F.progress(l.id)), false);
  F.explore(l.id);
  assert.equal(F.isComplete(l, F.progress(l.id)), true);
  F.solve(l.id, l.practice[0].id);
  assert.equal(F.progress(l.id).solved.length, 5);
});
test('刷新恢复进度、位置、声音偏好，重玩不重复累计', () => {
  const one = boot(); const l = one.lessons[1];
  one.F.explore(l.id); one.F.solve(l.id, 's1'); one.F.current(l.id, 'practice', 1); one.F.toggleSound();
  const two = boot({ raw: one.stored() });
  assert.equal(two.F.progress(l.id).phase, 'practice'); assert.equal(two.F.progress(l.id).index, 1);
  assert.equal(two.F.progress(l.id).solved.join(','), 's1'); assert.equal(two.F.state.sound, false);
});
test('损坏、旧版本及越界存档恢复为可用状态', () => {
  const broken = boot({ raw: '{broken' }); assert.equal(broken.F.state.version, 1);
  const old = boot({ raw: '{"version":0}' }); assert.equal(old.F.state.last, null);
  const bad = boot({ raw: JSON.stringify({ version: 1, last: 'missing', lessons: { rabbit: { explored: true, solved: ['r1', 'r1', 'unknown'], phase: 'practice', index: 999 }, cat: { solved: [], phase: 'done' } } }) });
  assert.equal(bad.F.progress('rabbit').solved.length, 1); assert.equal(bad.F.progress('rabbit').index, 3);
  assert.equal(bad.F.progress('cat').phase, 'explore'); assert.equal(bad.F.state.last, null);
});
test('localStorage 不可用，仍可答题并保存本次内存进度', () => {
  const b = boot({ blocked: true }); assert.equal(b.F.storageAvailable, false);
  b.F.solve('rabbit', 'r1'); assert.equal(b.F.progress('rabbit').solved[0], 'r1');
});
test('直接打开 HTML：内部页面即使存储隔离，也能携带并合并进度', () => {
  const a = boot({ file: true }); a.F.explore('rabbit'); a.F.solve('rabbit', 'r1'); a.F.current('rabbit', 'practice', 1);
  const link = a.F.withProgress('index.html'); assert.ok(link.startsWith('index.html#fm='));
  const b = boot({ file: true, hash: link.slice(link.indexOf('#')) });
  assert.equal(b.F.progress('rabbit').solved.join(','), 'r1'); assert.equal(b.F.progress('rabbit').index, 1);
  b.F.solve('squirrel','s1');
  const back = b.F.withProgress('兔兔菜摊.html');
  const c = boot({ file: true, raw: a.stored(), hash: back.slice(back.indexOf('#')) });
  assert.equal(c.F.progress('rabbit').solved.join(','), 'r1'); assert.equal(c.F.progress('squirrel').solved.join(','), 's1');
  assert.equal(c.F.withProgress('../index.html'), '../index.html'); assert.equal(c.F.withProgress('https://example.com'), 'https://example.com');
  assert.equal(boot().F.withProgress('index.html'), 'index.html');
});
test('较旧或损坏的本地地址片段不会覆盖新进度', () => {
  const local = {version:1,updatedAt:200,last:'rabbit',sound:false,lessons:{rabbit:{explored:true,solved:['r1','r2'],phase:'practice',index:2}}};
  const incoming = {version:1,updatedAt:100,last:'rabbit',sound:true,lessons:{rabbit:{explored:true,solved:['r1'],phase:'practice',index:0}}};
  const b = boot({file:true,raw:JSON.stringify(local),hash:'#fm='+encodeURIComponent(JSON.stringify(incoming))});
  assert.equal(b.F.progress('rabbit').index,2); assert.equal(b.F.progress('rabbit').solved.length,2); assert.equal(b.F.state.sound,false);
  const bad = boot({file:true,raw:JSON.stringify(local),hash:'#fm=%broken'}); assert.equal(bad.F.progress('rabbit').solved.length,2);
});
test('缺少配音时保留文字；静音或缺少文件不调用系统语音', () => {
  const b = boot({ audio: true }); assert.equal(b.spoken.length, 0);
  assert.equal(b.F.speak('未收录的句子').reason, 'unavailable'); assert.equal(b.spoken.length, 0);
  b.F.toggleSound(); assert.equal(b.F.speak('不应播放').reason, 'muted'); assert.equal(b.spoken.length, 0);
  assert.equal(boot({ noChinese: true }).F.speak('中文').reason, 'unavailable');
});
test('0 到 200 的整箱散装图准确，大数量不生成满屏单个图标', () => {
  for (let n = 0; n <= 200; n++) { const p = F.packages(n); assert.equal(p.hundreds*100+p.tens*10+p.singles, n); assert.ok(p.singles <= 12); }
  assert.ok(F.objects(null).includes('数量未知'));
  assert.equal((F.objects(150).match(/class="package"/g) || []).length, 6);
});
test('本地文件入口、脚本、样式、图片均存在，不依赖网络模块', () => {
  for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.html'))) {
    const html = fs.readFileSync(path.join(dir, file), 'utf8');
    assert.ok(html.includes('lang="zh-CN"')); assert.ok(!html.includes('user-scalable=no'));
    for (const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
      const target = match[1]; if (/^(https?:|data:)/.test(target)) continue;
      assert.ok(fs.existsSync(path.resolve(dir, target)), file + ': ' + target);
    }
  }
  assert.ok(fs.existsSync(path.join(dir, 'assets/forest-village.png')));
  for (const file of ['lessons.js','core.js','game.js','home.js']) assert.ok(!/\bfetch\(|^import /m.test(fs.readFileSync(path.join(dir, file), 'utf8')));
});
test('旧首页所有已有入口、顺序和关卡进度统计保留', () => {
  const before = execFileSync('git', ['show', 'HEAD:index.html'], { cwd: path.dirname(dir), encoding: 'utf8' });
  const after = fs.readFileSync(path.join(dir, '../index.html'), 'utf8');
  const links = html => [...html.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map(m => m[1]);
  const oldLinks = links(before), newLinks = links(after).filter(l => l !== 'forest-math/index.html');
  assert.deepEqual(newLinks, oldLinks);
});
console.log(`\n${checks} 项核验通过。`);
