/* Keep the model toolbar inside the browser's visible viewport, including tablet chrome. */
(()=>{'use strict';
 const panel=document.querySelector('.viewport-panel'),caption=document.querySelector('#field-view-caption');let pending=false;
 function sync(){pending=false;const viewport=window.visualViewport;
  if(!viewport||Math.abs(viewport.scale-1)<.01){const height=viewport?.height||window.innerHeight;document.documentElement.style.setProperty('--pm3-viewport-height',Math.round(height)+'px');}
  panel.classList.toggle('pm3-narrow-view',panel.clientWidth<540);panel.classList.toggle('pm3-has-field',!caption.hidden);
 }
 function schedule(){if(!pending){pending=true;requestAnimationFrame(sync);}}
 window.addEventListener('resize',schedule);window.addEventListener('orientationchange',schedule);window.visualViewport?.addEventListener('resize',schedule);
 new ResizeObserver(schedule).observe(panel);new MutationObserver(schedule).observe(caption,{attributes:true,attributeFilter:['hidden']});sync();
})();
