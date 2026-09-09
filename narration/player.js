/* Pre-recorded voice A. No runtime speech service or system voice fallback. */
(function () {
  'use strict';
  let current = null, lastText = '', status = null;
  function stop() {
    if (current) { current.pause(); current.onended = null; current.onerror = null; current = null; }
  }
  function isMuted() { return document.getElementById('muteBtn')?.textContent.includes('🔇'); }
  function say(text) {
    stop(); lastText = String(text || '');
    if (!lastText || isMuted()) return;
    const sources = window.NarrationResolver ? window.NarrationResolver.resolve(lastText) : (window.LESSON_AUDIO?.[lastText] ? [window.LESSON_AUDIO[lastText]] : null);
    const failed = () => { if (status) status.textContent = '这段配音暂时没读出来，可以再点重听。'; };
    if (!sources) { failed(); console.warn('[local narration] Missing clip:', lastText); return; }
    if (!sources.length) return;
    let index = 0, queue;
    try { queue = sources.map(source => { const audio = new Audio(source); audio.preload = 'auto'; return audio; }); } catch (_) { failed(); return; }
    // Reuse the element started by the user's tap, including subsequent fragments on mobile.
    const player = queue[0]; current = player;
    const playNext = () => {
      if (current !== player) return;
      const position = index++;
      if (position) player.src = queue[position].src;
      if (status) status.textContent = '';
      const error = () => { if (current === player && index === position + 1) { stop(); failed(); } };
      player.onerror = error;
      player.onended = () => {
        if (current !== player || index !== position + 1) return;
        if (index < sources.length && !isMuted()) playNext();
        else current = null;
      };
      try { const pending = player.play(); if (pending?.catch) pending.catch(error); } catch (_) { error(); }
    };
    playNext();
  }
  window.LessonNarrator = { say, stop, resolve: text => window.NarrationResolver ? window.NarrationResolver.resolve(text) : (window.LESSON_AUDIO?.[text] ? [window.LESSON_AUDIO[text]] : null) };
  window.addEventListener('pagehide', stop);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  document.addEventListener('click', event => {
    if (event.target.closest('#muteBtn, #homeBtn, #nextChapter, a[href], .pill')) stop();
  }, true);
  function mount() {
    const footer = document.createElement('div');
    footer.style.cssText = 'padding:18px;text-align:center;font:14px system-ui;color:#64748b';
    const label = document.createElement('span'); label.textContent = '本地合成配音 A · ';
    const replay = document.createElement('button'); replay.type = 'button'; replay.textContent = '🔊 重听刚才一句';
    replay.style.cssText = 'min-height:48px;padding:10px 16px;border:1px solid #cbd5e1;border-radius:12px;background:white;color:#334155;cursor:pointer';
    replay.addEventListener('click', () => { if (isMuted()) { status.textContent = '声音关着呢，先打开声音再听。'; return; } if (lastText) say(lastText); else status.textContent = '先开始探索，就能听见配音啦。'; });
    status = document.createElement('p'); status.setAttribute('role', 'status');
    footer.append(label, replay, status); document.body.append(footer);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true }); else mount();
})();
