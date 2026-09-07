// =========================================================
// 🛠️ STEP 1: PASTE YOUR ABLY ROOT API KEY BETWEEN THE QUOTES
// =========================================================
const ABLY_ROOT_KEY = "PASTE_YOUR_ABLY_ROOT_KEY_HERE";

const urlParams = new URLSearchParams(window.location.search);
const sharedRoomId = urlParams.get('room');
let roomId = '';
let mySymbol = 'X'; 
let currentTurn = 'X';
let channel;
let ably;
let scores = { X: 0, O: 0, draws: 0 };

// Theme Toggle Functionality
document.getElementById('theme-toggle').addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    document.getElementById('theme-toggle').innerText = document.body.classList.contains('light-theme') ? '☀️' : '🌙';
});

// Smart Router: Checks if joining or hosting based on the web link
if (sharedRoomId && window.location.search.includes('room=')) {
    if (ABLY_ROOT_KEY === "PASTE_YOUR_ABLY_ROOT_KEY_HERE") {
        document.body.innerHTML = "<h1>Setup Error: Please open script.js and add your Ably key!</h1>";
    } else {
        roomId = sharedRoomId;
        mySymbol = 'O'; 
        document.getElementById('menu-screen').style.display = 'none';
        document.getElementById('game-screen').style.display = 'block';
        initAblyConnection();
    }
} else {
    // Fresh visit: Always display the link generator landing page safely
    document.getElementById('menu-screen').style.display = 'block';
    document.getElementById('game-screen').style.display = 'none';
}

// Host Button Action
document.getElementById('create-room-btn').addEventListener('click', () => {
    if (ABLY_ROOT_KEY === "PASTE_YOUR_ABLY_ROOT_KEY_HERE") {
        alert("Please paste your Ably key inside script.js first!");
        return;
    }
    roomId = Math.random().toString(36).substring(2, 9);
    const matchUrl = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    
    const linkDisplay = document.getElementById('link-display');
    linkDisplay.style.display = 'block';
    linkDisplay.innerHTML = `Send this link to your friend:<br><a href="${matchUrl}" target="_blank">${matchUrl}</a>`;
    
    mySymbol = 'X';
    initAblyConnection();
    
    document.getElementById('menu-screen').style.display = 'none';
    document.getElementById('game-screen').style.display = 'block';
});

// Initialize Realtime Sync Pipe
function initAblyConnection() {
    ably = new Ably.Realtime(ABLY_ROOT_KEY);
    channel = ably.channels.get(`room-${roomId}`);
    
    document.getElementById('status-indicator').innerText = `You are Player ${mySymbol}. Waiting for opponent...`;

    // Network event receiver
    channel.subscribe('game-move', (message) => {
        const data = message.data;
        
        if (data.action === 'move') {
            const cell = document.querySelector(`[data-index="${data.index}"]`);
            cell.innerText = data.symbol;
            playAudioTone(550, 0.06); // Smooth click beep
            currentTurn = currentTurn === 'X' ? 'O' : 'X';
            document.getElementById('status-indicator').innerText = `Player ${currentTurn}'s Turn`;
            checkMatchState();
        } else if (data.action === 'reset') {
            resetBoardLocally();
        }
    });
}

// Cell grid click listeners
const cells = document.querySelectorAll('.cell');
cells.forEach((cell, index) => {
    cell.addEventListener('click', () => {
        if (currentTurn !== mySymbol || cell.innerText !== '') return;
        channel.publish('game-move', { action: 'move', index: index, symbol: mySymbol });
    });
});

// Reset game broadcast listener
document.getElementById('reset-game-btn').addEventListener('click', () => {
    channel.publish('game-move', { action: 'reset' });
});

function resetBoardLocally() {
    cells.forEach(cell => cell.innerText = '');
    currentTurn = 'X';
    document.getElementById('status-indicator').innerText = `Game Reset! Player X's Turn`;
    document.getElementById('reset-game-btn').style.display = 'none';
}

// Web Audio Synthesizer Node generator
function playAudioTone(freq, duration) {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
    } catch(e){}
}

// Win and Score calculations
function checkMatchState() {
    const grid = Array.from(cells).map(c => c.innerText);
    const patterns = [, [3, 4, 5], [6, 7, 8], // Rows, [1, 4, 7], [2, 5, 8], // Columns, [2, 4, 6]             // Diagonals
    ];
    
    for (let combo of patterns) {
        if (grid[combo[0]] && grid[combo[0]] === grid[combo[1]] && grid[combo[0]] === grid[combo[2]]) {
            const winner = grid[combo[0]];
            document.getElementById('status-indicator').innerText = `Player ${winner} Wins! 🎉`;
            scores[winner]++;
            document.getElementById(`score-${winner.toLowerCase()}`).innerText = scores[winner];
            currentTurn = 'NONE';
            playAudioTone(880, 0.25); // Winning chime
            document.getElementById('reset-game-btn').style.display = 'block';
            return;
        }
    }
    
    if (!grid.includes('')) {
        document.getElementById('status-indicator').innerText = "It's a Draw! 🤝";
        scores.draws++;
        document.getElementById('score-draw').innerText = scores.draws;
        currentTurn = 'NONE';
        playAudioTone(300, 0.2); // Draw low note
        document.getElementById('reset-game-btn').style.display = 'block';
    }
}

