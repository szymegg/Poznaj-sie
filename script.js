const socket = io();

const welcomeScreen = document.getElementById('welcome-screen');
const chatScreen = document.getElementById('chat-screen');
const startBtn = document.getElementById('start-btn');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const messagesBox = document.getElementById('messages-box');
const onlineCountSpan = document.getElementById('online-count');

const gameBtn = document.getElementById('game-toggle-btn');
const disconnectBtn = document.getElementById('leave-btn');
const gameBoard = document.getElementById('game-board');
const cells = document.querySelectorAll('.cell');

let inactivityTimer = null;
let responseTimer = null; 
let myTurn = true;        
let mySign = "X";         

// Kombinacje wygrywające w kółko i krzyżyk
const winningCombinations = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Poziomo
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Pionowo
    [0, 4, 8], [2, 4, 6]             // Skosy
];

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, (tag) => {
        const chars = { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' };
        return chars[tag] || tag;
    });
}

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

function startResponseTimer() {
    clearTimeout(responseTimer);
    responseTimer = setTimeout(() => {
        messagesBox.innerHTML += '<p class="system-msg" style="color: #dc3545; font-weight: bold; text-align: center;">Rozmówca nie odpowiada od 15 sekund... Może warto go rozruszać?</p>';
        messagesBox.scrollTop = messagesBox.scrollHeight;
    }, 15000); 
}

function stopResponseTimer() {
    clearTimeout(responseTimer);
}

function checkGameStatus() {
    let currentBoard = Array.from(cells).map(cell => cell.innerText);
    
    // Sprawdzanie wygranej
    for (let combo of winningCombinations) {
        const [a, b, c] = combo;
        if (currentBoard[a] && currentBoard[a] === currentBoard[b] && currentBoard[a] === currentBoard[c]) {
            if (currentBoard[a] === mySign) {
                alert("Gratulacje! Wygrałeś grę! 🎉");
            } else {
                alert("Niestety, przegrałeś. Obcy okazał się lepszy! 🤖");
            }
            resetGameBoard();
            return;
        }
    }

    // Sprawdzanie remisu (brak wolnych kafelków)
    if (currentBoard.every(cell => cell !== "")) {
        alert("Remis! Świetna walka! 🤝");
        resetGameBoard();
    }
}

function resetGameBoard() {
    cells.forEach(cell => cell.innerText = "");
    myTurn = (mySign === "X"); // Gracz X zawsze zaczyna nową rundę
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
    if (sendBtn) sendBtn.disabled = true;
    
    resetGameBoard();
}

function startNewChat() {
    resetUI();
    if (welcomeScreen) welcomeScreen.classList.add('id-hidden');
    if (chatScreen) chatScreen.classList.remove('id-hidden');
    socket.emit('search-partner');
}

if (startBtn) startBtn.addEventListener('click', startNewChat);

if (disconnectBtn) {
    disconnectBtn.addEventListener('click', () => {
        socket.emit('disconnect-chat');
        resetUI();
    });
}

if (gameBtn) {
    gameBtn.addEventListener('click', () => {
        if (gameBoard) {
            gameBoard.classList.toggle('id-hidden');
            socket.emit('start-game'); 
        }
    });
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
        startResponseTimer(); 
    }
}

if (sendBtn) sendBtn.disabled = false;
if (sendBtn) sendBtn.addEventListener('click', sendMessage);
if (messageInput) {
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
}

cells.forEach(cell => {
    cell.addEventListener('click', () => {
        if (myTurn && cell.innerText === "") {
            cell.innerText = mySign; 
            myTurn = false; 
            const index = cell.getAttribute('data-index');
            socket.emit('game-move', index);
            setTimeout(checkGameStatus, 50); // Krótkie opóźnienie, by litera zdążyła się narysować
        }
    });
});

socket.on('update-online-count', (count) => {
    if (onlineCountSpan) onlineCountSpan.innerText = count;
});

socket.on('partner-found', () => {
    const systemMsg = messagesBox.querySelector('.system-msg');
    if (systemMsg) systemMsg.remove();
    
    messagesBox.innerHTML += '<p class="system-msg text-success">Połączono z obcym! Napisz coś...</p>';
    messageInput.disabled = false;
    if (sendBtn) sendBtn.disabled = false;
    
    startInactivityTimer();
    myTurn = true; 
    mySign = "X"; 
});

socket.on('receive-message', (text) => {
    stopResponseTimer(); 
    const safeText = escapeHTML(text);
    messagesBox.innerHTML += `<p><strong>Obcy:</strong> ${safeText}</p>`;
    messagesBox.scrollTop = messagesBox.scrollHeight;
    startInactivityTimer();
});

socket.on('game-started', () => {
    if (gameBoard) gameBoard.classList.remove('id-hidden');
    mySign = "O"; 
    myTurn = false;
});

socket.on('opponent-moved', (index) => {
    const targetCell = document.querySelector(`.cell[data-index="${index}"]`);
    if (targetCell) {
        targetCell.innerText = (mySign === "X") ? "O" : "X"; 
        myTurn = true; 
        setTimeout(checkGameStatus, 50);
    }
});

socket.on('partner-disconnected', () => {
    stopInactivityTimer();
    stopResponseTimer();
    
    messagesBox.innerHTML += '<p class="system-msg text-danger">Rozmówca opuścił rozmowę.</p>';
    messageInput.disabled = true;
    if (sendBtn) sendBtn.disabled = true;

    setTimeout(() => {
        if (confirm("Twój rozmówca opuścił rozmowę. Czy chcesz znaleźć nową osobę?")) {
            startNewChat();
        } else {
            resetUI();
        }
    }, 600);
});
