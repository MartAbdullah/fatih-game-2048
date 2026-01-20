class Game2048 {
    constructor() {
        this.grid = Array(4).fill(null).map(() => Array(4).fill(0));
        this.score = 0;
        this.bestScore = parseInt(localStorage.getItem('bestScore')) || 0;
        this.gameBoard = document.getElementById('gameBoard');
        this.scoreElement = document.getElementById('score');
        this.bestElement = document.getElementById('best');
        this.previousState = null;
        this.hintPopup = document.getElementById('hintPopup');
        this.hintTimeout = null;
        this.leaderboard = this.loadLeaderboard();
        this.playerName = this.loadPlayerName();
        
        this.init();
    }

    init() {
        this.ensurePlayerName();
        this.createBoard();
        this.addRandomTile();
        this.addRandomTile();
        this.updateDisplay();
        this.setupEventListeners();
        this.updateBestScore();
        this.renderLeaderboard();
    }

    createBoard() {
        this.gameBoard.innerHTML = '';
        for (let i = 0; i < 16; i++) {
            const tile = document.createElement('div');
            tile.className = 'tile';
            this.gameBoard.appendChild(tile);
        }
    }

    setupEventListeners() {
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
        document.getElementById('newGame').addEventListener('click', () => this.restart());
        document.querySelectorAll('.retry-btn').forEach(btn => {
            btn.addEventListener('click', () => this.restart());
        });
        document.getElementById('undoBtn').addEventListener('click', () => this.undo());
        const exitBtn = document.getElementById('exitBtn');
        if (exitBtn) exitBtn.addEventListener('click', () => this.exitGame());
        const shuffleBtn = document.getElementById('shuffleBtn');
        if (shuffleBtn) shuffleBtn.addEventListener('click', () => this.shuffle());
        const gridBtn = document.getElementById('gridBtn');
        if (gridBtn) gridBtn.addEventListener('click', () => this.showHint());
        
        // Touch support for mobile
        let touchStartX = 0;
        let touchStartY = 0;
        
        this.gameBoard.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        });
        
        this.gameBoard.addEventListener('touchend', (e) => {
            if (!touchStartX || !touchStartY) return;
            
            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;
            
            const diffX = touchStartX - touchEndX;
            const diffY = touchStartY - touchEndY;
            
            if (Math.abs(diffX) > Math.abs(diffY)) {
                if (diffX > 0) {
                    this.move('left');
                } else {
                    this.move('right');
                }
            } else {
                if (diffY > 0) {
                    this.move('up');
                } else {
                    this.move('down');
                }
            }
            
            touchStartX = 0;
            touchStartY = 0;
        });
    }

    shuffle() {
        // Save state for undo
        this.savePreviousState();
        // Collect all non-zero values
        const values = [];
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
                if (this.grid[r][c] !== 0) values.push(this.grid[r][c]);
            }
        }
        // Create list of all positions and shuffle
        const positions = [];
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) positions.push({ r, c });
        }
        for (let i = positions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [positions[i], positions[j]] = [positions[j], positions[i]];
        }
        // Reset grid to zeros
        this.grid = Array(4).fill(null).map(() => Array(4).fill(0));
        // Place values in random positions
        for (let i = 0; i < values.length; i++) {
            const p = positions[i];
            this.grid[p.r][p.c] = values[i];
        }
        // After shuffle, spawn a new tile
        this.addRandomTile();
        this.updateDisplay();
    }

    // --- Hints ---
    computeMove(direction) {
        const clone = this.grid.map(r => r.slice());
        let moved = false;
        let gain = 0;

        const slideMerge = (line) => {
            const arr = line.filter(v => v !== 0);
            for (let i = 0; i < arr.length - 1; i++) {
                if (arr[i] === arr[i + 1]) {
                    arr[i] *= 2;
                    gain += arr[i];
                    arr.splice(i + 1, 1);
                }
            }
            while (arr.length < 4) arr.push(0);
            return arr;
        };

        if (direction === 'left' || direction === 'right') {
            for (let r = 0; r < 4; r++) {
                let line = clone[r].slice();
                if (direction === 'right') line = line.slice().reverse();
                const merged = slideMerge(line);
                const finalLine = direction === 'right' ? merged.slice().reverse() : merged;
                if (JSON.stringify(finalLine) !== JSON.stringify(clone[r])) moved = true;
                clone[r] = finalLine;
            }
        } else {
            for (let c = 0; c < 4; c++) {
                let col = [clone[0][c], clone[1][c], clone[2][c], clone[3][c]];
                if (direction === 'down') col = col.slice().reverse();
                const merged = slideMerge(col);
                const finalCol = direction === 'down' ? merged.slice().reverse() : merged;
                if (JSON.stringify(finalCol) !== JSON.stringify([clone[0][c], clone[1][c], clone[2][c], clone[3][c]])) moved = true;
                for (let r = 0; r < 4; r++) clone[r][c] = finalCol[r];
            }
        }

        return { moved, gain };
    }

    hasAnyMove() {
        // Quick check: empty or adjacent equals
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 4; col++) {
                if (this.grid[row][col] === 0) return true;
                if (col < 3 && this.grid[row][col] === this.grid[row][col + 1]) return true;
                if (row < 3 && this.grid[row][col] === this.grid[row + 1][col]) return true;
            }
        }
        // Fallback: try simulated moves to be safe
        const dirs = ['left', 'right', 'up', 'down'];
        return dirs.some(d => this.computeMove(d).moved);
    }

    findBestMove() {
        const dirs = ['left', 'right', 'up', 'down'];
        let best = { direction: null, gain: -1, moved: false };
        for (const d of dirs) {
            const res = this.computeMove(d);
            if (res.moved && res.gain > best.gain) best = { direction: d, gain: res.gain, moved: true };
        }
        if (!best.moved) {
            for (const d of dirs) {
                const res = this.computeMove(d);
                if (res.moved) return { direction: d, gain: res.gain, moved: true };
            }
        }
        // If still no move found, signal no-move
        return best;
    }

    clearHints() {
        const tiles = this.gameBoard.querySelectorAll('.tile');
        tiles.forEach(t => t.classList.remove('hint'));
    }

    highlightMergePairs(direction) {
        this.clearHints();
        const tiles = this.gameBoard.querySelectorAll('.tile');
        const addHint = (r, c) => {
            const idx = r * 4 + c;
            if (tiles[idx]) tiles[idx].classList.add('hint');
        };
        if (direction === 'left') {
            for (let r = 0; r < 4; r++) {
                for (let c = 0; c < 4; c++) {
                    if (this.grid[r][c] === 0) continue;
                    // find next non-zero to the right
                    for (let k = c + 1; k < 4; k++) {
                        if (this.grid[r][k] === 0) continue;
                        if (this.grid[r][k] === this.grid[r][c]) { addHint(r, c); addHint(r, k); }
                        break;
                    }
                }
            }
        } else if (direction === 'right') {
            for (let r = 0; r < 4; r++) {
                for (let c = 3; c >= 0; c--) {
                    if (this.grid[r][c] === 0) continue;
                    for (let k = c - 1; k >= 0; k--) {
                        if (this.grid[r][k] === 0) continue;
                        if (this.grid[r][k] === this.grid[r][c]) { addHint(r, c); addHint(r, k); }
                        break;
                    }
                }
            }
        } else if (direction === 'up') {
            for (let c = 0; c < 4; c++) {
                for (let r = 0; r < 4; r++) {
                    if (this.grid[r][c] === 0) continue;
                    for (let k = r + 1; k < 4; k++) {
                        if (this.grid[k][c] === 0) continue;
                        if (this.grid[k][c] === this.grid[r][c]) { addHint(r, c); addHint(k, c); }
                        break;
                    }
                }
            }
        } else if (direction === 'down') {
            for (let c = 0; c < 4; c++) {
                for (let r = 3; r >= 0; r--) {
                    if (this.grid[r][c] === 0) continue;
                    for (let k = r - 1; k >= 0; k--) {
                        if (this.grid[k][c] === 0) continue;
                        if (this.grid[k][c] === this.grid[r][c]) { addHint(r, c); addHint(k, c); }
                        break;
                    }
                }
            }
        }
    }

    showHint() {
        const best = this.findBestMove();
        if (!best || !best.moved) {
            this.clearHints();
            if (!this.hasAnyMove()) {
                this.showHintPopup('No moves available');
            } else {
                // Fallback to a legal direction if evaluation failed
                const dirs = ['left', 'right', 'up', 'down'];
                const legal = dirs.find(d => this.computeMove(d).moved);
                const arrowMap = { left: '←', right: '→', up: '↑', down: '↓' };
                const dir = legal || 'left';
                this.showHintPopup(`Try ${dir.toUpperCase()} ${arrowMap[dir] || ''}`);
            }
            return;
        }
        this.highlightMergePairs(best.direction);
        const arrowMap = { left: '←', right: '→', up: '↑', down: '↓' };
        const text = `Hint: ${best.direction.toUpperCase()} ${arrowMap[best.direction]}`;
        this.showHintPopup(text);
        // auto-clear tile hints after a while
        setTimeout(() => this.clearHints(), 2000);
    }

    showHintPopup(text) {
        if (!this.hintPopup) return;
        this.hintPopup.textContent = text;
        this.hintPopup.classList.add('show');
        if (this.hintTimeout) clearTimeout(this.hintTimeout);
        this.hintTimeout = setTimeout(() => {
            this.hintPopup.classList.remove('show');
        }, 1500);
    }

    handleKeyPress(e) {
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.move('up');
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.move('down');
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            this.move('left');
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            this.move('right');
        }
    }

    move(direction) {
        this.savePreviousState();
        let moved = false;

        if (direction === 'left') {
            moved = this.moveLeft();
        } else if (direction === 'right') {
            moved = this.moveRight();
        } else if (direction === 'up') {
            moved = this.moveUp();
        } else if (direction === 'down') {
            moved = this.moveDown();
        }

        if (moved) {
            this.addRandomTile();
            this.updateDisplay();
            this.checkGameOver();
        }
    }

    savePreviousState() {
        this.previousState = {
            grid: this.grid.map(row => [...row]),
            score: this.score
        };
    }

    undo() {
        if (this.previousState) {
            this.grid = this.previousState.grid;
            this.score = this.previousState.score;
            this.previousState = null;
            this.updateDisplay();
        }
    }

    moveLeft() {
        let moved = false;
        for (let row = 0; row < 4; row++) {
            const newRow = this.slideAndMerge(this.grid[row]);
            if (JSON.stringify(newRow) !== JSON.stringify(this.grid[row])) {
                moved = true;
            }
            this.grid[row] = newRow;
        }
        return moved;
    }

    moveRight() {
        let moved = false;
        for (let row = 0; row < 4; row++) {
            const reversed = this.grid[row].slice().reverse();
            const newRow = this.slideAndMerge(reversed).reverse();
            if (JSON.stringify(newRow) !== JSON.stringify(this.grid[row])) {
                moved = true;
            }
            this.grid[row] = newRow;
        }
        return moved;
    }

    moveUp() {
        let moved = false;
        for (let col = 0; col < 4; col++) {
            const column = [this.grid[0][col], this.grid[1][col], this.grid[2][col], this.grid[3][col]];
            const newColumn = this.slideAndMerge(column);
            if (JSON.stringify(newColumn) !== JSON.stringify(column)) {
                moved = true;
            }
            for (let row = 0; row < 4; row++) {
                this.grid[row][col] = newColumn[row];
            }
        }
        return moved;
    }

    moveDown() {
        let moved = false;
        for (let col = 0; col < 4; col++) {
            const column = [this.grid[0][col], this.grid[1][col], this.grid[2][col], this.grid[3][col]];
            const reversed = column.slice().reverse();
            const newColumn = this.slideAndMerge(reversed).reverse();
            if (JSON.stringify(newColumn) !== JSON.stringify(column)) {
                moved = true;
            }
            for (let row = 0; row < 4; row++) {
                this.grid[row][col] = newColumn[row];
            }
        }
        return moved;
    }

    slideAndMerge(line) {
        // Remove zeros
        let newLine = line.filter(val => val !== 0);
        
        // Merge adjacent same values
        for (let i = 0; i < newLine.length - 1; i++) {
            if (newLine[i] === newLine[i + 1]) {
                newLine[i] *= 2;
                this.score += newLine[i];
                newLine.splice(i + 1, 1);
            }
        }
        
        // Fill with zeros
        while (newLine.length < 4) {
            newLine.push(0);
        }
        
        return newLine;
    }

    addRandomTile() {
        const emptyCells = [];
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 4; col++) {
                if (this.grid[row][col] === 0) {
                    emptyCells.push({ row, col });
                }
            }
        }

        if (emptyCells.length > 0) {
            const { row, col } = emptyCells[Math.floor(Math.random() * emptyCells.length)];
            this.grid[row][col] = Math.random() < 0.9 ? 2 : 4;
        }
    }

    updateDisplay() {
        const tiles = this.gameBoard.querySelectorAll('.tile');
        let index = 0;
        
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 4; col++) {
                const value = this.grid[row][col];
                const tile = tiles[index];
                
                if (value === 0) {
                    tile.textContent = '';
                    // Reset classes and attributes to base empty cell
                    tile.className = 'tile';
                    tile.removeAttribute('data-value');
                    // Ensure no inline styles linger
                    tile.style.removeProperty('background');
                    tile.style.removeProperty('color');
                } else {
                    tile.textContent = value;
                    tile.className = 'tile active';
                    tile.setAttribute('data-value', value);
                    // Ensure inline styles are not conflicting
                    tile.style.removeProperty('background');
                    tile.style.removeProperty('color');
                }
                
                index++;
            }
        }

        this.scoreElement.textContent = this.score;
        this.updateBestScore();
    }

    // --- Leaderboard ---
    loadLeaderboard() {
        try {
            const saved = localStorage.getItem('leaderboard');
            if (saved) return JSON.parse(saved);
        } catch (e) {
            console.error('Failed to load leaderboard', e);
        }
        return [];
    }

    saveLeaderboard() {
        try {
            localStorage.setItem('leaderboard', JSON.stringify(this.leaderboard));
        } catch (e) {
            console.error('Failed to save leaderboard', e);
        }
    }

    updateLeaderboard() {
        const name = this.playerName || 'Player';
        this.leaderboard.push({ name, score: this.score });
        this.leaderboard.sort((a, b) => b.score - a.score);
        this.leaderboard = this.leaderboard.slice(0, 3);
        this.saveLeaderboard();
        this.renderLeaderboard();
    }

    // --- Player name ---
    loadPlayerName() {
        try {
            return localStorage.getItem('playerName') || '';
        } catch (e) {
            return '';
        }
    }

    savePlayerName(name) {
        this.playerName = name;
        try {
            localStorage.setItem('playerName', name);
        } catch (e) {
            console.error('Failed to save player name', e);
        }
    }

    ensurePlayerName(force = false) {
        if (!this.playerName || force) {
            this.promptPlayerName();
        }
        this.updateWelcomeMsg();
    }

    promptPlayerName() {
        const input = prompt('Enter your name:', this.playerName || 'Player');
        const name = (input || '').trim();
        if (name) {
            this.savePlayerName(name);
        } else if (!this.playerName) {
            this.savePlayerName('Player');
        }
        this.updateWelcomeMsg();
    }

    updateWelcomeMsg() {
        const welcomeEl = document.getElementById('welcomeMsg');
        if (welcomeEl && this.playerName) {
            welcomeEl.textContent = `Welcome ${this.playerName}`;
        }
    }

    renderLeaderboard() {
        const list = document.getElementById('leaderboardList');
        if (!list) return;
        list.innerHTML = '';
        if (!this.leaderboard.length) {
            const li = document.createElement('li');
            li.textContent = 'No scores yet';
            list.appendChild(li);
            return;
        }
        this.leaderboard.forEach(item => {
            const li = document.createElement('li');
            const nameSpan = document.createElement('span');
            nameSpan.className = 'name';
            nameSpan.textContent = item.name;
            const scoreSpan = document.createElement('span');
            scoreSpan.className = 'score';
            scoreSpan.textContent = item.score;
            li.appendChild(nameSpan);
            li.appendChild(scoreSpan);
            list.appendChild(li);
        });

        // Also update the persistent widget
        const widgetList = document.getElementById('leaderboardWidget');
        if (widgetList) {
            widgetList.innerHTML = '';
            if (!this.leaderboard.length) {
                const li = document.createElement('li');
                li.textContent = 'No scores yet';
                widgetList.appendChild(li);
            } else {
                this.leaderboard.forEach(item => {
                    const li = document.createElement('li');
                    const nameSpan = document.createElement('span');
                    nameSpan.className = 'name';
                    nameSpan.textContent = item.name;
                    const scoreSpan = document.createElement('span');
                    scoreSpan.className = 'score';
                    scoreSpan.textContent = item.score;
                    li.appendChild(nameSpan);
                    li.appendChild(scoreSpan);
                    widgetList.appendChild(li);
                });
            }
        }
    }

    updateBestScore() {
        if (this.score > this.bestScore) {
            this.bestScore = this.score;
            localStorage.setItem('bestScore', this.bestScore);
        }
        this.bestElement.textContent = this.bestScore;
    }

    checkGameOver() {
        // Check for 2048
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 4; col++) {
                if (this.grid[row][col] === 2048) {
                    this.handleGameEnd('win');
                    return;
                }
            }
        }

        // Check if any moves are possible
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 4; col++) {
                if (this.grid[row][col] === 0) return;
                
                if (col < 3 && this.grid[row][col] === this.grid[row][col + 1]) return;
                if (row < 3 && this.grid[row][col] === this.grid[row + 1][col]) return;
            }
        }

        this.handleGameEnd('lose');
    }

    showMessage(text) {
        const messageDiv = document.getElementById('gameMessage');
        messageDiv.querySelector('p').textContent = text;
        messageDiv.classList.add('show');
    }

    hideMessage() {
        const messageDiv = document.getElementById('gameMessage');
        messageDiv.classList.remove('show');
    }

    restart() {
        this.ensurePlayerName(true);
        this.grid = Array(4).fill(null).map(() => Array(4).fill(0));
        this.score = 0;
        this.previousState = null;
        this.hideMessage();
        this.addRandomTile();
        this.addRandomTile();
        this.updateDisplay();
    }

    handleGameEnd(state) {
        const text = state === 'win' ? 'You Win! 🎉' : 'Game Over!';
        this.updateLeaderboard();
        this.showMessage(text);
    }

    exitGame() {
        this.showMessage('See you next time! 👋');
        setTimeout(() => {
            this.hideMessage();
            this.grid = Array(4).fill(null).map(() => Array(4).fill(0));
            this.score = 0;
            this.previousState = null;
            this.addRandomTile();
            this.addRandomTile();
            this.updateDisplay();
        }, 4000);
    }
}

// Start the game when page loads
window.addEventListener('DOMContentLoaded', () => {
    new Game2048();
});
