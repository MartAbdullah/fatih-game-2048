class Game2048 {
    constructor() {
        this.grid = Array(4).fill(null).map(() => Array(4).fill(0));
        this.score = 0;
        this.bestScore = parseInt(localStorage.getItem('bestScore')) || 0;
        this.gameBoard = document.getElementById('gameBoard');
        this.scoreElement = document.getElementById('score');
        this.bestElement = document.getElementById('best');
        this.previousState = null;
        
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
                    tile.className = 'tile';
                } else {
                    tile.textContent = value;
                    tile.className = 'tile active';
                    tile.setAttribute('data-value', value);
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
                    this.showMessage('Je hebt gewonnen! 🎉');
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
