# Testing Guide - Permit2 Wallet Sender

Complete testing guide with examples and expected outputs.

## Testing Environments

### Testnet (Recommended for Testing)
- **Sepolia ETH**: https://sepoliafaucet.com/
- **Test Tokens**: Deploy your own using OpenZeppelin
- **Chain ID**: 11155111
- **No real money involved**

### Mainnet (After Testing Complete)
- **Production**: Use real tokens on Ethereum, Polygon, etc.
- **Real money**: Be careful!
- **Chain ID**: 1 (Ethereum), 137 (Polygon), etc.

## Full Testing Workflow

### Phase 1: Local Setup Testing

#### Test 1.1: Server Starts
```bash
npm start
```

**Expected output:**
```
[DEBUG] Listening on localhost:3000
```

**Verify:**
```bash
curl http://localhost:3000
# Should return HTML index page
```

---

#### Test 1.2: Frontend Loads
```
Open: http://localhost:3000/permit
```

**Expected:**
- ✅ Beautiful UI loads
- ✅ "Connect Wallet" button visible
- ✅ Console shows no errors (F12 → Console)
- ✅ Logs section visible

---

### Phase 2: Wallet Connection Testing

#### Test 2.1: MetaMask Connection

**Setup:**
1. Install MetaMask extension
2. Switch to Sepolia testnet
3. Get test ETH from faucet

**Test:**
1. Click "Connect Wallet"
2. Approve MetaMask popup

**Expected:**
- ✅ Wallet status shows your address
- ✅ Console shows: `✓ Connected to wallet: 0x...`
- ✅ Chain section appears
- ✅ Permit configuration section appears

---

#### Test 2.2: Wrong Network
1. Switch MetaMask to wrong network (e.g., Mainnet)
2. Try to connect

**Expected:**
- ✅ Shows correct chain ID mismatch error
- ✅ Can select different chain in UI
- ✅ Reconnect after switching

---

### Phase 3: Nonce Fetching Testing

#### Test 3.1: Nonce Retrieval
1. Connected to wallet
2. Enter token address: `0x1f9840a85d5af5bf1d1762f925bdaddc4201f984` (UNI on Mainnet)
3. Switch to Ethereum network
4. Click "Create Permit Signature"

**Expected Console Output:**
```
✓ Fetched nonce for 0x1f9840a85d5af5bf1d1762f925bdaddc4201f984: 0
```

**NOT:**
```
Random nonce: 882908  ❌
```

---

#### Test 3.2: Different Token Nonces
1. Test with USDC: `0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48`
2. Then with USDT: `0xdac17f958d2ee523a2206206994597c13d831ec7`

**Expected:**
- ✅ Each token shows its own nonce (usually 0 for first time)
- ✅ No errors in console
- ✅ Different tokens = different nonce counters

---

### Phase 4: Signature Creation Testing

#### Test 4.1: Create Signature
1. Connected wallet
2. Token: UNI
3. Spender: Permit2 contract
4. Amount: 1000000000000000000 (1 UNI)
5. Click "Create Permit Signature"

**Expected:**
- ✅ MetaMask popup appears
- ✅ Shows "Sign with your account"
- ✅ After approval: console shows signature details
- ✅ Signature appears below

---

#### Test 4.2: Signature Format Validation

```bash
cat signatures/wallet-1-*.json
```

**Expected JSON structure:**
```json
{
  "permits": {
    "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984": {
      "owner": "0x...",           // ✅ Your wallet
      "spender": "0x000000...",   // ✅ Permit2
      "value": "1000000...",      // ✅ Amount
      "nonce": 0,                 // ✅ From contract
      "deadline": 1234567890,     // ✅ Unix timestamp
      "v": 27,                    // ✅ Recovery ID
      "r": "0xABC123...",         // ✅ Signature part
      "s": "0xDEF456...",         // ✅ Signature part
      "signature": "0x..."        // ✅ Full signature
    }
  }
}
```

---

#### Test 4.3: Multiple Signatures
1. Create signature for UNI
2. Create signature for USDC
3. Create signature for DAI

**Expected:**
```json
{
  "permits": {
    "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984": {...},
    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": {...},
    "0x6b175474e89094c44da98b954eedeac495271d0f": {...}
  }
}
```

---

### Phase 5: Backend API Testing

#### Test 5.1: Submit Permits

```bash
curl -X POST http://localhost:3000/api/permits/submit \
  -H "Content-Type: application/json" \
  -d '{
    "permits": {...},
    "wallet": "0x...",
    "chainId": 1
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Stored 1 permit(s) for wallet 0x...",
  "fileName": "0x...-1-1234567890.json",
  "permitCount": 1,
  "timestamp": "2024-01-15T..."
}
```

---

#### Test 5.2: Get All Permits

```bash
curl http://localhost:3000/api/permits
```

**Expected:**
```json
{
  "success": true,
  "count": 3,
  "permits": [...]
}
```

---

#### Test 5.3: Get Specific Wallet Permits

```bash
curl "http://localhost:3000/api/permits/0xWallet/1"
```

**Expected:**
```json
{
  "success": true,
  "wallet": "0xWallet",
  "chainId": 1,
  "count": 3,
  "permits": [...]
}
```

---

#### Test 5.4: Validate Permit

```bash
curl -X POST http://localhost:3000/api/permits/validate \
  -H "Content-Type: application/json" \
  -d '{"permit": {...}}'
```

**Expected:**
```json
{
  "success": true,
  "message": "Permit signature is valid",
  "nonce": 0,
  "deadline": 1234567890,
  "expires_in_seconds": 3599
}
```

