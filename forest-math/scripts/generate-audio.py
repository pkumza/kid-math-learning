"""Local Kokoro synthesis. Run from project root with .tts-venv/bin/python."""
import os, json, argparse, subprocess
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
os.environ.setdefault('HF_HOME', str(ROOT / '.tts-cache' / 'huggingface'))
os.environ.setdefault('HF_HUB_DISABLE_XET', '1')
os.environ.setdefault('NUMBA_CACHE_DIR', str(ROOT / '.tts-cache' / 'numba'))
import numpy as np
import soundfile as sf
import torch
from kokoro import KPipeline
parser = argparse.ArgumentParser()
parser.add_argument('--samples', action='store_true')
parser.add_argument('--voice', default='zf_001', choices=['zf_001', 'zm_010'])
args = parser.parse_args()
torch.set_num_threads(4)
base = ROOT / 'forest-math'
pipe = KPipeline(lang_code='z', repo_id='hexgrad/Kokoro-82M-v1.1-zh', device='cpu')
def synth(text, output, voice):
    chunks = [result.audio.numpy() for result in pipe(text, voice=voice, speed=.9)]
    if not chunks: raise RuntimeError('No audio produced')
    audio = np.concatenate([np.zeros(2400), *chunks, np.zeros(4800)])
    if not np.isfinite(audio).all() or np.max(np.abs(audio)) < .001: raise RuntimeError('Invalid audio')
    wav = output.with_suffix('.wav')
    sf.write(wav, audio, 24000)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(wav), '-codec:a', 'libmp3lame', '-q:a', '3', str(output)], check=True)
    wav.unlink()
    return round(len(audio)/24000, 2)
if args.samples:
    for voice in ['zf_001', 'zm_010']:
        out = base / 'audio' / f'sample-{voice}.mp3'
        seconds = synth('兔兔的菜摊开门啦。来帮它装好胡萝卜！订单要六十根胡萝卜。菜摊已经有三十五根。还要补来多少根？', out, voice)
        print(f'{voice}: {seconds}s {out}', flush=True)
else:
    settings = {'model': 'hexgrad/Kokoro-82M-v1.1-zh', 'voice': args.voice, 'speed': .9}
    settings_file = base / 'audio' / 'settings.json'
    if settings_file.exists() and json.loads(settings_file.read_text()) != settings:
        raise RuntimeError('Voice settings changed: move existing numbered MP3s and settings.json to a backup directory before regenerating.')
    settings_file.write_text(json.dumps(settings, indent=2) + '\n')
    clips = json.loads((base / 'audio' / 'script.json').read_text())
    manifest = {}
    for i, clip in enumerate(clips):
        output = base / clip['file']
        if not output.exists(): synth(clip['text'], output, args.voice)
        manifest[clip['text']] = clip['file']
        print(f'{i+1}/{len(clips)} {clip["lesson"]} {clip["text"]}', flush=True)
    # Publish only once every clip is ready. Direct file:// loads without fetch/CORS.
    (base / 'audio' / 'manifest.js').write_text('window.FOREST_AUDIO = ' + json.dumps(manifest, ensure_ascii=False, indent=2) + ';\n')
