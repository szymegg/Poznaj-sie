const socket = io();

// Pobieranie elementów DOM
const welcomeScreen = document.getElementById('welcome-screen');
const chatScreen = document.getElementById('chat-screen');
const startBtn = document.getElementById('start-btn');
const disconnectBtn = document.getElementById('disconnect-btn');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const messagesBox = document.getElementById('messages-box');
const onlineCountSpan = document.getElementById('online-count');

// Elementy do gry w kółko i krzyżyk
const gameBoard = document.getElementById('game-board');
const cells = document.querySelectorAll('.cell');
const gameBtn = document.getElementById('game-btn') || document.querySelector('.btn-game') || document.querySelector('button:has(.fa-gamepad)');

let inactivityTimer = null;
let responseTimer = null; // Deadchat (15 sekund)
let myTurn = true;        // Zarządzanie turą w grze

// Funkcja zamieniająca znaki specjalne na bezpieczne encje HTML (ochrona XSS)
function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, (tag) => {
        const chars = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        };
        return chars[tag] || tag;
    });
}

// Licznik całkowitej nieaktywności (3 minuty)
function startInactivityTimer() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
        alert("Rozłączono z powodu nieaktywności przez 3 minuty.");
        socket.emit('disconnect-chat');
        resetUI();
    }, 180000);
}

function stopInactivityTimer() {
    clearTimeout(inactivityTimer);
}

// Licznik braku odpowiedzi po dokładnie 15 sekundach (Deadchat)
function startResponseTimer() {
    clearTimeout(responseTimer);
    responseTimer = setTimeout(() => {
        messagesBox.innerHTML += '<p class="system-msg" style="color: #dc3545; font-weight: bold; text-align: center;">Rozmówca nie odpowiada od 15 sekund... Może warto go rozruszać?</p>';
        messagesBox.scrollTop = messagesBox.scrollHeight;
    }, 15000); // Dokładnie 15000ms = 15 sekund
}

function stopResponseTimer() {
    clearTimeout(responseTimer);
}

function resetUI() {
    stopInactivityTimer();
    stopResponseTimer();
    if (chatScreen) chatScreen.classList.add('id-hidden');
    if (welcomeScreen) welcomeScreen.classList.remove('id-hidden');
    if (gameBoard) gameBoard.classList.add('id-hidden');
    
    messagesBox.innerHTML = '<p class="system-msg">Łączenie z rozmówcą...</p>';
    messageInput.value = "";
    messageInput.disabled = true;
    sendBtn.disabled = true;
    
    // Reset planszy gierki
    cells.forEach(cell => cell.innerText = "");
    myTurn = true;
}

function startNewChat() {
    resetUI();
    if (welcomeScreen) welcomeScreen.classList.add('id-hidden');
    if (chatScreen) chatScreen.classList.remove('id-hidden');
    socket.emit('search-partner');
}

// Obsługa przycisków startu i rozłączenia
if (startBtn) startBtn.addEventListener('click', startNewChat);

if (disconnectBtn) {
    disconnectBtn.addEventListener('click', () => {
        socket.emit('disconnect-chat');
        resetUI();
    });
}

// Ręczne włączanie/wyłączanie gierki przyciskiem "Gra"
if (gameBtn) {
    gameBtn.addEventListener('click', () => {
        if (gameBoard) {
            gameBoard.classList.toggle('id-hidden');
            socket.emit('start-game'); // Informujemy serwer, żeby pokazał planszę też u obcego
        }
    });
}

// Funkcja wysyłania wiadomości tekstowej
function sendMessage() {
    if (messageInput.disabled) return;

    const rawText = messageInput.value.trim();
    
    if (rawText !== "" && rawText.length <= 500) {
        const safeText = escapeHTML(rawText);
        messagesBox.innerHTML += `<p><strong>Ty:</strong> ${safeText}</p>`;
        
        socket.emit('send-message', rawText);

        messageInput.value = "";
        messagesBox.scrollTop = messagesBox.scrollHeight;
        
        startInactivityTimer();
        startResponseTimer(); // Odpalamy odliczanie 15s dla obcego na odpowiedź
    }
}

if (sendBtn) sendBtn.addEventListener('click', sendMessage);

if (messageInput) {
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
}

// Logika gry w kółko i krzyżyk
cells.forEach(cell => {
    cell.addEventListener('click', () => {
        // Kliknąć można tylko w swojej turze i tylko w puste pole
        if (myTurn && cell.innerText === "") {
            cell.innerText = "X"; 
            myTurn = false; // Oddajemy turę przeciwnikowi
            const index = cell.getAttribute('data-index');
            socket.emit('game-move', index);
        }
    });
});


// === OBSŁUGA EVENTÓW SOCKET.IO ===

// Aktualizacja licznika osób online na stronie startowej
socket.on('update-online-count', (count) => {
    if (onlineCountSpan) {
        onlineCountSpan.innerText = count;
    }
});

// Znaleziono partnera
socket.on('partner-found', () => {
    const systemMsg = messagesBox.querySelector('.system-msg');
    if (systemMsg) systemMsg.remove();
    
    messagesBox.innerHTML += '<p class="system-msg text-success">Połączono z obcym! Napisz coś...</p>';
    messageInput.disabled = false;
    sendBtn.disabled = false;
    
    startInactivityTimer();
    myTurn = true; // Osoba, która pierwsza kliknie na swoją planszę, stawia ruch
});

// Odbieranie wiadomości tekstowej
socket.on('receive-message', (text) => {
    stopResponseTimer(); // Obcy odpisał, więc kasujemy licznik 15s
    
    const safeText = escapeHTML(text);
    messagesBox.innerHTML += `<p><strong>Obcy:</strong> ${safeText}</p>`;
    messagesBox.scrollTop = messagesBox.scrollHeight;
    
    startInactivityTimer();
});

// Partner wcisnął ikonę gry / wywołał start gry
socket.on('game-started', () => {
    if (gameBoard) gameBoard.classList.remove('id-hidden');
});

// Serwer informuje o ruchu przeciwnika w grze
socket.on('opponent-moved', (index) => {
    const targetCell = document.querySelector(`.cell[data-index="${index}"]`);
    if (targetCell) {
        targetCell.innerText = "O"; // Ruch obcego to zawsze O
        myTurn = true;              // Z powrotem nasza tura!
    }
});

// Partner się rozłączył - POKAZANIE KOMUNIKATU I ZAPYTANIA
socket.on('partner-disconnected', () => {
    stopInactivityTimer();
    stopResponseTimer();
    
    messagesBox.innerHTML += '<p class="system-msg text-danger">Rozmówca się rozłączył.</p>';
    messageInput.disabled = true;
    sendBtn.disabled = true;

    // Automatyczne zapytanie o nowe losowanie
    setTimeout(() => {
        if (confirm("Twój rozmówca opuścił rozmowę. Czy chcesz znaleźć nową osobę?")) {
            startNewChat();
        } else {
            resetUI();
        }
    }, 500);
});
