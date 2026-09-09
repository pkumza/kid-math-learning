(function () {
  'use strict';
  const F = window.Forest, lessons = window.FOREST_LESSONS;
  function render() {
    let count = 0;
    document.getElementById('shopGrid').innerHTML = lessons.map((lesson, i) => {
      const p = F.progress(lesson.id), done = F.isComplete(lesson, p);
      if (done) count++;
      return `<a class="shop-card ${lesson.color}${done ? ' completed' : ''}" href="${lesson.title}.html"><span class="shop-icon" aria-hidden="true">${lesson.emoji}</span><span class="shop-number">0${i + 1}</span><span class="shop-name">${lesson.title}</span><span class="shop-desc">${lesson.subtitle}<b aria-hidden="true">↗</b></span><span class="shop-status">${done ? '✓ 贴纸收到了' : p.solved.length ? `已帮忙 ${p.solved.length} 次` : lesson.hard ? '多想几步 · 挑战关' : '开门营业'}</span></a>`;
    }).join('');
    document.getElementById('collectionCount').textContent = `我的贴纸 · ${count} / 6`;
    document.getElementById('stickers').innerHTML = lessons.map(l => F.isComplete(l, F.progress(l.id)) ? `<span class="sticker earned" title="${l.title}已完成" aria-label="${l.title}贴纸已获得">${l.emoji}</span>` : `<span class="sticker empty" title="完成${l.title}后获得" aria-label="${l.title}贴纸待获得">✿</span>`).join('');
    const last = lessons.find(l => l.id === F.state.last && !F.isComplete(l, F.progress(l.id)));
    const next = last || lessons.find(l => !F.isComplete(l, F.progress(l.id))) || lessons[0];
    const link = document.getElementById('continueLink');
    link.href = `${next.title}.html`; link.innerHTML = `${last ? '继续帮忙' : count === 6 ? '再去逛逛' : '去' + next.title} <span aria-hidden="true">↗</span>`;
    if (!F.storageAvailable) document.getElementById('storageNote').textContent = '当前浏览器无法保存进度。本次仍可以玩；关闭页面后，需要重新开始。';
  }
  render();
  window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
})();
