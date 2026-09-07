// State Variables
let board = Array(9).fill("");
let isGameActive = false;
let gameMode = "ai"; // "ai" or "p2p"
let difficulty = "hard"; // "easy", "medium", "hard"
let currentPlayer = "X";
let scores = { X: 0, O: 0, draws: 0 };

// Audio Synthesis Function (No external assets required)
function playSound(type) {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        const now = ctx.currentTime;

        if (type === 'click') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.exponentialRampToValueAtTime(150, now + 0.1);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
        } else if (type === 'win') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.setValueAtTime(450, now + 0.1);
            osc.frequency.setValueAtTime(600, now + 0.2);
            gain.gain.setValueAtTime(0.4, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
            osc.start(now);
            osc.stop(now + 0.4);
        } else if (type === 'draw') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.linearRampToValueAtTime(100, now + 0.3);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
        }
    } catch (e) {
        console.log("Audio not supported or blocked: ", e);
    }
}

// DOM Elements
const menuScreen = document.getElementById("menu-screen");
const gameScreen = document.getElementById("game-screen");
const boardElement = document.getElementById("board");
const statusElement = document.getElementById("status");
const themeToggle = document.getElementById("theme-toggle");

// UI Config Selection Toggles
document.getElementById("mode-ai").addEventListener("click", () => {
    gameMode = "ai";
    document.getElementById("mode-ai").classList.add("active");
    document.getElementById("mode-p2p").classList.remove("active");
    document.getElementById("difficulty-group").classList.remove("hidden");
});

document.getElementById("mode-p2p").addEventListener("click", () => {
    gameMode = "p2p";
    document.getElementById("mode-p2p").classList.add("active");
    document.getElementById("mode-ai").classList.remove("active");
    document.getElementById("difficulty-group").classList.add("hidden");
});

["easy", "medium", "hard"].forEach(diff => {
    document.getElementById(`diff-${diff}`).addEventListener("click", () => {
        difficulty = diff;
        ["easy", "medium", "hard"].forEach(d => {
            document.getElementById(`diff-${d}`).classList.toggle("active", d === diff);
        });
    });
});

// Theme Management
themeToggle.addEventListener("click", () => {
    const currentTheme = document.documentElement.getAttribute("data-theme");
    if (currentTheme === "dark") {
        document.documentElement.removeAttribute("data-theme");
        themeToggle.textContent = "🌙 Dark Mode";
    } else {
        document.documentElement.setAttribute("data-theme", "dark");
        themeToggle.textContent = "☀️ Light Mode";
    }
});

// Navigation & Actions
document.getElementById("start-btn").addEventListener("click", () => {
    menuScreen.classList.add("hidden");
    gameScreen.classList.remove("hidden");
    resetScores();
    initGame();
});

document.getElementById("back-btn").addEventListener("click", () => {
    gameScreen.classList.add("hidden");
    menuScreen.classList.remove("hidden");
    isGameActive = false;
});

document.getElementById("reset-btn").addEventListener("click", () => {
    initGame();
});

// Game Core Logic
function initGame() {
    board = Array(9).fill("");
    currentPlayer = "X";
    isGameActive = true;
    
    // Update Score Labels
    document.getElementById("label-p1").textContent = "Player X";
    if (gameMode === "ai") {
        const capitalize = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
        document.getElementById("label-p2").textContent = `AI (${capitalize})`;
    } else {
        document.getElementById("label-p2").textContent = "Player O";
    }

    statusElement.textContent = "Player X's Turn";
    
    // Clear Board UI
    document.querySelectorAll(".cell").forEach(cell => {
        cell.textContent = "";
        cell.className = "cell";
    });
}

function resetScores() {
    scores = { X: 0, O: 0, draws: 0 };
    updateScoreboardUI();
}

function updateScoreboardUI() {
    document.getElementById("score-p1").textContent = scores.X;
    document.getElementById("score-p2").textContent = scores.O;
    document.getElementById("score-draws").textContent = scores.draws;
}

boardElement.addEventListener("click", (e) => {
    const cell = e.target;
    if (!cell.classList.contains("cell") || !isGameActive) return;
    
    const index = parseInt(cell.getAttribute("data-index"));
    if (board[index] !== "") return;

    if (gameMode === "ai" && currentPlayer === "O") return; // Block clicking on AI turn

    handleMove(index);
});

function handleMove(index) {
    board[index] = currentPlayer;
    const cell = document.querySelector(`[data-index="${index}"]`);
    cell.textContent = currentPlayer;
    cell.classList.add(currentPlayer);
    playSound('click');

    if (checkWin(board, currentPlayer)) {
        statusElement.textContent = `${currentPlayer === 'X' ? 'Player X' : (gameMode === 'ai' ? 'AI' : 'Player O')} Wins!`;
        scores[currentPlayer]++;
        updateScoreboardUI();
        isGameActive = false;
        playSound('win');
        return;
    }

    if (board.every(cell => cell !== "")) {
        statusElement.textContent = "It's a Draw!";
        scores.draws++;
        updateScoreboardUI();
        isGameActive = false;
        playSound('draw');
        return;
    }

    // Switch turns
    currentPlayer = currentPlayer === "X" ? "O" : "X";
    statusElement.textContent = gameMode === "ai" && currentPlayer === "O" ? "AI Thinking..." : `Player ${currentPlayer}'s Turn`;

    if (gameMode === "ai" && currentPlayer === "O" && isGameActive) {
        setTimeout(makeAIMove, 400); // Small artificial delay
    }
}

// AI Engine
function makeAIMove() {
    let availableMoves = [];
    board.forEach((val, idx) => { if (val === "") availableMoves.push(idx); });

    let move;
    if (difficulty === "easy") {
        move = availableMoves[Math.floor(Math.random() * availableMoves.length)];
    } else if (difficulty === "medium") {
        if (Math.random() < 0.5) {
            move = getBestMove();
        } else {
            move = availableMoves[Math.floor(Math.random() * availableMoves.length)];
        }
    } else {
        move = getBestMove();
    }

    if (move !== undefined) {
        handleMove(move);
    }
}

function checkWin(b, player) {
    const wins = [
        [0,1,2], [3,4,5], [6,7,8], // Horizontal
        [0,3,6], [1,4,7], [2,5,8], // Vertical
        [0,4,8], [2,4,6]           // Diagonal
    ];
    return wins.some(cond => cond.every(idx => b[idx] === player));
}

function getBestMove() {
    let bestScore = -Infinity;
    let move;
    for (let i = 0; i < 9; i++) {
        if (board[i] === "") {
            board[i] = "O";
            let score = minimax(board, 0, false);
            board[i] = "";
            if (score > bestScore) {
                bestScore = score;
                move = i;
            }
        }
    }
    return move;
}

function minimax(b, depth, isMaximizing) {
    if (checkWin(b, "O")) return 10 - depth;
    if (checkWin(b, "X")) return depth - 10;
    if (b.every(cell => cell !== "")) return 0;

    if (isMaximizing) {
        let bestScore = -Infinity;
        for (let i = 0; i < 9; i++) {
            if (b[i] === "") {
                b[i] = "O";
                let score = minimax(b, depth + 1, false);
                b[i] = "";
                bestScore = Math.max(score, bestScore);
            }
        }
        return bestScore;
    } else {
        let bestScore = Infinity;
        for (let i = 0; i < 9; i++) {
            if (b[i] === "") {
                b[i] = "X";
                let score = minimax(b, depth + 1, true);
                b[i] = "";
                bestScore = Math.min(score, bestScore);
            }
        }
        return bestScore;
    }
}
