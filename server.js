const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const { v4: uuidv4 } = require("uuid");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.get("/", (req, res) => {
    res.send("Romel FPS Multiplayer Server Running");
});

let rooms = {};

function createRoom(code) {
    if (!rooms[code]) {
        rooms[code] = {
            players: {}
        };
        console.log("Room created:", code);
    }
}

function removePlayer(room, id) {
    if (rooms[room]) {
        delete rooms[room].players[id];
        if (Object.keys(rooms[room].players).length === 0) {
            delete rooms[room];
            console.log("Room deleted:", room);
        }
    }
}

wss.on("connection", (ws) => {
    let playerId = uuidv4();
    let roomCode = null;

    ws.on("message", (message) => {
        const data = JSON.parse(message);

        if (data.type === "join") {
            roomCode = data.room.toUpperCase();
            createRoom(roomCode);

            rooms[roomCode].players[playerId] = {
                id: playerId,
                x: Math.random() * 10 - 5,
                y: 1.8,
                z: Math.random() * 10 - 5,
                rotY: 0,
                health: 100,
                kills: 0
            };

            ws.send(JSON.stringify({
                type: "init",
                id: playerId
            }));
        }

        if (data.type === "update" && roomCode) {
            const player = rooms[roomCode].players[playerId];
            if (player) {
                player.x = data.state.x;
                player.y = data.state.y;
                player.z = data.state.z;
                player.rotY = data.state.rotY;
            }
        }

        if (data.type === "shoot" && roomCode) {
            const shooter = rooms[roomCode].players[playerId];
            if (!shooter) return;

            for (let id in rooms[roomCode].players) {
                if (id === playerId) continue;

                let target = rooms[roomCode].players[id];

                let dx = shooter.x - target.x;
                let dz = shooter.z - target.z;
                let distance = Math.sqrt(dx * dx + dz * dz);

                if (distance < 2) {
                    target.health -= 20;

                    if (target.health <= 0) {
                        shooter.kills++;
                        target.health = 100;
                        target.x = Math.random() * 20 - 10;
                        target.z = Math.random() * 20 - 10;
                    }
                }
            }
        }
    });

    ws.on("close", () => {
        if (roomCode) {
            removePlayer(roomCode, playerId);
        }
    });
});

setInterval(() => {
    for (let room in rooms) {
        const payload = JSON.stringify({
            type: "s
