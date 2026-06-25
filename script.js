// Łapiemy elementy z HTML
const socket = io();
const startBtn = document.getElementById('start-btn');
const welcomeScreen = document.getElementById('welcome-screen');
const chatScreen = document.getElementById('chat-screen');
const messagesBox = document.getElementById('messages-box');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');

// Elementy wyskakującego okienka
const actionModal = document.getElementById('action-modal');
const autoQuestionBtn = document.getElementById('auto-question-btn');
const leaveChatBtn = document.getElementById('leave-chat-btn');

let inactivityTimer; // Tu przechowamy nasz odliczający zegar

const icebreakers = [
    "Gdybyś mógł zjeść obiad z dowolną postacią (żywą lub martwą), kto by to był?",
    "Jaki jest Twój ulubiony kawałek muzyczny w tym tygodniu?",
    "Co wolisz: spędzić wieczór grając w gierki czy oglądając seriale?",
    "Gdybyś wygrał milion złotych, jaka byłaby pierwsza rzecz, którą kupisz?",
    "Jaka jest najbardziej absurdalna potrawa, jaką kiedykolwiek jadłeś?"
];

// Funkcja uruchamiająca odliczanie 15 sekund
function startInactivityTimer() {
    clearTimeout(inactivityTimer); 
    inactivityTimer = setTimeout(() => {
        actionModal.classList.remove('id-hidden'); 
    }, 15000);
}

// 1. FUNKCJA STARTU CZATU (wywoływana na początku i przy szukaniu nowego rozmówcy)
// 1. FUNKCJA STARTU CZATU (wywoływana na początku i przy szukaniu nowego rozmówcy)
function startNewChat() {
    messagesBox.innerHTML = `<p class="system-msg">Łączenie z rozmówcą...</p>`;
    socket.emit('search-partner');

    // ZABLOKOWANIE pisania i przycisków na starcie
    messageInput.disabled = true;
    sendBtn.disabled = true;
    leaveBtn.disabled = true;
    messageInput.placeholder = "Czekaj na rozmówcę...";
}

// Kliknięcie głównego przycisku "Rozpocznij losowanie"
startBtn.addEventListener('click', () => {
    welcomeScreen.classList.add('id-hidden');
    chatScreen.classList.remove('id-hidden');
    startNewChat(); // Odpalamy procedurę łączenia
});

// Funkcja wysyłania wiadomości
function sendMessage() {
    // Jeśli pole jest zablokowane, nie pozwól wysłać (zabezpieczenie)
    if(messageInput.disabled) return;

    const text = messageInput.value.trim();
    if(text !== "") {
        messagesBox.innerHTML += `<p><strong>Ty:</strong> ${text}</p>`;
        messageInput.value = ""; 
        startInactivityTimer();
    }
}

// Obsługa wysyłania
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if(e.key === 'Enter') sendMessage();
});

/* OBSŁUGA WYSKAKUJĄCEGO OKIENKA */

// Opcja 1: Automatyczne pytanie
autoQuestionBtn.addEventListener('click', () => {
    actionModal.classList.add('id-hidden'); 
    const randomQuestion = icebreakers[Math.floor(Math.random() * icebreakers.length)];
    messagesBox.innerHTML += `<p class="system-msg"><strong>Bot zadał pytanie:</strong> ${randomQuestion}</p>`;
    startInactivityTimer(); 
});

// Opcja 2: Opuść rozmowę i szukaj kolejnej osoby
leaveChatBtn.addEventListener('click', () => {
    actionModal.classList.add('id-hidden');
    clearTimeout(inactivityTimer); // Wyłączamy stary zegar

    // Informujemy o opuszczeniu czatu
    messagesBox.innerHTML += `<p class="system-msg" style="color: #d5684d; font-weight: bold; margin-top: 10px;">Opuściłeś rozmowę.</p>`;
    messagesBox.innerHTML += `<p class="system-msg">Szukanie nowego rozmówcy za 3 sekundy...</p>`;
    
    // Ponownie blokujemy okno wpisywania
    messageInput.disabled = true;
    sendBtn.disabled = true;
    messageInput.placeholder = "Rozmowa zakończona...";

    // Po 3 sekundach automatycznie odpalamy szukanie nowej osoby!
    setTimeout(() => {
        startNewChat();
    }, 3000);
});
// === LOGIKA GRY KÓŁKO I KRZYŻYK ===

const gameToggleBtn = document.getElementById('game-toggle-btn');
const gameBoard = document.getElementById('game-board');
const cells = document.querySelectorAll('.cell');

let gameActive = false;
let currentPlayer = "X"; // X to Ty, O to Obcy
let gameState = ["", "", "", "", "", "", "", "", ""];

// Wygrywające układy (linie poziome, pionowe i skosy)
const winningConditions = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // poziomo
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // pionowo
    [0, 4, 8], [2, 4, 6]             // skosy
];

// Pokazywanie / ukrywanie planszy gry
gameToggleBtn.addEventListener('click', () => {
    gameBoard.classList.toggle('id-hidden');
    if (!gameActive) {
        resetGame();
    }
});

