// Donkdle Game Logic
class DonkdleGame {
    constructor() {
        this.locations = [];
        this.targetLocation = null;
        this.guesses = [];
        this.maxGuesses = Infinity;
        this.gameOver = false;
        this.gameWon = false;
        
        this.init();
    }

    async init() {
        await this.loadLocations();
        this.loadGameState();
        this.setupEventListeners();
        this.renderBoard();
        
        // Check if game already ended today
        if (this.gameOver) {
            this.showGameOver();
        }
    }

    async loadLocations() {
        try {
            const response = await fetch('locations_data.json');
            this.locations = await response.json();
            
            // Filter out locations with "Unknown" hint region and other edge cases
            this.locations = this.locations.filter(loc => 
                loc.hint_region && 
                loc.hint_region !== "Unknown" &&
                loc.name && 
                loc.name.trim() !== ""
            );
            
            console.log(`Loaded ${this.locations.length} locations`);
            
            // Select today's location
            this.selectDailyLocation();
        } catch (error) {
            console.error('Error loading locations:', error);
            this.showMessage('Error loading game data. Please refresh the page.', 'error');
        }
    }

    selectDailyLocation() {
        // Use today's date as seed for consistent daily puzzle
        const today = new Date();
        const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
        
        // Simple seeded random
        const index = this.seededRandom(seed) % this.locations.length;
        this.targetLocation = this.locations[index];
        
        console.log('Today\'s location selected:', this.targetLocation.name);
    }

    seededRandom(seed) {
        const x = Math.sin(seed++) * 10000;
        return Math.floor((x - Math.floor(x)) * this.locations.length);
    }

