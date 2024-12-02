// src/services/gameService.js

const GameFactory = require('../gameLogic/GameFactory');

const games = {}; // In-memory store for game sessions

const createSession = (sessionId) => {
    if (!games[sessionId]) {
        games[sessionId] = {
            players: [],
            gameType: null,
            game: null,
            gameState: null
        };
    }
}

const addPlayerToSession = (sessionId, player) => {
    const session = games[sessionId];
    if (session) {
        session.players.push(player);
    }
}

const getPlayersInSession = (sessionId) => {
    const session = games[sessionId];
    return session ? session.players : [];
}

const createGameSession = (sessionId) => {
    const session = games[sessionId];
    if (!session) {
        console.error('Session not found');
    }
    console.log('Creating game session:', sessionId, session.gameType, session.players);
    const game = GameFactory.createGame(sessionId, session.gameType, session.players);
    games[sessionId].game = game;
    games[sessionId].gameState = game.getGameState();
    console.log(games[sessionId]);
    return games[sessionId];
};

const addSelectedGameToSession = (sessionId, gameType) => {
    const session = games[sessionId];
    if (session) {
        session.gameType = gameType;
    }
}

const getGameSession = (sessionId) => {
    const game = games[sessionId];
    if (game?.game) {
        game.gameState = game.game.getGameState();
    }
    return game;
}

const updateGameSession = ({ sessionId, ...data }) => {
    const session = games[sessionId];
    if (!session.game) {
        console.error('Game session not found.');
        return Promise.reject('Game session not found.');
    }

    return new Promise((resolve, reject) => {
        try {
            console.log(session.game);
            session.game.updateScore({ ...data });
            session.gameState = session.game.getGameState();

            if (session.game.gameOver) {
                resolve(session);
            } else {
                resolve(session);
            }
        } catch (error) {
            reject(error.message);
        }
    });
};

const undoLastThrow = (sessionId) => {
    const game = games[sessionId].game;
    if (game) {
        game.undoLastThrow();
    }
};

const resetGameSession = (sessionId) => {
    const game = games[sessionId].game;
    if (game) {
        delete games[sessionId].game;
    }
};

module.exports = {
    createSession,
    addPlayerToSession,
    getPlayersInSession,
    addSelectedGameToSession,
    createGameSession,
    getGameSession,
    updateGameSession,
    undoLastThrow,
    resetGameSession,
};