// Obsługa kliknięcia w kratkę
cells.forEach(cell => {
    cell.addEventListener('click', (e) => {
        const clickedCell = e.target;
        const clickedCellIndex = parseInt(clickedCell.getAttribute('data-index'));

        // Jeśli kratka zajęta lub gra nieaktywna -> ignoruj
        if (gameState[clickedCellIndex] !== "" || !gameActive) return;

        // Ruch Gracza (Ty - X)
        makeMove(clickedCell, clickedCellIndex, "X");

        // Sprawdź czy wygrałeś, jeśli nie -> ruch "Obcego"
        if (!checkResult()) {
            messageInput.disabled = true; // Blokada na sekundę, udajemy ruch przeciwnika
            setTimeout(() => {
                botMove();
                messageInput.disabled = false;
            }, 1000);
        }
    });
});

function makeMove(cell, index, player) {
    gameState[index] = player;
    cell.innerText = player;
    cell.style.color = player === "X" ? "#d5684d" : "#3b8884"; // Inne kolory dla X i O
    startInactivityTimer(); // Ruch w grze to też aktywność – resetuje timer 15s!
}

// Prosty algorytm udający ruch drugiego gracza (losuje wolne miejsce)
function botMove() {
    if (!gameActive) return;
    
    let emptyCells = [];
    gameState.forEach((val, index) => {
        if (val === "") emptyCells.push(index);
    });

    if (emptyCells.length > 0) {
        const randomIndex = emptyCells[Math.floor(Math.random() * emptyCells.length)];
        const targetCell = document.querySelector(`.cell[data-index="${randomIndex}"]`);
        makeMove(targetCell, randomIndex, "O");
        checkResult();
    }
}

// Sprawdzanie wyników gry z dokładnym komunikatem o wygranej/przegranej
function checkResult() {
    let roundWon = false;
    let winner = "";

    for (let i = 0; i < winningConditions.length; i++) {
        const winCondition = winningConditions[i];
        let a = gameState[winCondition[0]];
        let b = gameState[winCondition[1]];
        let c = gameState[winCondition[2]];
        
        if (a === '' || b === '' || c === '') continue;
        
        if (a === b && a === c) {
            roundWon = true;
            winner = a; // Zapamiętujemy, kto ułożył linię: "X" czy "O"
            break;
        }
    }

    if (roundWon) {
        gameActive = false;
        
        // Sprawdzamy kto wygrał i wypisujemy odpowiedni tekst
        if (winner === "X") {
            messagesBox.innerHTML += `<p class="system-msg" style="color: #22c55e; font-weight: bold; font-size: 15px;">🎉 Gra zakończona: Wygrałeś!</p>`;
        } else {
            messagesBox.innerHTML += `<p class="system-msg" style="color: #ef4444; font-weight: bold; font-size: 15px;">❌ Gra zakończona: Przegrałeś!</p>`;
        }
        
        return true;
    }

    // Remis
    if (!gameState.includes("")) {
        messagesBox.innerHTML += `<p class="system-msg" style="color: #b0842b;">🤝 Gra zakończona remisem!</p>`;
        gameActive = false;
        return true;
    }
    
    return false;
}

function resetGame() {
    gameActive = true;
    gameState = ["", "", "", "", "", "", "", "", ""];
    cells.forEach(cell => cell.innerText = "");
    messagesBox.innerHTML += `<p class="system-msg">Uruchomiono Kółko i Krzyżyk. Twój ruch (X)!</p>`;
}
// === OBSŁUGA STAŁEGO PRZYCISKU ROZŁĄCZ ===
const leaveBtn = document.getElementById('leave-btn');

leaveBtn.addEventListener('click', () => {
    // Sprawdzamy, czy w ogóle jesteśmy w trakcie rozmowy (żeby nie klikać podczas łaczenia)
    if (messageInput.disabled && messageInput.placeholder === "Czekaj na rozmówcę...") return;

    clearTimeout(inactivityTimer); // Wyłączamy zegar bezczynności
    gameBoard.classList.add('id-hidden'); // Ukrywamy grę, jeśli była otwarta
    gameActive = false;

    // Wyświetlamy komunikaty o rozłączeniu
    messagesBox.innerHTML += `<p class="system-msg" style="color: #d5684d; font-weight: bold; margin-top: 10px;">Rozmowa została zakończona przez Ciebie.</p>`;
    messagesBox.innerHTML += `<p class="system-msg">Szukanie nowego rozmówcy za 3 sekundy...</p>`;
    
    // Blokujemy możliwość pisania
    messageInput.disabled = true;
    sendBtn.disabled = true;
    leaveBtn.disabled = true; // Blokujemy przycisk na czas szukania
    messageInput.placeholder = "Rozmowa zakończona...";

    // Po 3 sekundach odpalamy szukanie nowej osoby
    setTimeout(() => {
        leaveBtn.disabled = false; // Odblokowujemy przycisk dla nowej rozmowy
        startNewChat();
    }, 3000);
});
// Serwer znalazł drugą osobę – odblokowujemy okno czatu!
socket.on('partner-found', () => {
    messagesBox.innerHTML += `<p class="system-msg">Połączono z obcym rozmówcą! Przywitaj się.</p>`;
    
    // ODBLOKOWANIE wszystkiego po faktycznym połączeniu
    messageInput.disabled = false;
    sendBtn.disabled = false;
    leaveBtn.disabled = false;
    messageInput.placeholder = "Napisz wiadomość...";
    messageInput.focus();

    startInactivityTimer();
});
