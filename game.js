// Donkdle Game Logic
class DonkdleGame {
    constructor() {
        this.locations = [];
        this.targetLocation = null;
        this.guesses = [];
        this.maxGuesses = Infinity;
        this.gameOver = false;
        this.gameWon = false;
        this.mode = this.getGameMode();
        
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

    getGameMode() {
        const params = new URLSearchParams(window.location.search);
        return params.get('mode') || 'daily';
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
        if (this.mode === 'random') {
            // Random mode: select a random location each time
            const index = Math.floor(Math.random() * this.locations.length);
            this.targetLocation = this.locations[index];
            console.log('Random location selected:', this.targetLocation.name);
        } else {
            // Daily mode: use today's date as seed for consistent daily puzzle
            const today = new Date();
            const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
            
            // Simple seeded random
            const index = this.seededRandom(seed) % this.locations.length;
            this.targetLocation = this.locations[index];
            
            console.log('Today\'s location selected:', this.targetLocation.name);
        }
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

        const searchTerms = value.toLowerCase().split(' ').filter(t => t.length > 0);
        
        // Filter and rank locations with fuzzy matching
        const scored = this.locations
            .map(loc => {
                const nameLower = loc.name.toLowerCase();
                const nameWords = nameLower.split(' ');
                
                let score = 0;
                let matchedTerms = 0;
                
                // Check if all search terms appear somewhere in the name
                for (const term of searchTerms) {
                    let termMatched = false;
                    
                    // Exact word match
                    if (nameWords.includes(term)) {
                        score += 50;
                        termMatched = true;
                    }
                    // Word starts with term
                    else if (nameWords.some(word => word.startsWith(term))) {
                        score += 30;
                        termMatched = true;
                    }
                    // Term appears anywhere in name
                    else if (nameLower.includes(term)) {
                        score += 10;
                        termMatched = true;
                    }
                    
                    if (termMatched) matchedTerms++;
                }
                
                // Must match all search terms
                if (matchedTerms !== searchTerms.length) return null;
                
                // Bonus for name starting with first search term
                if (nameLower.startsWith(searchTerms[0])) score += 100;
                
                // Bonus for shorter names (more specific)
                score += (100 - nameLower.length) / 10;
                
                return { location: loc, score };
            })
            .filter(item => item !== null)
            .sort((a, b) => b.score - a.score)
            .slice(0, 15);

        if (scored.length === 0) {
            autocompleteList.classList.remove('active');
            return;
        }

        // Render autocomplete list
        autocompleteList.innerHTML = scored
            .map(({ location: loc }, index) => {
                const highlightedName = this.highlightMatch(loc.name, value);
                const reqCount = (loc.moves || []).length;
                const movesPreview = (loc.moves || []).slice(0, 5).join(', ') + 
                    ((loc.moves || []).length > 5 ? '...' : '');
                
                return `
                    <div class="autocomplete-item" data-index="${index}" data-name="${loc.name}">
                        <div class="autocomplete-main">
                            <span class="autocomplete-name">${highlightedName}</span>
                        </div>
                        <div class="autocomplete-details">
                            <span class="autocomplete-region">${loc.hint_region}</span>
                            <span class="autocomplete-separator">•</span>
                            <span class="autocomplete-kong">${loc.kong}</span>
                            <span class="autocomplete-separator">•</span>
                            <span class="autocomplete-req">${reqCount} moves</span>
                        </div>
                        ${movesPreview ? `<div class="autocomplete-moves">${movesPreview}</div>` : ''}
                    </div>
                `;
            })
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

    highlightMatch(text, search) {
        const searchTerms = search.toLowerCase().split(' ').filter(t => t.length > 0);
        let result = text;
        
        // Highlight each search term
        for (const term of searchTerms) {
            const regex = new RegExp(`(${term})`, 'gi');
            result = result.replace(regex, '<strong>$1</strong>');
        }
        
        return result;
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
            this.shakeInput();
            return;
        }

        // Find the location
        const guessedLocation = this.locations.find(
            loc => loc.name.toLowerCase() === locationName.toLowerCase()
        );

        if (!guessedLocation) {
            this.showMessage('Location not found. Please select from the list.', 'error');
            this.shakeInput();
            return;
        }

        // Check if already guessed
        if (this.guesses.some(g => g.location.id === guessedLocation.id)) {
            this.showMessage('You already guessed this location!', 'error');
            this.shakeInput();
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

        // Save state and render with animation
        this.saveGameState();
        this.renderBoard(true); // Pass true to animate the new guess

        if (this.gameOver) {
            setTimeout(() => this.showGameOver(), 2500); // Increased delay for animation
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

        // Kong evaluation - handle multiple kongs
        let kongStatus = 'absent';
        const guessedKongs = guessed.kong.split(',').map(k => k.trim());
        const targetKongs = target.kong.split(',').map(k => k.trim());
        
        // Check if kong lists match exactly
        const guessedSet = new Set(guessedKongs);
        const targetSet = new Set(targetKongs);
        
        if (guessedSet.size === targetSet.size && [...guessedSet].every(k => targetSet.has(k))) {
            kongStatus = 'correct';
        } else {
            // Check if at least one kong matches
            const hasOverlap = [...guessedSet].some(k => targetSet.has(k));
            const hasAny = guessedKongs.includes('Any') || targetKongs.includes('Any');
            
            if (hasOverlap || hasAny) {
                kongStatus = 'present';
            }
        }

        // Requirements evaluation
        let requirementStatus = 'absent';
        let requirementArrow = '';
        const guessedReqCount = (guessed.moves || []).length;
        const targetReqCount = (target.moves || []).length;
        
        if (guessedReqCount === targetReqCount) {
            requirementStatus = 'correct';
        } else {
            requirementStatus = 'absent';
            requirementArrow = guessedReqCount < targetReqCount ? '↑' : '↓';
        }

        // Moves evaluation - must match exactly for green, any overlap for yellow
        const guessedMoves = new Set(guessed.moves || []);
        const targetMoves = new Set(target.moves || []);
        
        // Calculate move matches
        const commonMoves = [...guessedMoves].filter(m => targetMoves.has(m));
        const missingMoves = [...targetMoves].filter(m => !guessedMoves.has(m));
        const extraMoves = [...guessedMoves].filter(m => !targetMoves.has(m));
        
        let movesStatus = 'absent';
        // Green only if exact match (same moves, no extras, no missing)
        if (guessedMoves.size === targetMoves.size && 
            commonMoves.length === targetMoves.size && 
            missingMoves.length === 0 && 
            extraMoves.length === 0) {
            movesStatus = 'correct';
        } else if (commonMoves.length > 0) {
            // Yellow if at least one move matches
            movesStatus = 'present';
        }

        // Prepare move feedback for display
        const moveFeedback = {
            common: commonMoves,
            missing: missingMoves,
            extra: extraMoves
        };

        return {
            region: { status: regionStatus, value: guessed.hint_region },
            kong: { status: kongStatus, value: guessed.kong },
            requirement: { 
                status: requirementStatus, 
                value: guessedReqCount,
                arrow: requirementArrow
            },
            moves: { status: movesStatus, feedback: moveFeedback }
        };
    }

    renderBoard(animateNew = false) {
        const board = document.getElementById('gameBoard');
        board.innerHTML = '';

        // Render existing guesses
        this.guesses.forEach((guess, index) => {
            const isNewGuess = animateNew && index === this.guesses.length - 1;
            board.appendChild(this.createGuessRow(guess, isNewGuess));
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

    createGuessRow(guess, animate = false) {
        const wrapper = document.createElement('div');
        wrapper.className = 'guess-row';

        // Location name header
        const nameHeader = document.createElement('div');
        nameHeader.className = 'guess-location-name';
        nameHeader.textContent = guess.location.name;
        wrapper.appendChild(nameHeader);

        // Cells container
        const row = document.createElement('div');
        row.className = 'guess-cells-container';

        // Region cell
        const regionCell = document.createElement('div');
        regionCell.className = `guess-cell ${animate ? '' : guess.feedback.region.status}`;
        regionCell.innerHTML = `
            <div class="cell-label">REGION</div>
            <div class="cell-value">${guess.feedback.region.value}</div>
        `;
        row.appendChild(regionCell);

        // Kong cell
        const kongCell = document.createElement('div');
        kongCell.className = `guess-cell ${animate ? '' : guess.feedback.kong.status}`;
        kongCell.innerHTML = `
            <div class="cell-label">KONG</div>
            <div class="cell-value">${guess.feedback.kong.value}</div>
        `;
        row.appendChild(kongCell);

        // Requirement cell
        const reqCell = document.createElement('div');
        reqCell.className = `guess-cell ${animate ? '' : guess.feedback.requirement.status}`;
        reqCell.innerHTML = `
            <div class="cell-label">REQS</div>
            <div class="cell-value">
                ${guess.feedback.requirement.value}
                ${guess.feedback.requirement.arrow ? `<span class="requirement-arrow">${guess.feedback.requirement.arrow}</span>` : ''}
            </div>
        `;
        row.appendChild(reqCell);

        // Moves cell
        const movesCell = document.createElement('div');
        
        // Safety check for backward compatibility with old saved games
        if (!guess.feedback.moves) {
            guess.feedback.moves = { status: 'absent', feedback: { common: [], missing: [], extra: [] } };
        }
        
        movesCell.className = `guess-cell ${animate ? '' : guess.feedback.moves.status}`;
        
        let movesDisplay = '';
        const f = guess.feedback.moves.feedback;
        
        if (f.common.length === 0 && f.extra.length === 0) {
            movesDisplay = '<div class="moves-none">None</div>';
        } else {
            if (f.common.length > 0) {
                movesDisplay += '<div class="moves-section">';
                f.common.forEach(move => {
                    movesDisplay += `<span class="move-chip move-correct">✓ ${move}</span>`;
                });
                movesDisplay += '</div>';
            }
            if (f.extra.length > 0) {
                movesDisplay += '<div class="moves-section">';
                f.extra.forEach(move => {
                    movesDisplay += `<span class="move-chip move-extra">${move}</span>`;
                });
                movesDisplay += '</div>';
            }
        }
        
        movesCell.innerHTML = `
            <div class="cell-label">MOVES</div>
            <div class="moves-display">${movesDisplay}</div>
        `;
        row.appendChild(movesCell);

        wrapper.appendChild(row);

        // Apply flip animation to cells if this is a new guess
        if (animate) {
            const cells = [regionCell, kongCell, reqCell, movesCell];
            const statuses = [
                guess.feedback.region.status,
                guess.feedback.kong.status,
                guess.feedback.requirement.status,
                guess.feedback.moves.status
            ];

            cells.forEach((cell, index) => {
                setTimeout(() => {
                    cell.classList.add('flip');
                    // Add the status class mid-flip
                    setTimeout(() => {
                        cell.classList.add(statuses[index]);
                    }, 300); // Half of the flip animation duration
                }, index * 150); // Stagger each cell by 150ms
            });
        }

        return wrapper;
    }

    createEmptyRow() {
        const row = document.createElement('div');
        row.className = 'guess-cells-container';

        ['REGION', 'KONG', 'REQS', 'MOVES'].forEach(label => {
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

    shakeInput() {
        const inputSection = document.querySelector('.input-section');
        inputSection.classList.add('shake');
        setTimeout(() => {
            inputSection.classList.remove('shake');
        }, 500);
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
            message.textContent = this.mode === 'random' ? 'Better luck next time!' : 'Better luck tomorrow!';
        }

        // Show the answer
        const movesText = this.targetLocation.moves && this.targetLocation.moves.length > 0
            ? this.targetLocation.moves.join(', ')
            : 'None';
        
        let playAgainButton = '';
        if (this.mode === 'random') {
            playAgainButton = '<button id="playAgainBtn" class="guess-btn" style="margin-top: 20px;">Play Again</button>';
        }
        
        answerDisplay.innerHTML = `
            <h3>${this.mode === 'random' ? 'The Location:' : "Today's Location:"}</h3>
            <p><span class="answer-label">Name:</span> ${this.targetLocation.name}</p>
            <p><span class="answer-label">Region:</span> ${this.targetLocation.hint_region}</p>
            <p><span class="answer-label">Level:</span> ${this.targetLocation.level}</p>
            <p><span class="answer-label">Kong:</span> ${this.targetLocation.kong}</p>
            <p><span class="answer-label">Move Count:</span> ${(this.targetLocation.moves || []).length}</p>
            <p><span class="answer-label">Moves:</span> ${movesText}</p>
            ${playAgainButton}
        `;
        
        // Add play again button handler for random mode
        if (this.mode === 'random') {
            const playAgainBtnElement = document.getElementById('playAgainBtn');
            if (playAgainBtnElement) {
                playAgainBtnElement.addEventListener('click', () => {
                    window.location.reload();
                });
            }
        }

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
            text += this.statusToEmoji(f.moves.status);
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
        if (this.mode === 'random') {
            // Don't save random game state
            return null;
        }
        const today = new Date();
        return `donkdle_${today.getFullYear()}_${today.getMonth() + 1}_${today.getDate()}`;
    }

    saveGameState() {
        const key = this.getTodayKey();
        if (!key) return; // Don't save random games
        
        const state = {
            guesses: this.guesses,
            gameOver: this.gameOver,
            gameWon: this.gameWon
        };
        localStorage.setItem(key, JSON.stringify(state));
    }

    loadGameState() {
        const key = this.getTodayKey();
        if (!key) return; // Don't load for random games
        
        const saved = localStorage.getItem(key);
        if (saved) {
            try {
                const state = JSON.parse(saved);
                // Validate that saved guesses have the current feedback structure
                if (state.guesses && state.guesses.length > 0) {
                    const firstGuess = state.guesses[0];
                    if (!firstGuess.feedback || !firstGuess.feedback.moves) {
                        // Old format - clear saved state
                        console.log('Clearing old game format');
                        localStorage.removeItem(this.getTodayKey());
                        return;
                    }
                }
                this.guesses = state.guesses || [];
                this.gameOver = state.gameOver || false;
                this.gameWon = state.gameWon || false;
            } catch (e) {
                console.error('Error loading game state:', e);
                localStorage.removeItem(this.getTodayKey());
            }
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
