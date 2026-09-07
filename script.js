// =========================================================
// 🛠️ STEP 1: PASTE YOUR ABLY ROOT API KEY BETWEEN THE QUOTES
// =========================================================
const ABLY_ROOT_KEY = "G38OGQ.uNt5bQ:3qxG6KLwoMWXjLtVdPU_UHIogInp2ScswHaePErQao0";

const urlParams = new URLSearchParams(window.location.search);
const sharedRoomId = urlParams.get('room');
let roomId = '';
let mySymbol = 'X'; 
let currentTurn = 'X'; // Default fallback
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
        
        document.getElementById('sidebar-link-input').value = window.location.href;
        document.getElementById('menu-screen').style.display = 'none';
        document.getElementById('game-screen').style.display = 'flex';
        initAblyConnection();
    }
} else {
    document.getElementById('menu-screen').style.display = 'block';
    document.getElementById('game-screen').style.display = 'none';
}

// Host Button Action (Player X generates the game)
document.getElementById('create-room-btn').addEventListener('click', () => {
    if (ABLY_ROOT_KEY === "PASTE_YOUR_ABLY_ROOT_KEY_HERE") {
        alert("Please paste your Ably key inside script.js first!");
        return;
    }
    roomId = Math.random().toString(36).substring(2, 9);
    const matchUrl = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    
    document.getElementById('sidebar-link-input').value = matchUrl;
    mySymbol = 'X';
    
    // Host generates the random starting turn locally first
    currentTurn = Math.random() < 0.5 ? 'X' : 'O';
    
    initAblyConnection();
    
    document.getElementById('menu-screen').style.display = 'none';
    document.getElementById('game-screen').style.display = 'flex';
});

// Interactive Sidebar Clipboard Copy Logic
document.getElementById('copy-link-btn').addEventListener('click', () => {
    const linkInput = document.getElementById('sidebar-link-input');
    linkInput.select();
    linkInput.setSelectionRange(0, 99999); 
    navigator.clipboard.writeText(linkInput.value);
    
    const toast = document.getElementById('copy-toast');
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 2000);
});

// Initialize Realtime Sync Pipe
function initAblyConnection() {
    ably = new Ably.Realtime(ABLY_ROOT_KEY);
    channel = ably.channels.get(`room-${roomId}`);
    
    // When the connection is officially open, trigger sync mechanics
    ably.connection.on('connected', () => {
        updateStatusText();
        
        // If I am Player O, yell out to the network that I have arrived!
        if (mySymbol === 'O') {
            channel.publish('game-move', { action: 'player-joined' });
        }
    });

    // Network event receiver
    channel.subscribe('game-move', (message) => {
        const data = message.data;
        
        if (data.action === 'player-joined') {
            // Player X hears Player O join, and immediately transmits the true starting turn state
            if (mySymbol === 'X') {
                channel.publish('game-move', { action: 'sync-turn', turn: currentTurn });
            }
        } else if (data.action === 'sync-turn') {
            // Player O catches the true synchronized choice from the host
            currentTurn = data.turn;
            updateStatusText();
        } else if (data.action === 'move') {
            const cell = document.querySelector(`[data-index="${data.index}"]`);
            cell.innerText = data.symbol;
            playAudioTone(550, 0.06); 
            currentTurn = currentTurn === 'X' ? 'O' : 'X';
            updateStatusText();
            checkMatchState();
        } else if (data.action === 'reset') {
            resetBoardLocally(data.nextTurn);
        }
    });
}

// Update status text helpers
function updateStatusText() {
    if (currentTurn === 'NONE') return;
    if (currentTurn === mySymbol) {
        document.getElementById('status-indicator').innerText = `Your Turn (${mySymbol})`;
    } else {
        document.getElementById('status-indicator').innerText = `Waiting for Player ${currentTurn}...`;
    }
}

// Cell grid click listeners
// --- Replace it with this version ---
const cells = document.querySelectorAll('.cell');
cells.forEach((cell, index) => {
    cell.addEventListener('click', () => {
        // SAFETY GATE: If currentTurn is 'NONE', the game is over. Freeze the board!
        if (currentTurn === 'NONE' || currentTurn !== mySymbol || cell.innerText !== '') return;
        
        channel.publish('game-move', { action: 'move', index: index, symbol: mySymbol });
    });
});

// Reset game button listener
document.getElementById('reset-game-btn').addEventListener('click', () => {
    const nextTurn = Math.random() < 0.5 ? 'X' : 'O';
    channel.publish('game-move', { action: 'reset', nextTurn: nextTurn });
});

function resetBoardLocally(nextTurn) {
    cells.forEach(cell => cell.innerText = '');
    currentTurn = nextTurn;
    updateStatusText();
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
    
    // All possible winning combinations
    const patterns = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
        [0, 4, 8], [2, 4, 6]             // Diagonals
    ];
    
    for (let combo of patterns) {
        const [a, b, c] = combo;
        if (grid[a] && grid[a] === grid[b] && grid[a] === grid[c]) {
            const winner = grid[a];
            document.getElementById('status-indicator').innerText = winner === mySymbol ? "You Win! 🎉" : `Player ${winner} Wins! 😔`;
            
            // Increment local state score tallies
            scores[winner]++;
            document.getElementById(`score-${winner.toLowerCase()}`).innerText = scores[winner];
            
            // Lock out further moves immediately
            currentTurn = 'NONE';
            playAudioTone(880, 0.25); // Winning chime
            document.getElementById('reset-game-btn').style.display = 'block';
            return;
        }
    }
    
    // Check for standard Draw states
    if (!grid.includes('')) {
        document.getElementById('status-indicator').innerText = "It's a Draw! 🤝";
        scores.draws++;
        document.getElementById('score-draw').innerText = scores.draws;
        
        currentTurn = 'NONE';
        playAudioTone(300, 0.2); // Draw low note
        document.getElementById('reset-game-btn').style.display = 'block';
    }
}
