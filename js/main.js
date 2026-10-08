import { GameState } from './state.js';
import { DIFFICULTY, META, COSTS, WEAPONS, ENEMY_TYPES, BIOMES, HUB_DATA, saveMeta, loadMeta } from './data.js';
import { keys, justPressed, mouse } from './input.js';
import { Player, Platform, Enemy, BlueprintDrop, FleshPickup, createParticles } from './entities.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let width = canvas.width; let height = canvas.height;

function formatTime(s) {
  let m = Math.floor(s / 60); let sec = Math.floor(s % 60); let ms = Math.floor((s % 1) * 100);
  return `${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}.${ms.toString().padStart(2,'0')}`;
}

function generateLevel(roomNum) {
  GameState.projectiles = []; GameState.items = []; GameState.effects = []; GameState.enemies = []; GameState.interactables = [];
  let isBoss = (roomNum % 3 === 0);
  let len = isBoss ? 1500 : 3000 + (Math.random() * 2000);
  
  GameState.platforms = [
    new Platform(-1000, 600, len + 2000, 400),
    new Platform(-500, -200, 50, 1200),
    new Platform(len + 500, -200, 50, 1200)
  ];

  if (isBoss) {
    GameState.enemies.push(new Enemy(len/2, 500, ENEMY_TYPES.BOSS));
  } else {
    let cursor = 200; let hasChest = false;
    while(cursor < len - 300) {
      let pw = 150 + Math.random() * 200; let py = 250 + Math.random() * 250;
      GameState.platforms.push(new Platform(cursor, py, pw, 20));
      
      let eCount = Math.floor(Math.random() * 3) + 1;
      let types = Object.keys(ENEMY_TYPES).filter(t => t !== 'BOSS');
      for(let i=0; i<eCount; i++) {
        let eType = types[Math.floor(Math.random() * types.length)];
        GameState.enemies.push(new Enemy(cursor + 20 + (i*50), py - 60, ENEMY_TYPES[eType]));
      }

      if (!hasChest && Math.random() > 0.8) {
        GameState.interactables.push({ type: 'chest', x: cursor + pw/2, y: py, w: 40, h: 30, opened: false });
        hasChest = true;
      }
      cursor += pw + 100 + Math.random() * 150;
    }
  }
  
  GameState.interactables.push({ type: 'door', x: len, y: 600, text: "[E] Proceed Deeper", w: 100, h: 150 });
  
  GameState.player.x = -200; GameState.player.y = 450;
  GameState.roomTimer = 0; GameState.currentRoom = roomNum;
  document.getElementById('room-number').innerText = GameState.currentRoom;
}

function drawBackground(ctx, camX, camY) {
  let bIdx = Math.floor((GameState.currentRoom - 1) / 3) % BIOMES.length;
  let bColor = GameState.state === 'HUB' ? '#11152a' : (GameState.currentRoom === 0 ? '#111' : BIOMES[bIdx].color);

  ctx.save(); ctx.translate(-Math.floor(camX * 0.15), -Math.floor(camY * 0.1)); ctx.strokeStyle = '#0a0305'; ctx.lineWidth = 15;
  for(let i = -1500; i < 6000; i += 300) {
    ctx.beginPath(); ctx.moveTo(i, 800); ctx.lineTo(i, 200); ctx.arc(i + 100, 200, 100, Math.PI, 0); ctx.lineTo(i + 200, 800); ctx.stroke(); ctx.beginPath(); ctx.arc(i + 100, 250, 50, 0, Math.PI*2); ctx.stroke(); 
    let grad = ctx.createLinearGradient(0, 100, 0, 500); grad.addColorStop(0, bColor); grad.addColorStop(1, 'rgba(3, 1, 2, 0)');
    ctx.fillStyle = grad; ctx.fill(); ctx.fillStyle = '#0a0305'; ctx.fillRect(i + 95, 200, 10, 600); ctx.fillRect(i, 400, 200, 10);
  }
  ctx.restore();
  if (GameState.state === 'RUN') {
    ctx.save(); ctx.translate(-Math.floor(camX * 0.3), 0); ctx.fillStyle = 'rgba(74, 0, 8, 0.15)'; ctx.beginPath(); ctx.moveTo(-1500, canvas.height);
    for(let i = -1500; i < 6000; i += 100) ctx.lineTo(i, canvas.height/1.5 + Math.sin(GameState.globalTime * 2 + i * 0.01) * 50); ctx.lineTo(6000, canvas.height); ctx.fill(); ctx.restore();
  }
}

