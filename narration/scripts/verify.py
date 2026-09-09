import concurrent.futures,json,subprocess,re,importlib.util
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
full=json.loads((ROOT/'narration/script.json').read_text())
parts=json.loads((ROOT/'narration/parts.json').read_text())
clips=full+parts
spec=importlib.util.spec_from_file_location('generator',Path(__file__).with_name('generate.py'))
generator=importlib.util.module_from_spec(spec);spec.loader.exec_module(generator)
def verify(clip):
    assert clip.get('spokenText')==generator.spoken(clip['text']), clip['text']
    if clip.get('fragment'):assert clip.get('audioVersion')=='trim-edges-v2',clip['text']
    assert not re.search(r'[A-Za-z/×÷=+□⭕🔷🔺⭐−-]',clip['spokenText']),clip['spokenText']
    p=ROOT/clip['file']
    info=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration:stream=codec_name,channels,sample_rate','-of','json',str(p)]))
    stream=info['streams'][0];seconds=float(info['format']['duration'])
    assert stream['codec_name']=='mp3' and stream['channels']==1 and stream['sample_rate']=='24000',p
    assert (.08 if clip.get('fragment') else .3)<seconds<120,(p,seconds)
    subprocess.run(['ffmpeg','-v','error','-i',str(p),'-f','null','-'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
    return seconds,p.stat().st_size
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool: results=list(pool.map(verify,clips))
report={'clips':len(clips),'sentences':len(full),'fragments':len(parts),'seconds':round(sum(r[0] for r in results)), 'bytes':sum(r[1] for r in results),'voice':'zf_001','model':'Kokoro-82M-v1.1-zh','speed':.9,'format':'MP3 / 24000 Hz / mono'}
(ROOT/'narration/verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False))