---

### Phase 6: Python Sender Testing

#### Test 6.1: Install Python Dependencies

```bash
pip install web3>=6.0.0 eth-account>=0.9.0
```

**Verify:**
```bash
python -c "from web3 import Web3; print('Web3 installed OK')"
```

---

#### Test 6.2: Dry Run (No Execution)

```bash
python scripts/sender.py \
  --rpc "https://eth.rpc.blxrbdn.com" \
  --file "signatures/wallet-1-timestamp.json"
```

**Expected Output:**
```
✓ Loaded permits from signatures/wallet-1-timestamp.json
  Wallet: 0x...
  Chain ID: 1
  Permits: 1
============================================================
Processing permit for Uniswap
============================================================
✓ Permit validation passed
✓ Current nonce for 0x...: 0
⏭  Skipping execution (dry-run mode)

============================================================
SUMMARY
============================================================
✓ Successful: 1
✗ Failed: 0
⏭  Skipped: 1
```

---

#### Test 6.3: Execution on Testnet

**Setup:**
1. Deploy ERC20Permit token on Sepolia
2. Transfer some to your test wallet
3. Create permit signature for it
4. Store in JSON file

**Execute:**
```bash
python scripts/sender.py \
  --rpc "https://sepolia.drpc.org" \
  --file "signatures/wallet-11155111-timestamp.json" \
  --key "0xYourTestPrivateKey" \
  --execute
```

**Expected:**
```
✓ Transaction sent: 0xABC123DEF456...
✓ Permit executed successfully!
   Transaction hash: 0xABC123DEF456...
   Block number: 5234567

============================================================
SUMMARY
============================================================
✓ Successful: 1
✗ Failed: 0
⏭  Skipped: 0
```

---

#### Test 6.4: Verify Nonce Increment

```python
# Before execution: nonce = 0
# After execution: nonce = 1
```

**Check with Python:**
```bash
python -c "
from web3 import Web3
w3 = Web3(Web3.HTTPProvider('https://sepolia.drpc.org'))
abi = [{'name': 'nonces', 'inputs': [{'type': 'address'}], 'outputs': [{'type': 'uint256'}]}]
token = w3.eth.contract(address='0x...', abi=abi)
nonce = token.functions.nonces('0xYourWallet').call()
print(f'New nonce after execution: {nonce}')
"
```

---

### Phase 7: Error Testing

#### Test 7.1: Invalid Address
```bash
# Submit with invalid wallet address
curl -X POST http://localhost:3000/api/permits/submit \
  -H "Content-Type: application/json" \
  -d '{
    "permits": {...},
    "wallet": "invalid",
    "chainId": 1
  }'
```

**Expected:**
```json
{
  "success": false,
  "error": "Invalid wallet address format"
}
```

---

#### Test 7.2: Expired Permit
```
Create permit with deadline in the past
Try to execute
```

**Expected:**
```
✗ Error processing permit: Permit expired
```

---

#### Test 7.3: Nonce Mismatch
```
Manually change nonce in JSON to wrong value
Try to execute
```

**Expected:**
```
⚠ NONCE MISMATCH!
  Contract nonce: 1
  Signature nonce: 0
✗ Nonce mismatch: contract=1, signature=0
```

---

### Phase 8: Integration Testing

#### Test 8.1: Full Flow

1. ✅ Connect wallet
2. ✅ Create signature
3. ✅ Submit to backend
4. ✅ Verify stored
5. ✅ Run Python sender
6. ✅ Check transaction on blockchain

---

## Performance Testing

### Load Testing

```bash
# Create 100 permits
for i in {1..100}; do
  curl -X POST http://localhost:3000/api/permits/submit \
    -H "Content-Type: application/json" \
    -d '{"permits": {...}, "wallet": "0x...", "chainId": 1}'
done

# Check retrieval speed
time curl http://localhost:3000/api/permits
```

**Expected:**
- ✅ Submission: < 100ms each
- ✅ Retrieval: < 500ms

---

## Checklist for Production

- [ ] Tested on testnet successfully
- [ ] All error cases handled
- [ ] No console errors
- [ ] Gas prices reasonable
- [ ] RPC endpoints stable
- [ ] Backup of signatures
- [ ] Monitoring in place
- [ ] Tested with real tokens
- [ ] Tested with multiple users
- [ ] Rate limiting configured

---

## Test Data

### Mainnet Tokens with Permit Support
- UNI: `0x1f9840a85d5af5bf1d1762f925bdaddc4201f984`
- USDC: `0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48`
- DAI: `0x6b175474e89094c44da98b954eedeac495271d0f`

### Testnet Setup
```bash
# Deploy test token with permit on Sepolia
# Use: https://remix.ethereum.org/
# Template: OpenZeppelin ERC20Permit
```

---

## Debugging Commands

```bash
# Check signatures exist
ls -la signatures/

# View latest signature
cat signatures/$(ls -t signatures/ | head -1)

# Check server logs
npm start 2>&1 | grep -i permit

# Validate JSON
python -m json.tool signatures/wallet-1-*.json

# Check Python installation
python --version
pip list | grep -i web3
```

---

## Common Issues During Testing

| Issue | Solution |
|-------|----------|
| "Wallet not found" | Install MetaMask |
| "RPC endpoint unreachable" | Try different RPC |
| "Not connected to network" | Check internet connection |
| "Permission denied on signature" | Approve in MetaMask |
| "Gas too low" | Increase gas limit |
| "Token not found" | Verify token address correct |

---

Done! You should now have a fully tested Permit2 system.
