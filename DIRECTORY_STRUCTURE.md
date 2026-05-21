# Directory Structure - Permit2 System

```
Skilled_Stakes/
│
├── SYSTEM_CREATED.md ............................ Overview of everything created
├── PERMITS_QUICKSTART.md ........................ 5-minute getting started guide
├── README_PERMITS.md ........................... Full system documentation
├── NONCE_MISMATCH_FIX.md ....................... Detailed nonce issue explanation
├── PERMITS_INTEGRATION.md ....................... How to integrate with your app
├── TESTING_GUIDE.md ............................ Complete testing instructions
│
├── permit-config.json .......................... Multi-chain configuration
├── sample-permits.json ......................... Example permit signature format
├── .env.permit.example ......................... Environment variables template
├── requirements-permit.txt ..................... Python dependencies
│
├── src/
│   ├── client/
│   │   ├── permit.html ......................... FRONTEND - Beautiful UI for signatures
│   │   │                                       • Connect wallet (MetaMask)
│   │   │                                       • Select blockchain
│   │   │                                       • Fetch nonce from contract
│   │   │                                       • Create EIP-712 signature
│   │   │                                       • Display collected signatures
│   │   │                                       • Submit to backend
│   │   │
│   │   └── wallet-sender.js ................... Frontend JavaScript class
│   │                                        • WalletSender class
│   │                                        • Wallet connection
│   │                                        • Nonce fetching (FIXES THE ISSUE!)
│   │                                        • EIP-712 signing
│   │                                        • Signature management
│   │
│   └── server/
│       │
│       ├── server.js .......................... Express server (MODIFIED)
│       │                                       • Added permit routes
│       │                                       • Added /permit endpoint
│       │                                       • Express middleware setup
│       │
│       ├── permit-handler.js ................. Permit signature storage
│       │                                       • Store permits in JSON
│       │                                       • Retrieve permits by wallet/chain
│       │                                       • Validate signatures
│       │                                       • Generate transaction data
│       │
│       └── routes/
│           └── permit-routes.js .............. REST API endpoints
│                                               • POST /api/permits/submit
│                                               • GET /api/permits
│                                               • GET /api/permits/:wallet/:chainId
│                                               • POST /api/permits/validate
│                                               • POST /api/permits/execute
│
├── scripts/
│   └── sender.py ............................. Python executor script
│                                               • Load permits from JSON
│                                               • Fetch actual nonce from contract
│                                               • Verify nonce matches signature
│                                               • Execute permit transaction
│                                               • Support permit-only or permit+transfer
│                                               • Clear error reporting
│
├── signatures/ ............................... Auto-created directory
│   └── wallet-{chainId}-{timestamp}.json .... Stored permit signatures
│       (Created when permits are submitted)
│
└── [Rest of your existing structure...]
    ├── app.json
    ├── package.json (already has dependencies)
    ├── config.js
    ├── webpack.config.json
    ├── Dockerfile
    ├── docker-compose.yml
    ├── bin/
    ├── test/
    └── ... (your existing files)
```

## File Descriptions

### Documentation Files (Read These First!)

| File | Purpose | Audience |
|------|---------|----------|
| `SYSTEM_CREATED.md` | Overview of everything | Everyone |
| `PERMITS_QUICKSTART.md` | 5-minute setup | Getting started |
| `README_PERMITS.md` | Complete reference | Reference |
| `NONCE_MISMATCH_FIX.md` | Understanding nonce issue | Technical details |
| `PERMITS_INTEGRATION.md` | Integration with app | Developers |
| `TESTING_GUIDE.md` | Step-by-step testing | QA/Testing |

### Configuration Files

| File | Purpose | Edit? |
|------|---------|-------|
| `permit-config.json` | Networks and tokens | Yes (customize) |
| `sample-permits.json` | Example signature format | Reference only |
| `.env.permit.example` | Environment variables | Yes (copy to .env) |
| `requirements-permit.txt` | Python dependencies | No (reference) |

### Frontend (Browser-based UI)

| File | Purpose | Code Size |
|------|---------|-----------|
| `src/client/permit.html` | Complete UI (HTML + CSS + JS) | ~500 lines |
| `src/client/wallet-sender.js` | JavaScript class for logic | ~250 lines |

