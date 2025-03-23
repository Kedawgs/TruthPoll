// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PollRewardsVault is Ownable {
    // Fix: Add constructor that passes msg.sender to Ownable
    constructor(address _usdtAddress) Ownable(msg.sender) {
        usdtToken = IERC20(_usdtAddress);
    }

    using SafeERC20 for IERC20;
    
    struct PollReward {
        uint256 totalDeposit;
        uint256 rewardPerVoter;
        uint256 remainingRewards;
        mapping(address => bool) hasClaimedReward;
        mapping(address => bool) hasVoted;
    }
    
    // USDT token
    IERC20 public immutable usdtToken;
    
    // Poll ID to reward info
    mapping(address => PollReward) public pollRewards;
    
    // Registered polls
    mapping(address => bool) public isPollContract;
    
    // Events
    event PollFunded(address indexed pollAddress, uint256 amount, uint256 rewardPerVoter);
    event VoteRegistered(address indexed voter, address indexed poll);
    event RewardClaimed(address indexed voter, address indexed poll, uint256 amount);
    event RemainingRewardsWithdrawn(address indexed poll, address indexed owner, uint256 amount);
    
    // Only poll contract can register votes
    modifier onlyPoll(address pollAddress) {
        require(isPollContract[pollAddress], "Not a registered poll");
        _;
    }
    
    // Register a poll
    function registerPoll(address pollAddress) external onlyOwner {
        isPollContract[pollAddress] = true;
    }
    
    // Fund a poll with rewards
    function fundPoll(address pollAddress, uint256 amount, uint256 rewardPerVoter) external {
        require(isPollContract[pollAddress], "Not a registered poll");
        
        PollReward storage reward = pollRewards[pollAddress];
        
        // Transfer USDT from sender
        usdtToken.safeTransferFrom(msg.sender, address(this), amount);
        
        // Update reward info
        reward.totalDeposit += amount;
        reward.remainingRewards += amount;
        reward.rewardPerVoter = rewardPerVoter;
        
        emit PollFunded(pollAddress, amount, rewardPerVoter);
    }
    
    // Register a vote (called by poll contract)
    function registerVote(address voter) external onlyPoll(msg.sender) {
        PollReward storage reward = pollRewards[msg.sender];
        reward.hasVoted[voter] = true;
        
        emit VoteRegistered(voter, msg.sender);
    }
    
    // User claims their reward
    function claimReward(address pollAddress) external {
        PollReward storage reward = pollRewards[pollAddress];
        
        require(reward.hasVoted[msg.sender], "Not voted on this poll");
        require(!reward.hasClaimedReward[msg.sender], "Already claimed");
        require(reward.remainingRewards >= reward.rewardPerVoter, "Insufficient rewards");
        
        // Mark as claimed
        reward.hasClaimedReward[msg.sender] = true;
        reward.remainingRewards -= reward.rewardPerVoter;
        
        // Send reward
        usdtToken.safeTransfer(msg.sender, reward.rewardPerVoter);
        
        emit RewardClaimed(msg.sender, pollAddress, reward.rewardPerVoter);
    }
    
    // Check if user can claim reward
    function canClaimReward(address pollAddress, address voter) external view returns (bool) {
        PollReward storage reward = pollRewards[pollAddress];
        return reward.hasVoted[voter] && 
               !reward.hasClaimedReward[voter] && 
               reward.remainingRewards >= reward.rewardPerVoter;
    }
    
    // Get reward amount for a poll
    function getRewardAmount(address pollAddress) external view returns (uint256) {
        return pollRewards[pollAddress].rewardPerVoter;
    }
    
    // Poll creator can withdraw unclaimed rewards after poll ends
    function withdrawRemainingRewards(address pollAddress) external {
        require(isPollContract[pollAddress], "Not a registered poll");
        
        // Verify caller is poll owner
        IPoll poll = IPoll(pollAddress);
        require(poll.owner() == msg.sender, "Not poll owner");
        require(!poll.isActive() || block.timestamp >= poll.endTime(), "Poll not ended");
        
        PollReward storage reward = pollRewards[pollAddress];
        uint256 remaining = reward.remainingRewards;
        reward.remainingRewards = 0;
        
        usdtToken.safeTransfer(msg.sender, remaining);
        
        emit RemainingRewardsWithdrawn(pollAddress, msg.sender, remaining);
    }
}

// Interface for Poll contract
interface IPoll {
    function owner() external view returns (address);
    function isActive() external view returns (bool);
    function endTime() external view returns (uint256);
}