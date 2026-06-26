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

let inactivityTimer = null;

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

function startInactivityTimer() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
        alert("Rozłączono z powodu nieaktywności przez 3 minuty.");
        socket.emit('disconnect-chat');
        resetUI();
    }, 180000); // 3 minuty
}

function stopInactivityTimer() {
    clearTimeout(inactivityTimer);
}

function resetUI() {
    stopInactivityTimer();
    chatScreen.classList.add('id-hidden');
    welcomeScreen.classList.remove('id-hidden');
    messagesBox.innerHTML = '<p class="system-msg">Łączenie z rozmówcą...</p>';
    messageInput.value = "";
    messageInput.disabled = true;
    sendBtn.disabled = true;
}

function startNewChat() {
    resetUI();
    welcomeScreen.classList.add('id-hidden');
    chatScreen.classList.remove('id-hidden');
    socket.emit('search-partner');
}

// Obsługa przycisku startu losowania
if (startBtn) {
    startBtn.addEventListener('click', () => {
        startNewChat();
    });
}

// Funkcja wysyłania wiadomości
function sendMessage() {
    if (messageInput.disabled) return;

    const rawText = messageInput.value.trim();
    
    // Blokada pustych wiadomości i dłuższych niż 500 znaków
    if (rawText !== "" && rawText.length <= 500) {
        const safeText = escapeHTML(rawText);
        
        messagesBox.innerHTML += `<p><strong>Ty:</strong> ${safeText}</p>`;
        
        // Ślemy czysty tekst, serwer też go zwaliduje
        socket.emit('send-message', rawText);

        messageInput.value = "";
        messagesBox.scrollTop = messagesBox.scrollHeight;
        startInactivityTimer();
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
});

// Odbieranie wiadomości
socket.on('receive-message', (text) => {
    const safeText = escapeHTML(text);
    messagesBox.innerHTML += `<p><strong>Obcy:</strong> ${safeText}</p>`;
    messagesBox.scrollTop = messagesBox.scrollHeight;
    startInactivityTimer();
});

// Partner się rozłączył
socket.on('partner-disconnected', () => {
    stopInactivityTimer();
    messagesBox.innerHTML += '<p class="system-msg text-danger">Rozmówca się rozłączył.</p>';
    messageInput.disabled = true;
    sendBtn.disabled = true;
});
