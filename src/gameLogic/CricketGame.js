// src/gameLogic/CricketGame.js

const GameInterface = require('./GameInterface');

class CricketGame extends GameInterface {
    constructor(sessionId) {
        super(sessionId);
        this.playerData = {};
        this.currentPlayerIndex = 0;
        this.gameOver = false;
        this.winner = null;
        this.initializeGame();
    }

    initializeGame() {
        this.players.forEach((playerName) => {
            this.playerData[playerName] = {
                name: playerName,
                score: 0,
                hits: {
                    '15': 0,
                    '16': 0,
                    '17': 0,
                    '18': 0,
                    '19': 0,
                    '20': 0,
                    Bull: 0,
                },
                throwsLeft: 3,
            };
        });
        this.gameStarted = true;
    }

    updateScore({ playerName, hits }) {
        const player = this.playerData[playerName];

        // Check if it's the player's turn
        const currentPlayerName = this.players[this.currentPlayerIndex];
        if (playerName !== currentPlayerName) {
            throw new Error(`It's not ${playerName}'s turn.`);
        }

        // Process hits
        const numbers = ['15', '16', '17', '18', '19', '20', 'Bull'];
        numbers.forEach((number) => {
            if (hits[number]) {
                let hitCount = hits[number];
                let totalHits = player.hits[number] + hitCount;

                // Calculate overflow (extra hits beyond closing)
                let overflow = totalHits > 3 ? totalHits - 3 : 0;
                player.hits[number] = Math.min(totalHits, 3);

                if (overflow > 0) {
                    // Check if opponents have closed the number
                    const opponentsClosed = this.players.every((opponentName) => {
                        if (opponentName === playerName) return true;
                        return this.playerData[opponentName].hits[number] >= 3;
                    });

                    if (!opponentsClosed) {
                        const pointValue = number === 'Bull' ? 25 : parseInt(number);
                        player.score += pointValue * overflow;
                    }
                }
            }
        });

        // Check for win condition
        if (this.checkWinCondition(playerName)) {
            this.gameOver = true;
            this.winner = playerName;
        } else {
            // Advance to the next player
            player.throwsLeft--;
            if (player.throwsLeft === 0) {
                player.throwsLeft = 3; // Reset throws for the next turn
                this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
            }
        }
    }

    checkWinCondition(playerName) {
        const player = this.playerData[playerName];
        const allNumbersClosed = Object.values(player.hits).every((hits) => hits >= 3);

        if (!allNumbersClosed) {
            return false;
        }

        // Check if player has equal or higher score than opponents
        const opponents = this.players.filter((name) => name !== playerName);
        const playerScore = player.score;
        const opponentsScoreClosed = opponents.every((opponentName) => {
            const opponent = this.playerData[opponentName];
            const opponentNumbersClosed = Object.values(opponent.hits).every((hits) => hits >= 3);
            return opponentNumbersClosed && opponent.score <= playerScore;
        });

        return opponentsScoreClosed;
    }

    getGameState() {
        return {
            sessionId: this.sessionId,
            gameType: 'Cricket',
            players: this.players.map(playerName => {
                const player = this.playerData[playerName];
                return {
                    name: player.name,
                    score: player.score,
                    hits: player.hits,
                    throwsLeft: player.throwsLeft,
                };
            }),
            currentPlayer: this.players[this.currentPlayerIndex],
            gameStatus: this.gameOver ? 'completed' : 'active',
            winner: this.winner,
        };
    }
}

module.exports = CricketGame;
