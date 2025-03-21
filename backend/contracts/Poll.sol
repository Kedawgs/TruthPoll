// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// Import OpenZeppelin's Ownable contract for access control
import "@openzeppelin/contracts/access/Ownable.sol";

contract Poll is Ownable {
    // Poll metadata
    string public title;
    string[] public options;
    uint256 public creationTime;
    uint256 public endTime; // 0 means no end time
    bool public isActive;
    
    // Voting data structures
    mapping(address => uint256) public votes;  // Maps voter address to their vote (1-indexed)
    mapping(uint256 => uint256) public voteCount;  // Maps option index to number of votes
    uint256 public totalVotes;  // Total number of votes cast
    
    // Events for important state changes
    event Voted(address indexed voter, uint256 option);
    event PollEnded();
    event PollReactivated();
    
    /**
     * @dev Create a new poll
     * @param _title The poll title
     * @param _options The available voting options
     * @param _duration Duration in seconds (0 for no end time)
     * @param _owner Address that will own this poll
     */
    constructor(
        string memory _title,
        string[] memory _options,
        uint256 _duration,
        address _owner
    ) Ownable(_owner) {  // Pass the owner address to Ownable constructor
        // Ensure at least 2 options
        require(_options.length >= 2, "Poll must have at least 2 options");
        
        title = _title;
        creationTime = block.timestamp;
        
        // If duration is 0, poll has no end time
        if (_duration > 0) {
            endTime = block.timestamp + _duration;
        }
        
        isActive = true;
        
        // Copy options to storage
        for (uint256 i = 0; i < _options.length; i++) {
            options.push(_options[i]);
        }
    }
    
    /**
     * @dev Vote on a poll option
     * @param _option The index of the option to vote for
     */
    function vote(uint256 _option) external {
        // Validation checks
        require(isActive, "Poll is not active");
        require(_option < options.length, "Invalid option");
        require(votes[msg.sender] == 0, "Already voted");
        require(endTime == 0 || block.timestamp < endTime, "Poll has ended");
        
        // Record vote (add 1 to distinguish from uninitialized state)
        votes[msg.sender] = _option + 1;
        voteCount[_option]++;
        totalVotes++;
        
        // Emit event
        emit Voted(msg.sender, _option);
    }
    
    /**
     * @dev End the poll (only owner)
     */
    function endPoll() external onlyOwner {
        require(isActive, "Poll is already inactive");
        isActive = false;
        emit PollEnded();
    }
    
    /**
     * @dev Reactivate a poll that was ended (only owner)
     * @param _newDuration New duration in seconds (0 for no end time)
     */
    function reactivatePoll(uint256 _newDuration) external onlyOwner {
        require(!isActive, "Poll is already active");
        
        isActive = true;
        
        // Update end time if a new duration is provided
        if (_newDuration > 0) {
            endTime = block.timestamp + _newDuration;
        }
        
        emit PollReactivated();
    }
    
    /**
     * @dev Check if a user has voted
     * @param _voter Address to check
     * @return True if the user has voted
     */
    function hasVoted(address _voter) external view returns (bool) {
        return votes[_voter] > 0;
    }
    
    /**
     * @dev Get the option a user voted for
     * @param _voter Address of the voter
     * @return The index of the option they voted for
     */
    function getUserVote(address _voter) external view returns (uint256) {
        require(votes[_voter] > 0, "User has not voted");
        return votes[_voter] - 1; // Subtract 1 to get the actual option index
    }
    
    /**
     * @dev Check if the poll is currently active
     * @return True if the poll is active and not expired
     */
    function isPollActive() external view returns (bool) {
        if (!isActive) return false;
        if (endTime == 0) return true;
        return block.timestamp < endTime;
    }
    
    /**
     * @dev Get remaining time for poll (in seconds)
     * @return Seconds remaining, or 0 if no end time or already ended
     */
    function getRemainingTime() external view returns (uint256) {
        if (endTime == 0) return 0; // No end time
        if (block.timestamp >= endTime) return 0; // Poll ended
        return endTime - block.timestamp;
    }
    
    /**
     * @dev Get poll results
     * @return Array of vote counts for each option
     */
    function getResults() external view returns (uint256[] memory) {
        uint256[] memory results = new uint256[](options.length);
        
        for (uint256 i = 0; i < options.length; i++) {
            results[i] = voteCount[i];
        }
        
        return results;
    }
    
    /**
     * @dev Get all options
     * @return Array of option strings
     */
    function getOptions() external view returns (string[] memory) {
        return options;
    }
    
    /**
     * @dev Get number of options
     * @return Count of options
     */
    function getOptionsCount() external view returns (uint256) {
        return options.length;
    }
}