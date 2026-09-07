// --- CONFIGURATION ---
// PASTE YOUR ROOT ABLY KEY HERE INDEED
const ABLY_ROOT_KEY = "G38OGQ.uNt5bQ:3qxG6KLwoMWXjLtVdPU_UHIogInp2ScswHaePErQao0";

// Initialize Audio Context for Procedural Web Audio Synth Effects
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;

    if (type === 'click') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.08);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
    } else if (type === 'win') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
        osc.frequency.exponentialRampToValueAtTime(1046.50, now + 0.4); // C6
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
    } else if (type === 'draw') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.linearRampToValueAtTime(150, now + 0.2);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
    }
}

// State variables
let mySymbol = ''; // 'X' or 'O'
let currentTurn = 'X';
let roomId = '';
let channel = null;
let boardState = Array(9).fill('');
let scores = { X: 0, O: 0, draws: 0 };
let gameActive = false;

// DOM Hooking elements
const menuScreen = document.getElementById('menu-screen');
const gameScreen = document.getElementById('game-screen');
const statusDisplay = document.getElementById('status-display');
const connectionStatus = document.getElementById('connection-status');
const cells = document.querySelectorAll('.cell');
const scoreXDisplay = document.getElementById('score-x');
const scoreODisplay = document.getElementById('score-o');
const scoreDrawDisplay = document.getElementById('score-draw');
const rematchBtn = document.getElementById('rematch-btn');

// Parse Room ID out of URL if joining an existing link
const urlParams = new URLSearchParams(window.location.search);
const sharedRoomId = urlParams.get('room');

if (sharedRoomId && ABLY_ROOT_KEY !== "PASTE_YOUR_ABLY_ROOT_KEY_HERE") {
    roomId = sharedRoomId;
    mySymbol = 'O'; // Joining player is O
    initAblyConnection();
}

// Theme Mode Toggle Node
document.getElementById('theme-toggle').addEventListener('click', () => {
    document.body.classList.toggle('light-mode');
    const isLight = document.body.classList.contains('light-mode');
    document.getElementById('theme-toggle').innerText = isLight ? '🌙 Dark Mode' : '☀️ Light Mode';
});

// Create Room Handler
document.getElementById('create-match-btn').addEventListener('click', () => {
    if (ABLY_ROOT_KEY === "PASTE_YOUR_ABLY_ROOT_KEY_HERE") {
        alert("Please open script.js and add your Ably Root API key first!");
        return;
    }
    roomId = Math.random().toString(36).substring(2, 9);
    mySymbol = 'X'; // Creator player is X
    
    const shareUrl = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    document.getElementById('share-link-input').value = shareUrl;
    document.getElementById('link-container').classList.remove('hidden');
    
    initAblyConnection();
});

// Copy Link Capability
document.getElementById('copy-btn').addEventListener('click', () => {
    const input = document.getElementById('share-link-input');
    input.select();
    document.execCommand('copy');
    document.getElementById('copy-btn').innerText = 'Copied!';
    setTimeout(() => { document.getElementById('copy-btn').innerText = 'Copy Link'; }, 2000);
});

// Initialize Ably connection and pipelines
function initAblyConnection() {
    connectionStatus.innerText = "🟡 Connecting to network...";
    connectionStatus.style.color = "#f59e0b";

    const realtime = new Ably.Realtime({ key: ABLY_ROOT_KEY });

    realtime.connection.on('connected', () => {
        connectionStatus.innerText = "🟢 Online & Connected";
        connectionStatus.style.color = "#10b981";
        
        // Open Screen Interface
        menuScreen.classList.add('hidden');
        gameScreen.classList.remove('hidden');
        
        setupRoomChannel(realtime);
    });

    realtime.connection.on('failed', () => {
        connectionStatus.innerText = "🔴 Connection Failed";
        connectionStatus.style.color = "#ef4444";
        alert("Ably connection failed. Double-check your API key inside script.js.");
    });
}

function setupRoomChannel(realtime) {
    channel = realtime.channels.get(`room-${roomId}`);

    // Subscribe to Moves channel message broadcasts
    channel.subscribe('move', (message) => {
        const { index, symbol } = message.data;
        applyMove(index, symbol);
    });

    // Subscribe to rematch actions
    channel.subscribe('rematch', () => {
        resetBoardLocally();
    });

    // Start setup tracking state
    gameActive = true;
    updateStatusMessage();
}

// Click interface event hooks for game board cells
cells.forEach(cell => {
    cell.addEventListener('click', (e) => {
        const index = parseInt(e.target.getAttribute('data-index'));
        
        // Prevent click if conditions not met
        if (!gameActive || currentTurn !== mySymbol || boardState[index] !== '') return;

        // Push layout action out into network channel
        channel.publish('move', { index, symbol: mySymbol });
    });
});

function applyMove(index, symbol) {
    boardState[index] = symbol;
    cells[index].innerText = symbol;
    cells[index].classList.add(symbol.toLowerCase());
    playSound('click');

    if (checkWin(symbol)) {
        gameActive = false;
        scores[symbol]++;
        updateScoreboardDisplay();
        statusDisplay.innerHTML = `<span class="text-${symbol.toLowerCase()}">Player ${symbol} Wins!</span>`;
        playSound('win');
        rematchBtn.removeAttribute('disabled');
    } else if (boardState.every(cell => cell !== '')) {
        gameActive = false;
        scores.draws++;
        updateScoreboardDisplay();
        statusDisplay.innerHTML = `<span class="text-draw">Match ends in a Draw!</span>`;
        playSound('draw');
        rematchBtn.removeAttribute('disabled');
    } else {
        currentTurn = currentTurn === 'X' ? 'O' : 'X';
        updateStatusMessage();
    }
}

function updateStatusMessage() {
    if (currentTurn === mySymbol) {
        statusDisplay.innerHTML = `Your Turn (<span class="text-${mySymbol.toLowerCase()}">${mySymbol}</span>)`;
    } else {
        statusDisplay.innerHTML = `Waiting for opponent (<span class="text-${currentTurn.toLowerCase()}">${currentTurn}</span>)...`;
    }
}

function checkWin(player) {
    const winConditions = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // Horizontals
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // Verticals
        [0, 4, 8], [2, 4, 6]             // Diagonals
    ];
    return winConditions.some(combination => {
        return combination.every(index => boardState[index] === player);
    });
}

function updateScoreboardDisplay() {
    scoreXDisplay.innerText = scores.X;
    scoreODisplay.innerText = scores.O;
    scoreDrawDisplay.innerText = scores.draws;
}

// Rematch request
rematchBtn.addEventListener('click', () => {
    channel.publish('rematch', {});
});

function resetBoardLocally() {
    boardState = Array(9).fill('');
    currentTurn = 'X';
    gameActive = true;
    rematchBtn.setAttribute('disabled', 'true');
    cells.forEach(cell => {
        cell.innerText = '';
        cell.className = 'cell';
    });
    updateStatusMessage();
}

// Exit action handler
document.getElementById('exit-btn').addEventListener('click', () => {
    window.location.search = ''; // Strips query parameters out to return cleanly home
});
