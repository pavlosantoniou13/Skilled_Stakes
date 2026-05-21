# Permit2 Nonce Mismatch - Complete Guide

## The Problem You Had

You experienced a classic Permit2 issue where:
- **Signature nonce**: 882908 (random/incorrect)
- **Contract nonce**: 0 (actual current nonce)
- **Result**: Transaction reverted with "execution failed"

This document explains how the new system fixes this and how to verify it works.

## How This System Fixes It

### Before (Broken)
```javascript
// OLD WAY - WRONG!
const randomNonce = Math.floor(Math.random() * 1000000);
const signature = await signPermit(nonce: randomNonce); // ❌ Uses random nonce
```

### After (Fixed)
```javascript
// NEW WAY - CORRECT!
const actualNonce = await contract.methods.nonces(userAddress).call();
const signature = await signPermit(nonce: actualNonce); // ✅ Uses actual nonce
```

## What The New Code Does

### Step 1: Fetch Actual Nonce
When you click "Create Permit Signature", the system:

```javascript
async fetchTokenNonce(tokenAddress) {
    const contract = new this.web3.eth.Contract(ERC20_ABI, tokenAddress);
    const nonce = await contract.methods.nonces(this.userAccount).call();
    console.log(`✓ Fetched nonce for ${tokenAddress}: ${nonce}`);
    return parseInt(nonce);
}
```

**What you'll see in console:**
```
✓ Fetched nonce for 0x1f9840a85d5af5bf1d1762f925bdaddc4201f984: 0
```

### Step 2: Include in Signature
The nonce is included in the EIP-712 message:

```javascript
const message = {
    owner: userAddress,
    spender: spenderAddress,
    value: amount,
    nonce: actualNonce,  // ✅ Uses fetched nonce, not random
    deadline: deadline
};
```

### Step 3: Store in Backend
The signature is stored with the correct nonce:

```json
{
  "nonce": 0,  // ✅ Matches what's in contract
  "signature": "0x...",
  "v": 27,
  "r": "0x...",
  "s": "0x..."
}
```

### Step 4: Verify Before Execution
The Python sender verifies nonce matches:

```python
current_nonce = self.get_current_nonce(token_address, permit['owner'])
if current_nonce != permit['nonce']:
    raise ValueError(
        f"Nonce mismatch: contract={current_nonce}, signature={permit['nonce']}"
    )
```

## Verification Steps

### 1. Check Frontend Console

**Look for this log when creating signature:**
```
✓ Fetched nonce for 0x1f9840a85d5af5bf1d1762f925bdaddc4201f984: 0
```

**Not this (old broken way):**
```
Random nonce: 882908 ❌
```

### 2. Check Stored Signature

**Backend file format:**
```bash
cat signatures/wallet-1-timestamp.json
```

**Should show correct nonce:**
```json
{
  "permits": {
    "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984": {
      "nonce": 0,  // ✅ Matches contract
      ...
    }
  }
}
```

### 3. Verify Before Execution

**Run Python sender in dry-run mode:**
```bash
python scripts/sender.py \
  --rpc "https://eth-rpc.gateway.pokt.network" \
  --file "signatures/wallet-1-timestamp.json"
```

**Should show:**
```
✓ Current nonce for 0xWallet: 0
✓ Nonce validation passed
```

**NOT:**
```
✗ Nonce mismatch!
  Contract nonce: 0
  Signature nonce: 882908
```

### 4. Execute Transaction

With nonce verified, execution should succeed:

```bash
python scripts/sender.py \
  --rpc "https://eth-rpc.gateway.pokt.network" \
  --file "signatures/wallet-1-timestamp.json" \
  --key "your-private-key" \
  --execute
```

**Success output:**
```
✓ Transaction sent: 0xABC123...
✓ Permit executed successfully!
```

## How Nonces Work

### Understanding Nonce

Each token maintains a nonce counter per user for permit signatures:

```solidity
// In ERC20Permit contract
mapping(address => uint256) public nonces;

function permit(
    address owner,
    address spender,
    uint256 value,
    uint256 nonce,
    uint8 v,
    bytes32 r,
    bytes32 s,
    uint256 deadline
) external {
    // Verify nonce matches current
    require(nonce == nonces[owner]);
    
    // ... execute permit ...
    
    // Increment nonce
    nonces[owner]++;
}
```

### Nonce Behavior

| Action | Contract Nonce | Notes |
|--------|-----------------|-------|
| Token deployed | 0 | First user has nonce 0 |
| First permit executed | 1 | Nonce increments after use |
| Second permit executed | 2 | Each use increments |
| Permit rejected (nonce mismatch) | 2 | Nonce doesn't change |

