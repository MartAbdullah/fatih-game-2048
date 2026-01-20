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
        
        this.init();
    }

    init() {
        this.createBoard();
        this.addRandomTile();
        this.addRandomTile();
        this.updateDisplay();
        this.setupEventListeners();
        this.updateBestScore();
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
    simulateSlideAndMerge(line) {
        const nonZero = line.filter(v => v !== 0);
        let gain = 0;
        for (let i = 0; i < nonZero.length - 1; i++) {
            if (nonZero[i] === nonZero[i + 1]) {
                nonZero[i] *= 2;
                gain += nonZero[i];
                nonZero.splice(i + 1, 1);
            }
        }
        while (nonZero.length < 4) nonZero.push(0);
        return { newLine: nonZero, gain };
    }

    evaluateMove(direction) {
        let moved = false;
        let totalGain = 0;
        if (direction === 'left' || direction === 'right') {
            for (let r = 0; r < 4; r++) {
                let line = this.grid[r].slice();
                if (direction === 'right') line = line.slice().reverse();
                const { newLine, gain } = this.simulateSlideAndMerge(line);
                totalGain += gain;
                const finalLine = direction === 'right' ? newLine.slice().reverse() : newLine;
                if (JSON.stringify(finalLine) !== JSON.stringify(this.grid[r])) moved = true;
            }
        } else {
            for (let c = 0; c < 4; c++) {
                let col = [this.grid[0][c], this.grid[1][c], this.grid[2][c], this.grid[3][c]];
                if (direction === 'down') col = col.slice().reverse();
                const { newLine, gain } = this.simulateSlideAndMerge(col);
                totalGain += gain;
                const finalCol = direction === 'down' ? newLine.slice().reverse() : newLine;
                if (JSON.stringify(finalCol) !== JSON.stringify([this.grid[0][c], this.grid[1][c], this.grid[2][c], this.grid[3][c]])) moved = true;
            }
        }
        return { moved, gain: totalGain };
    }

    findBestMove() {
        const dirs = ['left', 'right', 'up', 'down'];
        let best = { direction: null, gain: -1, moved: false };
        for (const d of dirs) {
            const res = this.evaluateMove(d);
            if (res.moved && res.gain > best.gain) best = { direction: d, gain: res.gain, moved: true };
        }
        if (!best.moved) {
            // pick any legal move
            for (const d of dirs) {
                const res = this.evaluateMove(d);
                if (res.moved) return { direction: d, gain: 0, moved: true };
            }
        }
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
        const best = self.findBestMove ? this.findBestMove() : null;
        if (!best || !best.moved) {
            this.clearHints();
            this.showHintPopup('No moves available');
            return;
        }
        this.highlightMergePairs(best.direction);
        const arrowMap = { left: '←', right: '→', up: '↑', down: '↓' };
        const text = `Hint: ${best.direction.toUpperCase()} ${arrowMap[best.direction]}`;
        this.showHintPopup(text);
        // auto-clear tile hints after a while
        setTimeout(() => this.clearHints(), 1200);
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
                    this.showMessage('You Win! 🎉');
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

        this.showMessage('Game Over!');
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
        this.grid = Array(4).fill(null).map(() => Array(4).fill(0));
        this.score = 0;
        this.previousState = null;
        this.hideMessage();
        this.addRandomTile();
        this.addRandomTile();
        this.updateDisplay();
    }
}

// Start the game when page loads
window.addEventListener('DOMContentLoaded', () => {
    new Game2048();
});
