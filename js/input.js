export const keys = {};
export const justPressed = {};
export const mouse = { left: false, right: false, justLeft: false, justRight: false };

window.addEventListener('keydown', e => { 
  let kl = e.key.toLowerCase(); 
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(kl)) e.preventDefault();
  if (!keys[kl]) justPressed[kl] = true; keys[kl] = true; 
  if (e.key === 'Escape') { justPressed['escape'] = true; keys['escape'] = true; }
}, { passive: false });

window.addEventListener('keyup', e => { 
  let kl = e.key.toLowerCase();
  keys[kl] = false; 
  if (e.key === 'Escape') keys['escape'] = false;
});

window.addEventListener('mousedown', e => { if(e.button === 0) { mouse.left = true; mouse.justLeft = true; } if(e.button === 2) { mouse.right = true; mouse.justRight = true; }});
window.addEventListener('mouseup', e => { if(e.button === 0) mouse.left = false; if(e.button === 2) mouse.right = false; });
window.addEventListener('contextmenu', e => e.preventDefault());