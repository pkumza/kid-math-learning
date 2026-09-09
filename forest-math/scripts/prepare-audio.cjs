const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const dir = path.resolve(__dirname, '..');
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(dir, 'lessons.js'), 'utf8'), ctx);
const clips = new Map();
for (const lesson of ctx.window.FOREST_LESSONS) {
  function add(text) {
    if (!clips.has(text)) clips.set(text, { text, lesson: lesson.id, file: `audio/${crypto.createHash('sha256').update(text).digest('hex').slice(0, 16)}.mp3` });
  }
  add(lesson.intro + lesson.explore.lead); add(lesson.explore.hint); add(lesson.done.speech);
  for (const q of [...lesson.practice, ...lesson.challenge]) {
    q.story.forEach(c => add(c.text));
    add(q.story[q.story.length - 1].text + q.q);
    add(q.q); add(q.successSpeech); add(q.hint); q.hints.forEach(add);
  }
}
fs.writeFileSync(path.join(dir, 'audio', 'script.json'), JSON.stringify([...clips.values()], null, 2) + '\n');
console.log(`森林六关共 ${clips.size} 段配音。`);
