# 数学实验室卡规则

实验室卡让孩子先自由玩，再靠小目标通关。它不是选择题关卡。

配套的闯关题如果另写，仍用 `lesson-engine.js`，题量按 `AGENTS.md` 第 1～7 节，不走这份规则。

## 一张卡里有什么

- 每张卡 `2～3` 个小目标。全部完成，才写入 `yswg:done:<id>`（值为 `'1'`）。`id` 用 `lab-` 前缀，例如 `lab-maili`。
- 答错不扣分、不减星。错了可以继续试。
- 可点区域不小于 `44px`，方便 iPad。
- 朗读每句一口气能读完。短句、口语。
- `💡` 提示默认隐藏，点开才出现，并朗读去掉标签后的文字。
- 每张卡有折叠的「给爸爸妈妈的话」。写清背后的数学，可以写答案。默认收着。
- 视口 `≥900px` 时，小目标在右侧，栏宽约 `280px`。`≤899px`（含 iPad 竖屏）时，小目标排到主区上面。

## 技术约束

- 不依赖外部 CDN，不引外部字体或脚本。
- 公共能力只放 `lab-kit.js` / `lab-kit.css`。单张卡只写自己的玩法。
- 不要改 `lesson-engine.js` 来迁就实验室。
- 卡片页面不要用 `document.body.innerHTML` 覆盖整页。
- 页面要带视口：`<meta name="viewport" content="width=device-width, initial-scale=1">`。

下面这段只说明 API 的形状。真正的一张卡仍然要有 2～3 个小目标。

页面骨架：

```html
<link rel="stylesheet" href="lab-kit.css">
<script src="lab-kit.js"></script>
<script>
Lab.mount({
  id: 'lab-maili',
  title: '棋盘麦粒',
  emoji: '🌾',
  lead: '点一格，麦粒就翻一倍。',
  parent: '给爸爸妈妈的话，可含简单 HTML',
  goals: [{ id: 'yi', text: '找出第几格开始超过 1 亿' }],
  hints: [{ id: 'h1', text: '提示文案，默认不显示' }],
  onReset: function(){}
});
const stage = document.getElementById('stage');
</script>
```

`Lab.mount` 同步完成。返回前 `#stage` 已在主区里。请在 `mount` 之后再往 `#stage` 里画。若页面里已经有空的 `#stage`，套件会把它移进主区，不清里面后来写入的内容。

`onReset` 由卡片自己把棋盘恢复到开头。套件不会清空 `#stage`。

## 冻结 API

名字不要改。

### Lab.mount(cfg)

同步搭好外壳：

- `canvas#confetti`：全屏撒花，`pointer-events: none`。
- 顶栏：🦊 数学实验室，小字是 `cfg.title`。右侧 🏠 回首页、🔊 声音开关。按钮至少 `44px`，`aria-label` 写全。回首页先 `speechSynthesis.cancel()`，再 `location.href='index.html'`。静音时停止朗读。
- `.lab-layout`：左侧是引导句、`#stage`、空的 `#lab-status`、提示、折叠的给爸爸妈妈。右侧是小目标。
- 每个提示一个「💡 提示」按钮，正文默认不显示。点开后才显示，并用 `Lab.say` 朗读去标签的文字。按钮有 `aria-expanded`。
- 父母说明用 `details/summary`，默认折叠。摘要文字：`👨‍👩‍👧 给爸爸妈妈的话（点开）`。
- 小目标顶上写「小目标」。未完成是空心圆，完成打勾并变绿。
- 全部完成后才显示「再玩一次」。点它：删掉 `yswg:labgoals:<id>` 和 `yswg:done:<id>`，勾全部取消，再调用 `cfg.onReset`。

### Lab.goal(id)

幂等。未知 `id` 忽略。

新完成时：打勾，`Lab.good()`，一口气朗读该目标文字。已完成的 `id` 数组写入 `yswg:labgoals:<id>`。

当完成数等于 `goals.length`：写 `yswg:done:<id> = '1'`，`Lab.win()`，撒花，`Lab.say('小目标都完成啦！')`，显示「再玩一次」。

返回值：这次是不是新完成。

重新打开已经完成的卡：把勾恢复，显示安静横幅「这张卡已经点亮星星」。不要再撒花，不要再播通关音。

### Lab.say(text)

与课程引擎相同：优先中文女声，`lang` 为 `zh-CN`，`rate` `0.95`，`pitch` `1.1`，句后加「　。」。静音或空文字不说。

### Lab.click / Lab.good / Lab.bad / Lab.win

依次对应课程引擎的 `sClick` / `sGood` / `sBad` / `sWin`。静音时不出声。

### Lab.isGoal(id)

这个小目标是否已完成。

### Lab.toast(text)

把文字写进 `#lab-status`。

### Lab.formatCn(v)

接受 `bigint` 或纯数字符串，返回 `{digits, units}`。

若传入 `number`，只有 `Number.isSafeInteger(v)` 才转成 `bigint`。更大的 `number` 改走字符串会丢精度，大数请传 `bigint` 或纯数字符串。

- `digits`：从右往左每 3 位加一个逗号。
- `units`：从右往左每 4 位一组。单位依次是 `''`、`万`、`亿`、`万亿`、`亿亿`。组内用 `Number(chunk)` 再转回字符串，去掉前导零。数值为 0 的组省略。

例子：

- `134217728n` → `digits` `"134,217,728"`，`units` `"1亿3421万7728"`
- `100000000n` → `units` `"1亿"`
- `'18446744073709551615'` → `digits` `"18,446,744,073,709,551,615"`，`units` `"1844亿亿6744万亿737亿955万1615"`

## 声音和撒花

撒花与课程引擎相同：150 粒，颜色 `#2563EB`、`#F97316`、`#16A34A`、`#EAB308`、`#EC4899`、`#7C3AED`。

静音只关声音和朗读，不关掉页面。

## 按钮样式

卡片可以复用：

- `.lab-btn`：默认绿色
- `.lab-btn.purple`
- `.lab-btn.orange`
- `.lab-btn.ghost`：白底描边

`min-height: 48px`，`font-weight: 800`，圆角 `16px`，字体继承页面。按下时轻微缩小。`:focus-visible` 为紫色轮廓。

## 自检

- [ ] 先玩，再用 2～3 个小目标通关，不是选择题
- [ ] 全部小目标完成才写 `yswg:done:lab-...`
- [ ] 答错不扣分、不减星
- [ ] 可点区域 ≥ 44px，窄屏时小目标在主区上面
- [ ] 朗读一句能读完
- [ ] 💡 默认隐藏
- [ ] 有折叠的「给爸爸妈妈的话」，数学可以写明白，答案可以写在里面
- [ ] 没有外部 CDN
- [ ] 公共逻辑只在 `lab-kit.js` / `lab-kit.css`
- [ ] 没有为了实验室去改 `lesson-engine.js`
