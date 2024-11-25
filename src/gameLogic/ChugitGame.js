// src/gameLogic/ChugitGame.js

const GameInterface = require('./GameInterface');

class ChugitGame extends GameInterface {
    constructor(sessionId, players, startingScore) {
        super(sessionId, players);
        this.startingScore = startingScore;
        this.playerData = {};
        this.currentPlayerIndex = 0;
        this.initializeGame();
    }

    initializeGame() {
        this.players.forEach((playerName) => {
            this.playerData[playerName] = {
                name: playerName,
                score: this.startingScore,
                scores: [],
                throwsLeft: 3,
            };
        });
        this.gameStarted = true;
        this.gameOver = false;
        this.winner = null;
    }

    updateScore({ playerName, hit, multiplier }) {
        const player = this.playerData[playerName];

        // Check if it's the player's turn
        const currentPlayerName = this.players[this.currentPlayerIndex];
        if (playerName !== currentPlayerName) {
            throw new Error(`It's not ${playerName}'s turn.`);
        }

        // Subtract the score
        player.score -= hit * multiplier;
        player.scores.push(hit * multiplier);

        // Handle bust (negative score)
        if (player.score < 0) {
            player.score += hit * multiplier; // Reset to previous score
            throw new Error(`${playerName} bust! Score reset to previous.`);
        } else if (player.score === 0) {
            // Player wins
            this.gameOver = true;
            this.winner = playerName;
        }

        // Advance to the next player
        player.throwsLeft--;
        if (player.throwsLeft === 0) {
            player.throwsLeft = 3; // Reset throws for the next turn
            this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
        }
    }

    checkWinCondition(playerName) {
        return this.gameOver && this.winner === playerName;
    }

    getGameState() {
        return {
            sessionId: this.sessionId,
            gameType: 'Chugit',
            players: this.players.map(playerName => {
                const player = this.playerData[playerName];
                return {
                    name: player.name,
                    score: player.score,
                    throwsLeft: player.throwsLeft,
                };
            }),
            currentPlayer: this.players[this.currentPlayerIndex],
            gameStatus: this.gameOver ? 'completed' : 'active',
            winner: this.winner,
        };
    }
}

module.exports = ChugitGame;
