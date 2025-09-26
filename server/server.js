const express = require('express');
const WebSocket = require('ws');
const http = require('http');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.WebSocketServer({server});

const path = require('path');
app.use(express.static(path.join(__dirname, '..', 'src')));

const backgroundFiles = ['backgrounds/forest.png', 'backgrounds/city.png', 'backgrounds/lava.png', 'backgrounds/ice.png'];

let players = {};
let coins = [];
let leaderId = null;
let frozenCoinTimer = null;
// let gameStarted = false;
let gameState = 'LOBBY'; // LOBBY || PLAYING
let gameTimer = 60; // seconds
let gameCountdownInterval = null;

function spawnCoin() {
    coins.push({
        id: Date.now() + Math.floor(Math.random() * 1000),
        x: Math.floor(Math.random() * 760) + 10,
        y: Math.floor(Math.random() * 560) + 10
    });
}

function spawnRedCoin() {
    coins.push({
        id: 'r' + (Date.now() + Math.floor(Math.random() * 1000)),
        x: Math.floor(Math.random() * 760) + 10,
        y: Math.floor(Math.random() * 560) + 10,
        type: 'red'
    });
}

function spawnFrozenCoin() {
    coins.push({
        id: 'frozen-' + (Date.now() + Math.floor(Math.random() * 1000)),
        x: Math.floor(Math.random() * 760) + 10,
        y: Math.floor(Math.random() * 560) + 10,
        type: 'frozen'
    });
}

function getSpawnPosition() {
    const pad = 40;
    let attempts = 0;
    while (attempts < 50) {
        const x = Math.floor(Math.random() * (800 - pad * 2)) + pad;
        const y = Math.floor(Math.random() * (600 - pad * 2)) + pad;
        let ok = true;
        for (const id in players) {
            const p = players[id];
            if (!p) continue;
            const dx = p.x - x;
            const dy = p.y - y;
            if (Math.hypot(dx, dy) < 60) {
                ok = false;
                break;
            }
        }
        if (ok) return {x, y};
        attempts++;
    }
    return {x: Math.floor(Math.random() * 760) + 20, y: Math.floor(Math.random() * 560) + 20};
}

setInterval(() => {
    if (coins.filter(c => !c.type).length < 10) spawnCoin();
    broadcast({type: 'coins', coins});
}, 2000);

setInterval(() => {
    spawnRedCoin();
    broadcast({type: 'coins', coins});
}, 6000);

if (!frozenCoinTimer) {
    frozenCoinTimer = setInterval(() => {
        if (!coins.some(c => c.type === 'frozen')) {
            spawnFrozenCoin();
            broadcast({type: 'coins', coins});
        }
    }, 15000);
}

function broadcast(msg) {
    const data = JSON.stringify(msg);
    wss.clients.forEach(c => c.readyState === WebSocket.OPEN && c.send(data));
}

function randomColor() {
    const colors = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];
    const used = new Set(Object.values(players).map(p => p.color));
    const available = colors.filter(c => !used.has(c));
    if (available.length > 0) {
        return available[Math.floor(Math.random() * available.length)];
    }
    return colors[Math.floor(Math.random() * colors.length)];
}

function startGameCountdown() {
    clearInterval(gameCountdownInterval);
    gameTimer = 60;
    gameCountdownInterval = setInterval(() => {
        if (gameState === 'PLAYING') {
            gameTimer--;
            broadcast({type: 'timerUpdate', gameTime: gameTimer});
            if (gameTimer <= 0) {
                clearInterval(gameCountdownInterval);
                gameState = 'LOBBY';
                broadcast({type: 'gameOver', players});
                coins = [];
                Object.values(players).forEach(p => p.score = 0);
            }
        }
    }, 1000);
}