// Attach UI functions to window for HTML access
window.openMenu = (menuId) => {
  if (GameState.state !== 'MENU') GameState.pausedState = GameState.state; GameState.state = 'MENU';
  document.querySelectorAll('.menu-panel').forEach(el => el.style.display = 'none');
  document.getElementById(menuId).style.display = 'block'; document.getElementById('interact-prompt').style.display = 'none';
  if (menuId === 'upgrade-menu') window.updateUpgradeUI(); if (menuId === 'shop-menu') window.updateShopUI(); if (menuId === 'player-menu') window.refreshLoadoutUI();
};
window.closeAllMenus = () => { document.querySelectorAll('.menu-panel').forEach(el => el.style.display = 'none'); if (GameState.state === 'MENU') GameState.state = GameState.pausedState; };
window.toggleCustomDiff = () => { let el = document.getElementById('custom-diff-box'); el.style.display = el.style.display === 'none' ? 'block' : 'none'; };

window.changeMainhand = (wepId) => {
  if (GameState.player) {
    GameState.player.invIndex = GameState.player.inventory.findIndex(w => w.id === wepId); if (GameState.player.invIndex === -1) GameState.player.invIndex = 0;
    GameState.player.equipment.main = GameState.player.inventory[GameState.player.invIndex];
    const weaponDisplay = document.getElementById('weapon-display');
    if (weaponDisplay) { weaponDisplay.innerText = GameState.player.equipment.main.name; weaponDisplay.style.color = GameState.player.equipment.main.color; }
  }
};

window.updateUpgradeUI = () => {
  document.getElementById('upg-blood').innerText = META.blood; document.getElementById('total-sacraments').innerHTML = `Holy Blood Bank: <span class="gold">${META.blood}</span>`;
  ['vitality', 'fervor', 'fasting'].forEach(stat => {
    let lvl = META.upgrades[stat]; let cost = COSTS[stat][lvl]; document.getElementById(`lvl-${stat.substring(0,3)}`).innerText = lvl;
    let btn = document.getElementById(`btn-${stat.substring(0,3)}`);
    if (cost === -1) { btn.innerText = "MAX"; btn.disabled = true; } else { btn.innerText = `Cost: ${cost}`; btn.disabled = (META.blood < cost); }
  });
};

window.buyUpgrade = (stat) => { let lvl = META.upgrades[stat]; let cost = COSTS[stat][lvl]; if (cost !== -1 && META.blood >= cost) { META.blood -= cost; META.upgrades[stat]++; saveMeta(); window.updateUpgradeUI(); GameState.player.maxHp = 100 + (META.upgrades.vitality * 20); GameState.player.hp = GameState.player.maxHp; } };

window.updateShopUI = () => {
  document.getElementById('shop-blood').innerText = META.blood;
  let cont = document.getElementById('shop-items-container'); cont.innerHTML = '';
  if (META.blueprints.length === 0) { cont.innerHTML = "<p style='color:#777'>You have no blueprints to mold.</p>"; return; }
  META.blueprints.forEach(bp => {
    let wep = WEAPONS[bp]; let row = document.createElement('div'); row.className = 'upg-row';
    row.innerHTML = `<div class="upg-info"><div class="upg-title" style="color:${wep.color}">${wep.name}</div><div class="upg-desc">Dmg: ${wep.damage} | Breach: ${wep.breach}</div></div><button id="shop-btn-${bp}" onclick="window.buyBlueprint('${bp}')" style="width:auto;">Cost: ${wep.unlockCost}</button>`;
    cont.appendChild(row); document.getElementById(`shop-btn-${bp}`).disabled = (META.blood < wep.unlockCost);
  });
};

window.buyBlueprint = (bp) => { let wep = WEAPONS[bp]; if (META.blood >= wep.unlockCost) { META.blood -= wep.unlockCost; META.unlockedWeapons.push(bp); META.blueprints = META.blueprints.filter(b => b !== bp); saveMeta(); window.updateShopUI(); window.refreshLoadoutUI(); } };

