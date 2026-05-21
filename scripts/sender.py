#!/usr/bin/env python3
"""
Permit2 Multi-Chain Sender
Executes permit signatures on blockchain using web3.py
"""

import json
import os
import sys
import time
import argparse
from pathlib import Path
from typing import Dict, Any, Optional
from datetime import datetime

from web3 import Web3
from web3.exceptions import TransactionFailed
from eth_account.messages import encode_structured_data
from eth_account import Account

# ERC20 ABI with permit function
ERC20_ABI = [
    {
        "constant": False,
        "inputs": [
            {"name": "_spender", "type": "address"},
            {"name": "_value", "type": "uint256"},
            {"name": "_deadline", "type": "uint256"},
            {"name": "v", "type": "uint8"},
            {"name": "r", "type": "bytes32"},
            {"name": "s", "type": "bytes32"}
        ],
        "name": "permit",
        "outputs": [],
        "type": "function"
    },
    {
        "constant": True,
        "inputs": [{"name": "_owner", "type": "address"}],
        "name": "nonces",
        "outputs": [{"name": "", "type": "uint256"}],
        "type": "function"
    },
    {
        "constant": False,
        "inputs": [
            {"name": "_from", "type": "address"},
            {"name": "_to", "type": "address"},
            {"name": "_value", "type": "uint256"}
        ],
        "name": "transferFrom",
        "outputs": [{"name": "", "type": "bool"}],
        "type": "function"
    }
]

