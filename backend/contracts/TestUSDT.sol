// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TestUSDT is ERC20, Ownable {
    uint8 private _decimals = 6; // USDT uses 6 decimals
    
    constructor(address initialOwner) 
        ERC20("Test USDT", "tUSDT") 
        Ownable(initialOwner) 
    {
        // Mint 1,000,000 tokens to the contract deployer
        _mint(msg.sender, 1000000 * 10**decimals());
    }
    
    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }
    
    // For testing: anyone can mint tokens to themselves
    function mint(uint256 amount) external {
        _mint(msg.sender, amount);
    }
}