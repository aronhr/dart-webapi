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
                winningScore: [],
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

        let bust = false;
        if (player.score < 0 || player.score === 1) {
            player.score = player.startingScoreAtTurn;
            player.currentTurnScore = 0;
            bust = true;
            this.events.push(`${currentPlayer.name} bust! Score reset to ${player.score}.`);
        } else if (player.score === 0) {
            if (multiplier === 2) {
                this.gameOver = true;
                this.winner = currentPlayer.name;
                this.events.push(`${currentPlayer.name} wins the game!`);
            } else {
                player.score = player.startingScoreAtTurn;
                player.currentTurnScore = 0;
                bust = true;
                this.events.push(`${currentPlayer.name} bust! Must finish with a double.`);
            }
        } else {
            this.events.push(`${currentPlayer.name} hit ${multiplier} x ${value} (${dartScore}). Remaining score: ${player.score}`);
        }

        player.throwsLeft--;

        player.winningScore = this.calculateThrowsToWin(player.score, player.throwsLeft === 0 ? 3 : player.throwsLeft);

        if (bust || player.throwsLeft <= 0 || this.gameOver) {
            player.throwsLeft = 3;
            player.currentTurnScore = 0;

            if (!this.gameOver) {
                this.advanceToNextPlayer();
                this.events.push(`It's now ${this.players[this.currentPlayerIndex].name}'s turn.`);
            }
        }
    }

    undoLastThrow() {
        if (this.gameOver) {
            console.error('Game is over. Cannot undo last throw.');
            throw new Error('Game is over. Cannot undo last throw.');
        }

        let currentPlayer = this.players[this.currentPlayerIndex];
        let player = this.playerData[currentPlayer.name];
        // If the current player has no throws, go back to the previous player
        if (this.playerData[currentPlayer.name].scores.length === 0 || player.throwsLeft === 3) {
            currentPlayer = this.players[(this.currentPlayerIndex - 1 + this.players.length) % this.players.length];
            player = this.playerData[currentPlayer.name];

            player.throwsLeft = 0;
            // sum last 3 throws
            player.currentTurnScore = player.scores.slice(-3).reduce((acc, curr) => acc + curr.value * curr.multiplier, 0);
            this.currentPlayerIndex = (this.currentPlayerIndex - 1 + this.players.length) % this.players.length;
        }

        console.log('currentPlayer:', currentPlayer);



        if (player.scores.length === 0) {
            console.error('No throws to undo.');
            // throw new Error('No throws to undo.');
            return;
        }

        const lastThrow = player.scores.pop();
        const dartScore = lastThrow.value * lastThrow.multiplier;
        player.score += dartScore;
        player.currentTurnScore -= dartScore;
        player.throwsLeft++;

        if (player.throwsLeft === 3) {
            player.currentTurnScore = 0;
        }
        player.winningScore = this.calculateThrowsToWin(player.score, player.throwsLeft);

        this.events.push(`Last throw by ${currentPlayer.name} (${lastThrow.multiplier} x ${lastThrow.value}) has been undone.`);
    }

    isValidDart(value, multiplier) {
        const validValues = [...Array(20).keys()].map(n => n + 1).concat([25, 0]);
        const validMultipliers = [1, 2, 3];
        return validValues.includes(value) && validMultipliers.includes(multiplier);
    }

    advanceToNextPlayer() {
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    }

    calculateThrowsToWin(remainingScore, throwsLeft = 3) {
        if (remainingScore < 2 || remainingScore > 170 || throwsLeft < 1) {
            return [];
        }

        const throwOptions = [];

        // Generate all possible throws (singles, doubles, triples)
        for (let i = 1; i <= 20; i++) {
            throwOptions.push({ score: i * 3, name: `T${i}` });  // Triple
            throwOptions.push({ score: i * 2, name: `D${i}` });  // Double
            throwOptions.push({ score: i, name: `${i}` });       // Single
        }

        // Add Bull options
        throwOptions.push({ score: 50, name: 'D25' });  // Double Bull (Bullseye)
        throwOptions.push({ score: 25, name: '25' });   // Single Bull (Outer Bull)

        // Possible finishing doubles
        const finishingDoubles = [];
        for (let i = 1; i <= 20; i++) {
            finishingDoubles.push({ score: i * 2, name: `D${i}` });
        }
        finishingDoubles.push({ score: 50, name: 'D25' });  // Bullseye (Double 25)

        // Build possible sums of throws up to (throwsLeft - 1) throws
        const possibleSums = new Map();

        function generateSums(currentSum = 0, currentSequence = [], depth = 0) {
            if (depth >= throwsLeft - 1) {
                return;
            }
            for (const throwOption of throwOptions) {
                const newSum = currentSum + throwOption.score;
                const newSequence = currentSequence.concat(throwOption.name);

                // Store all sequences for each sum
                if (!possibleSums.has(newSum)) {
                    possibleSums.set(newSum, []);
                }
                possibleSums.get(newSum).push(newSequence);

                generateSums(newSum, newSequence, depth + 1);
            }
        }

        // Generate possible sums
        generateSums();

        // Try to find a valid combination
        for (const doubleThrow of finishingDoubles) {
            const doubleScore = doubleThrow.score;

            if (doubleScore > remainingScore) continue;

            const remaining = remainingScore - doubleScore;

            // Case 1: Finish with just the double
            if (remaining === 0 && throwsLeft >= 1) {
                return [doubleThrow.name];
            }

            // Check if remaining score can be achieved with available throws
            if (possibleSums.has(remaining)) {
                const sequences = possibleSums.get(remaining);
                for (const sequence of sequences) {
                    if (sequence.length + 1 <= throwsLeft) {
                        return [...sequence, doubleThrow.name];
                    }
                }
            }
        }

        // No valid combination found
        return [];
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
                    winningScore: player.winningScore,
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