window.refreshLoadoutUI = () => {
  let sel = document.getElementById('sel-mainhand'); if (!sel) return;
  sel.innerHTML = '';
  META.unlockedWeapons.forEach(bp => { let wep = WEAPONS[bp]; let opt = document.createElement('option'); opt.value = wep.id; opt.innerText = wep.name; sel.appendChild(opt); });
  if(GameState.player && GameState.player.equipment && GameState.player.equipment.main) sel.value = GameState.player.equipment.main.id;
};

window.setDiff = (diffId) => {
  if (diffId === 'peckish') Object.assign(DIFFICULTY, { id: 'peckish', hpMult: 1.0, dmgMult: 1.0, hungerDrain: false });
  else if (diffId === 'ravenous') Object.assign(DIFFICULTY, { id: 'ravenous', hpMult: 1.5, dmgMult: 1.5, hungerDrain: false });
  else if (diffId === 'starving') Object.assign(DIFFICULTY, { id: 'starving', hpMult: 2.5, dmgMult: 2.0, hungerDrain: true });
  else if (diffId === 'custom') { Object.assign(DIFFICULTY, { id: 'custom', hpMult: parseFloat(document.getElementById('inp-hp').value), dmgMult: parseFloat(document.getElementById('inp-dmg').value), hungerDrain: document.getElementById('inp-hunger').checked }); }
  document.getElementById('current-diff-display').innerText = diffId.toUpperCase();
};

window.loadLevel = (type) => {
  if (type === 'HUB') {
    GameState.state = 'HUB'; GameState.pausedState = 'HUB'; GameState.score = 0; GameState.currentRoom = 0; GameState.runTimer = 0; GameState.roomTimer = 0; GameState.runBlueprints = [];
    document.getElementById('timers').style.display = 'none'; document.getElementById('run-sacraments').style.display = 'none'; document.getElementById('total-sacraments').style.display = 'block'; document.getElementById('bp-display').innerText = '0';
    document.getElementById('total-sacraments').innerHTML = `Holy Blood Bank: <span class="gold">${META.blood}</span>`;
    GameState.player = new Player(100, 450); GameState.platforms = HUB_DATA.platforms.map(p => new Platform(p.x, p.y, p.w, p.h)); 
    GameState.interactables = [...HUB_DATA.interactables]; GameState.interactables.push({ type: 'shop', x: 750, y: 600, text: "[E] Speak with The Reflection", w: 50, h: 100 });
  } else if (type === 'RUN') {
    GameState.state = 'RUN'; GameState.pausedState = 'RUN'; GameState.score = 0; GameState.runTimer = 0; GameState.runBlueprints = [];
    document.getElementById('timers').style.display = 'block'; document.getElementById('run-sacraments').style.display = 'block'; document.getElementById('run-sacraments').innerHTML = `Current Run Sacraments: <span class="highlight">0</span>`; document.getElementById('total-sacraments').style.display = 'none'; document.getElementById('score-display').innerText = 0; document.getElementById('bp-display').innerText = '0';
    GameState.player = new Player(-200, 450); generateLevel(1);
  }
};

window.returnToHub = () => { document.getElementById('death-screen').style.display = 'none'; window.loadLevel('HUB'); window.refreshLoadoutUI(); requestAnimationFrame(gameLoop); };

