// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
// Updated import for ReentrancyGuard in OpenZeppelin v5
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Poll is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;
    
    // Poll metadata
    string public title;
    string[] public options;
    uint256 public creationTime;
    uint256 public endTime; // 0 means no end time
    bool public isActive;
    
    // USDT token address
    IERC20 public immutable usdtToken;
    uint256 public rewardPerVoter;
    uint256 public totalRewards;
    
    // Voting data structures
    mapping(address => uint256) public votes;  // Maps voter address to their vote (1-indexed)
    mapping(address => bool) public hasVotedAndRewarded; // Track votes and rewards
    mapping(uint256 => uint256) public voteCount;  // Maps option index to number of votes
    uint256 public totalVotes;  // Total number of votes cast
    
    // Meta-transaction nonces
    mapping(address => uint256) private _nonces;
    
    // Events for important state changes
    event Voted(address indexed voter, uint256 option);
    event RewardPaid(address indexed voter, uint256 amount);
    event PollEnded();
    event PollReactivated();
    event RewardsFunded(address indexed funder, uint256 amount);
    
    // Domain separator for EIP-712
    bytes32 private immutable _DOMAIN_SEPARATOR;
    bytes32 private constant _VOTE_TYPEHASH = 
        keccak256("Vote(address voter,uint256 option,uint256 nonce)");
    
    constructor(
        string memory _title,
        string[] memory _options,
        uint256 _duration,
        address _owner,
        address _usdtAddress,
        uint256 _rewardPerVoter
    ) Ownable(_owner) {
        require(_options.length >= 2, "Poll must have at least 2 options");
        
        title = _title;
        creationTime = block.timestamp;
        usdtToken = IERC20(_usdtAddress);
        rewardPerVoter = _rewardPerVoter;
        
        // If duration is 0, poll has no end time
        if (_duration > 0) {
            endTime = block.timestamp + _duration;
        }
        
        isActive = true;
        
        // Copy options to storage
        for (uint256 i = 0; i < _options.length; i++) {
            options.push(_options[i]);
        }
        
        // Initialize domain separator for EIP-712
        uint256 chainId;
        assembly {
            chainId := chainid()
        }
        _DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("TruthPoll")),
                keccak256(bytes("1")),
                chainId,
                address(this)
            )
        );
    }
    
    // Fund the poll with USDT rewards - only owner can call
    function fundRewards(uint256 amount) external nonReentrant onlyOwner {
        usdtToken.safeTransferFrom(msg.sender, address(this), amount);
        totalRewards += amount;
        emit RewardsFunded(msg.sender, amount);
    }
    
    // Regular vote function (for wallet users)
    function vote(uint256 _option) external nonReentrant {
        _vote(msg.sender, _option);
    }
    
    // Meta-transaction vote function (for relayer)
    function metaVote(
        address _voter,
        uint256 _option,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external nonReentrant {
        // Recreate the message hash that was signed
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                _DOMAIN_SEPARATOR,
                keccak256(abi.encode(_VOTE_TYPEHASH, _voter, _option, _nonces[_voter]))
            )
        );
        
        // Recover signer from the signature
        address signer = ecrecover(digest, v, r, s);
        require(signer == _voter, "Invalid signature");
        
        // Increment nonce
        _nonces[_voter]++;
        
        _vote(_voter, _option);
    }
    
    // Internal vote logic - updated to include immediate reward
    function _vote(address _voter, uint256 _option) internal {
        // Validation checks
        require(isActive, "Poll is not active");
        require(_option < options.length, "Invalid option");
        require(votes[_voter] == 0, "Already voted");
        require(endTime == 0 || block.timestamp < endTime, "Poll has ended");
        require(_voter != owner(), "Poll creator cannot vote on their own poll");
        
        // Record vote (add 1 to distinguish from uninitialized state)
        votes[_voter] = _option + 1;
        voteCount[_option]++;
        totalVotes++;
        
        // Emit vote event
        emit Voted(_voter, _option);
        
        // Handle immediate reward distribution if rewards are set
        if (rewardPerVoter > 0 && !hasVotedAndRewarded[_voter]) {
            require(totalRewards >= rewardPerVoter, "Insufficient reward funds");
            
            // Mark as rewarded and reduce total available rewards
            hasVotedAndRewarded[_voter] = true;
            totalRewards -= rewardPerVoter;
            
            // Transfer reward immediately
            usdtToken.safeTransfer(_voter, rewardPerVoter);
            emit RewardPaid(_voter, rewardPerVoter);
        }
    }
    
    // End poll
    function endPoll() external onlyOwner {
        require(isActive, "Poll is already inactive");
        isActive = false;
        emit PollEnded();
    }
    
    // Reactivate poll
    function reactivatePoll(uint256 _newDuration) external onlyOwner {
        require(!isActive, "Poll is already active");
        
        isActive = true;
        if (_newDuration > 0) {
            endTime = block.timestamp + _newDuration;
        }
        
        emit PollReactivated();
    }
    
    // Withdraw remaining rewards after poll ends
    function withdrawRemainingRewards() external onlyOwner nonReentrant {
        require(!isActive || block.timestamp >= endTime, "Poll must be ended");
        uint256 amount = totalRewards;
        totalRewards = 0;
        usdtToken.safeTransfer(owner(), amount);
    }
    
    // Check if a user has voted
    function hasVoted(address _voter) external view returns (bool) {
        return votes[_voter] > 0;
    }
    
    // Get option a user voted for
    function getUserVote(address _voter) external view returns (uint256) {
        require(votes[_voter] > 0, "User has not voted");
        return votes[_voter] - 1; // Subtract 1 to get the actual option index
    }
    
    // Check if poll is active
    function isPollActive() external view returns (bool) {
        if (!isActive) return false;
        if (endTime == 0) return true;
        return block.timestamp < endTime;
    }
    
    // Get remaining time for poll
    function getRemainingTime() external view returns (uint256) {
        if (endTime == 0) return 0; // No end time
        if (block.timestamp >= endTime) return 0; // Poll ended
        return endTime - block.timestamp;
    }
    
    // Get poll results
    function getResults() external view returns (uint256[] memory) {
        uint256[] memory results = new uint256[](options.length);
        
        for (uint256 i = 0; i < options.length; i++) {
            results[i] = voteCount[i];
        }
        
        return results;
    }
    
    // Get all options
    function getOptions() external view returns (string[] memory) {
        return options;
    }
    
    // Get number of options
    function getOptionsCount() external view returns (uint256) {
        return options.length;
    }
    
    // Get current nonce for a user
    function getNonce(address _user) external view returns (uint256) {
        return _nonces[_user];
    }
    
    // Check if rewards are available
    function getAvailableRewards() external view returns (uint256) {
        return totalRewards;
    }
}