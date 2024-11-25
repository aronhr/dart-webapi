// src/gameLogic/AroundTheClockGame.js

const GameInterface = require('./GameInterface');

class AroundTheClockGame extends GameInterface {
    constructor(sessionId, players) {
        super(sessionId, players);
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
                currentNumber: 1, // Starting number
                scores: [],
            };
        });
        this.gameStarted = true;
    }

    updateScore({ playerName, hitNumber }) {
        const player = this.playerData[playerName];

        // Check if it's the player's turn
        const currentPlayerName = this.players[this.currentPlayerIndex];
        if (playerName !== currentPlayerName) {
            throw new Error(`It's not ${playerName}'s turn.`);
        }

        // Check if hitNumber matches the current target number
        if (hitNumber === player.currentNumber) {
            player.currentNumber += 1; // Advance to the next number
            player.scores.push(hitNumber);

            // Check for win condition
            if (player.currentNumber > 20) {
                this.gameOver = true;
                this.winner = playerName;
                return; // Game ends; no need to advance turn
            }
        }

        // Advance to the next player
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    }

    checkWinCondition(playerName) {
        return this.gameOver && this.winner === playerName;
    }

    getGameState() {
        return {
            sessionId: this.sessionId,
            gameType: 'Around the Clock',
            players: this.players.map(playerName => {
                const player = this.playerData[playerName];
                return {
                    name: player.name,
                    currentNumber: player.currentNumber,
                    scores: player.scores,
                };
            }),
            currentPlayer: this.players[this.currentPlayerIndex],
            gameStatus: this.gameOver ? 'completed' : 'active',
            winner: this.winner,
        };
    }
}

module.exports = AroundTheClockGame;