wss.on('connection', ws => {
    console.log('WS: client connected');

    if (gameState === 'PLAYING') {
        ws.send(JSON.stringify({type: 'error', message: 'Game has already started'}));
        ws.close();
        return;
    }

    ws.on('message', msg => {
        let data;
        try {
            data = JSON.parse(msg);
        } catch (e) {
            console.warn('WS: failed to parse message', msg);
            return;
        }
        console.log('WS message:', data.type, data);

        if (data.type === 'join') {
            ws.id = data.id;

            const nameExist = Object.values(players).some(p => p.name === data.name);
            const playerCount = Object.keys(players).length;

            if (!data.name || nameExist) {
                try {
                    const message = !data.name ? 'Name cannot be empty!' : 'Name already exists!';
                    ws.send(JSON.stringify({type: 'error', message}));
                } catch (e) {
                }
                return;
            } else if (playerCount >= 4) {
                ws.send(JSON.stringify({type: 'error', message: 'Max 4 player count reached'}));
                return;
            } else {
                ws.send(JSON.stringify({type: 'clear-error'}))
            }

            if (!leaderId) leaderId = data.id;
            const pos = getSpawnPosition();
            players[data.id] = {
                name: data.name,
                x: pos.x,
                y: pos.y,
                score: 0,
                color: randomColor(),
                frozenUntil: 0
            };

            if (gameState === 'PLAYING') {
                ws.send(JSON.stringify({type: 'rejoin', players, leaderId, coins, gameTime: gameTimer}));
            } else {
                ws.send(JSON.stringify({type: 'lobby', players, leaderId}));
            }
            const playersWithFrozen = {};
            for (const id in players) {
                playersWithFrozen[id] = {
                    ...players[id],
                    frozenUntil: players[id].frozenUntil || 0
                };
            }
            broadcast({type: 'players', players: playersWithFrozen});

            const playersUpdate = JSON.stringify({type: 'players', players});
            wss.clients.forEach(c => {
                if (c.readyState === WebSocket.OPEN && c.id !== ws.id) {
                    c.send(playersUpdate);
                }
            });

            return;
        }

        if (data.type === 'startGame' && data.id === leaderId) {
            const playerCount = Object.keys(players).length;
            if (playerCount < 2) {
                ws.send(JSON.stringify({type: 'error', message: 'You must have minimum 2 players to start the game'}));
                return;
            }

            // gameStarted = true;
            gameState = 'PLAYING';
            startGameCountdown();
            coins = [];
            for (let i = 0; i < 10; i++) spawnCoin();
            const background = backgroundFiles[Math.floor(Math.random() * backgroundFiles.length)];
            broadcast({type: 'gameStart', coins, gameTime: gameTimer, background: background});
            return;
        }

        if (data.type === 'restart' && data.id === leaderId) {
            gameState = 'PLAYING';
            startGameCountdown();
            coins = [];
            for (let i = 0; i < 10; i++) spawnCoin();

            Object.values(players).forEach(p => {
                const pos = getSpawnPosition();
                p.x = pos.x;
                p.y = pos.y;
                p.score = 0;
                p.frozenUntil = 0;
            });
            broadcast({type: 'players', players});
            broadcast({type: 'gameStart', coins, gameTime: gameTimer, });
            broadcast({type: 'menuAction', action: 'restart', name: players[data.id]?.name || 'A player'});
            return;
        }

        if (data.type === 'move') {
            if (players[data.id]) {
                if (players[data.id].frozenUntil && players[data.id].frozenUntil > Date.now()) {
                    return;
                }
                players[data.id].x = data.x;
                players[data.id].y = data.y;
                const playersWithFrozen = {};
                for (const id in players) {
                    playersWithFrozen[id] = {
                        ...players[id],
                        frozenUntil: players[id].frozenUntil || 0
                    };
                }
                broadcast({type: 'players', players: playersWithFrozen});
            }
            return;
        }

        if (data.type === 'pickup') {
            const coin = coins.find(c => c.id === data.coinId);
            coins = coins.filter(c => c.id !== data.coinId);

            if (coin && coin.type === 'red') {
                broadcast({type: 'speedBoost', id: data.id, duration: 1000});
            } else if (coin.type === 'frozen') {
                const now = Date.now();
                for (const id in players) {
                    if (id !== data.id) {
                        players[id].frozenUntil = now + 3000; // 3 seconds
                    }
                }
            } else {
                if (players[data.id]) players[data.id].score++;
            }

            if (coins.filter(c => !c.type).length < 10) spawnCoin();

            const playersWithFrozen = {};
            for (const id in players) {
                playersWithFrozen[id] = {
                    ...players[id],
                    frozenUntil: players[id].frozenUntil || 0
                };
            }
            broadcast({type: 'players', players: playersWithFrozen});
            broadcast({type: 'coins', coins});
            return;
        }

        if (data.type === 'pause' || data.type === 'resume' || data.type === 'quit') {
            broadcast({type: 'menuAction', action: data.type, name: players[data.id]?.name || 'A player'});
            return;
        }
    });

    ws.on('close', () => {
        console.log('WS: client disconnected', ws.id);
        if (ws.id && players[ws.id]) {
            delete players[ws.id];

            if (ws.id === leaderId) {
                leaderId = Object.keys(players)[0] || null;
            }

            if (Object.keys(players).length === 0) {
                gameState = 'LOBBY';
                leaderId = null;
                clearInterval(gameCountdownInterval);
                gameTimer = 60;
                coins = [];
                if (frozenCoinTimer) clearInterval(frozenCoinTimer);
            }

            if (gameState === 'PLAYING') {
                broadcast({type: 'players', players});
            } else {
                broadcast({type: 'lobby', players, leaderId});
            }

            // broadcast({type: 'lobby', players, leaderId});
        }

        // if (Object.keys(players).length === 0) {
        //     gameStarted = false;
        // }
    });
});

server.listen(3000, () => console.log('Server running on http://localhost:3000'));