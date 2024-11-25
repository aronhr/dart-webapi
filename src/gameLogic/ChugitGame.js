// src/gameLogic/StandardGame.js

const GameInterface = require('./GameInterface');

class StandardGame extends GameInterface {
    constructor(sessionId, players, startingScore) {
        super(sessionId);
        this.startingScore = startingScore;
        this.players = players;
        this.playerData = {};
        this.currentPlayerIndex = 0;
        this.availableScores = [25, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
        this.initializeGame();
    }

    initializeGame() {
        console.log('players:', this.players);
        this.players.forEach((player) => {
            this.playerData[player.name] = {
                name: player.name,
                score: this.startingScore,
                scores: [],
                throwsLeft: 3,
                currentTurnScore: 0,
            };
        });
        this.gameStarted = true;
        this.gameOver = false;
        this.winner = null;
        this.events = [];
    }

    updateScore({ dart }) {
        console.log('dart:', dart);
        if (this.gameOver) {
            console.error(`Game is over. ${this.winner} has won.`);
            throw new Error(`Game is over. ${this.winner} has won.`);
        }

        const currentPlayer = this.players[this.currentPlayerIndex];
        console.log('currentPlayer:', currentPlayer);
        const player = this.playerData[currentPlayer.name];

        if (player.throwsLeft === 3) {
            player.startingScoreAtTurn = player.score;
            player.currentTurnScore = 0;
        }

        const { value, multiplier } = dart;
        const dartScore = value * multiplier;

        if (!this.isValidDart(value, multiplier)) {
            console.error(`Invalid dart throw: value ${value}, multiplier ${multiplier}.`);
            throw new Error(`Invalid dart throw: value ${value}, multiplier ${multiplier}.`);
        }

        player.currentTurnScore += dartScore;
        player.score -= dartScore;
        player.scores.push({ value, multiplier });

        if (player.score <= 0) {
            this.gameOver = true;
            this.winner = currentPlayer.name;
            this.events.push(`${currentPlayer.name} wins the game!`);
        } else {
            this.events.push(`${currentPlayer.name} hit ${multiplier} x ${value} (${dartScore}). Remaining score: ${player.score}`);
        }

        player.throwsLeft--;

        if (player.throwsLeft === 0 || this.gameOver) {
            player.throwsLeft = 3;
            player.currentTurnScore = 0;

            if (!this.gameOver) {
                this.advanceToNextPlayer();
                this.events.push(`It's now ${this.players[this.currentPlayerIndex].name}'s turn.`);
            }
        }
    }

    isValidDart(value, multiplier) {
        const validValues = [...Array(20).keys()].map(n => n + 1).concat([25]);
        const validMultipliers = [1, 2, 3];
        return validValues.includes(value) && validMultipliers.includes(multiplier);
    }

    advanceToNextPlayer() {
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    }

    checkWinCondition(playerName) {
        return this.gameOver && this.winner === playerName;
    }

    getGameState() {
        console.log('gamestate.players:', this.players);
        return {
            sessionId: this.sessionId,
            gameType: `${this.startingScore}`,
            players: this.players.map(playerObj => {
                const player = this.playerData[playerObj.name];
                return {
                    name: player.name,
                    score: player.score,
                    throwsLeft: player.throwsLeft,
                };
            }),
            availableScores: this.availableScores,
            currentPlayer: this.players[this.currentPlayerIndex],
            gameStatus: this.gameOver ? 'completed' : 'active',
            winner: this.winner,
        };
    }
}

module.exports = StandardGame;
