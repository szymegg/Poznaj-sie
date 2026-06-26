const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

// Kolejka oczekujących użytkowników
let waitingQueue = [];
const lastMessageTimes = {};

io.on('connection', (socket) => {
    console.log(`Nowy użytkownik połączył się: ${socket.id}`);
    io.emit('update-online-count', io.sockets.sockets.size);

    socket.on('search-partner', (data) => {
        socket.partner = null;
        
        // Zabezpieczenie wartości i ujednolicenie stringów
        const myGender = String(data?.myGender || 'male').trim();
        const searchGender = String(data?.searchGender || 'anyone').trim();

        console.log(`Żądanie parowania od ${socket.id}: Jestem=${myGender}, Szukam=${searchGender}`);

        // Szukamy idealnego dopasowania w kolejce
        let partnerIndex = waitingQueue.findIndex(user => {
            // 1. Czy osoba w kolejce szuka kogoś o mojej płci (lub szuka kogokolwiek)?
            const partnerWantsMe = (user.searchGender === 'anyone' || user.searchGender === myGender);
            
            // 2. Czy ja szukam osoby o płci, którą reprezentuje użytkownik w kolejce (lub szukam kogokolwiek)?
            const iWantPartner = (searchGender === 'anyone' || searchGender === user.myGender);
            
            // Zwracamy true tylko wtedy, gdy OBA warunki są jednocześnie spełnione
            return partnerWantsMe && iWantPartner;
        });

        if (partnerIndex !== -1) {
            // Wyciągamy pasującego partnera z kolejki
            let partnerData = waitingQueue.splice(partnerIndex, 1)[0];
            let partnerSocket = partnerData.socket;

            // Łączymy referencje socketów ze sobą
            socket.partner = partnerSocket;
            partnerSocket.partner = socket;

            // Emitujemy informację o sukcesie do obu stron
            socket.emit('partner-found');
            partnerSocket.emit('partner-found');
            
            console.log(`[SUKCES] Połączono parę: ${socket.id} <-> ${partnerSocket.id}`);
        } else {
            // Jeśli nikt nie pasuje, dodajemy nasz obiekt do kolejki oczekujących
            waitingQueue.push({
                socket: socket,
                myGender: myGender,
                searchGender: searchGender
            });
            console.log(`[KOLEJKA] Dodano do oczekujących: ${socket.id} (${myGender} szuka ${searchGender}). Rozmiar kolejki: ${waitingQueue.length}`);
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
    // Bezpieczne usuwanie z kolejki obiektów
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
