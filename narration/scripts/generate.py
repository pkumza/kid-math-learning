"""Offline Kokoro voice A. Atomic clips; publish manifests only after every worker succeeds."""
import os,json,re,subprocess,time,sys,argparse
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
os.environ.setdefault('HF_HOME',str(ROOT/'.tts-cache/huggingface'))
os.environ.setdefault('HF_HUB_OFFLINE','1')

def read_letters(value):
    if value=='Boss':return '大挑战'
    letters={'A':'诶','B':'比','C':'西','L':'艾尔','O':'欧'}
    compact=re.sub(r'\s+','',value)
    return '，'.join(letters[c] for c in compact) if compact and all(c in letters for c in compact) else ''

def spoken(text):
    text=re.sub(r'[A-Za-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]+(?:\s+[A-Za-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]+)*',lambda m:read_letters(m[0]),text)
    text=re.sub(r'(\d+)\s*/\s*(\d+)',lambda m:m[2]+'分之'+m[1],text)
    symbols={'□':'空格','⭕':'圆形','🔷':'菱形','🔺':'三角形','⭐':'星星','🌙':'月亮','🍎':'苹果','🍐':'梨','🍓':'草莓','🍇':'葡萄','🍌':'香蕉','🐰':'兔子','🐻':'熊','🟡':'圆形','🧺':'','🎉':'','×':'乘以','÷':'除以','+':'加','−':'减','-':'减','=':'等于','→':'，','?':'多少'}
    for key,value in symbols.items():text=text.replace(key,value)
    return re.sub(r'\s+',' ',text).strip()

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--workers',type=int,default=4);parser.add_argument('--worker',type=int)
    args=parser.parse_args()
    full=json.loads((ROOT/'narration/script.json').read_text());parts=json.loads((ROOT/'narration/parts.json').read_text());clips=full+parts
    if args.worker is None:
        workers=[subprocess.Popen([sys.executable,__file__,'--workers',str(args.workers),'--worker',str(i)]) for i in range(args.workers)]
        try: codes=[p.wait() for p in workers]
        except BaseException:
            for p in workers:p.terminate()
            for p in workers:p.wait()
            raise
        if any(codes):raise RuntimeError('Generation worker failed: '+str(codes))
        for c in clips:
            if not (ROOT/c['file']).is_file():raise RuntimeError('Missing output: '+c['file'])
            c['spokenText']=spoken(c['text'])
            if c.get('fragment'):c['audioVersion']='trim-edges-v2'
        for name,rows,global_name in [('script',full,'LESSON_AUDIO'),('parts',parts,'LESSON_AUDIO_PARTS')]:
            (ROOT/f'narration/{name}.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
            output=ROOT/('narration/manifest.js' if name=='script' else 'narration/parts.js')
            temporary=output.with_suffix('.tmp.js');temporary.write_text('window.'+global_name+' = '+json.dumps({c['text']:c['file'] for c in rows},ensure_ascii=False,indent=2)+';\n');temporary.replace(output)
        print(f'All {len(clips)} clips ready. Manifests published.',flush=True)
        return
    import numpy as np
    import soundfile as sf
    import torch
    from kokoro import KPipeline
    torch.set_num_threads(3)
    pipe=KPipeline(lang_code='z',repo_id='hexgrad/Kokoro-82M-v1.1-zh',device='cpu')
    rows=clips[args.worker::args.workers];started=time.time()
    for i,c in enumerate(rows):
        output=ROOT/c['file'];text=spoken(c['text']);previous=c.get('spokenText')
        if not output.exists() or (previous is not None and previous!=text) or (c.get('fragment') and c.get('audioVersion')!='trim-edges-v2'):
            chunks=[]
            for sentence in re.split(r'(?<=[。！？；])',text):
                if not sentence.strip():continue
                for result in pipe(sentence,voice='zf_001',speed=.9):chunks.extend([result.audio.numpy(),np.zeros(3600)])
            if not chunks:raise RuntimeError('No audio: '+text)
            audio=np.concatenate([np.zeros(1800),*chunks])
            if not np.isfinite(audio).all() or np.max(np.abs(audio))<.001:raise RuntimeError('Invalid audio: '+text)
            wav=output.with_suffix('.wav');temp=output.with_suffix('.tmp.mp3');sf.write(wav,audio,24000)
            filters=['-af','silenceremove=start_periods=1:start_duration=0.01:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_duration=0.01:start_threshold=-50dB,areverse'] if c.get('fragment') else []
            subprocess.run(['ffmpeg','-v','error','-y','-i',str(wav),*filters,'-codec:a','libmp3lame','-q:a','3',str(temp)],check=True)
            temp.replace(output);wav.unlink()
        if (i+1)%100==0 or i+1==len(rows):print(f'Worker {args.worker+1}: {i+1}/{len(rows)} | {time.time()-started:.0f}s',flush=True)
if __name__=='__main__':main()
