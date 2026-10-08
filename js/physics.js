import { GameState } from './state.js';

export function rectIntersect(r1, r2) { 
  return !(r2.x >= r1.x + r1.w || r2.x + r2.w <= r1.x || r2.y >= r1.y + r1.h || r2.y + r2.h <= r1.y); 
}

export function handleCollisions(entity, axis) {
  let hitSomething = false; 
  GameState.platforms.forEach(plat => {
    if (rectIntersect(entity, plat)) {
      hitSomething = true;
      if (axis === 'x') { 
        if (entity.vx > 0) entity.x = plat.x - entity.w; else if (entity.vx < 0) entity.x = plat.x + plat.w; 
        entity.vx = 0; 
      } else if (axis === 'y') { 
        if (entity.vy > 0) { 
          entity.y = plat.y - entity.h; entity.vy = 0; 
          if (entity.isPlayer) entity.grounded = true; 
        } else if (entity.vy < 0) { 
          entity.y = plat.y + plat.h; entity.vy = 0; 
        } 
      }
    }
  }); 
  return hitSomething;
}