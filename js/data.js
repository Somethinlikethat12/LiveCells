export const SETTINGS = { gravity: 2400, terminalVelocity: 1200, coyoteTime: 0.12, jumpBuffer: 0.12 };

export let DIFFICULTY = { id: 'peckish', hpMult: 1.0, dmgMult: 1.0, hungerDrain: false };
export let META = { blood: 0, upgrades: { vitality: 0, fervor: 0, fasting: 0 }, blueprints: [], unlockedWeapons: ['blade', 'mace'] };
export const COSTS = { vitality: [10, 25, 50, 100, 200, -1], fervor: [15, 30, 60, 120, 250, -1], fasting: [20, 40, 80, 150, 300, -1] };

export function loadMeta() { 
  try { let m = localStorage.getItem('butcher_meta_v4'); if(m) META = Object.assign(META, JSON.parse(m)); } catch(e){} 
}
export function saveMeta() { 
  try { localStorage.setItem('butcher_meta_v4', JSON.stringify(META)); } catch(e){} 
}

export const WEAPONS = {
  blade: { id: 'blade', name: "Blade of Fervor", damage: 40, breach: 20, range: 85, cooldown: 0.35, color: "#ff1a3c", drawType: "sword", swingSpeed: 0.2, unlockCost: 0 },
  mace: { id: 'mace', name: "Penance Mace", damage: 85, breach: 100, range: 70, cooldown: 0.7, color: "#d4af37", drawType: "blunt", swingSpeed: 0.4, unlockCost: 0 },
  scythe: { id: 'scythe', name: "Blood Scythe", damage: 65, breach: 50, range: 120, cooldown: 0.5, color: "#99001a", drawType: "sword", swingSpeed: 0.3, unlockCost: 50 },
  greatsword: { id: 'greatsword', name: "Crucible Greatsword", damage: 120, breach: 150, range: 100, cooldown: 1.0, color: "#eaddcf", drawType: "blunt", swingSpeed: 0.6, unlockCost: 100 },
};

export const ENEMY_TYPES = {
  PENITENT: { id: 'penitent', hp: 60, poise: 30, speed: 45, type: 'melee', color: '#2a1a1f', w: 24, h: 56, atkRange: 60, atkDmg: 20, windup: 0.4, cooldown: 1.2 },
  MARTYR:   { id: 'martyr',   hp: 40, poise: 20, speed: 60, type: 'ranged', color: '#3a1520', w: 24, h: 56, atkRange: 500, atkDmg: 15, windup: 0.6, cooldown: 2.0 }, 
  TEMPLAR:  { id: 'templar',  hp: 90, poise: 80, speed: 30, type: 'shield', color: '#1a1a24', w: 30, h: 60, atkRange: 50, atkDmg: 25, windup: 0.5, cooldown: 1.5 },
  THURIFER: { id: 'thurifer', hp: 70, poise: 50, speed: 40, type: 'bomber', color: '#4a1515', w: 24, h: 56, atkRange: 400, atkDmg: 25, windup: 0.5, cooldown: 3.0 },
  BOSS:     { id: 'boss',     hp: 800, poise: 300, speed: 65, type: 'melee', color: '#ff1a3c', w: 40, h: 100, atkRange: 120, atkDmg: 40, windup: 0.4, cooldown: 1.0 }
};

export const BIOMES = [ { name: "The Crypts", color: '#1a1a1a' }, { name: "Sanguine Gardens", color: '#2a1111' }, { name: "Cathedral Heights", color: '#11152a' } ];

export const HUB_DATA = {
  platforms: [
    { x: -500, y: 600, w: 2000, h: 400 },
    { x: -500, y: -200, w: 50, h: 1200 },
    { x: 1450, y: -200, w: 50, h: 1200 }
  ],
  interactables: [
    { type: 'altar', x: 400, y: 600, text: "[E] Pray at the Altar", w: 80, h: 60 },
    { type: 'shop', x: 750, y: 600, text: "[E] Speak with The Reflection", w: 50, h: 100 },
    { type: 'door', x: 1100, y: 600, text: "[E] Descend to the Crypt", w: 100, h: 150 }
  ]
};