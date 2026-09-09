(function () {
  'use strict';
  const KEY = 'forest-math:v1';
  const empty = () => ({ version: 1, updatedAt: 0, last: null, sound: true, lessons: {} });
  let available = true;
  let state = empty();
  function sanitize(raw) {
    const clean = empty();
    if (!raw || raw.version !== 1) return clean;
    clean.updatedAt = Number.isFinite(raw.updatedAt) ? Math.max(0, raw.updatedAt) : 0;
    clean.sound = raw.sound !== false;
    const lessons = window.FOREST_LESSONS || [];
    clean.last = lessons.some(l => l.id === raw.last) ? raw.last : null;
    for (const lesson of lessons) {
      const saved = raw.lessons && raw.lessons[lesson.id];
      if (!saved || typeof saved !== 'object') continue;
      const ids = [...lesson.practice, ...lesson.challenge].map(q => q.id);
      const solved = Array.isArray(saved.solved) ? [...new Set(saved.solved.filter(id => ids.includes(id)))] : [];
      const phase = ['explore', 'practice', 'challenge', 'done'].includes(saved.phase) ? saved.phase : 'explore';
      const list = lesson[phase];
      const index = Array.isArray(list) && Number.isInteger(saved.index) ? Math.max(0, Math.min(saved.index, list.length - 1)) : 0;
      clean.lessons[lesson.id] = { explored: saved.explored === true, solved, phase, index };
      if (phase === 'done' && !isComplete(lesson, clean.lessons[lesson.id])) clean.lessons[lesson.id].phase = 'explore';
    }
    return clean;
  }
  function isComplete(lesson, progress) {
    return Boolean(progress && progress.explored && [...lesson.practice, ...lesson.challenge].every(q => progress.solved.includes(q.id)));
  }
  function mergeProgress(local, incoming) {
    const a = sanitize(local), b = sanitize(incoming);
    const latest = b.updatedAt > a.updatedAt ? b : a;
    const merged = sanitize(latest);
    for (const lesson of window.FOREST_LESSONS || []) {
      const left = a.lessons[lesson.id], right = b.lessons[lesson.id];
      if (!left && !right) continue;
      const base = merged.lessons[lesson.id] || left || right;
      merged.lessons[lesson.id] = { ...base, explored: Boolean((left && left.explored) || (right && right.explored)), solved: [...new Set([...(left ? left.solved : []), ...(right ? right.solved : [])])] };
    }
    return merged;
  }
  try {
    const value = localStorage.getItem(KEY);
    if (value) { try { state = sanitize(JSON.parse(value)); } catch (_) { state = empty(); } }
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (_) { available = false; }
  // file:// 页面可能各自拥有存储；内部跳转用片段带上进度，不发出网络请求。
  const fileMode = typeof location !== 'undefined' && location.protocol === 'file:';
  if (fileMode && location.hash.startsWith('#fm=')) {
    try {
      const incoming = location.hash.slice(4);
      if (incoming.length <= 16000) {
        state = mergeProgress(state, JSON.parse(decodeURIComponent(incoming)));
        if (available) localStorage.setItem(KEY, JSON.stringify(state));
      }
    } catch (_) { /* 不完整的地址片段不影响正常进入。 */ }
  }
  function save() {
    state.updatedAt = Date.now();
    if (!available) return false;
    try { localStorage.setItem(KEY, JSON.stringify(state)); return true; }
    catch (_) { available = false; return false; }
  }
  function progress(id) {
    if (!state.lessons[id]) state.lessons[id] = { explored: false, solved: [], phase: 'explore', index: 0 };
    return state.lessons[id];
  }
  function current(id, phase, index) {
    const p = progress(id); p.phase = phase; p.index = index; state.last = id; save();
  }
  function solve(id, questionId) {
    const p = progress(id);
    if (!p.solved.includes(questionId)) p.solved.push(questionId);
    save();
  }
  function explore(id) { progress(id).explored = true; save(); }
  function evaluate(tree) {
    if (typeof tree === 'number') return tree;
    const [op, ...args] = tree; const values = args.map(evaluate);
    switch (op) {
      case '+': return values.reduce((a, b) => a + b, 0);
      case '-': return values[0] - values[1];
      case '*': return values.reduce((a, b) => a * b, 1);
      case '/': return values[0] / values[1];
      case '=': return Number(values[0] === values[1]);
      default: throw new Error('Unknown math operation');
    }
  }
  function normalizeAnswer(value) {
    const text = String(value).trim();
    return /^-?\d+$/.test(text) ? String(Number(text)) : text;
  }
  function checkAnswer(question, value) { return value !== '' && normalizeAnswer(value) === normalizeAnswer(question.answer); }
  function packages(amount) {
    if (amount <= 12) return { hundreds: 0, tens: 0, singles: amount };
    return { hundreds: Math.floor(amount / 100), tens: Math.floor(amount % 100 / 10), singles: amount % 10 };
  }
  function escape(value) { return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function objects(amount, icon = '🍎') {
    if (amount === null) return '<div class="unknown" aria-label="数量未知">?</div>';
    if (amount === 0) return '<div class="objects"><span class="package">空空的</span></div>';
    const parts = packages(amount);
    const group = (count, size) => Array.from({ length: count }, () => `<span class="package" aria-label="一箱${size}个"><em aria-hidden="true">📦</em>${size}</span>`).join('');
    const singles = Array.from({ length: parts.singles }, (_, i) => `<span class="object" aria-hidden="true">${icon === '🐾' ? ['🐰', '🐻', '🐱', '🦊'][i % 4] : icon}</span>`).join('');
    return `<div class="objects" aria-label="共${amount}个">${group(parts.hundreds, 100)}${group(parts.tens, 10)}${singles}</div>${parts.hundreds || parts.tens ? '<span class="package-legend">箱上数字＝这一箱的数量</span>' : ''}`;
  }
  let activeAudio = null;
  function stopSpeech() {
    if (activeAudio) { activeAudio.pause(); activeAudio.onended = null; activeAudio.onerror = null; activeAudio = null; }
    try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (_) {}
  }
  function withProgress(href) {
    const base = String(href).split('#')[0];
    const valid = ['index.html', ...(window.FOREST_LESSONS || []).map(l => l.title + '.html')];
    return fileMode && valid.includes(base) ? base + '#fm=' + encodeURIComponent(JSON.stringify(state)) : href;
  }
  function speak(text) {
    stopSpeech();
    if (!state.sound) return { ok: false, reason: 'muted' };
    const clip = window.FOREST_AUDIO && window.FOREST_AUDIO[text];
    if (clip) {
      try {
        const player = new window.Audio(clip); activeAudio = player;
        const failed = () => {
          if (activeAudio !== player) return;
          activeAudio = null;
          window.dispatchEvent(new CustomEvent('forest-speech-error'));
        };
        player.onended = () => { if (activeAudio === player) activeAudio = null; };
        player.onerror = failed;
        const playing = player.play();
        if (playing && playing.catch) playing.catch(failed);
        return { ok: true };
      } catch (_) { activeAudio = null; return { ok: false, reason: 'unavailable' }; }
    }
    return { ok: false, reason: 'unavailable' };
  }
  window.Forest = {
    get state() { return state; }, get storageAvailable() { return available; },
    progress, current, solve, explore, isComplete, sanitize, mergeProgress, withProgress, save, evaluate, checkAnswer, packages, escape, objects, speak, stopSpeech,
    toggleSound() { state.sound = !state.sound; if (!state.sound) stopSpeech(); save(); return state.sound; }
  };
  if (fileMode && typeof document !== 'undefined') document.addEventListener('click', event => {
    const anchor = event.target.closest('a[href]');
    if (anchor) anchor.setAttribute('href', withProgress(anchor.getAttribute('href')));
  });
})();
