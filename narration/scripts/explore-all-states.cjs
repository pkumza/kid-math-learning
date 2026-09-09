/* Finite exploration states, including intermediate animations and changing quantities. */
module.exports=({w,d,click,flush,evaluate:run,level})=>{
 const exec=code=>{run(code);flush();};
 switch(level.number){
 case 4:for(const n of [2,3,4,6])exec(`setPlateN(${n});deal()`);break;
 case 5:for(let t=6;t<=20;t++)for(let n=2;n<=5;n++)exec(`TOT=${t};DIV=${n};dealCookies()`);break;
 case 6:for(const b of d.querySelectorAll('#seg button')){click(b);flush();exec('for(let j=0;j<curParts;j++)eatSlice(j)');}break;
 case 8:for(const key of run('Object.keys(RULES)'))exec(`pickRule(${JSON.stringify(key)});doReveal()`);break;
 case 10:for(let h=0;h<=9;h++)for(let t=0;t<=9;t++)for(let o=0;o<=9;o++)exec(`H=${h};T=${t};O=${o};change('o',0)`);break;
 case 12:for(let h=1;h<=12;h++)for(let half=0;half<2;half++)exec(`eHour=${h};eHalf=${half};renderExplore()`);break;
 case 14:for(const b of d.querySelectorAll('#seg button')){click(b);flush();exec('for(let j=0;j<curParts;j++)tapCell(j)');}break;
 case 15:for(const sum of [0,7,10,99,100,101,1000,10001,99999])for(const b of d.querySelectorAll('[data-v]')){exec(`wallet=[${sum}]`);click(b);flush();}break;
 case 21:for(let l=2;l<=6;l++)for(let v=2;v<=5;v++)exec(`len=${l};wid=${v};renderExplore();countSquares()`);break;
 case 22:for(let l=2;l<=6;l++)for(let v=2;v<=5;v++)exec(`eW=${l};eH=${v};renderExplore();walkOnce()`);break;
 case 23:for(let h=1;h<=12;h++)for(let m=0;m<60;m+=5)exec(`eHour=${h};eMin=${m};renderExplore()`);break;
 case 24:case 30:{const rand=w.Math.random;for(const r of [0,.499,.999]){w.Math.random=()=>r;for(const key of run('Object.keys(SCENES)'))exec(`pickScene(${JSON.stringify(key)});${level.number===24?'drawOne':'drawMany'}()`);}w.Math.random=rand;break;}
 case 26:for(const n of [0,10,11,20,99,100,101,110,1000,1001,1010,10000,10001,10010,10100,99999])exec(`say(readChinese(${n}))`);break;
 case 28:for(let s=2;s<=24;s++)for(let e=s;e<=24;e++)exec(`sH=${Math.floor(s/2)};sHalf=${s%2};eH=${Math.floor(e/2)};eHalf=${e%2};renderExplore()`);break;
 case 34:for(let i=0;i<run('MOMENTS.length');i++)exec(`renderMoment(MOMENTS[${i}])`);break;
 case 35:for(let i=0;i<run('EX.length');i++)exec(`exVariant=${i};loadExplore();runCount()`);break;
 case 47:for(const b of d.querySelectorAll('.posbtn')){click(b);flush();exec('computeStep()');}break;
 }
};
