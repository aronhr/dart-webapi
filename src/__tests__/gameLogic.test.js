
const StandardGame = require('../gameLogic/StandardGame');
const CricketGame = require('../gameLogic/CricketGame');
const AroundTheClockGame = require('../gameLogic/AroundTheClockGame');
const ChugitGame = require('../gameLogic/ChugitGame');

describe('Game Logic Tests', () => {
    test('StandardGame initializes correctly', () => {
        const game = new StandardGame('session1', ['Player1', 'Player2'], 301);
        const gameState = game.getGameState();
        expect(gameState.gameType).toBe('301');
        expect(gameState.players.length).toBe(2);
        expect(gameState.currentPlayer).toBe('Player1');
    });

    test('CricketGame initializes correctly', () => {
        const game = new CricketGame('session2', ['PlayerA', 'PlayerB']);
        const gameState = game.getGameState();
        expect(gameState.gameType).toBe('Cricket');
        expect(gameState.players.length).toBe(2);
        expect(gameState.currentPlayer).toBe('PlayerA');
    });

    test('AroundTheClockGame initializes correctly', () => {
        const game = new AroundTheClockGame('session3', ['PlayerX', 'PlayerY']);
        const gameState = game.getGameState();
        expect(gameState.gameType).toBe('Around the Clock');
        expect(gameState.players.length).toBe(2);
        expect(gameState.currentPlayer).toBe('PlayerX');
    });

    test('ChugitGame initializes correctly', () => {
        const game = new ChugitGame('session4', ['PlayerOne', 'PlayerTwo'], 183);
        const gameState = game.getGameState();
        expect(gameState.gameType).toBe('Chugit');
        expect(gameState.players.length).toBe(2);
        expect(gameState.currentPlayer).toBe('PlayerOne');
    });
});
