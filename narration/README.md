# 全部 80 关与首页：声音 A 本地配音

统一使用已确认的 A：Kokoro-82M-v1.1-zh / zf_001 女声 / 0.9 语速。在本机生成，播放时直接读取 MP3，无付费 API，也不消耗 ChatGPT 或 Cursor 订阅额度。森林六关的配音单独保存在 `forest-math/audio`。

## 内容与播放

- `coverage.json`：按首页编号排列的全部 80 关与基本采集数量。
- `script.json`、`manifest.js`、`audio/`：完整句子的稿件与录音；包含首页欢迎语。
- `parts.json`、`parts.js`、`parts/`：同一声音生成的短语与数字，用于随操作变化的金额、时间、数的组成等内容。
- `resolver.js`：优先使用整句，变化内容用短语和正确读法的数字衔接。分数按“分母分之分子”读，小数保留小数点后的各位，较大整数保留万、千、百和零。
- `player.js`：重听、静音、切换阶段、页面离开都能停止当前朗读及待播片段。缺失音频时提示，不调用系统朗读。
- `coverage-audit.json`、`verification.json`：操作覆盖与音频文件核验结果。

覆盖探索、题目、点击后的提示、正误反馈、通关和重玩。固定内容整句录制；动态内容用已录好的片段组成，因此片段间语气可能有停顿。页面使用普通 script 和 Audio 加载，可直接打开 HTML；分享时请保留完整 `narration` 目录。

提示仍默认隐藏，点击后才显示和朗读。此前修正的第 79 关 120−20=100、第 69 关 19×4 估为 20×4=80 均保留。

## 重建与核验

独立环境 `.tts-venv`、离线模型缓存 `.tts-cache`、jsdom/acorn 测试依赖 `.tts-tools` 均不进入 Git。Python 依赖锁定文件为 `forest-math/scripts/requirements-tts.lock.txt`。

```sh
node narration/scripts/collect.cjs --record-finite
node narration/scripts/prepare-parts.cjs
.tts-venv/bin/python narration/scripts/generate.py
node narration/scripts/integrate.cjs
node narration/scripts/collect.cjs --check --exhaustive
node narration/scripts/test-player.cjs
.tts-venv/bin/python narration/scripts/test-spoken.py
node narration/scripts/test-resolver.cjs
.tts-venv/bin/python narration/scripts/verify.py
```

默认以四个独立本地进程合成，已有文件跳过；每段生成成功才原子替换文件，全部成功才发布清单。`--workers 1` 可降低同时生成的任务数。改声音或速度前需备份对应 MP3，再重新生成。

采集器在 jsdom 中执行原始关卡事件，包括题目正误选项、提示、动画结束和探索状态；`--exhaustive` 扩展有限数字与时钟组合。播放器使用模拟 Audio 检查覆盖，不实际发声。另检查 0–99999 的数字均能匹配、每个 MP3 可完整解码。这些检查不等同于逐段人工听审或平板实测。

模型：[Kokoro-82M-v1.1-zh](https://huggingface.co/hexgrad/Kokoro-82M-v1.1-zh)，Apache-2.0。文本与配音取自本仓库。
