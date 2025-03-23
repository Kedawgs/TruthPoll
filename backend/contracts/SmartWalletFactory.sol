// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/Create2.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract SmartWalletFactory is Ownable {
    event WalletCreated(address indexed owner, address wallet);
    
    // Constructor with Ownable base initialization
    constructor() Ownable(msg.sender) {}
    
    // Create2 allows deterministic wallet addresses
    function createWallet(address owner, uint256 salt) public returns (address) {
        bytes memory bytecode = _getWalletBytecode(owner);
        address walletAddress = Create2.deploy(0, bytes32(salt), bytecode);
        
        emit WalletCreated(owner, walletAddress);
        return walletAddress;
    }
    
    // Get wallet address without deploying
    function getWalletAddress(address owner, uint256 salt) public view returns (address) {
        bytes memory bytecode = _getWalletBytecode(owner);
        return Create2.computeAddress(bytes32(salt), keccak256(bytecode));
    }
    
    // Helper to generate creation bytecode
    function _getWalletBytecode(address owner) internal pure returns (bytes memory) {
        return abi.encodePacked(
            type(SmartWallet).creationCode,
            abi.encode(owner)
        );
    }
}

contract SmartWallet {
    address public owner;
    
    constructor(address _owner) {
        owner = _owner;
    }
    
    // Execute a transaction when validated by owner signature
    function execute(
        address target, 
        uint256 value, 
        bytes calldata data, 
        bytes calldata signature
    ) external returns (bytes memory) {
        // Verify signature comes from wallet owner
        bytes32 hash = keccak256(abi.encodePacked(
            target, value, keccak256(data)
        ));
        bytes32 signedHash = keccak256(abi.encodePacked(
            "\x19Ethereum Signed Message:\n32", hash
        ));
        
        address signer = recoverSigner(signedHash, signature);
        require(signer == owner, "Invalid signature");
        
        // Execute the call
        (bool success, bytes memory result) = target.call{value: value}(data);
        require(success, "Transaction execution failed");
        
        return result;
    }
    
    // Basic signature recovery
    function recoverSigner(bytes32 hash, bytes memory signature) internal pure returns (address) {
        require(signature.length == 65, "Invalid signature length");
        
        bytes32 r;
        bytes32 s;
        uint8 v;
        
        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }
        
        if (v < 27) {
            v += 27;
        }
        
        return ecrecover(hash, v, r, s);
    }
    
    // Allow receiving ETH
    receive() external payable {}
}