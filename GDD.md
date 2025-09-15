# Game Design Document: DOM Zombie Shooter

## 1\. High Concept

-   **Game Title:** DOM Zombie Shooter (Working Title)
    
-   **Genre:** Top-Down Arena Shooter
    
-   **Platform:** Web Browser
    
-   **Target Audience:** Casual players looking for a quick, competitive multiplayer experience.
    
-   **Unique Selling Proposition (USP):** A real-time multiplayer shooter rendered entirely with DOM elements, pushing the boundaries of what's possible in a browser without using `<canvas>`.
    

## 2\. Game Overview

### 2.1. Core Concept

Up to 4 players battle in a shared arena against each other and periodic waves of zombies. The primary objective is to collect the most gold and survive for a 3-minute round. If more than one player remains after the timer expires, a "Sudden Death" mode triggers with endless zombie waves until only one player is left standing.

### 2.2. Game Flow

1.  **Lobby:** Players join a game session via a URL, enter their unique names, and wait for the host to start the match.
    
2.  **Round Start (3:00):** Players spawn in the corners of the map. The main phase begins.
    
3.  **Main Phase:** Players move, shoot, collect items, and fight zombies. The goal is to accumulate gold and eliminate opponents.
    
4.  **Round End:**
    
    -   **Timer Expires (>1 Player):** Sudden Death mode begins. Gold no longer matters; the goal is to be the last one standing against infinite zombie hordes.
        
    -   **One Player Remains:** The last surviving player is declared the winner.
        
    -   **Timer Expires (<=1 Player):** The winner is the surviving player with the most gold.
        

## 3\. Core Mechanics

### 3.1. Player Actions

-   **Movement:** 8-directional movement (WASD + diagonals).
    
-   **Shooting:** Players shoot in the direction of their mouse cursor.
    
-   **Interaction:** Players automatically pick up items by moving over them.
    

### 3.2. Combat System

-   **Health & Armor:** Each player has 3 lives and can hold up to 3 armor points. Damage from other players removes armor first, then lives.
    
-   **Respawn:** Upon death, a player respawns in their starting corner after a 10-second delay, during which they cannot move or act.
    
-   **Zombies:** Zombies are a secondary threat. They target the nearest player and attempt to immobilize them. Direct contact with a zombie for 3 seconds results in the loss of 1 life, bypassing armor.
    

## 4\. Game Entities

### 4.1. Player

-   **Lives:** 3
    
-   **Armor:** 0 (Max: 3)
    
-   **Ammo:** 10 (Starts with)
    
-   **Gold:** 0 (Starts with)
    
-   **State:** Alive, Dead, Spawning.
    

### 4.2. Zombie (Bonus Threat)

-   **Lives:** 1 (Scales with waves in Sudden Death)
    
-   **Behavior:** Spawns at the edge of the map, locks onto the nearest player, and pursues them. Does not switch targets.
    
-   **Attack:** On contact, immobilizes the player for 3 seconds. If the zombie is not killed within this time, the player loses 1 life (ignores armor).
    

### 4.3. Projectile (Bullet)

-   **Behavior:** Travels in a straight line from the player towards the cursor position at the time of firing.
    
-   **Collision:** Despawns upon hitting a player, zombie, or map boundary.
    
-   **Damage:** 1 point (removes 1 armor or 1 life).
    

### 4.4. Pickups

-   **Ammo Crate:** Grants +30 ammo.
    
-   **Armor Plate:** Grants +1 armor (up to the maximum of 3).
    
-   **Gold Chest:** Grants a random amount of gold (1-100).
    

## 5\. Technical Specification

-   **Frontend:** HTML / CSS / JavaScript (TypeScript)
    
-   **Backend:** Node.js with TypeScript
    
-   **Networking:** WebSockets
    
-   **Architecture:** Authoritative Server (`Server is the Source of Truth`).
    
-   **Performance Target:** 60 FPS, jank-free experience.
    

### 5.1. World Coordinates & Rendering

