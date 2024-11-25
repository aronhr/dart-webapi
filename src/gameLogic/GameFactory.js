// src/gameLogic/GameFactory.js

const StandardGame = require('./StandardGame');
const ChugitGame = require('./ChugitGame');
const CricketGame = require('./CricketGame');
const AroundTheClockGame = require('./AroundTheClockGame');

class GameFactory {
    static createGame(sessionId, gameType, players) {
        switch (gameType) {
            case '301':
            case '501':
                return new StandardGame(sessionId, players, parseInt(gameType));
            case 'Chugit':
                return new ChugitGame(sessionId, players, 183);
            case 'Cricket':
                return new CricketGame(sessionId, players);
            case 'Around the Clock':
                return new AroundTheClockGame(sessionId, players);
            // Add cases for new games here
            default:
                console.error('Invalid game type:', gameType);
                throw new Error('Invalid game type');
        }
    }
}

module.exports = GameFactory;
