# Permit2 Wallet Sender - Quick Start

## 5-Minute Setup

### Step 1: Start Server
```bash
npm start
# Server runs on http://localhost:3000
```

### Step 2: Open Frontend
Open in browser:
```
http://localhost:3000/permit
```

### Step 3: Create Signature
1. Click "Connect Wallet" (MetaMask will popup)
2. Select blockchain (e.g., Ethereum)
3. Click "Create Permit Signature"
4. Approve signature in MetaMask
5. Download or submit signatures

### Step 4 (Optional): Execute on-chain

Install Python dependencies:
```bash
pip install web3>=6.0.0 eth-account>=0.9.0
```

Execute permits:
```bash
python scripts/sender.py \
  --rpc "https://eth-rpc.gateway.pokt.network" \
  --file "signatures/wallet-chainid-timestamp.json" \
  --key "your-private-key-here" \
  --execute
```

## What Gets Created?

**Signature File** (`signatures/wallet-1-1234567890.json`):
```json
{
  "wallet": "0x...",
  "chainId": 1,
  "timestamp": "2024-01-15T10:30:00Z",
  "permits": {
    "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984": {
      "owner": "0x...",
      "spender": "0x000000000022D473030F116dFC393fb8C563d921",
      "value": "1000000000000000000",
      "nonce": 0,
      "deadline": 1705324200,
      "v": 27,
      "r": "0x...",
      "s": "0x...",
      "signature": "0x...",
      "tokenAddress": "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984",
      "tokenName": "Uniswap",
      "chainId": 1,
      "timestamp": "2024-01-15T10:30:00Z"
    }
  }
}
```

## Verify It Works

**1. Check signatures were stored:**
```bash
ls signatures/
```

**2. View signature details:**
```bash
cat signatures/wallet-1-*.json
```

**3. Test execution (dry-run):**
```bash
python scripts/sender.py \
  --rpc "https://eth-rpc.gateway.pokt.network" \
  --file "signatures/wallet-1-*.json"
# Shows nonce and validation, doesn't execute
```

## Key Points

✅ Nonce is automatically fetched from contract (not random)
✅ Signature includes the correct nonce  
✅ Backend validates before storing
✅ Python executor verifies nonce before executing
✅ Detailed error messages for debugging

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Wallet not found" | Install MetaMask or compatible wallet |
| "Connection failed" | Check RPC endpoint is accessible |
| "Nonce mismatch" | Try creating new signature |
| "Gas estimation failed" | Token might not support permit |

## Next Steps

- Add more tokens in `permit-config.json`
- Add more blockchains
- Integrate with your app
- See `README_PERMITS.md` for full documentation
