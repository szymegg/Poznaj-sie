const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

// Kolejka przechowuje teraz obiekty z danymi o płci
let waitingQueue = [];
const lastMessageTimes = {};

io.on('connection', (socket) => {
    console.log(`Nowy użytkownik połączył się: ${socket.id}`);
    io.emit('update-online-count', io.sockets.sockets.size);

    socket.on('search-partner', (data) => {
        socket.partner = null;
        
        // Wyciągamy dane przesłane z frontu (domyślnie 'anyone' jeśli brak)
        const myGender = data?.myGender || 'male';
        const searchGender = data?.searchGender || 'anyone';

        // Szukamy w kolejce kogoś, kto pasuje do nas I do kogo my pasujemy
        let partnerIndex = waitingQueue.findIndex(user => {
            // Czy ta osoba pasuje do naszych kryteriów?
            const matchForMe = (searchGender === 'anyone' || searchGender === user.myGender);
            // Czy my pasujemy do jej kryteriów?
            const matchForPartner = (user.searchGender === 'anyone' || user.searchGender === myGender);
            
            return matchForMe && matchForPartner;
        });

        if (partnerIndex !== -1) {
            // Znaleziono dopasowanie! Wyciągamy partnera z kolejki
            let partnerData = waitingQueue.splice(partnerIndex, 1)[0];
            let partnerSocket = partnerData.socket;

            socket.partner = partnerSocket;
            partnerSocket.partner = socket;

            socket.emit('partner-found');
            partnerSocket.emit('partner-found');
            console.log(`Połączono parę z dopasowaniem płci: ${socket.id} oraz ${partnerSocket.id}`);
        } else {
            // Brak dopasowania – dodajemy siebie do kolejki oczekujących wraz z preferencjami
            waitingQueue.push({
                socket: socket,
                myGender: myGender,
                searchGender: searchGender
            });
            console.log(`Użytkownik ${socket.id} (${myGender} szuka ${searchGender}) czeka w kolejce.`);
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
    // Czyszczenie kolejki uwzględniając strukturę obiektów
    waitingQueue = waitingQueue.filter(item => item.socket.id !== socket.id);
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
