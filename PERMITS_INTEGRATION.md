# Permit2 Integration Guide

## For Game/App Integration

### Adding Permit Wallet to Your Game UI

#### Option 1: Embedded in Existing Page

Add to your main HTML:
```html
<div id="permit-section">
    <h2>Permit Sender</h2>
    <iframe src="/permit" style="width: 100%; height: 600px; border: none;"></iframe>
</div>
```

#### Option 2: Popup Modal

```javascript
function openPermitModal() {
    const modal = document.createElement('div');
    modal.innerHTML = `
        <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 9999;">
            <div style="background: white; width: 90%; max-width: 700px; height: 90%; border-radius: 10px; overflow: auto;">
                <iframe src="/permit" style="width: 100%; height: 100%; border: none;"></iframe>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    // Close on click outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}

// Usage
document.getElementById('openPermitBtn').addEventListener('click', openPermitModal);
```

#### Option 3: Separate Tab

```html
<a href="/permit" target="_blank" class="btn">Open Permit Sender</a>
```

### Receiving Permit Notifications

```javascript
// Listen for storage changes (cross-tab communication)
window.addEventListener('storage', (e) => {
    if (e.key === 'permitSignatures') {
        const signatures = JSON.parse(e.newValue);
        console.log('New signatures received:', signatures);
        // Update your game/app with signatures
    }
});

// Or use fetch to check backend
async function checkForNewPermits() {
    const response = await fetch('/api/permits');
    const data = await response.json();
    console.log('All permits:', data.permits);
}
```

### Integrating with Your Wallet System

```javascript
// In your wallet connection code
async function connectWalletWithPermits() {
    // Connect to wallet
    const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
    });
    
    const userWallet = accounts[0];
    
    // Check for existing permits from this wallet
    const permits = await fetch(`/api/permits/${userWallet}/1`).then(r => r.json());
    
    if (permits.permits.length > 0) {
        console.log('Found existing permits:', permits.permits);
        // Display option to execute
    }
    
    return userWallet;
}
```

## Connecting to Your Game Balance System

### Receiving Permit Approvals in Your Game

```javascript
// After permit is executed, transfer tokens to game
async function confirmPermitExecution(wallet, tokenAddress, amount) {
    // 1. Verify transaction on blockchain
    const tx = await web3.eth.getTransaction(txHash);
    if (tx) {
        // 2. Update game balance
        const balanceInGame = convertToGameCurrency(amount);
        await updatePlayerBalance(wallet, balanceInGame);
        
        // 3. Notify player
        socket.emit('balanceUpdated', { 
            wallet, 
            newBalance: balanceInGame 
        });
    }
}
```

### Socket.io Integration

In your server.js:

```javascript
io.on('connection', (socket) => {
    // Listen for permit execution events from backend API
    socket.on('permitExecuted', async (data) => {
        const { wallet, amount, txHash } = data;
        
        // Update player balance
        playerBalances[wallet] = (playerBalances[wallet] || 0) + amount;
        
        // Broadcast to all users
        io.emit('playerBalanceUpdated', {
            wallet,
            newBalance: playerBalances[wallet],
            txHash
        });
    });
});
```

## Advanced: Custom Token Support

### Adding New Token to Support

1. **Update permit-config.json:**
```json
{
  "tokens": {
    "ethereum": {
      "AAVE": "0x7Fc66500c84A76Ad7e9c93437E434122A1f9AcDd"
    }
  }
}
```

2. **Verify Token Has Permit Function:**
```bash
# Check Etherscan for token's permit() function in ABI
# If not present, token doesn't support Permit2
```

3. **Test:**
- Use that token address in frontend
- Create signature
- Should work automatically

## Testing & Validation

### Pre-Execution Checklist

```javascript
async function validateBeforeExecution(permitData) {
    // 1. Check nonce
    const currentNonce = await getTokenNonce(
        permitData.tokenAddress, 
        permitData.owner
    );
    if (currentNonce !== permitData.nonce) {
        throw new Error('Nonce mismatch!');
    }
    
    // 2. Check deadline
    const now = Math.floor(Date.now() / 1000);
    if (permitData.deadline < now) {
        throw new Error('Permit expired!');
    }
    
    // 3. Check balance
    const balance = await getTokenBalance(
        permitData.tokenAddress,
        permitData.owner
    );
    if (balance < permitData.value) {
        throw new Error('Insufficient balance!');
    }
    
    return true;
}
```

### Testing on Testnet

1. **Deploy test tokens:**
```bash
# Use OpenZeppelin ERC20 with Permit
# Deploy to Sepolia/Goerli
```

2. **Update config to use testnet:**
```json
{
  "networks": {
    "sepolia": {
      "chainId": 11155111,
      "rpc": "https://sepolia.drpc.org",
      "permit2Address": "0x000000000022D473030F116dFC393fb8C563d921"
    }
  }
}
```

3. **Test permit flow:**
- Create signature on testnet
- Execute with test eth
- Verify transaction

## Security Best Practices

### For Your Application

1. **Validate Permits on Backend:**
```javascript
// Before accepting user's permit
async function acceptUserPermit(permit) {
    try {
        const response = await fetch('/api/permits/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ permit })
        });
        
        const result = await response.json();
        if (!result.success) throw new Error(result.error);
        
        return true;
    } catch (e) {
        console.error('Invalid permit:', e);
        return false;
    }
}
```

2. **Rate Limit Submissions:**
```javascript
const permitSubmissions = new Map();

function canSubmitPermit(wallet) {
    const lastSubmit = permitSubmissions.get(wallet) || 0;
    const now = Date.now();
    
    if (now - lastSubmit < 60000) { // 1 minute cooldown
        return false;
    }
    
    permitSubmissions.set(wallet, now);
    return true;
}
```

3. **Log All Transactions:**
```javascript
async function logPermitActivity(wallet, action, details) {
    console.log(`[PERMIT] ${wallet} - ${action}`, details);
    // Also store in database for audit trail
}
```

## Monitoring & Analytics

### Track Permit Usage

```javascript
async function trackPermitMetrics() {
    const allPermits = await fetch('/api/permits').then(r => r.json());
    
    const metrics = {
        totalPermits: allPermits.count,
        totalValue: 0,
        byChain: {},
        byToken: {}
    };
    
    allPermits.permits.forEach(permit => {
        // Calculate metrics...
    });
    
    console.log('Permit Metrics:', metrics);
}

// Run periodically
setInterval(trackPermitMetrics, 3600000); // Every hour
```

### Alert on Failures

```javascript
async function monitorPermitExecution() {
    // Check for failed permits
    // Send alerts to admin
    // Log to database
}
```

## Troubleshooting Integration

| Issue | Solution |
|-------|----------|
| Permits not showing in game | Check CORS headers in server |
| Balance not updating | Verify backend route is receiving data |
| Nonce errors in production | Use testnet first to verify flow |
| Signatures not stored | Check file permissions in signatures/ |

## Next Steps

1. ✅ Test on testnet thoroughly
2. ✅ Add permit UI to your app
3. ✅ Integrate balance updates
4. ✅ Set up monitoring
5. ✅ Launch on mainnet with small limits
6. ✅ Gradually increase limits as confidence grows

## Support

- Full documentation: See `README_PERMITS.md`
- Quick start: See `PERMITS_QUICKSTART.md`
- Configuration: See `permit-config.json`
- Examples: See `sample-permits.json`