The game uses a virtual coordinate system (e.g., 1000x1000 units) on the server to track all entity positions. The client is responsible for translating these world coordinates into appropriate screen coordinates (pixels, percentages) for responsive rendering on any device. This separates game logic from presentation.

> _\[Mentor's Note: This is a crucial and excellent design choice. It's the professional way to handle multi-resolution displays and keep the server logic clean.\]_

## 6\. Data Structures (TypeScript Interfaces)

> _\[Mentor's Note: These interfaces are a great start. They clearly define the "blueprints" for our game objects. I've added a `status` field to the Player, which can simplify logic for handling states like respawning or being stunned.\]_

```
<span class="selected">// The complete snapshot of the game world, sent from server to clients.
interface GameState {
  gameStatus: 'lobby' | 'in-progress' | 'sudden-death' | 'finished';
  timer: number; // Time remaining in seconds
  players: { [id: string]: Player };
  bullets: { [id: string]: Bullet };
  items: { [id: string]: Item };
  zombies: { [id: string]: Zombie };
  winnerId?: string;
}

interface Vector2D {
  x: number;
  y: number;
}

interface Player {
  id: string;
  name: string;
  position: Vector2D;
  rotation: number; // Angle in radians for aiming
  lives: number;
  armor: number;
  ammo: number;
  gold: number;
  isAlive: boolean;
  status: 'active' | 'spawning' | 'stunned';
  respawnTimer: number; // Countdown &gt; 0 if spawning
}

interface Bullet {
  id: string;
  ownerId: string;
  position: Vector2D;
  velocity: Vector2D;
}

interface Item {
  id: string;
  type: 'ammo' | 'armor' | 'gold';
  position: Vector2D;
  value?: number; // For gold chests
}

interface Zombie {
  id: string;
  position: Vector2D;
  health: number;
  targetId: string;
}
</span><br class="ProseMirror-trailingBreak">
```

## 7\. Network Protocol (WebSocket API)

The client sends lightweight user inputs to the server. The server processes these inputs, simulates the game world, and broadcasts the authoritative `GameState` back to all clients at a fixed tick rate (e.g., 20-30 times per second).

> _\[Mentor's Note: This client-input -> server-state model is the right way to build a secure and synchronized real-time game. It prevents cheating and ensures everyone sees the same reality.\]_

### 7.1. Client to Server (C2S) Events

-   **`join_game`**: Sent once to enter the lobby.
    
    -   **Payload:** `{ name: string }`
        
-   **`player_input`**: Sent repeatedly at a fixed interval (e.g., 30 times/sec) while the player is active.
    
    -   **Payload:** `{ keys: string[], mouseAngle: number }` (e.g., `keys: ['w', 'a']`)
        
-   **`player_shoot`**: Sent on a mouse click.
    
    -   **Payload:** `{ angle: number }`
        
-   **`start_game`**: Sent by the host player to begin the match.
    
    -   **Payload:** `{}`
        

### 7.2. Server to Client (S2C) Events

-   **`init`**: The very first message to a new client, assigning them their unique ID.
    
    -   **Payload:** `{ playerId: string, initialState: GameState }`
        
-   **`game_state`**: The primary update message, broadcast to all players.
    
    -   **Payload:** `GameState`
        
-   **`player_joined`**: Informs all clients in the lobby about a new player.
    
    -   **Payload:** `{ id: string, name: string }`
        
-   **`player_left`**: Informs all clients when a player disconnects.
    
    -   **Payload:** `{ id: string }`
        

## 8\. Minimum Viable Product (MVP)

-   A functional server that clients can connect to via a URL.
    
-   **Lobby System:** Players can join, set a unique name, and see other players in the lobby.
    
-   **Host Controls:** The first player to join becomes the host and can start the game for 2-4 players.
    
-   **Core Gameplay:**
    
    -   Players spawn on the map as `div` elements.
        
    -   Players can move using keyboard inputs.
        
    -   Movement is smooth (60 FPS, using `requestAnimationFrame`).
        
    -   The server correctly processes movement inputs and broadcasts the updated positions to all clients in real-time.