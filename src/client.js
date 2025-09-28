const LOG = true;
const playerId = Date.now().toString();
let playerName = '';
let players = {};
let coins = [];
let gameTime = 60;
let timerInterval = null;
let paused = false;
let pickedCoins = new Set();
let speedBoosts = {};
let boostedPlayers = {};
let playerSpeeds = {};

if (LOG) console.log('client.js loaded', {href: location.href, playerId});

let ws = null;

function initWS() {
    try {
        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = location.host;
        const url = `${protocol}//${host}`;

        if (LOG) console.log('connect ws', url);
        ws = new WebSocket(url);

        ws.onopen = () => LOG && console.log('ws open');
        ws.onclose = () => LOG && console.log('ws close');
        ws.onerror = e => console.error('ws error', e);

        ws.onmessage = e => {
            let data;
            try {
                data = JSON.parse(e.data);
            } catch (err) {
                console.warn('invalid ws msg', e.data);
                return;
            }
            if (LOG) console.log('ws msg', data.type, data);
            handleMessage(data);
        };
    } catch (err) {
        console.error('ws init failed', err);
    }
}

initWS();

const keys = {};
const SPEED = 2;
let playerSpeed = SPEED;

function handleMessage(data) {
    if (data.type === 'lobby') {
        Object.entries(data.players || {}).forEach(([id, p]) => {
            if (!players[id]) {
                players[id] = {...p, x: p.x, y: p.y, targetX: p.x, targetY: p.y};
            } else {
                players[id].name = p.name;
                players[id].color = p.color;
                players[id].score = p.score;
                if (players[id].x === undefined) players[id].x = p.x;
                if (players[id].y === undefined) players[id].y = p.y;
                players[id].targetX = p.x;
                players[id].targetY = p.y;
            }
        });
        Object.keys(players).forEach(id => {
            if (!(id in (data.players || {}))) delete players[id];
        });
        showLobby();
        renderPlayers();
        const startBtn = document.getElementById('startBtn');
        if (startBtn) {
            if (data.leaderId && String(data.leaderId) === String(playerId)) startBtn.style.display = 'block';
            else startBtn.style.display = 'none';
        }
        renderLobbyPlayers();
        return;
    }

    if (data.type === 'gameStart') {
        coins = data.coins || [];
        gameTime = data.gameTime || 60;
        if (data.background) {
            const arena = document.getElementById('arena');
            if (arena) arena.style.backgroundImage = `url(${data.background})`;
        }
        showGame();
        renderCoins();
        startTimer();
        paused = false;
        const menu = document.getElementById('menu');
        if (menu) menu.style.display = 'none';
        requestAnimationFrame(gameLoop);
        return;
    }

    if (data.type === 'gameOver') {
        players = data.players || {};
        endGame();
        return;
    }

    if (data.type === 'rejoin') {
        players = data.players || {};
        coins = data.coins || [];
        gameTime = data.gameTime || 0;
        showGame();
        renderPlayers();
        renderCoins();
        startTimer();
        requestAnimationFrame(gameLoop);
        return;
    }

    if (data.type === 'players') {
        Object.entries(data.players || {}).forEach(([id, p]) => {
            if (!players[id]) {
                players[id] = {...p, x: p.x, y: p.y, targetX: p.x, targetY: p.y};
            } else {
                players[id].targetX = p.x;
                players[id].targetY = p.y;
                players[id].score = p.score;
                players[id].color = p.color;
                players[id].name = p.name;
                players[id].frozenUntil = p.frozenUntil || 0;
            }
        });
        Object.keys(players).forEach(id => {
            if (!(id in (data.players || {}))) delete players[id];
        });
        renderPlayers();
        updateScore();
        renderLeaderboard();
        renderLobbyPlayers();
        return;
    }

    if (data.type === 'coins') {
        coins = data.coins || [];
        const coinIds = new Set(coins.map(c => c.id));
        pickedCoins.forEach(id => {
            if (!coinIds.has(id)) pickedCoins.delete(id);
        });
        renderCoins();
        return;
    }

    if (data.type === 'menuAction') {
        if (data.action === 'pause') paused = true;
        if (data.action === 'resume') paused = false;
        if (data.action === 'resume') requestAnimationFrame(gameLoop);
        if (data.action === 'quit') location.reload();
        return;
    }

    if (data.type === 'timerUpdate') {
        gameTime = data.gameTime;
        const timerEl = document.getElementById('timer');
        if (timerEl) timerEl.textContent = String(gameTime);
        return;
    }

    if (data.type === 'error') {
        const errorContainer = document.getElementById('errors');
        const errorMessage = document.getElementById('errorMessage');

        if (errorMessage && errorContainer) {
            errorMessage.textContent = data.message;
            errorContainer.style.display = 'block';
        }

        return;
    }

    if (data.type === 'clear-error') {
        const errorContainer = document.getElementById('errors');
        if (errorContainer) errorContainer.style.display = 'none';

        const errorMessage = document.getElementById('errorMessage');
        if (errorMessage) errorMessage.textContent = '';

        return;
    }

    if (data.type === 'speedBoost') {
        const {id, duration} = data;
        boostedPlayers[id] = true;
        renderPlayers();
        if (id === playerId) {
            playerSpeed = SPEED * 2;
        }
        if (speedBoosts[id]) clearTimeout(speedBoosts[id]);
        speedBoosts[id] = setTimeout(() => {
            boostedPlayers[id] = false;
            playerSpeeds[id] = SPEED;
            renderPlayers();
            if (id === playerId) playerSpeed = SPEED;
        }, duration || 1000);
        return;
    }
}

