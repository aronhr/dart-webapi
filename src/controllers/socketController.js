// src/controllers/socketController.js

const gameService = require('../services/gameService');

module.exports = (io) => {
    io.on('connection', (socket) => {
        console.log('New client connected:', socket.id);

        // Handle client role assignment
        socket.on('joinSession', ({ sessionId, role }) => {
            socket.join(sessionId);
            socket.sessionId = sessionId;
            socket.role = role; // 'controller' or 'display'
            console.log(`Client ${socket.id} joined session ${sessionId} as ${role}`);
            if (role === 'display') {
                // create session if it doesn't exist
                gameService.createSession(sessionId);
            }
            if (role === 'controller') {
                io.in(sessionId).emit('controllerJoined', true);
            }
            // send game state to the display
            io.in(sessionId).emit('gameState', gameService.getGameSession(sessionId));
        });

        socket.on('playerJoined', ({ sessionId, player }) => {
            if (socket.role !== 'controller') return;
            gameService.addPlayerToSession(sessionId, player);
            io.in(socket.sessionId).emit('gameState', gameService.getGameSession(sessionId));
            console.log(`Player ${player.name} added to session ${sessionId}`);
        });

        socket.on('gameSelected', ({ sessionId, gameType }) => {
            if (socket.role !== 'controller') return;

            console.log('gameSelected', gameType);

            try {
                gameService.addSelectedGameToSession(sessionId, gameType);
                io.in(sessionId).emit('gameState', gameService.getGameSession(sessionId));
            } catch (error) {
                console.error(error);
                socket.emit('error', { message: error.message });
            }
        });

        // Handle game setup from the controller
        socket.on('startGame', ({ sessionId }) => {
            if (socket.role !== 'controller') return;
            try {
                gameService.createGameSession(sessionId);
                io.in(sessionId).emit('gameState', gameService.getGameSession(sessionId));
            } catch (error) {
                console.error(error);
                socket.emit('error', { message: error.message });
            }
        });

        // Handle score updates from the controller
        socket.on('scoreUpdate', (data) => {
            if (socket.role !== 'controller') return;

            gameService.updateGameSession({ sessionId: socket.sessionId, ...data })
                .then((gameState) => {
                    // Send the updated game state
                    io.in(socket.sessionId).emit('gameState', gameService.getGameSession(socket.sessionId));
                    console.log(gameState)
                    // Emit specific events based on gameState events
                    /*gameState.gameState.events.forEach((event) => {
                        if (event.includes('bust')) {
                            io.in(socket.sessionId).emit('playerBusted', { message: event });
                        } else if (event.includes('wins')) {
                            io.in(socket.sessionId).emit('playerWon', { winner: gameState.winner });
                        } else if (event.includes('turn')) {
                            io.in(socket.sessionId).emit('turnAdvanced', {
                                currentPlayer: gameState.players[gameState.playerOrder[gameState.currentPlayerIndex]],
                            });
                        } else {
                            // General event
                            io.in(socket.sessionId).emit('gameEvent', { message: event });
                        }
                    });*/
                })
                .catch((error) => {
                    console.error(error);
                    socket.emit('error', { message: error.message });
                });
        });

        socket.on('undo', ({ sessionId }) => {
            if (socket.role !== 'controller') return;

            gameService.undoLastThrow(sessionId);
            io.in(sessionId).emit('gameState', gameService.getGameSession(sessionId));
        });

        // Handle leave game
        socket.on('leaveGame', ({ sessionId }) => {
            if (socket.role !== 'controller') return;

            // Reset the game session
            gameService.resetGameSession(sessionId);

            // Notify display to reset
            io.in(sessionId).emit('gameState', gameService.getGameSession(sessionId));

            // Controller remains connected to the session
        });

        // Handle disconnection
        socket.on('disconnect', () => {
            console.log(`Client disconnected: ${socket.id}`);
            if (socket.role === 'controller' && socket.sessionId) {
                // Controller disconnected unexpectedly
                gameService.resetGameSession(socket.sessionId);
                io.in(socket.sessionId).emit('gameState', gameService.getGameSession(socket.sessionId));
                io.in(socket.sessionId).emit('controllerJoined', false);
            }
        });
    });
};
