"""Regression tests for pronunciation text, independent of the synthesis model."""
import importlib.util
from pathlib import Path
spec=importlib.util.spec_from_file_location('generator',Path(__file__).with_name('generate.py'))
generator=importlib.util.module_from_spec(spec);spec.loader.exec_module(generator)
spoken=generator.spoken
assert spoken('A × 2 ÷ 3')=='诶 乘以 2 除以 3'
assert spoken('ABCABC')=='诶，比，西，诶，比，西'
assert spoken('这是直角，zhí jiǎo。')=='这是直角，。'
assert spoken('1/2 + 0.5 = 1')=='2分之1 加 0.5 等于 1'
assert spoken('□−1')=='空格减1'
print('Spoken text: multiplication/division retained, letters pronounced, pinyin omitted, fractions and decimals passed.')
