const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const dir = path.resolve(__dirname, '..');
const ctx = {window:{}};
vm.runInNewContext(fs.readFileSync(path.join(dir,'audio/manifest.js'),'utf8'),ctx);
const clips = JSON.parse(fs.readFileSync(path.join(dir,'audio/script.json'),'utf8'));
assert.equal(Object.keys(ctx.window.FOREST_AUDIO).length, clips.length);
let total = 0;
for (const clip of clips) {
  assert(['rabbit','squirrel','cat','bear','bus','picnic'].includes(clip.lesson));
  assert.equal(ctx.window.FOREST_AUDIO[clip.text], clip.file);
  const file = path.join(dir,clip.file);
  const info = JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_name,sample_rate,channels','-of','json',file],{encoding:'utf8'}));
  assert.equal(info.streams[0].codec_name,'mp3');
  assert.equal(info.streams[0].channels,1);
  const seconds = Number(info.format.duration); assert(seconds > .3 && seconds < 60);
  execFileSync('ffmpeg',['-v','error','-i',file,'-f','null','-']);
  total += seconds;
}
for (const title of ['兔兔菜摊','松鼠仓库','小猫打包屋','小熊点心屋','森林小巴','动物野餐']) {
  assert(fs.readFileSync(path.join(dir,title+'.html'),'utf8').includes('audio/manifest.js'));
}
console.log(`${clips.length} 段配音全部可解码，时长合计 ${Math.round(total)} 秒；全部六关入口已接入。`);