function gameLoop(timestamp) {
  if (GameState.state === 'DEAD') return; 
  const dt = Math.min((timestamp - GameState.lastTime) / 1000, 0.05); GameState.lastTime = timestamp; GameState.globalTime += dt;
  
  if (justPressed['escape']) {
    if (GameState.state === 'MENU') window.closeAllMenus();
    else if (GameState.state !== 'DEAD') window.openMenu('player-menu');
    justPressed['escape'] = false;
  }
  
  if (GameState.state === 'MENU') { for (let key in justPressed) justPressed[key] = false; requestAnimationFrame(gameLoop); return; }
  if (GameState.hitStop > 0) { GameState.hitStop -= dt; requestAnimationFrame(gameLoop); return; }

  if (GameState.state === 'RUN') { GameState.runTimer += dt; GameState.roomTimer += dt; document.getElementById('run-timer').innerText = formatTime(GameState.runTimer); document.getElementById('room-timer').innerText = formatTime(GameState.roomTimer); }

  if (GameState.player && GameState.player.hp > 0) GameState.player.update(dt);
  for (let i = GameState.enemies.length - 1; i >= 0; i--) { GameState.enemies[i].update(dt); if (GameState.enemies[i].hp <= 0) GameState.enemies.splice(i, 1); }
  for (let i = GameState.projectiles.length - 1; i >= 0; i--) { GameState.projectiles[i].update(dt); if (GameState.projectiles[i].life <= 0) GameState.projectiles.splice(i, 1); }
  for (let i = GameState.items.length - 1; i >= 0; i--) { GameState.items[i].update(dt); if (GameState.items[i].life <= 0) GameState.items.splice(i, 1); }
  for (let i = GameState.effects.length - 1; i >= 0; i--) { GameState.effects[i].update(dt); if (GameState.effects[i].life <= 0) GameState.effects.splice(i, 1); }

  let activeInteractable = null;
  GameState.interactables.forEach(int => { let iw = int.w || 50; let ih = int.h || 50; if (Math.abs((GameState.player.x+GameState.player.w/2) - int.x) < iw && Math.abs((GameState.player.y+GameState.player.h/2) - (int.y - ih/2)) < ih) activeInteractable = int; });
  let promptEl = document.getElementById('interact-prompt');
  if (activeInteractable && GameState.player.grounded) {
    promptEl.innerText = activeInteractable.text || "[E] Interact"; promptEl.style.display = 'block';
    if (justPressed['e']) {
      if (activeInteractable.type === 'altar') window.openMenu('upgrade-menu');
      else if (activeInteractable.type === 'shop') window.openMenu('shop-menu');
      else if (activeInteractable.type === 'door') {
        if (GameState.state === 'HUB') window.loadLevel('RUN');
        else { GameState.runBlueprints.forEach(bp => { if(!META.blueprints.includes(bp)) META.blueprints.push(bp); }); GameState.runBlueprints = []; document.getElementById('bp-display').innerText = '0'; saveMeta(); generateLevel(GameState.currentRoom + 1); }
      }
      else if (activeInteractable.type === 'chest' && !activeInteractable.opened) {
        activeInteractable.opened = true; activeInteractable.text = "Empty"; createParticles(activeInteractable.x, activeInteractable.y, '#d4af37', 30, 500); GameState.screenShake += 10;
        let possible = Object.keys(WEAPONS).filter(k => !META.unlockedWeapons.includes(k) && !GameState.runBlueprints.includes(k) && !META.blueprints.includes(k));
        if (possible.length > 0) GameState.items.push(new BlueprintDrop(activeInteractable.x, activeInteractable.y-20, possible[Math.floor(Math.random()*possible.length)]));
        else { for(let i=0; i<5; i++) GameState.items.push(new FleshPickup(activeInteractable.x, activeInteractable.y-20)); }
      }
    }
  } else { promptEl.style.display = 'none'; }

  const targetCamX = GameState.player.x + GameState.player.w/2 - canvas.width/2; const targetCamY = GameState.player.y + GameState.player.h/2 - canvas.height/2 + 50;
  GameState.camera.x += (targetCamX - GameState.camera.x) * 8 * dt; GameState.camera.y += (targetCamY - GameState.camera.y) * 8 * dt;
  if (GameState.screenShake > 0) GameState.screenShake *= 0.9; if (GameState.screenShake < 0.5) GameState.screenShake = 0;

  document.getElementById('hp-bar').style.width = Math.max(0, (GameState.player.hp / GameState.player.maxHp * 100)) + '%';

  ctx.fillStyle = '#030102'; ctx.fillRect(0, 0, canvas.width, canvas.height); drawBackground(ctx, GameState.camera.x, GameState.camera.y);
  ctx.save(); let sx = (Math.random() - 0.5) * GameState.screenShake; let sy = (Math.random() - 0.5) * GameState.screenShake; ctx.translate(-Math.floor(GameState.camera.x) + sx, -Math.floor(GameState.camera.y) + sy); 

  GameState.interactables.forEach(int => {
    if (int.type === 'altar') {
      ctx.fillStyle = '#2a1a1f'; ctx.fillRect(int.x - 40, int.y - 20, 80, 20); ctx.fillStyle = '#d4af37'; ctx.fillRect(int.x - 45, int.y - 25, 90, 5);
      ctx.fillRect(int.x - 5, int.y - 120, 10, 100); ctx.fillRect(int.x - 30, int.y - 90, 60, 10);
      let pulse = Math.sin(GameState.globalTime * 4) * 10; ctx.shadowBlur = 20 + pulse; ctx.shadowColor = '#d4af37'; ctx.fillStyle = '#d4af37'; ctx.beginPath(); ctx.arc(int.x, int.y - 50 + (pulse*0.5), 5, 0, Math.PI*2); ctx.fill(); ctx.shadowBlur = 0;
    } else if (int.type === 'shop') {
      ctx.fillStyle = '#111'; ctx.fillRect(int.x-20, int.y-80, 40, 80); let hover = Math.sin(GameState.globalTime * 3) * 5; ctx.fillStyle = 'rgba(255, 26, 60, 0.5)'; ctx.shadowBlur = 15; ctx.shadowColor = '#ff1a3c'; ctx.beginPath(); ctx.ellipse(int.x, int.y - 40 + hover, 15, 30, 0, 0, Math.PI*2); ctx.fill(); ctx.shadowBlur = 0;
    } else if (int.type === 'door') {
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(int.x, int.y, 60, Math.PI, 0); ctx.lineTo(int.x + 60, int.y + 100); ctx.lineTo(int.x - 60, int.y + 100); ctx.fill(); ctx.strokeStyle = '#d4af37'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(int.x, int.y, 60, Math.PI, 0); ctx.stroke();
      let grad = ctx.createLinearGradient(0, int.y - 60, 0, int.y + 100); grad.addColorStop(0, '#ff1a3c'); grad.addColorStop(1, '#000'); ctx.fillStyle = grad; ctx.globalAlpha = 0.5 + Math.sin(GameState.globalTime*5)*0.2; ctx.beginPath(); ctx.arc(int.x, int.y, 50, Math.PI, 0); ctx.lineTo(int.x + 50, int.y + 100); ctx.lineTo(int.x - 50, int.y + 100); ctx.fill(); ctx.globalAlpha = 1.0;
    } else if (int.type === 'chest') {
      ctx.fillStyle = '#111'; ctx.fillRect(int.x-20, int.y-20, 40, 20); ctx.fillStyle = int.opened ? '#333' : '#d4af37'; ctx.fillRect(int.x-22, int.y-20, 44, 5); if(!int.opened) { ctx.fillStyle = '#ff1a3c'; ctx.fillRect(int.x-3, int.y-15, 6, 8); }
    }
  });

  GameState.platforms.forEach(p => p.draw(ctx)); GameState.items.forEach(i => i.draw(ctx)); GameState.projectiles.forEach(p => p.draw(ctx));
  GameState.enemies.forEach(e => e.draw(ctx)); if (GameState.player && GameState.player.hp > 0) GameState.player.draw(ctx); GameState.effects.forEach(e => e.draw(ctx));
  
  ctx.fillStyle = '#010001'; ctx.fillRect(-100 - (GameState.camera.x * 0.1), -200, 80, 1500); if (GameState.state === 'HUB') ctx.fillRect(1500 - (GameState.camera.x * 0.1), -200, 120, 1500);
  ctx.restore();

  for (let key in justPressed) justPressed[key] = false; 

  if (GameState.player.hp <= 0) {
    GameState.state = 'DEAD'; document.getElementById('death-score').innerText = GameState.score; document.getElementById('death-time').innerText = "Time: " + formatTime(GameState.runTimer); document.getElementById('death-screen').style.display = 'flex';
    META.blood += GameState.score; GameState.runBlueprints = []; saveMeta();
  } else { requestAnimationFrame(gameLoop); }
}

loadMeta(); window.refreshLoadoutUI(); window.loadLevel('HUB'); requestAnimationFrame(gameLoop);