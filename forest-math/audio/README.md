# 六关本地配音

使用 [Kokoro-82M-v1.1-zh](https://huggingface.co/hexgrad/Kokoro-82M-v1.1-zh)（Apache-2.0）在本机合成；不调用收费语音服务。Kokoro Python 包与 Misaki 均为 0.9.4。

- 范围：全部六家小店，共 210 段；探索玩法、信息卡、问题、隐藏提示。
- 配音稿：`script.json`。同一句去重；最后一张信息卡连同问题单独合成，保留现有节奏。
- 声音：默认 zf_001，速度 0.9；试听页另提供 zm_010。
- 输出：24 kHz 单声道 MP3，首尾短停顿。manifest.js 是文本到真实文件的映射，全部生成完成才写入。
- 不朗读尚未打开的提示。游戏中的提示仍需点击才出现和播放。
- 音频与页面同目录分发，可离线播放；模型和 Python 环境不用分发。

在项目根目录重新生成：

```sh
node forest-math/scripts/prepare-audio.cjs
.tts-venv/bin/python forest-math/scripts/generate-audio.py --samples
.tts-venv/bin/python forest-math/scripts/generate-audio.py
```

已存在的配音会跳过；如果要换声音或速度，请先把旧 MP3 移到备份目录。模型缓存位于 `.tts-cache`，独立环境位于 `.tts-venv`，均不进入 Git。