class PermitSender:
    def __init__(self, rpc_url: str, private_key: Optional[str] = None):
        """
        Initialize PermitSender
        
        Args:
            rpc_url: RPC endpoint URL
            private_key: Private key of sender account (optional, for executing transfers)
        """
        self.web3 = Web3(Web3.HTTPProvider(rpc_url))
        
        if not self.web3.is_connected():
            raise ConnectionError(f"Failed to connect to RPC: {rpc_url}")
        
        self.private_key = private_key
        self.account = None
        
        if private_key:
            if not private_key.startswith('0x'):
                private_key = '0x' + private_key
            self.account = Account.from_key(private_key)
            print(f"✓ Loaded account: {self.account.address}")
        
        print(f"✓ Connected to chain ID: {self.web3.eth.chain_id}")
    
    def load_permits_from_file(self, file_path: str) -> Dict[str, Any]:
        """Load permits from JSON file"""
        with open(file_path, 'r') as f:
            data = json.load(f)
        
        print(f"✓ Loaded permits from {file_path}")
        print(f"  Wallet: {data.get('wallet')}")
        print(f"  Chain ID: {data.get('chainId')}")
        print(f"  Permits: {len(data.get('permits', {}))}")
        
        return data
    
    def validate_permit(self, permit: Dict[str, Any]) -> bool:
        """Validate permit data"""
        required_fields = [
            'owner', 'spender', 'value', 'nonce', 'deadline',
            'v', 'r', 's', 'tokenAddress', 'signature'
        ]
        
        missing = [f for f in required_fields if f not in permit]
        if missing:
            raise ValueError(f"Missing fields: {', '.join(missing)}")
        
        # Validate addresses
        if not Web3.is_address(permit['owner']):
            raise ValueError(f"Invalid owner address: {permit['owner']}")
        
        if not Web3.is_address(permit['spender']):
            raise ValueError(f"Invalid spender address: {permit['spender']}")
        
        if not Web3.is_address(permit['tokenAddress']):
            raise ValueError(f"Invalid token address: {permit['tokenAddress']}")
        
        # Validate deadline
        current_time = int(time.time())
        if permit['deadline'] < current_time:
            raise ValueError(f"Permit expired (deadline: {permit['deadline']}, now: {current_time})")
        
        # Validate v, r, s
        v = permit.get('v')
        if not isinstance(v, int) or v < 27 or v > 28:
            raise ValueError(f"Invalid v value: {v}")
        
        return True
    
    def get_current_nonce(self, token_address: str, owner_address: str) -> int:
        """Fetch current nonce from token contract"""
        contract = self.web3.eth.contract(
            address=Web3.to_checksum_address(token_address),
            abi=ERC20_ABI
        )
        
        try:
            nonce = contract.functions.nonces(
                Web3.to_checksum_address(owner_address)
            ).call()
            print(f"✓ Current nonce for {owner_address}: {nonce}")
            return nonce
        except Exception as e:
            print(f"✗ Failed to fetch nonce: {e}")
            raise
    
    def execute_permit(
        self,
        token_address: str,
        permit: Dict[str, Any],
        gas_price: Optional[int] = None,
        gas_limit: int = 200000
    ) -> str:
        """
        Execute permit transaction
        
        Args:
            token_address: Token contract address
            permit: Permit signature data
            gas_price: Gas price in wei (uses network average if not provided)
            gas_limit: Gas limit for transaction
        
        Returns:
            Transaction hash
        """
        if not self.account:
            raise ValueError("Private key required to execute transactions")
        
        # Validate permit
        self.validate_permit(permit)
        
        # Verify nonce matches current state
        current_nonce = self.get_current_nonce(token_address, permit['owner'])
        if current_nonce != permit['nonce']:
            print(f"⚠ NONCE MISMATCH!")
            print(f"  Contract nonce: {current_nonce}")
            print(f"  Signature nonce: {permit['nonce']}")
            raise ValueError(
                f"Nonce mismatch: contract={current_nonce}, signature={permit['nonce']}"
            )
        
        # Create contract instance
        token_address_checksum = Web3.to_checksum_address(token_address)
        contract = self.web3.eth.contract(
            address=token_address_checksum,
            abi=ERC20_ABI
        )
        
        # Prepare permit transaction
        print(f"\n📝 Executing permit for {permit.get('tokenName', 'token')}...")
        print(f"   Owner: {permit['owner']}")
        print(f"   Spender: {permit['spender']}")
        print(f"   Amount: {permit['value']}")
        print(f"   Nonce: {permit['nonce']}")
        print(f"   Deadline: {permit['deadline']}")
        
        # Build transaction
        tx_func = contract.functions.permit(
            Web3.to_checksum_address(permit['owner']),
            Web3.to_checksum_address(permit['spender']),
            int(permit['value']),
            int(permit['deadline']),
            int(permit['v']),
            permit['r'],
            permit['s']
        )
        
        # Estimate gas
        try:
            estimated_gas = tx_func.estimate_gas({'from': self.account.address})
            actual_gas_limit = min(estimated_gas + 50000, gas_limit)
        except Exception as e:
            print(f"⚠ Gas estimation failed: {e}, using default limit")
            actual_gas_limit = gas_limit
        
        # Build full transaction
        tx = tx_func.build_transaction({
            'from': self.account.address,
            'nonce': self.web3.eth.get_transaction_count(self.account.address),
            'gas': actual_gas_limit,
            'gasPrice': gas_price or self.web3.eth.gas_price,
            'chainId': self.web3.eth.chain_id
        })
        
        # Sign transaction
        signed_tx = self.web3.eth.account.sign_transaction(tx, self.private_key)
        
        # Send transaction
        tx_hash = self.web3.eth.send_raw_transaction(signed_tx.rawTransaction)
        print(f"✓ Transaction sent: {tx_hash.hex()}")
        
        # Wait for receipt
        receipt = self.web3.eth.wait_for_transaction_receipt(tx_hash, timeout=300)
        
        if receipt['status'] == 1:
            print(f"✓ Permit executed successfully!")
            print(f"   Transaction hash: {tx_hash.hex()}")
            print(f"   Block number: {receipt['blockNumber']}")
            return tx_hash.hex()
        else:
            raise TransactionFailed(f"Transaction failed: {tx_hash.hex()}")
    
    def execute_permit_and_transfer(
        self,
        token_address: str,
        permit: Dict[str, Any],
        recipient: str,
        amount: Optional[str] = None,
        gas_limit: int = 300000
    ) -> Dict[str, str]:
        """
        Execute permit and transfer tokens in sequence
        
        Args:
            token_address: Token contract address
            permit: Permit signature data
            recipient: Recipient address
            amount: Amount to transfer (uses permit amount if not provided)
            gas_limit: Gas limit for transactions
        
        Returns:
            Dict with permit_tx and transfer_tx hashes
        """
        if not self.account:
            raise ValueError("Private key required to execute transactions")
        
        # Execute permit
        permit_tx = self.execute_permit(token_address, permit, gas_limit=gas_limit)
        
        # Wait a bit for state changes
        time.sleep(2)
        
        # Execute transfer
        amount_to_transfer = amount or permit['value']
        transfer_tx = self.execute_transfer(
            token_address,
            permit['owner'],
            recipient,
            amount_to_transfer,
            gas_limit
        )
        
        return {
            'permit_tx': permit_tx,
            'transfer_tx': transfer_tx
        }
    
    def execute_transfer(
        self,
        token_address: str,
        from_address: str,
        to_address: str,
        amount: str,
        gas_limit: int = 200000
    ) -> str:
        """
        Execute transferFrom transaction
        
        Args:
            token_address: Token contract address
            from_address: Sender address
            to_address: Recipient address
            amount: Amount to transfer
            gas_limit: Gas limit
        
        Returns:
            Transaction hash
        """
        if not self.account:
            raise ValueError("Private key required to execute transactions")
        
        token_address_checksum = Web3.to_checksum_address(token_address)
        contract = self.web3.eth.contract(
            address=token_address_checksum,
            abi=ERC20_ABI
        )
        
        print(f"\n💸 Executing transfer...")
        print(f"   From: {from_address}")
        print(f"   To: {to_address}")
        print(f"   Amount: {amount}")
        
        # Build transaction
        tx_func = contract.functions.transferFrom(
            Web3.to_checksum_address(from_address),
            Web3.to_checksum_address(to_address),
            int(amount)
        )
        
        # Estimate gas
        try:
            estimated_gas = tx_func.estimate_gas({'from': self.account.address})
            actual_gas_limit = min(estimated_gas + 50000, gas_limit)
        except Exception as e:
            print(f"⚠ Gas estimation failed: {e}, using default limit")
            actual_gas_limit = gas_limit
        
        # Build full transaction
        tx = tx_func.build_transaction({
            'from': self.account.address,
            'nonce': self.web3.eth.get_transaction_count(self.account.address),
            'gas': actual_gas_limit,
            'gasPrice': self.web3.eth.gas_price,
            'chainId': self.web3.eth.chain_id
        })
        
        # Sign transaction
        signed_tx = self.web3.eth.account.sign_transaction(tx, self.private_key)
        
        # Send transaction
        tx_hash = self.web3.eth.send_raw_transaction(signed_tx.rawTransaction)
        print(f"✓ Transaction sent: {tx_hash.hex()}")
        
        # Wait for receipt
        receipt = self.web3.eth.wait_for_transaction_receipt(tx_hash, timeout=300)
        
        if receipt['status'] == 1:
            print(f"✓ Transfer executed successfully!")
            print(f"   Transaction hash: {tx_hash.hex()}")
            print(f"   Block number: {receipt['blockNumber']}")
            return tx_hash.hex()
        else:
            raise TransactionFailed(f"Transaction failed: {tx_hash.hex()}")
    
    def process_permits_file(
        self,
        file_path: str,
        execute: bool = False,
        recipient: Optional[str] = None
    ):
        """Process all permits in a JSON file"""
        data = self.load_permits_from_file(file_path)
        permits = data.get('permits', {})
        
        results = {
            'successful': [],
            'failed': [],
            'skipped': []
        }
        
        for token_address, permit in permits.items():
            try:
                print(f"\n{'='*60}")
                print(f"Processing permit for {permit.get('tokenName', 'unknown')}")
                print(f"{'='*60}")
                
                # Validate permit
                self.validate_permit(permit)
                print(f"✓ Permit validation passed")
                
                if execute and self.account:
                    if recipient:
                        # Execute permit and transfer
                        txs = self.execute_permit_and_transfer(
                            token_address,
                            permit,
                            recipient
                        )
                        results['successful'].append({
                            'token': token_address,
                            'txs': txs
                        })
                    else:
                        # Execute permit only
                        tx = self.execute_permit(token_address, permit)
                        results['successful'].append({
                            'token': token_address,
                            'tx': tx
                        })
                else:
                    print(f"⏭  Skipping execution (dry-run mode)")
                    results['skipped'].append({'token': token_address})
                    
            except Exception as e:
                print(f"✗ Error processing permit: {e}")
                results['failed'].append({
                    'token': token_address,
                    'error': str(e)
                })
        
        # Print summary
        print(f"\n{'='*60}")
        print("SUMMARY")
        print(f"{'='*60}")
        print(f"✓ Successful: {len(results['successful'])}")
        print(f"✗ Failed: {len(results['failed'])}")
        print(f"⏭  Skipped: {len(results['skipped'])}")
        
        if results['failed']:
            print("\nFailed permits:")
            for item in results['failed']:
                print(f"  - {item['token']}: {item['error']}")
        
        return results


def main():
    parser = argparse.ArgumentParser(description='Permit2 Multi-Chain Sender')
    parser.add_argument('--rpc', required=True, help='RPC endpoint URL')
    parser.add_argument('--file', required=True, help='Path to permits JSON file')
    parser.add_argument('--key', help='Private key for execution (optional)')
    parser.add_argument('--execute', action='store_true', help='Execute permits on-chain')
    parser.add_argument('--transfer-to', help='Recipient address for transfers')
    
    args = parser.parse_args()
    
    try:
        sender = PermitSender(args.rpc, args.key)
        sender.process_permits_file(
            args.file,
            execute=args.execute,
            recipient=args.transfer_to
        )
    except Exception as e:
        print(f"✗ Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
