const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

let waitingQueue = [];
const lastMessageTimes = {};

io.on('connection', (socket) => {
    console.log(`Nowy użytkownik połączył się: ${socket.id}`);
    io.emit('update-online-count', io.sockets.sockets.size);

    socket.on('search-partner', () => {
        socket.partner = null;
        if (waitingQueue.length > 0) {
            let partnerSocket = waitingQueue.shift();
            socket.partner = partnerSocket;
            partnerSocket.partner = socket;
            socket.emit('partner-found');
            partnerSocket.emit('partner-found');
            console.log(`Połączono parę: ${socket.id} oraz ${partnerSocket.id}`);
        } else {
            waitingQueue.push(socket);
            console.log(`Użytkownik ${socket.id} czeka w kolejce.`);
        }
    });

    socket.on('send-message', (text) => {
        const now = Date.now();
        if (lastMessageTimes[socket.id] && (now - lastMessageTimes[socket.id] < 400)) return; 
        if (!text || typeof text !== 'string' || text.trim().length === 0 || text.length > 500) return; 

        lastMessageTimes[socket.id] = now;
        if (socket.partner) {
            socket.partner.emit('receive-message', text.trim());
        }
    });

    socket.on('start-game', () => {
        if (socket.partner) socket.partner.emit('game-started');
    });

    socket.on('game-move', (index) => {
        if (socket.partner) socket.partner.emit('opponent-moved', index);
    });

    socket.on('disconnect-chat', () => {
        disconnectUser(socket);
    });

    socket.on('disconnect', () => {
        disconnectUser(socket);
        console.log(`Użytkownik się rozłączył: ${socket.id}`);
        io.emit('update-online-count', io.sockets.sockets.size);
    });
});

function disconnectUser(socket) {
    delete lastMessageTimes[socket.id];
    waitingQueue = waitingQueue.filter(user => user.id !== socket.id);
    if (socket.partner) {
        socket.partner.emit('partner-disconnected');
        socket.partner.partner = null;
        socket.partner = null;
    }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Serwer działa na porcie ${PORT}`);
});
