import { GameState } from './state.js';
import { SETTINGS, DIFFICULTY, META, WEAPONS } from './data.js';
import { keys, justPressed, mouse } from './input.js';
import { rectIntersect, handleCollisions } from './physics.js';

export function createParticles(x, y, color, count, force=400, upward=false) { 
  for(let i=0; i<count; i++) GameState.effects.push(new Particle(x, y, color, force, upward)); 
}

export class Platform {
  constructor(x, y, w, h) {
    this.x = x; this.y = y; this.w = w; this.h = h; this.candles = []; this.bloodStains = [];
    if (this.w > 100 && this.h < 100) { for(let i=0; i<Math.floor(Math.random()*3)+1; i++) this.candles.push({ x: this.x + 20 + Math.random() * (this.w - 40), h: 8 + Math.random() * 10, offset: Math.random() * 10 }); }
    for(let i=0; i<Math.floor(this.w / 50); i++) if(Math.random()>0.5) this.bloodStains.push({ x: this.x + Math.random() * this.w, length: 10 + Math.random() * 30 });
  }
  draw(ctx) {
    let grad = ctx.createLinearGradient(this.x, this.y, this.x, this.y + Math.min(this.h, 100));
    grad.addColorStop(0, '#1a1a1a'); grad.addColorStop(1, '#050203');
    ctx.fillStyle = grad; ctx.fillRect(this.x, this.y, this.w, this.h);
    ctx.shadowBlur = 10; ctx.shadowColor = '#d4af37'; ctx.fillStyle = '#d4af37'; ctx.fillRect(this.x, this.y, this.w, 4); ctx.shadowBlur = 0; 
    ctx.fillStyle = '#6b0010'; this.bloodStains.forEach(b => ctx.fillRect(b.x, this.y + 4, 6, b.length));
    this.candles.forEach(c => { ctx.fillStyle = '#eaddcf'; ctx.fillRect(c.x, this.y - c.h, 6, c.h); let flicker = Math.sin(GameState.globalTime * 15 + c.offset) * 2; ctx.shadowBlur = 10; ctx.shadowColor = '#ffaa00'; ctx.fillStyle = '#ffcc00'; ctx.beginPath(); ctx.arc(c.x + 3, this.y - c.h - 4 + flicker, 3, 0, Math.PI*2); ctx.fill(); ctx.shadowBlur = 0; });
    if (this.h < 100) { ctx.fillStyle = '#0a0506'; ctx.fillRect(this.x + 10, this.y + 4, 15, 800); ctx.fillRect(this.x + this.w - 25, this.y + 4, 15, 800); }
  }
}

