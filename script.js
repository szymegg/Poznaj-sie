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

let inactivityTimer = null;
let responseTimer = null; // Licznik 15 sekund na odpowiedź (Deadchat)

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

// Licznik braku odpowiedzi po 15 sekundach (Deadchat)
function startResponseTimer() {
    clearTimeout(responseTimer);
    responseTimer = setTimeout(() => {
        messagesBox.innerHTML += '<p class="system-msg" style="color: #dc3545; font-weight: bold;">Rozmówca nie odpowiada od 15 sekund... Może warto go rozruszać?</p>';
        messagesBox.scrollTop = messagesBox.scrollHeight;
    }, 150000); // 15 sekund
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
}

function startNewChat() {
    resetUI();
    if (welcomeScreen) welcomeScreen.classList.add('id-hidden');
    if (chatScreen) chatScreen.classList.remove('id-hidden');
    socket.emit('search-partner');
}

// Obsługa przycisków
if (startBtn) {
    startBtn.addEventListener('click', startNewChat);
}

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

if (sendBtn) {
    sendBtn.addEventListener('click', sendMessage);
}

if (messageInput) {
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
}

if (disconnectBtn) {
    disconnectBtn.addEventListener('click', () => {
        socket.emit('disconnect-chat');
        resetUI();
    });
}

// Obsługa kliknięcia w kafelki gry (Kółko i Krzyżyk)
cells.forEach(cell => {
    cell.addEventListener('click', () => {
        const index = cell.getAttribute('data-index');
        // Jeśli pole jest puste, stawiamy znak i wysyłamy ruch do partnera
        if (cell.innerText === "") {
            cell.innerText = "X"; // Gracz rozpoczynający ma X
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
    
    // Automatycznie pokazujemy też planszę do gry, jeśli chcesz, żeby była widoczna
    if (gameBoard) gameBoard.classList.remove('id-hidden');
});

// Odbieranie wiadomości
socket.on('receive-message', (text) => {
    stopResponseTimer(); // Obcy odpisał, więc kasujemy licznik 15s
    
    const safeText = escapeHTML(text);
    messagesBox.innerHTML += `<p><strong>Obcy:</strong> ${safeText}</p>`;
    messagesBox.scrollTop = messagesBox.scrollHeight;
    
    startInactivityTimer();
});

// Partner się rozłączył
socket.on('partner-disconnected', () => {
    stopInactivityTimer();
    stopResponseTimer();
    messagesBox.innerHTML += '<p class="system-msg text-danger">Rozmówca się rozłączył.</p>';
    messageInput.disabled = true;
    sendBtn.disabled = true;
});

// Serwer informuje o ruchu przeciwnika w grze
socket.on('opponent-moved', (index) => {
    const targetCell = document.querySelector(`.cell[data-index="${index}"]`);
    if (targetCell) {
        targetCell.innerText = "O"; // Przeciwnik stawia O
    }
});

// Gra wystartowała z poziomu serwera
socket.on('game-started', () => {
    if (gameBoard) gameBoard.classList.remove('id-hidden');
});
