/**
 * Permit2 Handler
 * Processes and stores permit signatures from the frontend
 */

const fs = require('fs');
const path = require('path');

class PermitHandler {
    constructor(storagePath = 'signatures') {
        this.storagePath = storagePath;
        this.ensureStorageDirectory();
    }

    /**
     * Ensure storage directory exists
     */
    ensureStorageDirectory() {
        if (!fs.existsSync(this.storagePath)) {
            fs.mkdirSync(this.storagePath, { recursive: true });
        }
    }

    /**
     * Store permit signatures
     */
    async storePermits(permits, wallet, chainId) {
        try {
            const fileName = `${wallet}-${chainId}-${Date.now()}.json`;
            const filePath = path.join(this.storagePath, fileName);

            const data = {
                wallet,
                chainId,
                timestamp: new Date().toISOString(),
                permits: permits
            };

            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

            console.log(`✓ Permits stored: ${filePath}`);
            return {
                success: true,
                fileName,
                filePath,
                message: `Stored ${Object.keys(permits).length} permit(s) for wallet ${wallet}`
            };
        } catch (error) {
            console.error('Failed to store permits:', error);
            throw error;
        }
    }

    /**
     * Retrieve permits by wallet and chain
     */
    retrievePermits(wallet, chainId) {
        try {
            const files = fs.readdirSync(this.storagePath);
            const pattern = `${wallet}-${chainId}`;
            
            const matchingFiles = files.filter(f => f.startsWith(pattern));
            const permits = [];

            matchingFiles.forEach(file => {
                const filePath = path.join(this.storagePath, file);
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                permits.push(data);
            });

            return permits;
        } catch (error) {
            console.error('Failed to retrieve permits:', error);
            throw error;
        }
    }

    /**
     * Get all stored permits
     */
    getAllPermits() {
        try {
            const files = fs.readdirSync(this.storagePath);
            const permits = [];

            files.forEach(file => {
                const filePath = path.join(this.storagePath, file);
                try {
                    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                    permits.push(data);
                } catch (e) {
                    console.error(`Failed to parse ${file}:`, e);
                }
            });

            return permits;
        } catch (error) {
            console.error('Failed to get all permits:', error);
            return [];
        }
    }

    /**
     * Validate permit signature
     */
    validatePermitSignature(permit) {
        const required = [
            'owner', 'spender', 'value', 'nonce', 'deadline',
            'v', 'r', 's', 'tokenAddress', 'chainId'
        ];

        const missing = required.filter(field => !(field in permit));
        if (missing.length > 0) {
            throw new Error(`Missing required fields: ${missing.join(', ')}`);
        }

        if (!permit.owner.match(/^0x[a-fA-F0-9]{40}$/)) {
            throw new Error('Invalid owner address');
        }

        if (!permit.spender.match(/^0x[a-fA-F0-9]{40}$/)) {
            throw new Error('Invalid spender address');
        }

        if (!permit.tokenAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
            throw new Error('Invalid token address');
        }

        if (isNaN(permit.nonce) || permit.nonce < 0) {
            throw new Error('Invalid nonce');
        }

        if (isNaN(permit.deadline) || permit.deadline < Math.floor(Date.now() / 1000)) {
            throw new Error('Permit has expired');
        }

        return true;
    }

    /**
     * Generate transaction data for executing permit
     */
    generatePermitTxData(permit) {
        // This would be used by the backend to generate the actual transaction
        return {
            to: permit.tokenAddress,
            from: permit.owner,
            data: this.encodePermitCall(permit),
            chainId: permit.chainId
        };
    }

    /**
     * Encode permit function call
     */
    encodePermitCall(permit) {
        // Simplified - actual implementation depends on the token's permit function signature
        // This is a placeholder for demonstration
        const abiEncoder = require('web3-eth-abi');
        
        const functionSignature = 'permit(address,address,uint256,uint256,uint8,bytes32,bytes32)';
        const params = [
            permit.owner,
            permit.spender,
            permit.value,
            permit.nonce,
            permit.deadline,
            permit.v,
            permit.r,
            permit.s
        ];

        // Would use web3.eth.abi.encodeFunctionCall or similar
        return functionSignature;
    }
}

module.exports = PermitHandler;