function renderLobbyPlayers() {
    const list = document.getElementById('playersList');
    if (list) {
        list.innerHTML = '';
        Object.values(players).forEach(p => {
            const li = document.createElement('li');
            li.textContent = p.name + (p.name === playerName ? ' (You)' : '');
            list.appendChild(li);
        });
    }
}

// leaderboard
function renderLeaderboard() {
    const leaderboard = document.getElementById('leaderboard');
    const list = document.getElementById('leaderboardList');
    if (!leaderboard || !list) return;
    const sorted = Object.values(players).sort((a, b) => (b.score || 0) - (a.score || 0));
    Array.from(list.children).map(li => li.getAttribute('data-name'));
    sorted.forEach((p, i) => {
        let li = list.querySelector(`li[data-name="${p.name}"]`);
        if (!li) {
            li = document.createElement('li');
            li.setAttribute('data-name', p.name);
            li.style.transition = 'transform 0.5s';
            list.appendChild(li);
        }
        li.textContent = `${i + 1}. ${p.name}${p.name === playerName ? ' (You)' : ''} — ${p.score || 0}`;
        li.style.color = p.color || 'white';
        li.style.order = i;
    });
    Array.from(list.children).forEach(li => {
        if (!sorted.find(p => p.name === li.getAttribute('data-name'))) li.remove();
    });
    leaderboard.style.display = 'block';
}

function hideLeaderboard() {
    const leaderboard = document.getElementById('leaderboard');
    if (leaderboard) leaderboard.style.display = 'none';
}

function showLobby() {
    const js = document.getElementById('join-screen');
    const ls = document.getElementById('lobby-screen');
    if (js && js.style) js.style.display = 'none';
    if (ls && ls.style) ls.style.display = 'block';
}

function showGame() {
    const ls = document.getElementById('lobby-screen');
    const gs = document.getElementById('game-screen');
    const js = document.getElementById('join-screen');
    if (ls && ls.style) ls.style.display = 'none';
    if (gs && gs.style) gs.style.display = 'block';
    renderLeaderboard();
    if (js && js.style) js.style.display = 'none';
}

function updateScore() {
    const scoreEl = document.getElementById('score');
    if (scoreEl) scoreEl.textContent = String(players[playerId]?.score || 0);
}