    setupEventListeners() {
        const input = document.getElementById('locationInput');
        const guessBtn = document.getElementById('guessBtn');
        const helpBtn = document.getElementById('helpBtn');
        const statsBtn = document.getElementById('statsBtn');
        const closeHelp = document.getElementById('closeHelp');
        const closeStats = document.getElementById('closeStats');
        const shareBtn = document.getElementById('shareBtn');
        const shareResultsBtn = document.getElementById('shareResultsBtn');
        const viewStatsBtn = document.getElementById('viewStatsBtn');

        // Input and autocomplete
        input.addEventListener('input', (e) => this.handleInput(e.target.value));
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.makeGuess();
            } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                this.navigateAutocomplete(e);
            }
        });

        // Guess button
        guessBtn.addEventListener('click', () => this.makeGuess());

        // Modal buttons
        helpBtn.addEventListener('click', () => this.showModal('helpModal'));
        statsBtn.addEventListener('click', () => this.showStatsModal());
        closeHelp.addEventListener('click', () => this.hideModal('helpModal'));
        closeStats.addEventListener('click', () => this.hideModal('statsModal'));
        shareBtn.addEventListener('click', () => this.shareResults());
        shareResultsBtn.addEventListener('click', () => this.shareResults());
        viewStatsBtn.addEventListener('click', () => {
            this.hideModal('gameOverModal');
            this.showStatsModal();
        });

        // Close modals on outside click
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.classList.remove('active');
            }
        });
    }

    handleInput(value) {
        if (this.gameOver) return;

        const autocompleteList = document.getElementById('autocompleteList');
        
        if (!value || value.length < 2) {
            autocompleteList.classList.remove('active');
            return;
        }

        // Filter locations by input
        const filtered = this.locations
            .filter(loc => loc.name.toLowerCase().includes(value.toLowerCase()))
            .slice(0, 10); // Limit to 10 results

        if (filtered.length === 0) {
            autocompleteList.classList.remove('active');
            return;
        }

        // Render autocomplete list
        autocompleteList.innerHTML = filtered
            .map((loc, index) => `
                <div class="autocomplete-item" data-index="${index}" data-name="${loc.name}">
                    ${loc.name}
                    <span style="color: #818384; font-size: 0.85em; margin-left: 10px;">
                        (${loc.hint_region} - ${loc.kong})
                    </span>
                </div>
            `)
            .join('');

        // Add click handlers
        autocompleteList.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('click', () => {
                document.getElementById('locationInput').value = item.dataset.name;
                autocompleteList.classList.remove('active');
            });
        });

        autocompleteList.classList.add('active');
    }

    navigateAutocomplete(e) {
        const list = document.getElementById('autocompleteList');
        if (!list.classList.contains('active')) return;

        const items = list.querySelectorAll('.autocomplete-item');
        if (items.length === 0) return;

        e.preventDefault();
        
        let current = list.querySelector('.selected');
        let index = current ? Array.from(items).indexOf(current) : -1;

        if (current) current.classList.remove('selected');

        if (e.key === 'ArrowDown') {
            index = (index + 1) % items.length;
        } else if (e.key === 'ArrowUp') {
            index = index <= 0 ? items.length - 1 : index - 1;
        }

        items[index].classList.add('selected');
        items[index].scrollIntoView({ block: 'nearest' });
    }

    makeGuess() {
        if (this.gameOver) return;

        const input = document.getElementById('locationInput');
        const locationName = input.value.trim();

        if (!locationName) {
            this.showMessage('Please enter a location name', 'error');
            return;
        }

        // Find the location
        const guessedLocation = this.locations.find(
            loc => loc.name.toLowerCase() === locationName.toLowerCase()
        );

        if (!guessedLocation) {
            this.showMessage('Location not found. Please select from the list.', 'error');
            return;
        }

        // Check if already guessed
        if (this.guesses.some(g => g.location.id === guessedLocation.id)) {
            this.showMessage('You already guessed this location!', 'error');
            return;
        }

        // Add guess
        const feedback = this.evaluateGuess(guessedLocation);
        this.guesses.push({ location: guessedLocation, feedback });

        // Clear input and autocomplete
        input.value = '';
        document.getElementById('autocompleteList').classList.remove('active');

        // Check win condition
        if (guessedLocation.id === this.targetLocation.id) {
            this.gameWon = true;
            this.gameOver = true;
        }

        // Save state and render
        this.saveGameState();
        this.renderBoard();

        if (this.gameOver) {
            setTimeout(() => this.showGameOver(), 500);
        } else {
            this.showMessage(`${this.guesses.length} ${this.guesses.length === 1 ? 'guess' : 'guesses'} made. Keep trying!`, 'info');
        }
    }

    evaluateGuess(guessed) {
        const target = this.targetLocation;
        
        // Region/Level evaluation
        let regionStatus = 'absent';
        if (guessed.hint_region === target.hint_region) {
            regionStatus = 'correct';
        } else if (guessed.level === target.level) {
            regionStatus = 'present';
        }

        // Kong evaluation
        let kongStatus = 'absent';
        if (guessed.kong === target.kong) {
            kongStatus = 'correct';
        } else {
            // Check for partial match (both have "Any" or share a kong)
            // For now, simple check - in full version would handle multi-kong locations
            if (guessed.kong === 'Any' || target.kong === 'Any') {
                kongStatus = 'present';
            }
        }

        // Requirements evaluation
        let requirementStatus = 'absent';
        let requirementArrow = '';
        const diff = Math.abs(guessed.requirement_count - target.requirement_count);
        
        if (guessed.requirement_count === target.requirement_count) {
            requirementStatus = 'correct';
        } else if (diff <= 2) {
            requirementStatus = 'present';
            requirementArrow = guessed.requirement_count < target.requirement_count ? '↑' : '↓';
        }

        // Items evaluation
        const itemCategories = ['needs_pad', 'needs_gun', 'needs_barrel', 'needs_active', 'needs_instrument', 'needs_training'];
        const matchingCategories = itemCategories.filter(cat => guessed[cat] === target[cat]);
        const matchCount = matchingCategories.length;

        let itemStatus = 'absent';
        if (matchCount === 6) {
            itemStatus = 'correct';
        } else if (matchCount > 0) {
            itemStatus = 'present';
        }

        // Individual item feedback for display
        const itemFeedback = itemCategories.map(cat => ({
            name: cat.replace('needs_', '').charAt(0).toUpperCase(),
            status: guessed[cat] === target[cat] ? 'correct' : 'absent'
        }));

        return {
            region: { status: regionStatus, value: guessed.hint_region },
            kong: { status: kongStatus, value: guessed.kong },
            requirement: { 
                status: requirementStatus, 
                value: guessed.requirement_count,
                arrow: requirementArrow
            },
            items: { status: itemStatus, items: itemFeedback }
        };
    }

    renderBoard() {
        const board = document.getElementById('gameBoard');
        board.innerHTML = '';

        // Render existing guesses
        this.guesses.forEach(guess => {
            board.appendChild(this.createGuessRow(guess));
        });

        // Render one empty row if game is not over
        if (!this.gameOver) {
            board.appendChild(this.createEmptyRow());
        }

        // Disable input if game over
        if (this.gameOver) {
            document.getElementById('locationInput').disabled = true;
            document.getElementById('guessBtn').disabled = true;
        }
    }

    createGuessRow(guess) {
        const row = document.createElement('div');
        row.className = 'guess-row';

        // Region cell
        const regionCell = document.createElement('div');
        regionCell.className = `guess-cell ${guess.feedback.region.status}`;
        regionCell.innerHTML = `
            <div class="cell-label">REGION</div>
            <div class="cell-value">${guess.feedback.region.value}</div>
        `;
        row.appendChild(regionCell);

        // Kong cell
        const kongCell = document.createElement('div');
        kongCell.className = `guess-cell ${guess.feedback.kong.status}`;
        kongCell.innerHTML = `
            <div class="cell-label">KONG</div>
            <div class="cell-value">${guess.feedback.kong.value}</div>
        `;
        row.appendChild(kongCell);

        // Requirement cell
        const reqCell = document.createElement('div');
        reqCell.className = `guess-cell ${guess.feedback.requirement.status}`;
        reqCell.innerHTML = `
            <div class="cell-label">REQS</div>
            <div class="cell-value">
                ${guess.feedback.requirement.value}
                ${guess.feedback.requirement.arrow ? `<span class="requirement-arrow">${guess.feedback.requirement.arrow}</span>` : ''}
            </div>
        `;
        row.appendChild(reqCell);

        // Items cell
        const itemsCell = document.createElement('div');
        itemsCell.className = `guess-cell ${guess.feedback.items.status}`;
        itemsCell.innerHTML = `
            <div class="cell-label">ITEMS (P G B A I T)</div>
            <div class="items-grid">
                ${guess.feedback.items.items.map(item => 
                    `<div class="item-indicator ${item.status}">${item.name}</div>`
                ).join('')}
            </div>
        `;
        row.appendChild(itemsCell);

        return row;
    }

    createEmptyRow() {
        const row = document.createElement('div');
        row.className = 'guess-row';

        ['REGION', 'KONG', 'REQS', 'ITEMS (P G B A I T)'].forEach(label => {
            const cell = document.createElement('div');
            cell.className = 'guess-cell empty';
            cell.innerHTML = `<div class="cell-label">${label}</div>`;
            row.appendChild(cell);
        });

        return row;
    }

    showMessage(text, type = 'info') {
        const message = document.getElementById('message');
        message.textContent = text;
        message.className = `message ${type}`;
        
        setTimeout(() => {
            message.textContent = '';
            message.className = 'message';
        }, 3000);
    }

    showModal(modalId) {
        document.getElementById(modalId).classList.add('active');
    }

    hideModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
    }

    showStatsModal() {
        const stats = this.getStats();
        
        document.getElementById('gamesPlayed').textContent = stats.played;
        document.getElementById('winPercentage').textContent = stats.winPercentage;
        document.getElementById('currentStreak').textContent = stats.currentStreak;
        document.getElementById('maxStreak').textContent = stats.maxStreak;

        // Show share section if game is over
        const shareSection = document.getElementById('shareSection');
        if (this.gameOver) {
            shareSection.style.display = 'block';
            document.getElementById('shareText').textContent = this.generateShareText();
        } else {
            shareSection.style.display = 'none';
        }

        this.showModal('statsModal');
    }

    showGameOver() {
        const modal = document.getElementById('gameOverModal');
        const title = document.getElementById('gameOverTitle');
        const message = document.getElementById('gameOverMessage');
        const answerDisplay = document.getElementById('answerDisplay');

        if (this.gameWon) {
            title.textContent = '🎉 Congratulations! 🎉';
            message.textContent = `You found the location in ${this.guesses.length} ${this.guesses.length === 1 ? 'guess' : 'guesses'}!`;
        } else {
            title.textContent = '😢 Game Over';
            message.textContent = 'Better luck tomorrow!';
        }

        // Show the answer
        answerDisplay.innerHTML = `
            <h3>Today's Location:</h3>
            <p><span class="answer-label">Name:</span> ${this.targetLocation.name}</p>
            <p><span class="answer-label">Region:</span> ${this.targetLocation.hint_region}</p>
            <p><span class="answer-label">Level:</span> ${this.targetLocation.level}</p>
            <p><span class="answer-label">Kong:</span> ${this.targetLocation.kong}</p>
            <p><span class="answer-label">Requirements:</span> ${this.targetLocation.requirement_count}</p>
        `;

        this.updateStats();
        this.showModal('gameOverModal');
    }

    generateShareText() {
        const date = new Date().toLocaleDateString();
        const emoji = this.gameWon ? '🎉' : '😢';
        const tries = this.gameWon ? `${this.guesses.length}/∞` : 'X/∞';
        
        let text = `Donkdle ${date} ${emoji}\n${tries}\n\n`;
        
        this.guesses.forEach(guess => {
            const f = guess.feedback;
            text += this.statusToEmoji(f.region.status);
            text += this.statusToEmoji(f.kong.status);
            text += this.statusToEmoji(f.requirement.status);
            text += this.statusToEmoji(f.items.status);
            text += '\n';
        });
        
        return text;
    }

    statusToEmoji(status) {
        const emojiMap = {
            correct: '🟩',
            present: '🟨',
            absent: '⬛'
        };
        return emojiMap[status] || '⬛';
    }

    shareResults() {
        const text = this.generateShareText();
        
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                this.showMessage('Results copied to clipboard!', 'success');
            }).catch(() => {
                this.fallbackCopy(text);
            });
        } else {
            this.fallbackCopy(text);
        }
    }

    fallbackCopy(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        
        try {
            document.execCommand('copy');
            this.showMessage('Results copied to clipboard!', 'success');
        } catch (err) {
            this.showMessage('Failed to copy. Please copy manually.', 'error');
            document.getElementById('shareText').textContent = text;
        }
        
        document.body.removeChild(textarea);
    }

    // Local Storage Methods
    getTodayKey() {
        const today = new Date();
        return `donkdle_${today.getFullYear()}_${today.getMonth() + 1}_${today.getDate()}`;
    }

    saveGameState() {
        const state = {
            guesses: this.guesses,
            gameOver: this.gameOver,
            gameWon: this.gameWon
        };
        localStorage.setItem(this.getTodayKey(), JSON.stringify(state));
    }

    loadGameState() {
        const saved = localStorage.getItem(this.getTodayKey());
        if (saved) {
            const state = JSON.parse(saved);
            this.guesses = state.guesses || [];
            this.gameOver = state.gameOver || false;
            this.gameWon = state.gameWon || false;
        }
    }

    getStats() {
        const stats = JSON.parse(localStorage.getItem('donkdle_stats') || '{}');
        return {
            played: stats.played || 0,
            won: stats.won || 0,
            winPercentage: stats.played ? Math.round((stats.won / stats.played) * 100) : 0,
            currentStreak: stats.currentStreak || 0,
            maxStreak: stats.maxStreak || 0
        };
    }

    updateStats() {
        const stats = JSON.parse(localStorage.getItem('donkdle_stats') || '{}');
        const lastPlayed = stats.lastPlayed || '';
        const today = new Date().toDateString();

        // Initialize if needed
        if (!stats.played) {
            stats.played = 0;
            stats.won = 0;
            stats.currentStreak = 0;
            stats.maxStreak = 0;
        }

        // Only update if not already played today
        if (lastPlayed !== today) {
            stats.played++;
            if (this.gameWon) {
                stats.won++;
                
                // Update streak
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                if (lastPlayed === yesterday.toDateString()) {
                    stats.currentStreak++;
                } else {
                    stats.currentStreak = 1;
                }
                
                stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);
            } else {
                stats.currentStreak = 0;
            }
            
            stats.lastPlayed = today;
            localStorage.setItem('donkdle_stats', JSON.stringify(stats));
        }
    }
}

// Initialize game when page loads
document.addEventListener('DOMContentLoaded', () => {
    new DonkdleGame();
});
