(function () {
  'use strict';
  const F = window.Forest, cfg = window.LESSON_CONFIG;
  if (!cfg) { document.body.textContent = '这家小店暂时没找到，请返回森林首页。'; return; }
  const e = F.escape;
  const saved = F.progress(cfg.id);
  let phase = saved.phase, index = saved.index;
  let shown = 0, answer = '', solvedNow = false, hintStep = 0;
  let feedback = '', feedbackType = '', speechMessage = '';
  let sandbox = {};
  const root = document.getElementById('app');
  root.innerHTML = `<div class="lesson-shell"><header class="site-header lesson-header"><a class="back-link" href="index.html">← 森林小镇</a><a class="brand" href="index.html"><span class="brand-mark" aria-hidden="true">✿</span>森林小店长</a><button class="round-button" id="soundButton"></button></header><main><div class="lesson-meta"><div class="lesson-title"><span class="animal" aria-hidden="true">${cfg.emoji}</span><div><h1>${cfg.title}</h1><p>${cfg.subtitle}</p></div></div><nav class="stage-tabs" aria-label="关卡阶段"><button class="stage-tab" data-stage="explore">① 玩一玩</button><button class="stage-tab" data-stage="practice">② 帮个忙</button><button class="stage-tab" data-stage="challenge">③ 挑战一下</button></nav></div><div id="storageWarning" class="storage-warning" hidden>当前浏览器无法保存进度。本次仍可以玩；关闭页面后，需要重新开始。</div><div id="voiceMessage" class="notice" role="status" hidden></div><section class="play-card" id="playCard" aria-label="数学游戏"></section><div class="lesson-bottom"><details class="parent-note"><summary>这关的陪玩小纸条</summary><p>${cfg.parentNote}</p><p>没听清：重听信息卡。想找方法：点 💡。可以随时回到“玩一玩”。</p></details><p class="site-footer">小店长，按你的节奏来。<span>✿</span></p></div></main></div>`;
  const play = document.getElementById('playCard');
  function currentQuestion() { return cfg[phase] && cfg[phase][index]; }
  function updateChrome() {
    document.querySelectorAll('[data-stage]').forEach(button => {
      if (button.dataset.stage === phase) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
    const button = document.getElementById('soundButton');
    button.textContent = F.state.sound ? '🔊' : '🔇';
    button.setAttribute('aria-label', F.state.sound ? '关闭声音' : '打开声音');
    button.setAttribute('aria-pressed', String(F.state.sound));
    document.getElementById('storageWarning').hidden = F.storageAvailable;
    const voice = document.getElementById('voiceMessage'); voice.hidden = !speechMessage; voice.textContent = speechMessage;
  }
  function say(text) {
    const result = F.speak(text);
    speechMessage = !result.ok ? result.reason === 'muted' ? '声音关着呢。也可以看卡片，或点右上角打开声音。' : '这台设备暂时不能朗读中文。可以和爸爸妈妈一起看卡片，照样能玩。' : '';
    updateChrome();
  }
  window.addEventListener('forest-speech-error', () => { speechMessage = '这次没有读出来。可以再点一次小喇叭，或请爸爸妈妈读卡片。'; updateChrome(); });
  function resetSandbox() {
    sandbox = { ...cfg.explore, source: null, interacted: false, before: cfg.explore.amount, delta: null, ran: false };
  }
  function resetQuestion() {
    const q = currentQuestion();
    shown = 0; answer = q && q.mode === 'place' ? '0' : ''; solvedNow = false; hintStep = 0; feedback = ''; feedbackType = '';
  }
  function setPhase(next, nextIndex = 0) {
    cancelDrag(); F.stopSpeech(); phase = next; index = nextIndex; hintStep = 0; feedback = ''; speechMessage = '';
    if (phase === 'explore') resetSandbox();
    else if (phase !== 'done') resetQuestion();
    F.current(cfg.id, phase, index); render();
    if (phase === 'done') say(cfg.done.speech);
    const heading = play.querySelector('h2');
    if (heading) { heading.setAttribute('tabindex', '-1'); heading.focus({ preventScroll: true }); }
  }
  function statusDots(list) {
    const completed = F.progress(cfg.id).solved;
    return `<div class="progress-dots" aria-label="本阶段共${list.length}题，已完成${list.filter(q => completed.includes(q.id)).length}题">${list.map((q, i) => `<span class="progress-dot${completed.includes(q.id) ? ' solved' : ''}${i === index ? ' current' : ''}"></span>`).join('')}</div>`;
  }
  function hintHTML(item) {
    const hints = [item.hint, ...(item.hints || [])];
    return `<div class="help-row"><button class="hint-button" data-action="hint" aria-expanded="${hintStep > 0}" aria-controls="hintContent">💡 ${hintStep ? '收起提示' : '给我一点提示'}</button><div class="hint-content" id="hintContent" ${hintStep ? '' : 'hidden'}>${hints.slice(0, hintStep).map((h, i) => `<p>${i + 1}. ${e(h)}</p>`).join('')}${hintStep && hintStep < hints.length ? '<button class="hint-more" data-action="more-hint">再给我一点帮助 →</button>' : ''}</div></div>`;
  }
  function zone(label, amount, icon, extra = '') {
    return `<div class="zone" ${extra}><span class="zone-title">${label}</span>${F.objects(amount, icon)}<span class="zone-amount">${amount === null ? '?' : amount}</span></div>`;
  }
  function control(text, action, disabled = false, extra = '') {
    return `<button class="small-control" data-action="${action}" ${disabled ? 'disabled' : ''} ${extra}>${text}</button>`;
  }
  function exploration() {
    const s = sandbox, icon = cfg.explore.icon;
    if (s.type === 'transfer') {
      const basket = (side, label, n) => `<button class="zone interactive${s.source === side ? ' selected' : ''}" data-action="transfer" data-side="${side}" aria-pressed="${s.source === side}"><span class="zone-title">${label}</span>${F.objects(n, icon)}<span class="zone-amount">${n} 根</span></button>`;
      return `<div class="explore-zones">${basket('left', '左边篮子', s.left)}<span class="operator" aria-hidden="true">⇄</span>${basket('right', '右边篮子', s.total - s.left)}</div><p class="observation" role="status">${s.interacted ? `左边 ${s.left} 根，右边 ${s.total - s.left} 根。一共还是 ${s.total} 根。` : s.source ? '选好啦，再点另一只篮子。' : '先选一只篮子。'}</p>`;
    }
    if (s.type === 'balance') {
      const side = (name, label) => `<div class="zone"><span class="zone-title">${label}</span>${F.objects(s[name], icon)}<span class="zone-amount">${s[name]} 颗</span><div class="explore-controls">${control('− 1', 'balance', s[name] <= 0, `data-side="${name}" data-delta="-1" aria-label="${label}拿一颗"`)}${control('＋ 1', 'balance', s[name] >= 12, `data-side="${name}" data-delta="1" aria-label="${label}加一颗"`)}</div></div>`;
      return `<div class="explore-zones">${side('left', '左边')}${side('right', '右边')}</div><div class="balance-line" style="--tilt:${Math.max(-12, Math.min(12, (s.right - s.left) * 3))}deg" aria-hidden="true"></div><div class="balance-label" role="status">${s.left === s.right ? '一样多，平衡啦！' : s.left > s.right ? '左边多，左边往下。' : '右边多，右边往下。'}</div>`;
    }
    if (s.type === 'machine') {
      return `<div class="explore-zones"><div class="zone"><span class="zone-title">放进去</span>${F.objects(s.input, icon)}<span class="zone-amount">${s.input} 个</span><div class="explore-controls">${control('− 1', 'machine-input', s.input === 0, 'data-delta="-1" aria-label="少放一个"')}${control('＋ 1', 'machine-input', s.input === 12, 'data-delta="1" aria-label="多放一个"')}</div></div><div><span class="flow-label">🤖 再添 ${s.rule} 个</span><div class="explore-controls">${[1, 2, 3].map(n => control(`添 ${n} 个`, 'machine-rule', false, `data-rule="${n}" aria-pressed="${n === s.rule}"`)).join('')}</div></div>${zone('包装后', s.ran ? s.input + s.rule : null, icon)}</div><div class="explore-controls">${control('开动机器 →', 'machine-run')}</div><p class="observation" role="status">${s.ran ? `${s.input} ＋ ${s.rule} ＝ ${s.input + s.rule}` : '调好了，就让机器开动。'}</p>`;
    }
    if (s.type === 'bakery' || s.type === 'bus') {
      const isBus = s.type === 'bus', limit = isBus ? 12 : 20;
      return `<div class="explore-zones">${zone(isBus ? '乘客，只数小动物' : '柜台上的点心', s.amount, icon)}</div><div class="explore-controls">${control(isBus ? '🐾 上车 1 位' : '🍪 送来 2 个', 'change-stock', s.amount + (isBus ? 1 : 2) > limit, `data-delta="${isBus ? 1 : 2}"`)}${control(isBus ? '🐾 下车 1 位' : '🍪 拿走 3 个', 'change-stock', s.amount < (isBus ? 1 : 3), `data-delta="${isBus ? -1 : -3}"`)}</div><p class="observation" role="status">${s.delta === null ? '点按钮，看看会发生什么。' : `原来 ${s.before} → ${s.delta > 0 ? isBus ? '上车' : '送来' : isBus ? '下车' : '拿走'} ${Math.abs(s.delta)} → 现在 ${s.amount}<br>${s.before} ${s.delta > 0 ? '＋' : '−'} ${Math.abs(s.delta)} ＝ ${s.amount}`}</p>`;
    }
    const basket = (side, label) => `<div class="zone"><span class="zone-title">${label} · 想要 ${s.target} 个</span>${F.objects(s[side], icon)}<span class="zone-amount">已装 ${s[side]} 个</span><div class="explore-controls">${control('− 1', 'picnic', s[side] === 0, `data-side="${side}" data-delta="-1" aria-label="${label}拿出一个"`)}${control('＋ 1', 'picnic', s[side] === 8, `data-side="${side}" data-delta="1" aria-label="${label}放入一个"`)}</div></div>`;
    const difference = (n, label) => `${label}${n === s.target ? '刚刚好' : n < s.target ? `还缺 ${s.target - n} 个` : `多了 ${n - s.target} 个`}`;
    return `<div class="explore-zones">${basket('left', '兔兔篮')}${basket('right', '熊熊篮')}</div><p class="observation" role="status">${difference(s.left, '兔兔篮')}，${difference(s.right, '熊熊篮')}。</p>`;
  }
  function renderExplore() {
    play.innerHTML = `<div class="play-top"><span class="play-tag">自由探索 · 随便试一试</span><span aria-hidden="true">${cfg.emoji} ✿</span></div><div class="play-content"><div class="task-heading"><h2>${cfg.explore.title}</h2><p>${cfg.explore.lead}</p></div><div class="story-controls"><button class="button outline" data-action="explore-speak">🔊 听听怎么玩</button></div><div class="explore-board" id="sandbox">${exploration()}</div><div class="answer-actions"><button class="button secondary" data-action="explore-reset">重新摆一摆</button><button class="button" data-action="explore-done">我试好了，去帮忙 →</button></div></div>${hintHTML(cfg.explore)}`;
  }
  function visualHTML(visual) {
    if (visual.text !== undefined) return `<div class="visual-text">${e(visual.text).replace(/盒/g, '<span role="img" aria-label="盒子">📦</span>').replace(/袋/g, '<span role="img" aria-label="袋子">🛍️</span>')}</div>`;
    return `${F.objects(visual.amount, visual.icon)}${visual.amount !== null ? `<div class="quantity">${visual.amount}</div>` : ''}`;
  }
  function storyHTML(q) {
    return `<div class="story-controls">${shown < q.story.length ? `<button class="button" data-action="story-next">${shown === 0 ? '▶ 听听小伙伴的任务' : '下一句 →'}</button>` : ''}${shown ? '<button class="button outline" data-action="story-restart">↺ 从头听故事</button>' : ''}<span class="play-tag">${shown} / ${q.story.length} 张信息卡</span></div><div class="story-cards${q.story.length === 4 ? ' four-cards' : ''}" style="--cards:${Math.min(q.story.length, 3)}">${q.story.map((c, i) => i < shown ? `<article class="story-card${i === shown - 1 ? ' current' : ''}"><h3>${e(c.label)}</h3><div class="card-visual">${visualHTML(c.visual)}</div><p class="caption">${e(c.text)}</p><button class="replay-line" data-action="story-replay" data-line="${i}" aria-label="重听：${e(c.label)}">🔊</button></article>` : `<div class="story-card waiting" aria-label="第${i + 1}张信息卡尚未打开"><span>${i + 1} · ${i === shown ? '听下一句就打开' : '等一等这张卡'}</span></div>`).join('')}</div>`;
  }
  function answerHTML(q) {
    if (q.mode === 'choice') return `<div class="options">${q.options.map(o => `<button class="option${answer === o.value ? ' selected' : ''}" data-action="choice" data-value="${e(o.value)}" aria-pressed="${answer === o.value}" ${solvedNow ? 'disabled' : ''}>${e(o.label)}</button>`).join('')}</div>`;
    if (q.mode === 'place') {
      const tray = (side, count, label) => `<div class="zone drag-zone" data-drop="${side}"><span class="zone-title">${label}</span><div class="drag-items">${Array.from({ length: count }, (_, i) => `<button class="drag-item" data-action="place-item" data-side="${side}" aria-label="${side === 'source' ? '放入' : '拿回'}一${q.unit}" ${solvedNow ? 'disabled' : ''}>${q.icon === '🐾' ? ['🐰','🐻','🐱','🦊'][i % 4] : e(q.icon)}</button>`).join('')}${!count ? '<span class="tray-empty">' + (side === 'target' ? '拖到这里' : '都拿走啦') + '</span>' : ''}</div><span class="zone-amount">${count} ${q.unit}</span></div>`;
      return `<div class="place-board">${tray('source', q.max - Number(answer), '备货盘')}${tray('target', Number(answer), '我的答案')}</div><p class="place-caption">拖进来，摆一摆。多了就拖回去。<br><small>也可以轻点物品，一次搬一个。</small></p>`;
    }
    return `<div class="answer-layout"><div class="answer-display" aria-live="polite" aria-label="我的答案"><span${answer === '' ? ' class="placeholder"' : ''}>${answer === '' ? '?' : answer}</span><small>${q.unit}</small></div><div class="keypad" aria-label="数字键盘">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 'clear', 0, 'delete'].map(n => `<button class="key${typeof n === 'string' ? ' utility' : ''}" data-action="key" data-key="${n}" aria-label="${n === 'delete' ? '删除最后一位' : n === 'clear' ? '清空答案' : n}" ${solvedNow ? 'disabled' : ''}>${n === 'delete' ? '⌫' : n === 'clear' ? '清空' : n}</button>`).join('')}</div></div>`;
  }
  function questionArea(q) {
    return `<section class="question-area" aria-label="回答任务"><h3>${e(q.q)} <button class="replay-line" data-action="question-replay" aria-label="重听要回答的问题">🔊</button></h3>${answerHTML(q)}<div class="answer-actions">${solvedNow ? '<button class="button sunshine" data-action="next">' + (index === cfg[phase].length - 1 ? phase === 'practice' ? '去挑战一下 →' : '看看完成了没 →' : '下一个小任务 →') + '</button>' : `<button class="button" data-action="submit" ${answer === '' ? 'disabled' : ''}>我准备好了 ✓</button>`}</div><div class="feedback ${feedbackType}" role="status" ${feedback ? '' : 'hidden'}>${e(feedback)}${solvedNow ? ' <button class="replay-line" data-action="feedback-replay" aria-label="重听答对反馈">🔊</button>' : ''}</div></section>`;
  }
  function renderQuestion() {
    cancelDrag();
    const q = currentQuestion();
    play.innerHTML = `<div class="play-top"><span class="play-tag">${phase === 'practice' ? '帮个小忙' : '挑战任务'} · ${index + 1} / ${cfg[phase].length}</span>${cfg.hard && phase === 'challenge' ? '<span class="hard-label">多想几步，慢慢来</span>' : statusDots(cfg[phase])}</div><div class="play-content"><div class="task-heading"><h2>${phase === 'challenge' ? '有个小难题，一起试试看' : '小店长，来帮个忙吧'}</h2><p>一张卡讲一件事。可以随时重听。</p></div>${storyHTML(q)}<div id="answerSection">${shown === q.story.length ? questionArea(q) : '<p class="place-caption" style="text-align:center">先把故事听完整，任务就出现啦。</p>'}</div></div>${shown === q.story.length ? hintHTML(q) : ''}`;
  }
  function renderDone() {
    const complete = F.isComplete(cfg, F.progress(cfg.id));
    if (!complete) { advanceIncomplete(); return; }
    const next = window.FOREST_LESSONS[window.FOREST_LESSONS.indexOf(cfg) + 1];
    play.innerHTML = `<div class="done-panel"><div class="big-sticker" aria-label="已获得贴纸">${cfg.done.badge}</div><span class="eyebrow">收到了，一张新贴纸</span><h2>${cfg.done.title}</h2><p>${cfg.done.text}</p><p>这家小店的任务，都完成了。</p><div class="done-actions"><a class="button sunshine" href="index.html">回小镇贴贴纸 →</a>${next ? `<a class="button secondary" href="${next.title}.html">逛逛${next.title} ↗</a>` : ''}</div><button class="button outline" data-action="again">还想再玩一遍</button></div>`;
  }
  function render() {
    updateChrome();
    if (phase === 'explore') renderExplore(); else if (phase === 'done') renderDone(); else renderQuestion();
  }
  function refreshAnswer() {
    cancelDrag();
    const active = document.activeElement;
    const focus = active && active.dataset ? { action: active.dataset.action, key: active.dataset.key, value: active.dataset.value, side: active.dataset.side } : null;
    document.getElementById('answerSection').innerHTML = questionArea(currentQuestion());
    if (focus && focus.action) {
      const replacement = [...document.querySelectorAll('#answerSection button')].find(b => b.dataset.action === focus.action && b.dataset.key === focus.key && b.dataset.value === focus.value && b.dataset.side === focus.side && !b.disabled);
      if (replacement) replacement.focus({ preventScroll: true });
    }
  }
  function firstIncomplete(which) {
    const solved = F.progress(cfg.id).solved;
    const found = cfg[which].findIndex(q => !solved.includes(q.id));
    return found < 0 ? 0 : found;
  }
  function advanceIncomplete() {
    const p = F.progress(cfg.id);
    if (!p.explored) { setPhase('explore'); return; }
    if (cfg.practice.some(q => !p.solved.includes(q.id))) { setPhase('practice', firstIncomplete('practice')); return; }
    if (cfg.challenge.some(q => !p.solved.includes(q.id))) { setPhase('challenge', firstIncomplete('challenge')); return; }
    setPhase('done');
  }
  function submit() {
    const q = currentQuestion();
    if (!q || shown < q.story.length || solvedNow || answer === '') return;
    if (F.checkAnswer(q, answer)) {
      solvedNow = true; F.solve(cfg.id, q.id); feedbackType = 'good'; feedback = '✓ 对上啦！' + q.solution;
    } else { feedbackType = 'retry'; feedback = '还没对上，再试试。可以重听卡片，也可以点 💡。'; }
    refreshAnswer(); updateChrome();
    const dots = play.querySelector('.progress-dots');
    if (dots) dots.outerHTML = statusDots(cfg[phase]);
    if (solvedNow) say(q.successSpeech);
  }
  function clearFeedback() { feedback = ''; feedbackType = ''; }
  function enterKey(key) {
    const q = currentQuestion();
    if (!q || q.mode !== 'number' || shown < q.story.length || solvedNow) return;
    if (key === 'clear') answer = '';
    else if (key === 'delete') answer = answer.slice(0, -1);
    else if (/^\d$/.test(key) && answer.length < 3) answer = answer === '0' ? key : answer + key;
    clearFeedback(); refreshAnswer();
  }
  function sandboxAction(action, button) {
    const s = sandbox, side = button.dataset.side, delta = Number(button.dataset.delta);
    if (action === 'transfer') {
      if (!s.source) { if (side === 'left' ? s.left > 0 : s.total - s.left > 0) s.source = side; }
      else if (s.source === side) s.source = null;
      else { s.left += side === 'left' ? 1 : -1; s.source = null; s.interacted = true; }
    } else if (action === 'balance') { s[side] = Math.max(0, Math.min(12, s[side] + delta)); }
    else if (action === 'machine-input') { s.input = Math.max(0, Math.min(12, s.input + delta)); s.ran = false; }
    else if (action === 'machine-rule') { s.rule = Number(button.dataset.rule); s.ran = false; }
    else if (action === 'machine-run') { s.ran = true; }
    else if (action === 'change-stock') { s.before = s.amount; s.delta = delta; s.amount = Math.max(0, Math.min(s.type === 'bus' ? 12 : 20, s.amount + delta)); }
    else if (action === 'picnic') { s[side] = Math.max(0, Math.min(8, s[side] + delta)); }
    else return false;
    document.getElementById('sandbox').innerHTML = exploration(); return true;
  }
  let drag = null, suppressClickUntil = 0;
  function moveItem(side) {
    const q = currentQuestion();
    if (!q || q.mode !== 'place' || solvedNow || shown < q.story.length) return;
    answer = String(Math.max(0, Math.min(q.max, Number(answer) + (side === 'source' ? 1 : -1))));
    feedback = side === 'source' ? '放好啦！' : '拿回来啦。'; feedbackType = 'info';
    refreshAnswer();
    const destination = play.querySelector(`[data-drop="${side === 'source' ? 'target' : 'source'}"]`);
    if (destination) destination.classList.add('just-dropped');
  }
  function cancelDrag() {
    if (!drag) return;
    const old = drag; drag = null;
    old.ghost.remove(); old.item.classList.remove('being-dragged');
    play.querySelectorAll('.drop-ready').forEach(el => el.classList.remove('drop-ready'));
    if (old.item.hasPointerCapture(old.id)) old.item.releasePointerCapture(old.id);
  }
  function dropAt(x, y) {
    const zone = document.elementFromPoint(x, y)?.closest('[data-drop]');
    return zone && play.contains(zone) && zone.dataset.drop !== drag.side ? zone : null;
  }
  root.addEventListener('pointerdown', event => {
    suppressClickUntil = 0;
    const item = event.target.closest('.drag-item');
    if (!item || item.disabled || drag || !event.isPrimary || event.button !== 0) return;
    const ghost = document.createElement('div');
    ghost.className = 'drag-ghost'; ghost.textContent = item.textContent;
    ghost.setAttribute('aria-hidden', 'true'); ghost.hidden = true; document.body.append(ghost);
    drag = { item, ghost, id: event.pointerId, side: item.dataset.side, x: event.clientX, y: event.clientY, moved: false };
    item.setPointerCapture(event.pointerId);
  });
  root.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 7) return;
    drag.moved = true; drag.ghost.hidden = false; drag.item.classList.add('being-dragged');
    drag.ghost.style.left = `${event.clientX}px`; drag.ghost.style.top = `${event.clientY}px`;
    const target = dropAt(event.clientX, event.clientY);
    play.querySelectorAll('[data-drop]').forEach(el => el.classList.toggle('drop-ready', el === target));
  });
  root.addEventListener('pointerup', event => {
    if (!drag || drag.id !== event.pointerId) return;
    const side = drag.side, moved = drag.moved, accepted = moved && dropAt(event.clientX, event.clientY);
    if (moved) { event.preventDefault(); suppressClickUntil = performance.now() + 400; }
    cancelDrag();
    if (accepted) moveItem(side);
  });
  const interruptedDrag = event => { if (drag && drag.id === event.pointerId) cancelDrag(); };
  root.addEventListener('pointercancel', interruptedDrag);
  root.addEventListener('lostpointercapture', interruptedDrag);
  window.addEventListener('blur', cancelDrag);
  window.addEventListener('pagehide', cancelDrag);
  root.addEventListener('click', event => {
    if (event.detail && performance.now() < suppressClickUntil) { event.preventDefault(); return; }
    const button = event.target.closest('button'); if (!button || button.disabled) return;
    if (button.id === 'soundButton') { F.toggleSound(); speechMessage = ''; updateChrome(); return; }
    if (button.dataset.stage) { setPhase(button.dataset.stage, button.dataset.stage === 'explore' ? 0 : firstIncomplete(button.dataset.stage)); return; }
    const action = button.dataset.action;
    if (phase === 'explore' && sandboxAction(action, button)) return;
    if (action === 'explore-speak') { say(cfg.intro + cfg.explore.lead); return; }
    if (action === 'explore-reset') { resetSandbox(); document.getElementById('sandbox').innerHTML = exploration(); return; }
    if (action === 'explore-done') { const replay = F.isComplete(cfg, F.progress(cfg.id)); F.explore(cfg.id); if (replay) setPhase('practice', 0); else advanceIncomplete(); return; }
    if (action === 'again') { setPhase('explore'); return; }
    const q = currentQuestion();
    if (action === 'hint' || action === 'more-hint') {
      const item = phase === 'explore' ? cfg.explore : q;
      const hints = [item.hint, ...(item.hints || [])];
      hintStep = action === 'hint' ? hintStep ? 0 : 1 : Math.min(hintStep + 1, hints.length);
      const row = play.querySelector('.help-row'); row.outerHTML = hintHTML(item);
      if (hintStep) say(hints[hintStep - 1]); return;
    }
    if (!q) return;
    if (action === 'story-next' && shown < q.story.length) { const line = q.story[shown++]; renderQuestion(); say(line.text + (shown === q.story.length ? q.q : '')); return; }
    if (action === 'story-restart') { F.stopSpeech(); shown = 1; renderQuestion(); say(q.story[0].text + (q.story.length === 1 ? q.q : '')); return; }
    if (action === 'story-replay') { say(q.story[Number(button.dataset.line)].text); return; }
    if (action === 'feedback-replay' && solvedNow) { say(q.successSpeech); return; }
    if (action === 'question-replay') { say(q.q); return; }
    if (action === 'next' && solvedNow) {
      if (index + 1 < cfg[phase].length) setPhase(phase, index + 1);
      else if (phase === 'practice') setPhase('challenge', firstIncomplete('challenge'));
      else advanceIncomplete();
      return;
    }
    if (solvedNow || shown < q.story.length) return;
    if (action === 'key') { enterKey(button.dataset.key); return; }
    if (action === 'choice') { answer = button.dataset.value; clearFeedback(); refreshAnswer(); return; }
    if (action === 'place-item') { moveItem(button.dataset.side); return; }
    if (action === 'submit') submit();
  });
  document.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName) || event.target.isContentEditable) return;
    const q = currentQuestion(); if (!q || shown < q.story.length || solvedNow) return;
    if (q.mode === 'number' && (/^\d$/.test(event.key) || ['Backspace', 'Delete'].includes(event.key))) {
      event.preventDefault(); enterKey(event.key === 'Backspace' ? 'delete' : event.key === 'Delete' ? 'clear' : event.key);
    }
    if (event.key === 'Enter' && event.target.tagName !== 'BUTTON') { event.preventDefault(); submit(); }
  });
  window.addEventListener('pagehide', F.stopSpeech);
  window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
  if (phase === 'explore') resetSandbox(); else if (phase !== 'done') resetQuestion();
  F.current(cfg.id, phase, index); render();

  // 渐进增强：浏览器提供 WebMCP 时，辅助工具走同一套答题动作。
  if (document.modelContext && document.modelContext.registerTool) {
    const lifecycle = new AbortController();
    const register = tool => { try { Promise.resolve(document.modelContext.registerTool(tool, { signal: lifecycle.signal })).catch(() => {}); } catch (_) {} };
    register({ name: 'read_forest_task', description: '读取当前已显示的任务和进度，不包含隐藏提示或答案。', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true }, execute() { const q = currentQuestion(); return { lesson: cfg.title, phase, question: shown === (q && q.story.length) ? q.q : null, cards: q ? q.story.slice(0, shown).map(c => c.text) : [], solved: F.progress(cfg.id).solved.length }; } });
    register({ name: 'submit_forest_answer', description: '为已完整展示的当前任务提交答案，与页面确认按钮相同。', inputSchema: { type: 'object', properties: { answer: { type: 'string', maxLength: 4 } }, required: ['answer'], additionalProperties: false }, annotations: { readOnlyHint: false }, execute(input) {
      const q = currentQuestion();
      if (!input || typeof input.answer !== 'string' || !/^-?\d{1,3}$/.test(input.answer) || Object.keys(input).some(k => k !== 'answer')) throw new Error('请输入合法的整数答案。');
      if (!q || shown < q.story.length || solvedNow) throw new Error('请先在页面上听完整个任务，或进入下一题。');
      if (q.mode === 'choice' && !q.options.some(o => o.value === input.answer)) throw new Error('请选择页面上的选项。');
      if (q.mode !== 'choice' && (Number(input.answer) < 0 || Number(input.answer) > (q.mode === 'place' ? q.max : 999))) throw new Error('答案超出当前操作范围。');
      answer = input.answer; submit(); return { correct: solvedNow, message: feedback };
    } });
    window.addEventListener('pagehide', () => lifecycle.abort(), { once: true });
  }
})();
