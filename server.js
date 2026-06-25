const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serwer będzie automatycznie serwował Twoje pliki HTML/CSS/JS z tego folderu
app.use(express.static(__dirname));

// Tablica przechowująca użytkowników, którzy aktualnie szukają pary
let waitingQueue = [];

io.on('connection', (socket) => {
    console.log(`Nowy użytkownik połączył się: ${socket.id}`);

   socket.on('search-partner', () => {
    socket.partner = null;

    // 1. Sprawdzamy, czy w kolejce już ktoś czeka
    if (waitingQueue.length > 0) {
        // Wyciągamy pierwszą osobę z kolejki
        let partnerSocket = waitingQueue.shift();

        // Parujemy ich ze sobą
        socket.partner = partnerSocket;
        partnerSocket.partner = socket;

        // Informujemy oba programy, że znaleziono parę!
        socket.emit('partner-found');
        partnerSocket.emit('partner-found');
        
        console.log(`Połączono parę: ${socket.id} oraz ${partnerSocket.id}`);
    } else {
        // 2. Jeśli kolejka jest pusta, sami do niej wskakujemy i czekamy
        waitingQueue.push(socket);
        console.log(`Użytkownik ${socket.id} czeka w kolejce.`);
    }
    });

    // Przesyłanie wiadomości tekstowej
    socket.on('send-message', (text) => {
        if (socket.partner) {
            // Wysyłamy wiadomość bezpośrednio do partnera
            socket.partner.emit('receive-message', text);
        }
    });

    // Uruchomienie gierki u rozmówcy
    socket.on('start-game', () => {
        if (socket.partner) socket.partner.emit('game-started');
    });

    // Ruch w kółko i krzyżyk
    socket.on('game-move', (index) => {
        if (socket.partner) socket.partner.emit('opponent-moved', index);
    });

    // Rozłączenie lub kliknięcie "Rozłącz"
    socket.on('disconnect-chat', () => {
        disconnectUser(socket);
    });

    socket.on('disconnect', () => {
        disconnectUser(socket);
        console.log(`Użytkownik się rozłączył: ${socket.id}`);
    });
});

function disconnectUser(socket) {
    // Jeśli był w kolejce, usuwamy go
    waitingQueue = waitingQueue.filter(user => user.id !== socket.id);

    // Jeśli miał parę, informujemy partnera, że został sam
    if (socket.partner) {
        socket.partner.emit('partner-disconnected');
        socket.partner.partner = null;
        socket.partner = null;
    }
}

// Serwer wystartuje na porcie 3000
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Serwer działa na porcie ${PORT}`);
});
