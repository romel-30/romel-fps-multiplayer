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

function createRoom(code){
    if(!rooms[code]){
        rooms[code] = { players:{} };
    }
}

wss.on("connection", (ws)=>{
    let playerId = uuidv4();
    let roomCode = null;

    ws.on("message", (message)=>{
        const data = JSON.parse(message);

        if(data.type === "join"){
            roomCode = data.room.toUpperCase();
            createRoom(roomCode);

            rooms[roomCode].players[playerId] = {
                id: playerId,
                x: 0,
                y: 1.8,
                z: 0,
                rotY: 0,
                health: 100,
                kills: 0
            };

            ws.send(JSON.stringify({
                type:"init",
                id: playerId
            }));
        }

        if(data.type === "update" && roomCode){
            const p = rooms[roomCode].players[playerId];
            if(!p) return;

            p.x = data.state.x;
            p.y = data.state.y;
            p.z = data.state.z;
            p.rotY = data.state.rotY;
        }

        if(data.type === "shoot" && roomCode){
            const shooter = rooms[roomCode].players[playerId];
            if(!shooter) return;

            const maxDistance = 20;
            const hitRadius = 1.2;
            const forwardX = Math.sin(shooter.rotY);
            const forwardZ = Math.cos(shooter.rotY);

            for(let id in rooms[roomCode].players){
                if(id === playerId) continue;

                const target = rooms[roomCode].players[id];

                const dx = target.x - shooter.x;
                const dz = target.z - shooter.z;
                const distance = Math.sqrt(dx*dx + dz*dz);

                if(distance > maxDistance) continue;

                const dot = (dx*forwardX + dz*forwardZ) / distance;

                if(dot > 0.95){ // aiming close enough
                    target.health -= 25;

                    if(target.health <= 0){
                        shooter.kills++;
                        target.health = 100;
                        target.x = (Math.random()-0.5)*20;
                        target.z = (Math.random()-0.5)*20;
                    }
                }
            }
        }
    });

    ws.on("close", ()=>{
        if(roomCode && rooms[roomCode]){
            delete rooms[roomCode].players[playerId];
        }
    });
});

setInterval(()=>{
    for(let room in rooms){
        const payload = JSON.stringify({
            type:"state",
            players: rooms[room].players
        });

        wss.clients.forEach(client=>{
            if(client.readyState === WebSocket.OPEN){
                client.send(payload);
            }
        });
    }
}, 50);

const PORT = process.env.PORT || 3000;

server.listen(PORT, ()=>{
    console.log("Server running on port", PORT);
});
