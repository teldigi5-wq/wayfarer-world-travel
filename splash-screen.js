/* Wayfarer first-paint cinematic welcome. Not a supplier loading indicator.
   The overlay is VISIBLE in HTML, before the homepage can paint.
   This controller only dismisses it; no external requests or vendor dependencies. */
(() => {
  'use strict';
  const splash=document.getElementById('wf-splash');
  if(!splash)return;
  const skip=document.getElementById('wf-splash-skip');
  const main=document.getElementById('main-content');
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduced){
    // The OS prefers-reduced-motion setting hides the splash from first paint.
    splash.remove();
    return;
  }
  let closed=false;
  let dismissTimer=null;
  function finish(){
    if(closed)return;
    closed=true;
    clearTimeout(dismissTimer);
    document.removeEventListener('keydown',onKey);
    document.removeEventListener('visibilitychange',onVisibility);
    splash.classList.add('wf-splash-closing');
    // Focus moves to real content before the modal is removed, including on automatic dismissal.
    try{main?.focus({preventScroll:true});}catch{}
    setTimeout(()=>splash.remove(),380);
  }
  function onKey(e){
    if(e.key==='Escape'){finish();return;}
    // aria-modal must also behave modally: keep keyboard focus on Skip,
    // never let a fast Tab keystroke land behind the splash.
    if(e.key==='Tab'&&!closed){
      e.preventDefault();
      skip?.focus({preventScroll:true});
    }
  }
  function onVisibility(){if(document.visibilityState==='hidden')finish();}
  skip?.addEventListener('click',finish,{once:true});
  document.addEventListener('keydown',onKey);
  document.addEventListener('visibilitychange',onVisibility);
  // Always show first on each FULL navigation/reload; internal tabs never replay it.
  // The CSS contains a separate 3-second no-JS visibility fail-safe.
  dismissTimer=setTimeout(finish,1350);
  try{skip?.focus({preventScroll:true});}catch{}
})();
