# dart-webapi

Server for the home dart scoreboard. It owns all game state, serves the
[dart-webapp](https://github.com/aronhr/dart-webapp) frontend and puts the scoreboard on a
Chromecast / Google TV, so the iPad stays the keypad and the TV shows the scores.

```
iPad (/)  ──socket.io──▶  dart-webapi  ──Cast v2 (DashCast)──▶  TV opens /display
                             ▲                                      │
                             └──────────────socket.io───────────────┘
```

## Games

X01 (301/501/701, double/straight/master out, double in), Cricket (standard / cut-throat),
Around the Clock, Chug it and High Score. All games support legs ("first to N"), undo and stats.

A match is stored as its settings plus the list of darts thrown; every state is rebuilt by
replaying those darts (`src/games/index.js`). That keeps undo exact in every game, across turns
and legs.

## Casting

`src/cast/` finds Cast devices with mDNS and talks the Cast v2 protocol directly. It launches
the public DashCast receiver and tells it to open `PUBLIC_URL/display?room=…`. A watchdog reloads
the page if the TV is still on DashCast but the page isn't connected, and the cast is re-attached
after a server restart. If someone presses back/home on the TV, the cast is left stopped.

Requirements: the server must be on the same LAN as the TV, use host networking (mDNS), and the
TV must be able to reach `PUBLIC_URL` (open the port in the firewall).

## Running

```bash
docker compose up -d --build    # expects ../dart-webapp next to this repo
```

Environment: `PORT` (8687), `PUBLIC_URL` (LAN URL the TV loads), `DATA_DIR` (`./data`).
State (players, rooms, match history) is kept in `data/db.json`.

Development: `npm install && npm run dev`, tests with `npm test`.

## Socket protocol

Clients send `hello {room, role: 'controller'|'display', cast?}` and then commands with an ack
callback: `players:add|update|remove`, `setup:set`, `match:start`, `dart {n, m}`, `undo`,
`turn:end`, `match:rematch`, `match:end`, `cast:start {deviceId}`, `cast:stop`.
The server answers every change with a full `snapshot` of the room and sends `fx` events
(180, bust, checkout, leg/match won …) for the TV animations.
