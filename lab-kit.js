"use strict";
/* 数学实验室外壳。
   声音、朗读、撒花从 lesson-engine.js 复制后再接到 Lab.*，不改原文件。
   不用 document.body.innerHTML，避免冲掉 mount 后面的脚本。 */
(function(){
  let muted=false, audioCtx=null, zhVoice=null;
  let current=null;
  let doneIds=new Set();
  let statusEl=null, bannerEl=null, againBtn=null, goalListEl=null;

  function ac(){
    if(!audioCtx){
      try{ audioCtx=new (window.AudioContext||window.webkitAudioContext)(); }
      catch(e){}
    }
    if(audioCtx&&audioCtx.state==='suspended'){
      try{ audioCtx.resume(); }catch(e){}
    }
    return audioCtx;
  }
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
  if('speechSynthesis'in window){
    pickVoice();
    speechSynthesis.onvoiceschanged=pickVoice;
    setTimeout(pickVoice,300);
    setTimeout(pickVoice,1200);
  }
  function say(text){
    if(muted||!text||!('speechSynthesis'in window)) return;
    try{
      if(!zhVoice) pickVoice();
      speechSynthesis.cancel();
      const u=new SpeechSynthesisUtterance(text+'　。');
      u.lang='zh-CN'; if(zhVoice) u.voice=zhVoice; u.rate=0.95; u.pitch=1.1;
      speechSynthesis.speak(u);
    }catch(e){}
  }
  function cleanText(html){
    const raw=String(html==null?'':html);
    try{
      const tmp=document.createElement('div');
      tmp.innerHTML=raw;
      return (tmp.textContent||'').replace(/\s+/g,' ').trim();
    }catch(e){
      return raw.replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
    }
  }
  function confetti(){
    const cv=document.getElementById('confetti');
    if(!cv) return;
    const ctx=cv.getContext('2d');
    if(!ctx) return;
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

  function normId(id){ return id==null?'':String(id); }
  function goalsKey(){ return 'yswg:labgoals:'+current.id; }
  function doneKey(){ return 'yswg:done:'+current.id; }
  function allDone(){
    return !!(current&&current.goals.length>0&&doneIds.size===current.goals.length);
  }
  function paintGoals(){
    if(!goalListEl) return;
    goalListEl.querySelectorAll('.lab-goal').forEach(node=>{
      const id=node.getAttribute('data-goal-id');
      const on=doneIds.has(id);
      node.classList.toggle('is-done', on);
      const mark=node.querySelector('.lab-goal-mark');
      if(mark) mark.textContent=on?'✓':'';
      const state=node.querySelector('.lab-goal-state');
      if(state) state.textContent=on?'已完成':'未完成';
    });
  }
  function showReplay(on){
    if(againBtn) againBtn.hidden=!on;
  }
  function showBanner(on){
    if(bannerEl) bannerEl.hidden=!on;
  }
  function loadProgress(){
    doneIds=new Set();
    let saved=[];
    let flagged=false;
    try{
      const raw=localStorage.getItem(goalsKey());
      if(raw){
        const parsed=JSON.parse(raw);
        if(Array.isArray(parsed)) saved=parsed;
      }
    }catch(e){}
    try{ flagged=localStorage.getItem(doneKey())==='1'; }catch(e){}
    const known=new Set(current.goals.map(g=>normId(g&&g.id)).filter(Boolean));
    saved.forEach(id=>{ const key=normId(id); if(known.has(key)) doneIds.add(key); });
    if(flagged) known.forEach(key=>doneIds.add(key));
    paintGoals();
    const done=allDone();
    showReplay(done);
    showBanner(done);
  }
  function onAgain(){
    sClick();
    try{ if('speechSynthesis'in window) speechSynthesis.cancel(); }catch(e){}
    try{
      localStorage.removeItem(goalsKey());
      localStorage.removeItem(doneKey());
    }catch(e){}
    doneIds=new Set();
    paintGoals();
    showReplay(false);
    showBanner(false);
    if(current&&typeof current.onReset==='function') current.onReset();
  }
  function hintNode(h, index){
    const hid='lab-hint-'+String(h&&h.id!=null?h.id:index).replace(/[^\w-]/g,'');
    const btn=document.createElement('button');
    btn.type='button';
    btn.className='lab-hint-btn';
    btn.textContent='💡 提示';
    btn.setAttribute('aria-expanded','false');
    btn.setAttribute('aria-controls', hid);
    const body=document.createElement('div');
    body.className='lab-hint-text';
    body.id=hid;
    body.hidden=true;
    body.setAttribute('role','note');
    body.innerHTML='💡 '+(h&&h.text||'');
    btn.addEventListener('click',()=>{
      sClick();
      btn.setAttribute('aria-expanded','true');
      body.hidden=false;
      say(cleanText(h&&h.text||''));
    });
    return {btn, body};
  }

  function mount(cfg){
    if(!document.body) throw new Error('Lab.mount 需要在 body 出现后调用');
    cfg=cfg||{};
    const id=cfg.id||'lab';
    const goals=Array.isArray(cfg.goals)?cfg.goals.slice():[];
    const hints=Array.isArray(cfg.hints)?cfg.hints.slice():[];
    current={ id:id, goals:goals, onReset:cfg.onReset };
    doneIds=new Set();
    if(cfg.title) document.title=cfg.title+' · 数学实验室';

    const canvas=document.createElement('canvas');
    canvas.id='confetti';
    canvas.setAttribute('aria-hidden','true');

    const wrap=document.createElement('div');
    wrap.className='lab-wrap';
    wrap.setAttribute('data-id', id);

    const header=document.createElement('header');
    header.className='lab-header';
    const brand=document.createElement('div');
    brand.className='lab-brand';
    const fox=document.createElement('span');
    fox.className='lab-fox';
    fox.setAttribute('aria-hidden','true');
    fox.textContent='🦊';
    const brandText=document.createElement('div');
    brandText.appendChild(document.createTextNode('数学实验室'));
    brandText.appendChild(document.createElement('br'));
    const small=document.createElement('small');
    small.textContent=cfg.title||'';
    brandText.appendChild(small);
    brand.appendChild(fox);
    brand.appendChild(brandText);

    const tools=document.createElement('div');
    tools.className='lab-tools';
    const homeBtn=document.createElement('button');
    homeBtn.type='button';
    homeBtn.className='lab-icon-btn';
    homeBtn.id='lab-home';
    homeBtn.textContent='🏠';
    homeBtn.setAttribute('aria-label','回首页');
    homeBtn.title='回首页';
    const muteBtn=document.createElement('button');
    muteBtn.type='button';
    muteBtn.className='lab-icon-btn';
    muteBtn.id='lab-mute';
    muteBtn.textContent='🔊';
    muteBtn.setAttribute('aria-label','声音开关');
    muteBtn.setAttribute('aria-pressed','false');
    muteBtn.title='声音开关';
    tools.appendChild(homeBtn);
    tools.appendChild(muteBtn);
    header.appendChild(brand);
    header.appendChild(tools);

    bannerEl=document.createElement('p');
    bannerEl.className='lab-banner';
    bannerEl.id='lab-banner';
    bannerEl.hidden=true;
    bannerEl.textContent='这张卡已经点亮星星';

    const layout=document.createElement('div');
    layout.className='lab-layout';
    const main=document.createElement('main');
    main.className='lab-main';

    const lead=document.createElement('p');
    lead.className='lab-lead';
    if(cfg.emoji){
      const em=document.createElement('span');
      em.className='lab-emoji';
      em.setAttribute('aria-hidden','true');
      em.textContent=cfg.emoji+' ';
      lead.appendChild(em);
    }
    lead.appendChild(document.createTextNode(cfg.lead||''));

    let stage=document.getElementById('stage');
    if(!stage){
      stage=document.createElement('div');
      stage.id='stage';
    }

    statusEl=document.createElement('p');
    statusEl.id='lab-status';
    statusEl.className='lab-status';
    statusEl.setAttribute('role','status');
    statusEl.setAttribute('aria-live','polite');

    const hintsWrap=document.createElement('div');
    hintsWrap.className='lab-hints';
    hints.forEach((h,i)=>{
      const nodes=hintNode(h,i);
      hintsWrap.appendChild(nodes.btn);
      hintsWrap.appendChild(nodes.body);
    });

    const details=document.createElement('details');
    details.className='lab-parent';
    const summary=document.createElement('summary');
    summary.textContent='👨‍👩‍👧 给爸爸妈妈的话（点开）';
    const parentBody=document.createElement('div');
    parentBody.className='lab-parent-body';
    parentBody.innerHTML=cfg.parent||'';
    details.appendChild(summary);
    details.appendChild(parentBody);

    main.appendChild(lead);
    main.appendChild(stage);
    main.appendChild(statusEl);
    main.appendChild(hintsWrap);
    main.appendChild(details);

    const aside=document.createElement('aside');
    aside.className='lab-goals';
    aside.setAttribute('aria-label','小目标');
    const kicker=document.createElement('p');
    kicker.className='lab-kicker';
    kicker.textContent='小目标';
    goalListEl=document.createElement('ul');
    goalListEl.className='lab-goal-list';
    goals.forEach(g=>{
      const li=document.createElement('li');
      li.className='lab-goal';
      li.setAttribute('data-goal-id', normId(g&&g.id));
      const mark=document.createElement('span');
      mark.className='lab-goal-mark';
      mark.setAttribute('aria-hidden','true');
      const text=document.createElement('span');
      text.className='lab-goal-text';
      text.textContent=g&&g.text||'';
      const state=document.createElement('span');
      state.className='sr-only lab-goal-state';
      state.textContent='未完成';
      li.appendChild(mark);
      li.appendChild(text);
      li.appendChild(state);
      goalListEl.appendChild(li);
    });
    againBtn=document.createElement('button');
    againBtn.type='button';
    againBtn.className='lab-btn';
    againBtn.id='lab-again';
    againBtn.textContent='再玩一次';
    againBtn.hidden=true;
    aside.appendChild(kicker);
    aside.appendChild(goalListEl);
    aside.appendChild(againBtn);

    layout.appendChild(main);
    layout.appendChild(aside);
    wrap.appendChild(header);
    wrap.appendChild(bannerEl);
    wrap.appendChild(layout);

    homeBtn.addEventListener('click',()=>{
      try{ if('speechSynthesis'in window) speechSynthesis.cancel(); }catch(e){}
      location.href='index.html';
    });
    muteBtn.addEventListener('click',()=>{
      muted=!muted;
      muteBtn.textContent=muted?'🔇':'🔊';
      muteBtn.setAttribute('aria-pressed', muted?'true':'false');
      if(muted&&'speechSynthesis'in window) speechSynthesis.cancel();
      else sClick();
    });
    againBtn.addEventListener('click', onAgain);

    loadProgress();
    document.body.appendChild(canvas);
    document.body.appendChild(wrap);
  }

  function goal(id){
    if(!current) return false;
    const key=normId(id);
    if(!key) return false;
    const item=current.goals.find(g=>g&&normId(g.id)===key);
    if(!item||doneIds.has(key)) return false;
    doneIds.add(key);
    paintGoals();
    sGood();
    say(cleanText(item.text||''));
    try{ localStorage.setItem(goalsKey(), JSON.stringify(Array.from(doneIds))); }catch(e){}
    if(allDone()){
      try{ localStorage.setItem(doneKey(),'1'); }catch(e){}
      sWin();
      confetti();
      say('小目标都完成啦！');
      showReplay(true);
    }
    return true;
  }
  function isGoal(id){
    return !!(current&&doneIds.has(normId(id)));
  }
  function toast(text){
    if(!statusEl) return;
    statusEl.textContent=text==null?'':String(text);
  }

  /* 例：
     134217728n → digits "134,217,728"，units "1亿3421万7728"
     100000000n → units "1亿"
     '18446744073709551615' → digits "18,446,744,073,709,551,615"，
       units "1844亿亿6744万亿737亿955万1615"
     number 只有 Number.isSafeInteger 才转 bigint，否则按字符串处理会丢精度。 */
  function formatCn(v){
    let raw;
    if(typeof v==='bigint') raw=v.toString();
    else if(typeof v==='number'&&Number.isSafeInteger(v)) raw=BigInt(v).toString();
    else raw=String(v==null?'':v).trim();
    let neg=false;
    if(raw.charAt(0)==='-'){ neg=true; raw=raw.slice(1); }
    if(!/^\d+$/.test(raw)){
      const shown=(neg?'-':'')+raw;
      return {digits:shown, units:shown};
    }
    raw=raw.replace(/^0+(?=\d)/,'');
    if(raw==='0') return {digits:'0', units:'0'};
    const digits=(neg?'-':'')+raw.replace(/\B(?=(\d{3})+(?!\d))/g,',');
    const unitNames=['','万','亿','万亿','亿亿'];
    const groups=[];
    for(let end=raw.length; end>0; end-=4){
      groups.push(raw.slice(Math.max(0, end-4), end));
    }
    let units='';
    for(let i=groups.length-1; i>=0; i--){
      const n=Number(groups[i]);
      if(!n) continue;
      units+=String(n)+(unitNames[i]||'');
    }
    if(neg) units='-'+units;
    return {digits:digits, units:units};
  }

  const FORMAT_EXAMPLES=[
    [134217728n, '134,217,728', '1亿3421万7728'],
    [100000000n, '100,000,000', '1亿'],
    ['18446744073709551615', '18,446,744,073,709,551,615', '1844亿亿6744万亿737亿955万1615']
  ];
  function selfCheckFormatCn(){
    FORMAT_EXAMPLES.forEach(row=>{
      const got=formatCn(row[0]);
      if(!got||got.digits!==row[1]||got.units!==row[2]){
        if(typeof console!=='undefined'&&console.warn){
          console.warn('[lab-kit] formatCn 自检未通过', String(row[0]), got);
        }
      }
    });
  }

  window.Lab={
    mount:mount,
    say:say,
    click:sClick,
    good:sGood,
    bad:sBad,
    win:sWin,
    goal:goal,
    isGoal:isGoal,
    toast:toast,
    formatCn:formatCn
  };
  try{ selfCheckFormatCn(); }catch(e){
    if(typeof console!=='undefined'&&console.warn) console.warn('[lab-kit] formatCn 自检异常', e);
  }
})();
