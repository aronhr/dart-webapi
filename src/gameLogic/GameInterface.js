// src/gameLogic/GameInterface.js

class GameInterface {
    constructor(sessionId, players, gameType) {
        if (new.target === GameInterface) {
            throw new TypeError('Cannot construct GameInterface instances directly');
        }
        this.sessionId = sessionId;
        this.players = players;
        this.gameType = gameType;
        this.gameStarted = false;
        this.currentPlayerIndex = 0;
        this.throwsLeft = 3;
    }

    initializeGame() {
        throw new Error('initializeGame() must be implemented');
    }

    updateScore(data) {
        throw new Error('updateScore() must be implemented');
    }

    checkWinCondition(playerName) {
        throw new Error('checkWinCondition() must be implemented');
    }

    getGameState() {
        throw new Error('getGameState() must be implemented');
    }
}

module.exports = GameInterface;
