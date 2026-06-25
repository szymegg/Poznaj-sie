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

    // Reakcja na kliknięcie "Rozpocznij losowanie"
    socket.on('search-partner', (myGenderPreference) => {
        // Zapisujemy preferencje tego użytkownika
        socket.partnerPreference = myGenderPreference;
        socket.partner = null;

        // Szukamy kogoś w kolejce, kto pasuje do naszych kryteriów i my pasujemy do jego
        let matchIndex = waitingQueue.findIndex(user => {
            // Czy ja akceptuję jego, a on akceptuje mnie?
            const IAcceptHim = (myGenderPreference === 'anyone'); // uproszczone na start lub dokładne parowanie
            const HeAcceptsMe = (user.partnerPreference === 'anyone');
            
            return IAcceptHim && HeAcceptsMe; // Na start najprostsze parowanie 'Kogokolwiek'
        });

        if (matchIndex !== -1) {
            // Znaleźliśmy parę! Wyciągamy tę osobę z kolejki
            let partnerSocket = waitingQueue.splice(matchIndex, 1)[0];

            // Łączymy ich ze sobą w kodzie
            socket.partner = partnerSocket;
            partnerSocket.partner = socket;

            // Wysyłamy sygnał do obu osób, że zostali połączeni!
            socket.emit('matched');
            partnerSocket.emit('matched');
        } else {
            // Brak wolnych ludzi pasujących – dodajemy użytkownika do kolejki oczekujących
            waitingQueue.push(socket);
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
server.listen(PORT, () => {
    console.log(`Prawdziwy serwer działa! Wejdź na: http://localhost:${PORT}`);
});
