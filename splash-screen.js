/* Wayfarer first-visit branded entrance. Independent of paid services and app APIs.
   Never waits on fonts, network providers, video, or image decoding. */
(() => {
  'use strict';
  const splash=document.getElementById('wf-splash');
  if(!splash)return;
  const skip=document.getElementById('wf-splash-skip');
  const KEY='wf-splash-seen-v1';
  const OS_REDUCED=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let seen=false, motionOff=false;
  try{seen=sessionStorage.getItem(KEY)==='1';}catch{}
  try{motionOff=localStorage.getItem('wf-visual-motion-v1')==='off';}catch{}
  if(seen||OS_REDUCED||motionOff){splash.remove();return;}
  let finished=false,timeout;
  const close=()=>{
    if(finished)return;
    finished=true;
    clearTimeout(timeout);
    document.removeEventListener('keydown',onKey);
    document.removeEventListener('visibilitychange',onHidden);
    try{sessionStorage.setItem(KEY,'1');}catch{}
    splash.classList.add('wf-splash-closing');
    // Remove DOM on a bounded timer; never wait for a transitionend event.
    setTimeout(()=>splash.remove(),400);
  };
  function onKey(e){if(e.key==='Escape')close();}
  function onHidden(){if(document.visibilityState==='hidden')close();}
  skip?.addEventListener('click',()=>{
    close();
    document.querySelector('#main-content')?.focus({preventScroll:true});
  },{once:true});
  document.addEventListener('keydown',onKey);
  document.addEventListener('visibilitychange',onHidden);
  splash.hidden=false;
  // Decorative entrance only. 1250 ms maximum user-perceived delay,
  // independently of supplier latency or the rest of the web app.
  timeout=setTimeout(close,1250);
  skip?.focus({preventScroll:true});
})();
