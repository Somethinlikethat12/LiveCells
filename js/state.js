export const GameState = {
  camera: { x: 0, y: 0 },
  screenShake: 0, hitStop: 0, globalTime: 0,
  runTimer: 0, roomTimer: 0,
  state: 'HUB', pausedState: 'HUB',
  currentRoom: 0, runBlueprints: [],
  score: 0, lastTime: 0,
  
  // Entity arrays
  platforms: [], enemies: [], items: [], effects: [], projectiles: [], interactables: [],
  
  // The Player
  player: null
};