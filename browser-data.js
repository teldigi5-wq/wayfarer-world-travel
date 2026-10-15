/* Scope privacy controls to only the two Wayfarer-owned local draft keys.
   Never clear all origin storage, silently submit a provider request or claim
   third-party data has been erased. No browser storage read on initial load. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const open=$('wf-data-open'),confirm=$('wf-data-confirm'),
    cancel=$('wf-data-cancel'),area=$('wf-data-confirmation'),
    result=$('wf-data-result');
  if(!open||!confirm||!cancel||!area||!result)return;
  const keys=['wf-trips-v2','wf-checks-v2'];
  let armed=false;
  const disarm=(focus=false)=>{
    armed=false;area.hidden=true;open.disabled=false;
    if(focus)open.focus();
  };
  open.addEventListener('click',()=>{
    armed=true;area.hidden=false;open.disabled=true;
    result.textContent='Nothing has been deleted. Confirm or cancel below.';
    confirm.focus();
  });
  cancel.addEventListener('click',()=>{
    disarm(true);result.textContent='Deletion cancelled. Saved browser drafts were not changed.';
  });
  confirm.addEventListener('click',()=>{
    if(!armed)return;
    try{
      for(const key of keys)localStorage.removeItem(key);
      // Verify both removals; storage can be unavailable or intercepted.
      if(keys.some(key=>localStorage.getItem(key)!==null))
        throw Error('Unable to verify local deletion');
      disarm();
      result.textContent='Both Wayfarer local draft/checklist records were removed from this browser. Reload any other open Wayfarer tabs; downloaded files or third-party records are unaffected.';
    }catch{
      disarm();result.textContent='Unable to confirm deletion in this browser. Check browser storage settings and try again. No other website data was intentionally cleared.';
    }
  });
})();
