/* Move existing controls on phones so each action keeps one state and one event handler. */
(()=>{'use strict';
 const root=document.documentElement,panel=document.querySelector('.viewport-panel'),top=document.querySelector('.viewport-top'),modes=document.querySelector('#render-mode-controls'),details=document.querySelector('#inspector'),toggle=document.querySelector('#toggle-right-panel');
 const media=matchMedia('(max-width:600px), (max-width:1000px) and (max-height:520px) and (pointer:coarse)');
 const anchor=document.createComment('display-mode-home');modes.before(anchor);
 const caption=document.createElement('div');caption.className='mobile-model-caption pm3-mobile-only';top.prepend(caption);
 const more=document.createElement('button');more.id='mobile-more';more.className='tool-btn pm3-mobile-only';more.textContent='More';more.setAttribute('aria-label','More model controls');more.setAttribute('aria-expanded','false');more.setAttribute('aria-controls','mobile-model-options');document.querySelector('.toolbar-group').append(more);
 const options=document.querySelector('.native-controls');options.id='mobile-model-options';
 const close=document.createElement('button');close.id='mobile-details-close';close.className='pm3-mobile-only';close.textContent='×';close.setAttribute('aria-label','Close model details');document.querySelector('.inspector-head').append(close);
 const scrim=document.createElement('button');scrim.id='mobile-details-scrim';scrim.className='pm3-mobile-only';scrim.hidden=true;scrim.setAttribute('aria-label','Close model details');document.body.append(scrim);
 const views=[...document.querySelectorAll('#view-state-controls button')],original=views.map(b=>b.innerHTML);let phone=false;
 function setOptions(open){root.classList.toggle('mobile-options-open',open);more.setAttribute('aria-expanded',String(open));}
 function setDetails(open){setOptions(false);root.classList.toggle('mobile-inspector-open',open);scrim.hidden=!open;toggle.setAttribute('aria-expanded',String(open));if(open){details.setAttribute('role','dialog');details.setAttribute('aria-modal','true');details.setAttribute('aria-label','Model details');close.focus();}else{details.removeAttribute('role');details.removeAttribute('aria-modal');if(phone)toggle.focus();}}
 more.onclick=()=>setOptions(!root.classList.contains('mobile-options-open'));close.onclick=scrim.onclick=()=>setDetails(false);
 toggle.addEventListener('click',e=>{if(!phone)return;e.preventDefault();e.stopImmediatePropagation();setDetails(!root.classList.contains('mobile-inspector-open'));},true);
 panel.addEventListener('pointerdown',e=>{if(!e.target.closest('.native-controls,#mobile-more'))setOptions(false);});
 document.addEventListener('keydown',e=>{if(phone&&e.key==='Escape'){const open=root.classList.contains('mobile-options-open');setOptions(false);if(!scrim.hidden){e.stopImmediatePropagation();setDetails(false);}else if(open)e.stopImmediatePropagation();}},true);
 function title(){caption.textContent=document.querySelector('#selected-title').textContent;}
 new MutationObserver(title).observe(document.querySelector('#selected-title'),{childList:true,subtree:true,characterData:true});title();
 function sync(){phone=media.matches;root.classList.toggle('pm3-phone',phone);if(phone){top.append(modes);views.forEach((b,i)=>b.textContent=['Closed','Exploded','Layer focus'][i]);toggle.setAttribute('aria-label','Open model details');toggle.setAttribute('aria-expanded','false');}
 else{details.removeAttribute('role');details.removeAttribute('aria-modal');anchor.after(modes);views.forEach((b,i)=>b.innerHTML=original[i]);root.classList.remove('mobile-inspector-open');scrim.hidden=true;toggle.setAttribute('aria-label','Collapse structure inspector');toggle.setAttribute('aria-expanded',String(!document.querySelector('.app-shell').classList.contains('hide-right')));}
 setOptions(false);requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')));
 }
 media.addEventListener('change',sync);sync();
})();
