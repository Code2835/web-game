const express = require('express');
const WebSocket = require('ws');
const http = require('http');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.WebSocketServer({server});

const path = require('path');
app.use(express.static(path.join(__dirname, '..', 'src')));

let players = {};
let coins = [];
let leaderId = null;

function spawnCoin() {
    coins.push({
        id: Date.now() + Math.floor(Math.random() * 1000),
        x: Math.floor(Math.random() * 760) + 10,
        y: Math.floor(Math.random() * 560) + 10
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
    if (coins.length < 10) spawnCoin();
    broadcast({type: 'coins', coins});
}, 2000);

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

wss.on('connection', ws => {
    console.log('WS: client connected');

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
            if (!leaderId) leaderId = data.id;
            const pos = getSpawnPosition();
            players[data.id] = {
                name: data.name,
                x: pos.x,
                y: pos.y,
                score: 0,
                color: randomColor()
            };
            try {
                ws.send(JSON.stringify({type: 'lobby', players, leaderId}));
            } catch (e) {
                console.warn('WS: failed to send lobby to new client', e);
            }
            broadcast({type: 'players', players});
            return;
        }

        if (data.type === 'startGame' && data.id === leaderId) {
            coins = [];
            for (let i = 0; i < 10; i++) spawnCoin();
            broadcast({type: 'gameStart', coins, gameTime: 60});
            return;
        }

        if (data.type === 'move') {
            if (players[data.id]) {
                players[data.id].x = data.x;
                players[data.id].y = data.y;
                broadcast({type: 'players', players});
            }
            return;
        }

        if (data.type === 'pickup') {
            coins = coins.filter(c => c.id !== data.coinId);
            if (players[data.id]) players[data.id].score++;
            spawnCoin();
            broadcast({type: 'players', players});
            broadcast({type: 'coins', coins});
            return;
        }

        if (data.type === 'pause' || data.type === 'resume' || data.type === 'quit') {
            broadcast({type: 'menuAction', action: data.type, name: data.name});
            return;
        }
    });

    ws.on('close', () => {
        console.log('WS: client disconnected', ws.id);
        if (ws.id && players[ws.id]) {
            delete players[ws.id];
        }
        if (ws.id === leaderId) leaderId = null;
        broadcast({type: 'players', players});
    });
});

server.listen(3000, () => console.log('Server running on http://localhost:3000'));