**Features:**
- ✅ Multi-chain support (Ethereum, Polygon, Avalanche, BSC)
- ✅ Beautiful responsive design
- ✅ Automatic nonce fetching (FIXES THE BUG!)
- ✅ Signature display and export
- ✅ Debug logs viewer
- ✅ MetaMask integration

### Backend (Node.js/Express)

| File | Purpose | Code Size |
|------|---------|-----------|
| `src/server/server.js` | Express server (modified) | +15 lines added |
| `src/server/permit-handler.js` | Signature handling | ~200 lines |
| `src/server/routes/permit-routes.js` | REST API | ~150 lines |

**Features:**
- ✅ REST API endpoints
- ✅ Signature validation
- ✅ File-based storage (easy to integrate)
- ✅ Comprehensive error handling
- ✅ CORS enabled

### Python Executor

| File | Purpose | Code Size |
|------|---------|-----------|
| `scripts/sender.py` | Execute permits on-chain | ~500 lines |

**Features:**
- ✅ Load permits from JSON
- ✅ Verify nonce before execution
- ✅ Gas estimation
- ✅ Transaction monitoring
- ✅ Batch processing
- ✅ Dry-run mode

---

## What's Connected to What?

```
permit.html (Frontend UI)
    ↓ Uses
wallet-sender.js (Frontend Class)
    ↓ Fetches nonce from
Token Contract (Blockchain)
    ↓ Sends signature to
permit-routes.js (Backend API)
    ↓ Stores in
signatures/ directory
    ↓ Read by
sender.py (Python Executor)
    ↓ Executes on
Blockchain
```

---

## How to Find Things

**I want to...**

- **Connect my game**: See `PERMITS_INTEGRATION.md`
- **Add a new blockchain**: Edit `permit-config.json`
- **Add a new token**: Edit `permit-config.json`  
- **Fix nonce issues**: See `NONCE_MISMATCH_FIX.md`
- **Execute permits**: Use `scripts/sender.py`
- **Test everything**: Follow `TESTING_GUIDE.md`
- **Understand the code**: Each file has inline comments
- **See full documentation**: Read `README_PERMITS.md`

---

## Key Numbers

- **Frontend Size**: ~600 lines (HTML + CSS + JS)
- **Backend Size**: ~400 lines (handler + routes)
- **Python Size**: ~500 lines
- **Documentation**: ~5000 lines (very comprehensive!)
- **Total Complexity**: Low (simple, readable code)

---

## Installation Quick Reference

```bash
# 1. Already done - files are created
# No additional npm packages needed (web3.js via CDN in HTML)

# 2. For Python:
pip install -r requirements-permit.txt

# 3. Start:
npm start

# 4. Open:
http://localhost:3000/permit

# 5. Execute (when ready):
python scripts/sender.py --rpc "https://..." --file "signatures/..." --execute
```

---

## File Dependencies

```
permit.html
    → CDN: web3.js
    → CDN: axios (can use fetch)
    → Uses: /api/permits/* endpoints

wallet-sender.js (included in permit.html)
    → Requires: web3.js
    → Calls: Token contract (web3.eth.Contract)

server.js
    → Requires: permit-routes.js
    → Uses: permit-handler.js

permit-handler.js
    → Uses: fs (Node.js built-in)
    → Reads/Writes: signatures/ directory

permit-routes.js
    → Requires: permit-handler.js
    → Uses: Express

sender.py
    → Requires: web3.py, eth_account
    → Reads: signatures/ directory
    → Calls: Blockchain RPC endpoints
```

---

## Important Notes

⚠️ **Don't Delete**
- `signatures/` directory (auto-created, stores permits)
- `permit-config.json` (stores network configurations)

✅ **Safe to Modify**
- All `.md` files (documentation)
- `permit-config.json` (add networks/tokens)
- `.env.permit.example` (copy to .env)

🔒 **Keep Secure**
- Private keys (never in code)
- `.env` file (add to .gitignore)
- Signature files (sensitive data)

---

## All Done! 🎉

Everything has been created and integrated. No additional setup needed!

Start with: [`PERMITS_QUICKSTART.md`](PERMITS_QUICKSTART.md)