### Key Rules

✅ **Signature must use current nonce**
- If current nonce is 0, signature must use 0
- If current nonce is 5, signature must use 5

❌ **Using old/random nonce will fail**
- Old signature: nonce=0, current=1 → FAIL
- Random: nonce=999, current=0 → FAIL

## Common Scenarios

### Scenario 1: Fresh Wallet (First Time)
```
Current nonce in contract: 0
Create signature with: 0 ✅
Execute: Success ✅
Nonce becomes: 1
```

### Scenario 2: Multiple Signatures

**Issue:** What if user creates 2 signatures without executing?

```
Current nonce: 0
Create signature #1 with nonce: 0 ✅
Create signature #2 with nonce: 0 ✅
Execute signature #1: Success (nonce becomes 1)
Execute signature #2: FAIL (nonce is 1, not 0) ❌
```

**Solution:** Each signature must be executed in order, or recreated with new nonce

### Scenario 3: Stale Signature

**Issue:** Signature created days ago

```
Created signature with nonce: 5
User didn't execute
Other transactions happened: nonce becomes 7
Try to execute old signature: FAIL ❌
```

**Solution:** Create new signature (fetches current nonce automatically)

## Debugging Nonce Issues

### Problem: Still Getting Nonce Mismatch

**Check 1: Is contract nonce what you expect?**
```bash
# Use Python to check
python -c "
from web3 import Web3
w3 = Web3(Web3.HTTPProvider('https://eth-rpc.gateway.pokt.network'))
contract_abi = '[{\"name\": \"nonces\", \"inputs\": [{\"name\": \"_owner\", \"type\": \"address\"}], \"outputs\": [{\"type\": \"uint256\"}]}]'
contract = w3.eth.contract(address='0x1f9840a85d5af5bf1d1762f925bdaddc4201f984', abi=contract_abi)
nonce = contract.functions.nonces('0xYourWallet').call()
print(f'Contract nonce: {nonce}')
"
```

**Check 2: Does your signature match?**
```bash
# Parse your JSON file
cat signatures/wallet-1-timestamp.json | grep '"nonce"'
# Should match contract nonce above
```

**Check 3: Is RPC endpoint in sync?**
Different RPC providers might have different state (rare but possible)
- Try different RPC
- Wait for block finality
- Check on Etherscan

### Problem: Signature Created But Not Used?

If you create signature but don't execute for a while:
1. **Delete** the old signature JSON file
2. **Create a new one** - it will fetch current nonce
3. **Execute immediately**

### Problem: Multiple Nonces Showing?

If you have multiple signatures from the same wallet:
```json
{
  "permits": {
    "TOKEN1": {"nonce": 0, ...},  // ✅ Use first
    "TOKEN2": {"nonce": 0, ...},  // ✅ Use second
    "TOKEN3": {"nonce": 0, ...}   // ✅ Use third
  }
}
```

✅ **Different tokens** = different nonce counters = all can use 0
❌ **Same token** = shared nonce counter = need sequence: 0, 1, 2, ...

## Testing Locally

### Use Testnet for Full Testing

```bash
# 1. Get testnet ETH
# Visit: https://sepoliafaucet.com/

# 2. Get test token with permit
# Deploy: https://remix.ethereum.org/
# Use OpenZeppelin ERC20Permit template

# 3. Create signature with test token
# Frontend automatically fetches correct nonce

# 4. Execute in Python
python scripts/sender.py \
  --rpc "https://sepolia.drpc.org" \
  --file "signatures/wallet-11155111-timestamp.json" \
  --key "test-private-key" \
  --execute
```

## Best Practices

✅ **Always fetch nonce before signing** (This system does this!)
✅ **Sign with current nonce** (This system does this!)
✅ **Execute in order** if multiple signatures
✅ **Create fresh signature if delayed** 
✅ **Use testnet to verify first**
✅ **Monitor nonce in logs**

❌ **Don't hardcode nonces**
❌ **Don't reuse old signatures**
❌ **Don't skip nonce validation**
❌ **Don't sign multiple with same nonce expecting parallel execution**

## Summary

The new Permit2 system **completely solves the nonce mismatch problem** by:

1. ✅ Fetching actual nonce from contract
2. ✅ Including it in signature
3. ✅ Storing with correct nonce
4. ✅ Verifying before execution
5. ✅ Clear error messages

**You should never see "nonce mismatch" again!**

If you do, something went wrong with the flow above. Check the verification steps to find where the issue is.
