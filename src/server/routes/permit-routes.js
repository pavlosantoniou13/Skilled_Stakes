/**
 * Permit Routes
 * Express routes for handling permit signature submission and retrieval
 */

const express = require('express');
const PermitHandler = require('../permit-handler');

const router = express.Router();
const permitHandler = new PermitHandler(require('path').join(__dirname, '../../signatures'));

/**
 * POST /api/permits/submit
 * Submit permits from frontend
 */
router.post('/submit', async (req, res) => {
    try {
        const { permits, wallet, chainId } = req.body;

        if (!permits || !wallet || !chainId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: permits, wallet, chainId'
            });
        }

        // Validate each permit
        const validationErrors = [];
        Object.entries(permits).forEach(([tokenAddress, permit]) => {
            try {
                permitHandler.validatePermitSignature(permit);
            } catch (error) {
                validationErrors.push({
                    token: tokenAddress,
                    error: error.message
                });
            }
        });

        if (validationErrors.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: validationErrors
            });
        }

        // Store permits
        const result = await permitHandler.storePermits(permits, wallet, chainId);

        res.json({
            success: true,
            message: result.message,
            fileName: result.fileName,
            permitCount: Object.keys(permits).length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error submitting permits:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/permits/:wallet/:chainId
 * Retrieve permits for a specific wallet and chain
 */
router.get('/:wallet/:chainId', (req, res) => {
    try {
        const { wallet, chainId } = req.params;

        if (!wallet.match(/^0x[a-fA-F0-9]{40}$/)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid wallet address format'
            });
        }

        if (isNaN(chainId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid chain ID'
            });
        }

        const permits = permitHandler.retrievePermits(wallet, chainId);

        res.json({
            success: true,
            wallet,
            chainId: parseInt(chainId),
            count: permits.length,
            permits: permits
        });
    } catch (error) {
        console.error('Error retrieving permits:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/permits
 * Get all stored permits
 */
router.get('/', (req, res) => {
    try {
        const permits = permitHandler.getAllPermits();

        res.json({
            success: true,
            count: permits.length,
            permits: permits
        });
    } catch (error) {
        console.error('Error retrieving permits:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/permits/validate
 * Validate a permit signature without storing it
 */
router.post('/validate', (req, res) => {
    try {
        const { permit } = req.body;

        if (!permit) {
            return res.status(400).json({
                success: false,
                error: 'No permit data provided'
            });
        }

        permitHandler.validatePermitSignature(permit);

        res.json({
            success: true,
            message: 'Permit signature is valid',
            nonce: permit.nonce,
            deadline: permit.deadline,
            expires_in_seconds: permit.deadline - Math.floor(Date.now() / 1000)
        });
    } catch (error) {
        console.error('Validation error:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/permits/execute
 * Execute a permit signature on-chain
 * This would typically be called by the backend Python script
 */
router.post('/execute', async (req, res) => {
    try {
        const { permit, txData } = req.body;

        if (!permit) {
            return res.status(400).json({
                success: false,
                error: 'No permit data provided'
            });
        }

        // Validate permit
        permitHandler.validatePermitSignature(permit);

        // Generate transaction data
        const executionData = {
            permit: permit,
            tx: permitHandler.generatePermitTxData(permit),
            timestamp: new Date().toISOString(),
            status: 'pending'
        };

        res.json({
            success: true,
            message: 'Permit ready for execution',
            executionData: executionData
        });
    } catch (error) {
        console.error('Execution error:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