export class Player {
  constructor(x, y) {
    this.isPlayer = true; this.x = x; this.y = y; this.w = 24; this.h = 56;
    this.vx = 0; this.vy = 0; this.maxSpeed = 450; this.accel = 3000; this.friction = 2500; this.jumpForce = -800;
    this.maxHp = 100 + (META.upgrades.vitality * 20); this.hp = this.maxHp; 
    this.facingRight = true; this.grounded = false; this.jumpsLeft = 1; 
    this.coyoteTimer = 0; this.jumpBufferTimer = 0;
    this.isRolling = false; this.rollTimer = 0; this.rollMax = 0.35; this.rollCooldownTimer = 0; this.rollSpeed = 850;
    this.isParrying = false; this.parryTimer = 0; this.parryCooldownTimer = 0;
    
    this.inventory = META.unlockedWeapons.map(id => WEAPONS[id]); this.invIndex = 0;
    let selectedWepId = document.getElementById('sel-mainhand').value;
    this.invIndex = this.inventory.findIndex(w => w.id === selectedWepId); if (this.invIndex === -1) this.invIndex = 0;
    this.equipment = { main: this.inventory[this.invIndex] }; 
    this.isAttacking = false; this.attackTimer = 0; this.attackCooldownTimer = 0; this.hasHit = false;
  }
  update(dt) {
    if (GameState.state === 'RUN' && DIFFICULTY.hungerDrain) { let drainRate = Math.max(0.2, 1.5 - (META.upgrades.fasting * 0.2)); this.hp -= drainRate * dt; }
    if (justPressed['q'] && !this.isAttacking && !this.isRolling && !this.isParrying) {
      this.inventory = META.unlockedWeapons.map(id => WEAPONS[id]);
      this.invIndex = (this.invIndex + 1) % this.inventory.length; this.equipment.main = this.inventory[this.invIndex];
      document.getElementById('sel-mainhand').value = this.equipment.main.id; document.getElementById('weapon-display').innerText = this.equipment.main.name; document.getElementById('weapon-display').style.color = this.equipment.main.color;
      createParticles(this.x + this.w/2, this.y + this.h/2, this.equipment.main.color, 15, 200);
    }
    if (this.attackCooldownTimer > 0) this.attackCooldownTimer -= dt; if (this.rollCooldownTimer > 0) this.rollCooldownTimer -= dt; if (this.parryCooldownTimer > 0) this.parryCooldownTimer -= dt;
    if (this.grounded) { this.coyoteTimer = SETTINGS.coyoteTime; this.jumpsLeft = 1; } else { this.coyoteTimer -= dt; }
    if (justPressed[' '] || justPressed['w'] || justPressed['arrowup']) this.jumpBufferTimer = SETTINGS.jumpBuffer; else this.jumpBufferTimer -= dt;

    if (this.isParrying) { this.parryTimer -= dt; this.vx = 0; if (this.parryTimer <= 0) this.isParrying = false; } 
    else if (this.isRolling) {
      this.rollTimer -= dt; this.vx = (this.facingRight ? 1 : -1) * this.rollSpeed;
      if (Math.random() > 0.4) GameState.effects.push(new AfterImage(this.x, this.y, this.w, this.h, this.facingRight, 1 - (this.rollTimer/this.rollMax)));
      if (this.rollTimer <= 0) this.isRolling = false;
    } else {
      if (mouse.justRight && this.parryCooldownTimer <= 0 && !this.isAttacking) { this.isParrying = true; this.parryTimer = 0.25; this.parryCooldownTimer = 0.6; createParticles(this.x + this.w/2, this.y + this.h/2, '#d4af37', 5, 100); }
      else if (justPressed['shift'] && this.rollCooldownTimer <= 0) { this.isRolling = true; this.rollTimer = this.rollMax; this.rollCooldownTimer = 0.6; this.vy = 0; createParticles(this.x + this.w/2, this.y + this.h, '#d4af37', 10, 200); }
      let moveDir = 0; if (keys['a'] || keys['arrowleft']) moveDir = -1; if (keys['d'] || keys['arrowright']) moveDir = 1;
      if (moveDir !== 0 && !this.isAttacking) { this.facingRight = moveDir === 1; this.vx += moveDir * this.accel * dt; if (Math.abs(this.vx) > this.maxSpeed) this.vx = moveDir * this.maxSpeed; } 
      else { if (this.vx > 0) this.vx = Math.max(0, this.vx - this.friction * dt); if (this.vx < 0) this.vx = Math.min(0, this.vx + this.friction * dt); }
      if (this.jumpBufferTimer > 0) { if (this.coyoteTimer > 0) { this.vy = this.jumpForce; this.coyoteTimer = 0; this.jumpBufferTimer = 0; this.grounded = false; createParticles(this.x + this.w/2, this.y + this.h, '#ffffff', 8, 200, true); } 
      else if (this.jumpsLeft > 0) { this.vy = this.jumpForce * 0.9; this.jumpsLeft--; this.jumpBufferTimer = 0; createParticles(this.x + this.w/2, this.y + this.h, '#d4af37', 15, 300); } }
      if (!(keys[' '] || keys['w'] || keys['arrowup']) && this.vy < -100) this.vy *= 0.5; 

      if (mouse.justLeft && this.attackCooldownTimer <= 0 && !this.isAttacking) { this.isAttacking = true; this.hasHit = false; let wep = this.equipment.main; this.attackTimer = wep.swingSpeed; this.attackCooldownTimer = wep.cooldown; }
      if (this.isAttacking) {
        let wep = this.equipment.main; this.attackTimer -= dt; let progress = 1 - (this.attackTimer / wep.swingSpeed); let windupRatio = wep.drawType === 'blunt' ? 0.3 : 0.2;
        if (progress >= windupRatio && !this.hasHit) {
            this.hasHit = true; let attackBox = { x: this.facingRight ? this.x + this.w : this.x - wep.range, y: this.y - 10, w: wep.range, h: 70 };
            GameState.effects.push(new SlashEffect(attackBox.x, attackBox.y, attackBox.w, attackBox.h, wep.color, this.facingRight, wep.drawType)); this.vx += this.facingRight ? 350 : -350; 
            let finalDamage = wep.damage * (1 + META.upgrades.fervor * 0.25); let hitAny = false;
            GameState.enemies.forEach(enemy => {
              if (rectIntersect(attackBox, enemy)) {
                if (enemy.cfg.id === 'templar' && this.facingRight !== enemy.facingRight && enemy.stunTimer <= 0) {
                  if (wep.breach >= enemy.currentPoise) { enemy.takeDamage(finalDamage, this.facingRight, wep.breach); enemy.stunTimer = 1.5; createParticles(enemy.x+enemy.w/2, enemy.y+enemy.h/2, '#ffffff', 25, 400); } 
                  else { enemy.currentPoise -= wep.breach; createParticles(enemy.x + enemy.w/2, enemy.y + enemy.h/2, '#d4af37', 15, 300); GameState.screenShake = 5; this.vx = this.facingRight ? -400 : 400; }
                } else { enemy.takeDamage(finalDamage, this.facingRight, wep.breach); }
                hitAny = true;
              }
            });
            if (hitAny) { GameState.hitStop = 0.05; GameState.screenShake = wep.damage * 0.2; }
        }
        if (this.attackTimer <= 0) this.isAttacking = false; 
      }
    }
    if (!this.isRolling) { this.vy += SETTINGS.gravity * dt; if (this.vy > SETTINGS.terminalVelocity) this.vy = SETTINGS.terminalVelocity; }
    this.x += this.vx * dt; handleCollisions(this, 'x'); this.y += this.vy * dt; this.grounded = false; handleCollisions(this, 'y');
  }
  draw(ctx) {
    ctx.save();
    if (this.grounded && !this.isRolling) { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.beginPath(); ctx.ellipse(this.x + this.w/2, this.y + this.h, 15, 4, 0, 0, Math.PI*2); ctx.fill(); }
    ctx.translate(this.x + this.w/2, this.y + this.h/2); if (!this.facingRight) ctx.scale(-1, 1); 
    if (this.isRolling) { let progress = 1 - (this.rollTimer / this.rollMax); ctx.rotate(progress * Math.PI * 2); ctx.shadowBlur = 15; ctx.shadowColor = '#d4af37'; ctx.fillStyle = '#6b0010'; ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI*2); ctx.fill(); ctx.strokeStyle = '#d4af37'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 24, progress * Math.PI, progress * Math.PI + Math.PI); ctx.stroke(); ctx.shadowBlur = 0; ctx.restore(); return; }
    let gt = GameState.globalTime;
    let breath = Math.sin(gt * 8) * 2; let runCycle = (this.vx !== 0 && this.grounded && !this.isParrying && !this.isAttacking) ? Math.sin(this.x * 0.04) : 0;
    if (this.isParrying) { ctx.shadowBlur = 20; ctx.shadowColor = '#d4af37'; ctx.strokeStyle = '#d4af37'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(5, 0, 30, -Math.PI/2.5, Math.PI/2.5); ctx.stroke(); ctx.shadowBlur = 0; }
    let pulse = Math.sin(gt * 5) * 5; ctx.shadowBlur = 10 + pulse; ctx.shadowColor = '#d4af37'; ctx.strokeStyle = '#d4af37'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(-2, -this.h/2 - 12 + breath, 12, 4, 0, 0, Math.PI*2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-2, -this.h/2 - 16); ctx.lineTo(-2, -this.h/2 - 25); ctx.stroke(); ctx.beginPath(); ctx.moveTo(6, -this.h/2 - 14); ctx.lineTo(12, -this.h/2 - 20); ctx.stroke(); ctx.shadowBlur = 0;
    ctx.strokeStyle = '#111'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 10); if(!this.grounded) { ctx.lineTo(-10, 28); } else { ctx.lineTo(-runCycle * 15, 28); } ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, 10); if(!this.grounded) { ctx.lineTo(10, 28); } else { ctx.lineTo(runCycle * 15, 28); } ctx.stroke();
    let capeWave = this.grounded ? Math.sin(gt * 10) * 5 : -15 - (this.vy * 0.02); ctx.fillStyle = '#6b0010'; ctx.beginPath(); ctx.moveTo(8, -12 + breath); ctx.lineTo(-10, -12 + breath); ctx.bezierCurveTo(-20, 5, -25 + capeWave, 20, -15 + capeWave, this.h/2 - 5); ctx.lineTo(10, 15); ctx.fill();
    ctx.fillStyle = '#ffe6ea'; ctx.beginPath(); ctx.arc(2, -this.h/2 + 5 + breath, 9, 0, Math.PI*2); ctx.fill(); ctx.shadowBlur = 10; ctx.shadowColor = '#ff1a3c'; ctx.fillStyle = '#ff1a3c'; ctx.fillRect(5, -this.h/2 + 3 + breath, 4, 3); ctx.shadowBlur = 0;
    ctx.save(); ctx.translate(2, -2 + breath); let wep = this.equipment.main;
    if (this.isParrying) { ctx.rotate(-Math.PI/4); } 
    else if (this.isAttacking) { let progress = 1 - (this.attackTimer / wep.swingSpeed); let windupRatio = wep.drawType === 'blunt' ? 0.3 : 0.2; let angle = 0; if (progress < windupRatio) { angle = -Math.PI * 0.8; } else { let strikeProg = (progress - windupRatio) / (1 - windupRatio); angle = -Math.PI * 0.8 + (Math.PI * 1.5 * strikeProg); } ctx.rotate(angle); } else { ctx.rotate(Math.PI/6 + (runCycle * 0.5)); }
    if (wep.drawType === 'sword') { ctx.fillStyle = '#222'; ctx.fillRect(-2, 0, 4, 15); ctx.fillStyle = '#d4af37'; ctx.fillRect(-6, 12, 12, 3); let bladeGrad = ctx.createLinearGradient(0, 15, 0, 45); bladeGrad.addColorStop(0, '#e0e0e0'); bladeGrad.addColorStop(1, '#ff1a3c'); ctx.fillStyle = bladeGrad; ctx.beginPath(); ctx.moveTo(-3, 15); ctx.lineTo(3, 15); ctx.lineTo(0, 50); ctx.fill(); } 
    else if (wep.drawType === 'blunt') { ctx.fillStyle = '#4a2f35'; ctx.fillRect(-2, 0, 4, 35); ctx.fillStyle = '#d4af37'; ctx.beginPath(); ctx.arc(0, 35, 12, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = '#ff1a3c'; ctx.fillRect(-15, 33, 30, 4); ctx.fillRect(-2, 23, 4, 24); }
    ctx.fillStyle = '#ffe6ea'; ctx.beginPath(); ctx.arc(0,0, 5, 0, Math.PI*2); ctx.fill(); ctx.restore(); ctx.restore();
  }
}