function renderPlayers() {
    const arena = document.getElementById('arena');
    if (!arena) return;
    const existing = {};
    arena.querySelectorAll('.player').forEach(el => {
        const id = el.getAttribute('data-id');
        if (id) existing[id] = el;
    });

    Object.entries(players).forEach(([id, p]) => {
        let el = existing[id];
        if (!el) {
            el = document.createElement('div');
            el.className = 'player';
            el.setAttribute('data-id', id);
            el.title = p.name || '';
            arena.appendChild(el);
        }
        el.style.backgroundColor = p.color || 'white';
        el.style.transform = `translate(${p.x || 0}px, ${p.y || 0}px)`;
        if (String(id) === String(playerId)) el.classList.add('you'); else el.classList.remove('you');
        if (boostedPlayers[id]) {
            el.classList.add('speed-boost');
            el.style.filter = 'drop-shadow(0 0 10px red) brightness(1.1)';
            el.style.opacity = '0.7';
        } else {
            el.classList.remove('speed-boost');
            el.style.filter = '';
            el.style.opacity = '';
        }
        if (p.frozenUntil && p.frozenUntil > Date.now()) {
            el.classList.add('frozen-player');
        } else {
            el.classList.remove('frozen-player');
        }
        delete existing[id];
    });

    Object.keys(existing).forEach(id => existing[id].remove());
}

function renderCoins() {
    const arena = document.getElementById('arena');
    if (!arena) return;
    const existing = {};
    arena.querySelectorAll('.coin').forEach(el => {
        const id = el.getAttribute('data-id');
        if (id) existing[id] = el;
    });

    coins.forEach(c => {
        let el = existing[c.id];
        if (!el) {
            el = document.createElement('div');
            el.className = 'coin';
            if (c.type === 'red') el.classList.add('red-coin');
            el.className = c.type === 'frozen' ? 'coin frozen-coin' : 'coin';
            el.setAttribute('data-id', c.id);
            arena.appendChild(el);
        } else {
            el.className = c.type === 'frozen' ? 'coin frozen-coin' : 'coin';
        }
        if (c.type === 'red') {
            el.classList.add('red-coin');
        } else {
            el.classList.remove('red-coin');
        }
        el.style.left = `${c.x}px`;
        el.style.top = `${c.y}px`;
        delete existing[c.id];
    });

    Object.keys(existing).forEach(id => existing[id].remove());
}

function startTimer() {
    clearInterval(timerInterval);
    const timerEl = document.getElementById('timer');
    if (timerEl) timerEl.textContent = String(gameTime);

    timerInterval = setInterval(() => {
        if (!paused) {
            // gameTime--;
            // const timerEl = document.getElementById('timer');
            // if (timerEl) timerEl.textContent = String(gameTime);
            if (gameTime <= 0) endGame();
        }
    }, 1000);
}

function endGame() {
    playerSpeed = 0;
    clearInterval(timerInterval);
    document.getElementById('soundEnd')?.play();
    hideLeaderboard();
    const sorted = Object.values(players).sort((a, b) => (b.score || 0) - (a.score || 0));
    const winnerSpan = document.getElementById('winner');
    if (winnerSpan && sorted.length > 0) {
        const winner = sorted[0];
        winnerSpan.textContent = `${winner.name} (${winner.score || 0} points)`;
        winnerSpan.style.color = winner.color || '#ffd700';
    }
    const list = document.getElementById('resultList');
    if (list) {
        list.innerHTML = '';
        sorted.forEach((p, i) => {
            const li = document.createElement('li');
            li.textContent = `${i + 1}. ${p.name} - ${p.score || 0} points`;
            li.style.color = p.color || 'white';
            list.appendChild(li);
        });
    }
    document.getElementById('result-screen')?.style && (document.getElementById('result-screen').style.display = 'block');
}

