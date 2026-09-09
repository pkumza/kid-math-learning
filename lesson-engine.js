"use strict";
/* 通用关卡引擎：读取 window.LESSON_CONFIG 渲染整关。
   蓝本：lesson-batch-61-66.js，新增配置自检与无障碍支持（aria、焦点管理、键盘可达）。 */
(function(){
  const cfg = window.LESSON_CONFIG;
  if(!cfg) return;

  const $=(s,el=document)=>el.querySelector(s);
  const $$=(s,el=document)=>Array.prototype.slice.call(el.querySelectorAll(s));
  let muted=false, audioCtx=null, zhVoice=null, maxStep=0, answered=false;
  let practiceIndex=0, challengeIndex=0, inChallenge=false, revealedCount=0;
  const hasChallenge=Array.isArray(cfg.challenge)&&cfg.challenge.length>0;
  const lastStep=hasChallenge?4:3;

  function validateConfig(){
    const warn=(msg)=>{ if(window.console&&console.warn) console.warn('[lesson-engine]['+(cfg.id||'?')+'] '+msg); };
    const p=cfg.practice||[], c=cfg.challenge||[];
    if(p.length<3||p.length>6) warn('practice 题量 '+p.length+' 超出 3~6 规则');
    if(c.length<1||c.length>2) warn('challenge 题量 '+c.length+' 超出 1~2 规则');
    p.concat(c).forEach((q,i)=>{ if(!q.hint) warn('第 '+(i+1)+' 题缺少 hint'); });
    if(!cfg.explore||!cfg.explore.reveals||!cfg.explore.reveals.length) warn('explore.reveals 为空');
  }
  validateConfig();

  function ac(){ if(!audioCtx){ try{audioCtx=new (window.AudioContext||window.webkitAudioContext)();}catch(e){} } return audioCtx; }
  function beep(freq,dur,type,vol,when){
    if(muted) return; const c=ac(); if(!c) return;
    const t=c.currentTime+(when||0), o=c.createOscillator(), g=c.createGain();
    o.type=type||'sine'; o.frequency.value=freq;
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(vol||0.15,t+0.01);
    g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t+dur+0.02);
  }
  const sClick=()=>beep(680,0.06,'triangle',0.12,0);
  const sGood=()=>[523,659,784].forEach((f,i)=>beep(f,0.12,'sine',0.16,i*0.09));
  const sWin=()=>[523,659,784,1047,1319].forEach((f,i)=>beep(f,0.16,'sine',0.18,i*0.12));
  const sBad=()=>beep(190,0.2,'sawtooth',0.1,0);

  function pickVoice(){
    if(!('speechSynthesis'in window)) return;
    const vs=speechSynthesis.getVoices(); if(!vs||!vs.length) return;
    const zh=vs.filter(v=>/zh|cmn|chinese|普通话|国语|中文/i.test((v.lang||'')+' '+(v.name||'')));
    const female=/婷婷|美嘉|思琪|善怡|静|丽|语嫣|晓|Ting-?Ting|Mei-?Jia|Sin-?ji|Yu-?shu|Tian-?Tian|Li-?mu|Han|female|女/i;
    const male=/男|male|Yu-?Long|Liang|国梁/i;
    zhVoice = zh.find(v=>female.test(v.name))
           || zh.find(v=>/zh[-_]?CN/i.test(v.lang)&&!male.test(v.name))
           || zh.find(v=>!male.test(v.name))
           || zh[0] || null;
  }
  if('speechSynthesis'in window){ pickVoice(); speechSynthesis.onvoiceschanged=pickVoice; setTimeout(pickVoice,300); setTimeout(pickVoice,1200); }
  function say(text){ if(!muted && window.LessonNarrator) window.LessonNarrator.say(text); }

  function visualHTML(v){
    if(!v) return '';
    if(v.html) return v.html;
    if(v.type==='row'){
      return '<div class="visual-row">'+(v.items||[]).map(item=>{
        if(typeof item==='string') return '<span class="sign">'+item+'</span>';
        return '<span class="thing '+(item.cls||'')+'">'+item.text+'</span>';
      }).join('')+'</div>';
    }
    if(v.type==='count'){
      return '<div class="count-line">'+Array.from({length:v.count||0},(_,i)=>'<span class="thing small '+(v.cls||'')+'">'+(v.text||String(i+1))+'</span>').join('')+'</div>';
    }
    if(v.type==='grid'){
      const cells=Array.from({length:(v.rows||1)*(v.cols||1)},()=>'<span class="mini-cell"></span>').join('');
      return '<div class="mini-grid" style="grid-template-columns:repeat('+v.cols+',34px)">'+cells+'</div>';
    }
    if(v.type==='clues'){
      return '<div class="logic-list">'+(v.items||[]).map(c=>'<div class="clue">'+c+'</div>').join('')+'</div>';
    }
    return '';
  }
  function cleanText(html){
    return String(html||'').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
  }
  function renderHint(text){
    const hint=$('#qHint');
    hint.innerHTML='';
    if(!text) return;
    const btn=document.createElement('button');
    btn.type='button';
    btn.className='hint-btn';
    btn.textContent='💡 提示';
    btn.setAttribute('aria-expanded','false');
    btn.setAttribute('aria-controls','hintText');
    const body=document.createElement('span');
    body.className='hint-text';
    body.id='hintText';
    body.setAttribute('role','note');
    body.hidden=true;
    body.innerHTML='💡 '+text;
    btn.addEventListener('click',()=>{
      sClick();
      btn.hidden=true;
      btn.setAttribute('aria-expanded','true');
      body.hidden=false;
      say(cleanText(text));
    });
    hint.appendChild(btn);
    hint.appendChild(body);
  }

  function page(){
    document.title=(cfg.title||'数学小课堂')+' · 数学小课堂';
    document.body.innerHTML=
      '<canvas id="confetti" aria-hidden="true"></canvas><div class="wrap">'+
        '<header><div class="brand"><span class="fox" aria-hidden="true">🦊</span><div>数学王国<br><small>'+cfg.title+'</small></div></div>'+
          '<div class="tools"><button class="icon-btn" id="homeBtn" title="回家" aria-label="返回首页">🏠</button><button class="icon-btn" id="muteBtn" title="声音开关" aria-label="声音开关" aria-pressed="false">🔊</button></div></header>'+
        '<div class="steps" role="navigation" aria-label="关卡步骤">'+
          '<button type="button" class="pill" data-step="1">① 探索</button>'+
          '<button type="button" class="pill" data-step="2">② 闯关</button>'+
          (hasChallenge?'<button type="button" class="pill" data-step="3">③ 挑战</button><button type="button" class="pill" data-step="4">④ 完成</button>':'<button type="button" class="pill" data-step="3">③ 完成</button>')+
        '</div>'+
        '<section class="screen on" id="welcome"><div class="card '+(cfg.hard?'hard':'')+'">'+
          '<div class="hard-banner">🌟 困难关 Boss！需要多想一步</div>'+
          '<div class="hero-visual" aria-hidden="true">'+cfg.emoji+'</div><h1 tabindex="-1">'+cfg.heading+'</h1>'+
          '<span class="pinyin">'+(cfg.pinyin||'')+'</span><p class="lead">'+cfg.intro+'</p>'+
          '<button class="big-btn" id="startBtn">开始探索 →</button>'+
          '<details><summary>👨‍👩‍👧 给爸爸妈妈的话（点开）</summary><p>'+cfg.parentNote+'</p></details>'+
        '</div></section>'+
        '<section class="screen" id="explore"><div class="card '+(cfg.hard?'hard':'')+'">'+
          '<div class="hard-banner">🌟 困难关 Boss！先看线索，再做判断</div>'+
          '<h2 tabindex="-1">'+cfg.explore.title+'</h2><p class="lead" style="margin-top:0">'+cfg.explore.lead+'</p>'+
          '<div class="stage" id="exploreStage">'+visualHTML(cfg.explore.visual)+'</div>'+
          '<div class="reveal-grid" id="revealGrid"></div><div class="note" id="note">'+cfg.explore.note+'</div>'+
          '<div class="unlock" id="unlock" aria-live="polite"></div><button class="big-btn purple" id="toPractice" disabled>去闯关 →</button>'+
        '</div></section>'+
        '<section class="screen" id="practice"><div class="card" id="practiceCard">'+
          '<div class="hard-banner">🌟 挑战题来了！把前面的本领连起来</div>'+
          '<div class="level-tag" id="levelTag"></div><div class="q-big" id="qBig" tabindex="-1"></div><div class="q-hint" id="qHint"></div>'+
          '<div class="stage" id="questionStage"></div><div class="ask" id="ask"></div><div class="options" id="options" role="group" aria-label="答案选项"></div>'+
          '<div class="feedback" id="feedback" role="status" aria-live="polite"></div><button class="big-btn" id="nextLevel" style="display:none">下一关 →</button>'+
        '</div></section>'+
        '<section class="screen" id="done"><div class="card '+(cfg.hard?'hard':'')+'">'+
          '<div class="badge" aria-hidden="true">'+(cfg.done.badge||'🎖️')+'</div><h1 tabindex="-1">太厉害啦！</h1><div class="trophy-name">'+cfg.done.title+'</div>'+
          '<p class="lead">'+cfg.done.text+'</p><p class="lead" style="font-size:.95rem">'+(cfg.done.extra||'')+'</p>'+
          '<button class="big-btn" id="nextChapter">'+(cfg.nextText||'进入下一关 →')+'</button><button class="big-btn orange" id="again">再玩一次 🔁</button>'+
        '</div></section>'+
      '</div>';
  }

  function show(id,step){if(window.LessonNarrator)window.LessonNarrator.stop();
    $$('.screen').forEach(s=>s.classList.remove('on'));
    const screen=$('#'+id);
    screen.classList.add('on');
    $$('.pill').forEach(p=>{
      const active=+p.dataset.step===step;
      p.classList.toggle('active',active);
      if(active) p.setAttribute('aria-current','step'); else p.removeAttribute('aria-current');
    });
    if(typeof step==='number' && step>maxStep) maxStep=step;
    syncPills();
    window.scrollTo({top:0,behavior:'smooth'});
    const heading=screen.querySelector('h1,h2');
    if(heading) heading.focus({preventScroll:true});
  }
  function syncPills(){
    $$('.pill').forEach(p=>{
      const s=+p.dataset.step;
      p.classList.toggle('nav-on',s<=maxStep);
      p.classList.toggle('nav-locked',s>maxStep);
      if(s>maxStep) p.setAttribute('aria-disabled','true'); else p.removeAttribute('aria-disabled');
    });
  }
  function unlockPractice(){
    const btn=$('#toPractice');
    btn.disabled=false; btn.classList.add('ready');
    $('#unlock').textContent=cfg.explore.unlock||'🎉 你发现了小秘密！去闯关吧！';
    sWin(); say(cfg.explore.unlockVoice||cfg.explore.unlock||'去闯关吧！');
  }
  function renderExplore(){
    const grid=$('#revealGrid'); grid.innerHTML='';
    revealedCount=0;
    (cfg.explore.reveals||[]).forEach((r,i)=>{
      const b=document.createElement('button');
      b.type='button';
      b.className='reveal-card';
      b.setAttribute('aria-label',cleanText(r.title)+'，点按查看');
      b.innerHTML='<div class="pic" aria-hidden="true">'+r.pic+'</div><div class="title">'+r.title+'</div><div class="answer">'+r.answer+'</div>';
      b.addEventListener('click',()=>{
        if(b.classList.contains('done')) return;
        sGood(); b.classList.add('done'); revealedCount++;
        b.setAttribute('aria-label',cleanText(r.title)+'，'+cleanText(r.answer));
        say(r.voice||r.answer.replace(/<[^>]+>/g,''));
        if(revealedCount>=Math.min(2,(cfg.explore.reveals||[]).length) && $('#toPractice').disabled) unlockPractice();
      });
      grid.appendChild(b);
      if(i===0) setTimeout(()=>b.focus({preventScroll:true}),50);
    });
  }
  function renderProblem(){
    answered=false;
    const arr=inChallenge?cfg.challenge:cfg.practice;
    const idx=inChallenge?challengeIndex:practiceIndex;
    const p=arr[idx];
    const card=$('#practiceCard');
    card.classList.toggle('hard', inChallenge||!!p.hard);
    $('#levelTag').textContent=inChallenge ? `🌟 挑战 ${idx+1} / ${arr.length}` : `第 ${idx+1} / ${arr.length} 关`;
    $('#qBig').innerHTML=p.q;
    renderHint(p.hint||'');
    $('#questionStage').innerHTML=visualHTML(p.visual);
    $('#ask').textContent=p.ask||'选一选 👇';
    $('#feedback').textContent='';
    $('#nextLevel').style.display='none';
    const opts=(p.options||[]).slice().sort(()=>Math.random()-0.5);
    const box=$('#options'); box.innerHTML='';
    opts.forEach(v=>{
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='opt'+(String(v).length>4?' long':'');
      btn.textContent=v;
      btn.addEventListener('click',()=>choose(btn,v,p));
      box.appendChild(btn);
    });
    $('#qBig').focus({preventScroll:true});
    say(p.voice||cleanText(p.q));
  }
  function choose(btn,v,p){
    if(answered) return;
    if(String(v)===String(p.answer)){
      answered=true;
      btn.classList.add('correct'); sGood();
      $('#feedback').innerHTML='<span class="gr">答对啦！🎉</span><div class="stars" aria-hidden="true">⭐⭐⭐</div>';
      say(p.winVoice||'答对啦！你真厉害！');
      $$('.opt').forEach(o=>o.disabled=true);
      const arr=inChallenge?cfg.challenge:cfg.practice;
      const idx=inChallenge?challengeIndex:practiceIndex;
      const nb=$('#nextLevel');
      if(!inChallenge && idx===arr.length-1 && hasChallenge) nb.textContent='进入挑战 🌟';
      else nb.textContent=(idx===arr.length-1)?'完成啦 🎉':'下一关 →';
      nb.style.display='block';
      nb.focus({preventScroll:true});
    }else{
      btn.classList.add('wrong'); sBad();
      $('#feedback').innerHTML='<span class="or">'+(p.wrong||'再想一想～')+'</span>';
      say(p.wrongVoice||p.wrong||'再想一想。');
      setTimeout(()=>btn.classList.remove('wrong'),400);
    }
  }
  function nextProblem(){
    sClick();
    if(inChallenge){
      if(challengeIndex===cfg.challenge.length-1){ finish(); }
      else{ challengeIndex++; renderProblem(); }
      return;
    }
    if(practiceIndex===cfg.practice.length-1){
      if(hasChallenge){
        inChallenge=true; challengeIndex=0; show('practice',3); renderProblem();
        say('挑战时间到！这些题更难一点哦。');
      }else{
        finish();
      }
    }else{
      practiceIndex++; renderProblem();
    }
  }
  function startPractice(){
    inChallenge=false; practiceIndex=0; challengeIndex=0;
    show('practice',2); renderProblem();
  }
  function finish(){
    show('done',lastStep); sWin(); say(cfg.done.voice||'太厉害啦！你通关啦！'); confetti(); markDone();
  }
  function resetAll(){
    answered=false; practiceIndex=0; challengeIndex=0; inChallenge=false; maxStep=1;
    $('#toPractice').disabled=true; $('#toPractice').classList.remove('ready'); $('#unlock').textContent='';
    renderExplore(); show('explore',1);
  }
  function markDone(){
    try{ localStorage.setItem('yswg:done:'+cfg.id,'1'); }catch(e){}
  }
  function confetti(){
    const cv=$('#confetti'), ctx=cv.getContext('2d');
    cv.width=innerWidth; cv.height=innerHeight; cv.style.display='block';
    const colors=['#2563EB','#F97316','#16A34A','#EAB308','#EC4899','#7C3AED'];
    const P=[];
    for(let i=0;i<150;i++) P.push({
      x:innerWidth/2+(Math.random()-0.5)*120, y:innerHeight*0.28,
      vx:(Math.random()-0.5)*13, vy:Math.random()*-13-3, g:0.32,
      s:7+Math.random()*9, c:colors[i%colors.length], rot:Math.random()*6, vr:(Math.random()-0.5)*0.4
    });
    let t=0;
    (function anim(){
      t++; ctx.clearRect(0,0,cv.width,cv.height);
      P.forEach(p=>{ p.vy+=p.g; p.x+=p.vx; p.y+=p.vy; p.rot+=p.vr;
        ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot); ctx.fillStyle=p.c;
        ctx.fillRect(-p.s/2,-p.s/2,p.s,p.s*0.6); ctx.restore();
      });
      if(t<150) requestAnimationFrame(anim); else cv.style.display='none';
    })();
  }

  page();
  renderExplore();
  syncPills();
  $('#startBtn').addEventListener('click',()=>{ ac(); sClick(); show('explore',1); say(cfg.explore.voice||cfg.explore.lead.replace(/<[^>]+>/g,'')); });
  $('#toPractice').addEventListener('click',()=>{ sClick(); startPractice(); });
  $('#nextLevel').addEventListener('click',nextProblem);
  $('#again').addEventListener('click',()=>{ sClick(); resetAll(); say('我们再玩一次！'); });
  $('#nextChapter').addEventListener('click',()=>{ try{ if('speechSynthesis'in window)speechSynthesis.cancel(); }catch(e){} location.href=cfg.nextHref||'index.html'; });
  $('#homeBtn').addEventListener('click',()=>{ sClick(); try{ if('speechSynthesis'in window)speechSynthesis.cancel(); }catch(e){} location.href='index.html'; });
  $('#muteBtn').addEventListener('click',()=>{
    muted=!muted; $('#muteBtn').textContent=muted?'🔇':'🔊';
    $('#muteBtn').setAttribute('aria-pressed',muted?'true':'false');
    if(muted&&'speechSynthesis'in window) speechSynthesis.cancel(); else sClick();
  });
  $$('.pill').forEach(p=>p.addEventListener('click',()=>{
    const step=+p.dataset.step; if(step>maxStep) return;
    if(step===1) show('explore',1);
    else if(step===2) startPractice();
    else if(hasChallenge && step===3){ inChallenge=true; challengeIndex=0; show('practice',3); renderProblem(); }
    else show('done',lastStep);
  }));
})();