export class Enemy {
  constructor(x, y, cfg) {
    this.cfg = cfg; this.x = x; this.y = y; this.w = cfg.w; this.h = cfg.h; this.vx = 0; this.vy = 0; 
    this.hp = cfg.hp * DIFFICULTY.hpMult; this.atkDmg = cfg.atkDmg * DIFFICULTY.dmgMult;
    this.currentPoise = cfg.poise; this.stunTimer = 0; this.speed = cfg.speed + Math.random() * 10;
    this.facingRight = Math.random() > 0.5; this.flashTimer = 0; this.knockbackTimer = 0; this.animOffset = Math.random() * 100;
    this.state = 'walk'; this.actionTimer = 0; 
  }
  takeDamage(amount, fromLeft, breach) {
    this.hp -= amount; this.flashTimer = 0.1; this.knockbackTimer = 0.2; this.vx = fromLeft ? 350 : -350; this.vy = -300; this.currentPoise -= breach;
    if (this.currentPoise <= 0) { this.state = 'stunned'; this.stunTimer = 1.0; this.currentPoise = this.cfg.poise; }
    createParticles(this.x + this.w/2, this.y + this.h/2, '#b3001b', 20, 600);
    if (this.hp <= 0) { 
      GameState.items.push(new FleshPickup(this.x + this.w/2, this.y + this.h/2)); 
      let bpChance = this.cfg.id === 'boss' ? 1.0 : 0.05;
      if (Math.random() < bpChance) {
        let possible = Object.keys(WEAPONS).filter(k => !META.unlockedWeapons.includes(k) && !GameState.runBlueprints.includes(k) && !META.blueprints.includes(k));
        if (possible.length > 0) GameState.items.push(new BlueprintDrop(this.x + this.w/2, this.y, possible[Math.floor(Math.random()*possible.length)]));
      }
      createParticles(this.x + this.w/2, this.y + this.h/2, '#d4af37', 15, 400); GameState.screenShake += (this.cfg.id==='boss'?20:8); 
    }
  }
  update(dt) {
    if (this.flashTimer > 0) this.flashTimer -= dt; this.vy += SETTINGS.gravity * dt;
    let p = GameState.player;
    let distToPlayer = Math.abs((p.x + p.w/2) - (this.x + this.w/2)); let yDist = Math.abs(p.y - this.y); let canSeePlayer = yDist < 200;

    if (this.state === 'stunned' || this.stunTimer > 0) {
      this.stunTimer -= dt; this.vx = 0; if (this.stunTimer <= 0) { this.state = 'walk'; this.actionTimer = 1.0; }
    } else if (this.state === 'windup') {
      this.actionTimer -= dt; this.vx = 0;
      if (this.actionTimer <= 0) {
        this.state = 'attack'; this.actionTimer = 0.1;
        if (this.cfg.type === 'ranged') { GameState.projectiles.push(new Stake(this.x + this.w/2, this.y + 15, this.facingRight, this.atkDmg)); createParticles(this.x + this.w/2, this.y + 15, '#ff1a3c', 10, 200); }
        else if (this.cfg.type === 'bomber') GameState.projectiles.push(new CenserBomb(this.x + this.w/2, this.y + 10, (p.x - this.x) * 1.5, -600, this.atkDmg));
      }
    } else if (this.state === 'attack') {
      this.actionTimer -= dt; this.vx = 0;
      if (this.cfg.type === 'melee' || this.cfg.type === 'shield') {
        let atkBox = { x: this.facingRight ? this.x + this.w : this.x - this.cfg.atkRange, y: this.y, w: this.cfg.atkRange, h: this.h };
        if (rectIntersect(atkBox, p)) {
          if (p.isParrying) {
            this.state = 'stunned'; this.stunTimer = 1.5; p.isParrying = false; p.parryCooldownTimer = 0; 
            createParticles(p.x+p.w/2, p.y+p.h/2, '#d4af37', 30, 500); GameState.hitStop = 0.1; GameState.screenShake += 15;
          } else if (!p.isRolling && !this.hasHitPlayer) { p.hp -= this.atkDmg; this.hasHitPlayer = true; createParticles(p.x, p.y, '#ff1a3c', 15); }
        }
      }
      if (this.actionTimer <= 0) { this.state = 'walk'; this.actionTimer = this.cfg.cooldown; this.hasHitPlayer = false; }
    } else if (this.state === 'walk') {
      if (this.currentPoise < this.cfg.poise) this.currentPoise += 10 * dt; if (this.actionTimer > 0) this.actionTimer -= dt;
      if (distToPlayer < 800 && canSeePlayer && this.knockbackTimer <= 0) this.facingRight = (p.x > this.x);
      if (this.knockbackTimer > 0) { this.knockbackTimer -= dt; } else {
        if (canSeePlayer && distToPlayer < this.cfg.atkRange && this.actionTimer <= 0) { this.state = 'windup'; this.actionTimer = this.cfg.windup; }
        else {
          if (this.cfg.type === 'shield') { if (canSeePlayer && distToPlayer < 400 && distToPlayer > this.cfg.atkRange - 10) this.vx = this.facingRight ? this.speed : -this.speed; else this.vx = 0; }
          else this.vx = this.facingRight ? this.speed : -this.speed;
        }
      }
    }
    this.x += this.vx * dt; if (handleCollisions(this, 'x') && this.knockbackTimer <= 0 && this.state === 'walk') this.facingRight = !this.facingRight;
    this.y += this.vy * dt; handleCollisions(this, 'y');
  }
  draw(ctx) {
    ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.ellipse(this.x + this.w/2, this.y + this.h, 16, 4, 0, 0, Math.PI*2); ctx.fill();
    ctx.translate(this.x + this.w/2, this.y + this.h/2); if (!this.facingRight) ctx.scale(-1, 1);
    if (this.cfg.id === 'boss') ctx.scale(2, 2);
    let isStunned = (this.state === 'stunned'); let breath = isStunned ? 0 : Math.sin(GameState.globalTime * 5 + this.animOffset) * 2;
    let runCycle = (this.vx !== 0 && !isStunned) ? Math.sin(this.x * 0.05) : 0; let slouch = isStunned ? 10 : 0; 
    
    ctx.fillStyle = this.flashTimer > 0 ? '#ffffff' : this.cfg.color;
    ctx.strokeStyle = '#110508'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    
    ctx.beginPath(); ctx.moveTo(0, 10 + slouch); ctx.lineTo(-runCycle * 15, 25); ctx.stroke(); 
    ctx.beginPath(); ctx.moveTo(0, 10 + slouch); ctx.lineTo(runCycle * 15, 25); ctx.stroke(); 
    ctx.beginPath(); ctx.ellipse(0, -5 + breath + slouch, 12, 16, isStunned ? Math.PI/8 : Math.PI/12, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#110508'; ctx.beginPath(); ctx.arc(8, -20 + breath + slouch, 8, 0, Math.PI*2); ctx.fill();

    ctx.save(); ctx.translate(2, -10 + breath + slouch);
    if (this.state === 'windup') ctx.rotate(-Math.PI*0.8); else if (this.state === 'attack') ctx.rotate(Math.PI/4);
    
    if (this.cfg.type === 'shield') {
      if (isStunned) { ctx.rotate(-Math.PI/2); } 
      ctx.fillStyle = '#222'; ctx.fillRect(10, -25, 12, 50); ctx.fillStyle = '#4a0008'; ctx.fillRect(14, -15, 4, 30); ctx.fillRect(10, -5, 12, 4); 
    } else if (this.cfg.type === 'melee') { ctx.strokeStyle = this.flashTimer > 0 ? '#ffffff' : '#4a0008'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(15, 10); ctx.stroke(); }
    else if (this.cfg.type === 'ranged') { let windup = 1 - (this.actionTimer / this.cfg.windup); if (this.state === 'windup' && windup > 0.5) { ctx.shadowBlur = 15; ctx.shadowColor = '#ff1a3c'; } ctx.fillStyle = '#ff1a3c'; ctx.beginPath(); ctx.arc(15, 0, 5, 0, Math.PI*2); ctx.fill(); ctx.shadowBlur = 0; }
    else if (this.cfg.type === 'bomber') { let swing = (isStunned || this.state !== 'walk') ? 0 : Math.sin(GameState.globalTime * 8) * 15; ctx.strokeStyle = '#555'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(swing, 20); ctx.stroke(); ctx.fillStyle = '#d4af37'; ctx.beginPath(); ctx.arc(swing, 20, 6, 0, Math.PI*2); ctx.fill(); }
    ctx.restore();
    
    if (isStunned) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; let angle = GameState.globalTime * 10; ctx.beginPath(); ctx.arc(10, -35, 8, angle, angle + Math.PI); ctx.stroke(); ctx.beginPath(); ctx.arc(10, -35, 12, -angle, -angle + Math.PI); ctx.stroke(); }
    ctx.restore();
  }
}