function gameLoop() {
    if (!paused) {
        const p = players[playerId];
        const isFrozen = p && p.frozenUntil && p.frozenUntil > Date.now();
        if (p) {
            let dx = 0, dy = 0;
            if (!isFrozen) {
                if (keys['ArrowUp']) dy -= playerSpeed;
                if (keys['ArrowDown']) dy += playerSpeed;
                if (keys['ArrowLeft']) dx -= playerSpeed;
                if (keys['ArrowRight']) dx += playerSpeed;
            }
            if (dx !== 0 || dy !== 0) {
                p.x = Math.max(0, Math.min(800 - 30, p.x + dx));
                p.y = Math.max(0, Math.min(600 - 30, p.y + dy));
                p.targetX = p.x;
                p.targetY = p.y;
                const myEl = document.querySelector(`.player[data-id="${playerId}"]`);
                if (myEl) myEl.style.transform = `translate(${p.x}px, ${p.y}px)`;
                if (isFrozen) return;
                if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({
                    type: 'move',
                    id: playerId,
                    x: p.x,
                    y: p.y
                }));
                checkPickup();
            }
        }
        Object.entries(players).forEach(([id, p]) => {
            if (id !== playerId) {
                if (typeof p.x === 'number' && typeof p.targetX === 'number') {
                    p.x += (p.targetX - p.x) * 0.2;
                }
                if (typeof p.y === 'number' && typeof p.targetY === 'number') {
                    p.y += (p.targetY - p.y) * 0.2;
                }
                const el = document.querySelector(`.player[data-id="${id}"]`);
                if (el) el.style.transform = `translate(${p.x}px, ${p.y}px)`;
            }
        });
        const myEl = document.querySelector(`.player[data-id="${playerId}"]`);
        if (myEl) {
            if (isFrozen) myEl.classList.add('frozen-player');
            else myEl.classList.remove('frozen-player');
        }
        requestAnimationFrame(gameLoop);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const joinBtn = document.getElementById('joinBtn');
    const startBtn = document.getElementById('startBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const resumeBtn = document.getElementById('resumeBtn');
    const restartBtn = document.getElementById('restartBtn');
    const quitBtn = document.getElementById('quitBtn');
    const playerNameInput = document.getElementById('playerName');

    joinBtn?.addEventListener('click', () => {
        playerName = playerNameInput?.value || '';
        if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({
            type: 'join',
            id: playerId,
            name: playerName
        }));
    });

    startBtn?.addEventListener('click', () => {
        if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({type: 'startGame', id: playerId}));
    });

    pauseBtn?.addEventListener('click', () => {
        paused = true;
        document.getElementById('menu')?.style && (document.getElementById('menu').style.display = 'block');
        if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({
            type: 'pause',
            id: playerId,
            name: playerName
        }));
    });

    resumeBtn?.addEventListener('click', () => {
        paused = false;
        document.getElementById('menu')?.style && (document.getElementById('menu').style.display = 'none');
        if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({
            type: 'resume',
            id: playerId,
            name: playerName
        }));
        requestAnimationFrame(gameLoop);
    });

    restartBtn?.addEventListener('click', () => {
        if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({
            type: 'restart',
            id: playerId,
            name: playerName
        }));
    });

    quitBtn?.addEventListener('click', () => {
        if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({
            type: 'quit',
            id: playerId,
            name: playerName
        }));
        location.reload();
    });

    window.addEventListener('keydown', (e) => {
        const p = players[playerId];
        if (p && p.frozenUntil && p.frozenUntil > Date.now()) return;
        if (e.key.startsWith('Arrow')) {
            keys[e.key] = true;
            e.preventDefault();
        }
    }, {passive: false});
    window.addEventListener('keyup', (e) => {
        const p = players[playerId];
        if (p && p.frozenUntil && p.frozenUntil > Date.now()) return;
        if (e.key.startsWith('Arrow')) {
            keys[e.key] = false;
            e.preventDefault();
        }
    }, {passive: false});

    requestAnimationFrame(gameLoop);
});

function playCoinSound() {
    const base = document.getElementById('soundCoin');
    try {
        if (base) {
            const a = base.cloneNode(true);
            a.play().catch(() => {
            });
        } else {
            const a = new Audio('audio/coin.mp3');
            a.play().catch(() => {
            });
        }
    } catch (e) {
        console.warn('playCoinSound failed', e);
    }
}

function checkPickup() {
    const p = players[playerId];
    if (!p) return;
    coins.slice().forEach(c => {
        if (Math.abs(p.x - c.x) < 20 && Math.abs(p.y - c.y) < 20 && !pickedCoins.has(c.id)) {
            playCoinSound();
            pickedCoins.add(c.id);
            if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({
                type: 'pickup',
                id: playerId,
                coinId: c.id
            }));
        }
    });
}