export class BlueprintDrop {
  constructor(x,y,wepId) { this.x=x; this.y=y; this.wepId=wepId; this.vx=(Math.random()-0.5)*200; this.vy=-300; this.life=15; }
  update(dt) {
    this.vy += SETTINGS.gravity * dt; this.x += this.vx * dt; handleCollisions(this, 'x'); this.y += this.vy * dt; handleCollisions(this, 'y'); this.vx *= 0.95; this.life -= dt;
    let p = GameState.player;
    if (Math.hypot(p.x - this.x, p.y - this.y) < 80) { this.x += (p.x - this.x) * 10 * dt; this.y += (p.y - this.y) * 10 * dt; }
    if (rectIntersect(this, p)) {
      this.life = -1; GameState.runBlueprints.push(this.wepId); document.getElementById('bp-display').innerText = GameState.runBlueprints.length;
      createParticles(this.x, this.y, '#00e5ff', 20, 300); GameState.screenShake += 5;
    }
  }
  draw(ctx) {
    let hover = Math.sin(GameState.globalTime * 8) * 5; ctx.shadowBlur = 20; ctx.shadowColor = '#00e5ff'; ctx.fillStyle = '#00e5ff';
    ctx.beginPath(); ctx.arc(this.x, this.y + hover, 6, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
  }
}

export class Stake { 
  constructor(x, y, facingRight, dmg) { this.x = x; this.y = y; this.w = 20; this.h = 4; this.vx = facingRight ? 800 : -800; this.vy = 0; this.life = 2.0; this.owner = 'enemy'; this.dmg = dmg; } 
  update(dt) { 
    this.x += this.vx * dt; this.life -= dt; let p = GameState.player;
    if (this.owner === 'enemy' && rectIntersect(this, p)) { 
      if (p.isParrying) { this.owner = 'player'; this.vx *= -1.5; p.isParrying = false; p.parryCooldownTimer = 0; createParticles(this.x, this.y, '#d4af37', 20, 400); GameState.screenShake += 5; GameState.hitStop = 0.05; } 
      else if (!p.isRolling) { p.hp -= this.dmg; this.life = -1; createParticles(this.x, this.y, '#ff1a3c', 10); GameState.screenShake += 3; } 
    } 
    else if (this.owner === 'player') { GameState.enemies.forEach(e => { if (rectIntersect(this, e) && this.life > 0) { e.takeDamage(60, this.vx > 0, 100); this.life = -1; } }); } 
  } 
  draw(ctx) { ctx.shadowBlur = 10; let color = this.owner === 'enemy' ? '#ff1a3c' : '#d4af37'; ctx.shadowColor = color; ctx.fillStyle = color; ctx.fillRect(this.x, this.y, this.w, this.h); ctx.shadowBlur = 0; } 
}

export class CenserBomb { 
  constructor(x, y, vx, vy, dmg) { this.x = x; this.y = y; this.w = 12; this.h = 12; this.vx = vx; this.vy = vy; this.life = 2.0; this.dmg = dmg; } 
  update(dt) { 
    this.vy += SETTINGS.gravity * dt; this.x += this.vx * dt; let hitX = handleCollisions(this, 'x'); this.y += this.vy * dt; let hitY = handleCollisions(this, 'y'); 
    if (hitX) this.vx *= -0.5; if (hitY) { this.vy *= -0.5; this.vx *= 0.8; } this.life -= dt; let p = GameState.player;
    if (this.life > 0.1 && rectIntersect(this, p) && p.isParrying) { this.vx = (this.x > p.x) ? 600 : -600; this.vy = -600; p.isParrying = false; p.parryCooldownTimer = 0; createParticles(this.x, this.y, '#d4af37', 10, 300); GameState.hitStop = 0.05; } 
    if (this.life <= 0) { 
      GameState.effects.push(new Explosion(this.x, this.y)); 
      if (Math.hypot(p.x+p.w/2 - this.x, p.y+p.h/2 - this.y) < 100 && !p.isRolling) { p.hp -= this.dmg; GameState.screenShake += 10; } 
      GameState.enemies.forEach(e => { if (Math.hypot(e.x+e.w/2 - this.x, e.y+e.h/2 - this.y) < 100) e.takeDamage(40, this.x < e.x, 50); }); 
    } 
  } 
  draw(ctx) { ctx.fillStyle = '#d4af37'; ctx.beginPath(); ctx.arc(this.x+6, this.y+6, 6, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = '#ff1a3c'; ctx.fillRect(this.x+4, this.y-2, 4, 4); } 
}

export class Explosion { 
  constructor(x, y) { this.x = x; this.y = y; this.life = 0.25; this.maxLife = 0.25; GameState.screenShake += 8; } 
  update(dt) { this.life -= dt; } 
  draw(ctx) { let p = 1 - (this.life/this.maxLife); ctx.globalAlpha = this.life * 4; ctx.fillStyle = '#ff1a3c'; ctx.beginPath(); ctx.arc(this.x, this.y, p * 100, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = '#d4af37'; ctx.beginPath(); ctx.arc(this.x, this.y, p * 60, 0, Math.PI*2); ctx.fill(); ctx.globalAlpha = 1.0; } 
}

export class FleshPickup { 
  constructor(x, y) { this.x = x; this.y = y; this.w = 12; this.h = 12; this.vx = (Math.random() - 0.5) * 300; this.vy = -400; this.life = 10; } 
  update(dt) { 
    this.vy += SETTINGS.gravity * dt; this.x += this.vx * dt; handleCollisions(this, 'x'); this.y += this.vy * dt; handleCollisions(this, 'y'); this.vx *= 0.95; this.life -= dt; 
    let p = GameState.player;
    if (Math.hypot(p.x - this.x, p.y - this.y) < 80) { this.x += (p.x - this.x) * 10 * dt; this.y += (p.y - this.y) * 10 * dt; } 
    if (rectIntersect(this, p)) { this.life = -1; p.hp = Math.min(p.maxHp, p.hp + 35 + (META.upgrades.fasting * 5)); document.getElementById('score-display').innerText = ++GameState.score; createParticles(this.x, this.y, '#ff1a3c', 10, 300); GameState.screenShake += 5; } 
  } 
  draw(ctx) { let hover = Math.sin(GameState.globalTime * 8 + this.x) * 3; ctx.shadowBlur = 15; ctx.shadowColor = '#ff1a3c'; ctx.fillStyle = '#ff1a3c'; ctx.beginPath(); ctx.arc(this.x, this.y + hover, 8, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(this.x, this.y + hover, 3, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; } 
}

export class Particle { 
  constructor(x, y, color, force, upward=false) { this.x = x; this.y = y; this.vx = (Math.random() - 0.5) * force; this.vy = upward ? Math.random() * -force : (Math.random() - 0.7) * force; this.life = 1.0; this.color = color; this.size = Math.random() * 5 + 2; } 
  update(dt) { this.vy += SETTINGS.gravity * dt; this.x += this.vx * dt; this.y += this.vy * dt; this.life -= dt * 2.5; } 
  draw(ctx) { ctx.fillStyle = this.color; ctx.globalAlpha = Math.max(0, this.life); ctx.fillRect(this.x, this.y, this.size, this.size); ctx.globalAlpha = 1.0; } 
}

export class SlashEffect { 
  constructor(x, y, w, h, color, facingRight, type) { this.x = x; this.y = y; this.w = w; this.h = h; this.color = color; this.life = 0.15; this.facingRight = facingRight; this.type = type; } 
  update(dt) { this.life -= dt; } 
  draw(ctx) { ctx.save(); ctx.translate(this.x + this.w/2, this.y + this.h/2); if (!this.facingRight) ctx.scale(-1, 1); ctx.globalAlpha = this.life / 0.15; ctx.shadowBlur = 20; ctx.shadowColor = this.color; ctx.fillStyle = this.color; if (this.type === 'blunt') { ctx.beginPath(); ctx.arc(0, 0, this.w/1.5, -Math.PI/1.5, Math.PI/4); ctx.lineTo(0,0); ctx.fill(); } else { ctx.beginPath(); ctx.arc(0, 0, this.w/2, -Math.PI/2, Math.PI/2); ctx.arc(-20, 0, this.w/2, Math.PI/2, -Math.PI/2, true); ctx.fill(); } ctx.restore(); } 
}

export class AfterImage { 
  constructor(x, y, w, h, facingRight, progress) { this.x = x; this.y = y; this.w = w; this.h = h; this.facingRight = facingRight; this.life = 0.3; this.progress = progress; } 
  update(dt) { this.life -= dt; } 
  draw(ctx) { ctx.save(); ctx.translate(this.x + this.w/2, this.y + this.h/2); if (!this.facingRight) ctx.scale(-1, 1); ctx.rotate(this.progress * Math.PI * 2); ctx.globalAlpha = this.life; ctx.fillStyle = '#d4af37'; ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI*2); ctx.fill(); ctx.globalAlpha = 1.0; ctx.restore(); } 
}