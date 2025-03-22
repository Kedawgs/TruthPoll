// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// Import the Poll contract
import "./Poll.sol";

contract PollFactory {
    // Store all created polls
    address[] public deployedPolls;
    
    // Mapping from creator address to their polls
    mapping(address => address[]) public creatorToPolls;
    
    // Events
    event PollCreated(address indexed pollAddress, string title, address indexed creator);
    
    /**
     * @dev Create a new poll
     * @param _title Poll title
     * @param _options Array of poll options
     * @param _duration Duration in seconds (0 for no end time)
     * @return Address of the newly created poll
     */
    function createPoll(
        string memory _title,
        string[] memory _options,
        uint256 _duration
    ) public returns (address) {
        // Create new poll contract
        Poll newPoll = new Poll(
            _title,
            _options,
            _duration,
            msg.sender
        );
        
        address pollAddress = address(newPoll);
        
        // Store poll address
        deployedPolls.push(pollAddress);
        creatorToPolls[msg.sender].push(pollAddress);
        
        // Emit event
        emit PollCreated(pollAddress, _title, msg.sender);
        
        return pollAddress;
    }
    
    /**
     * @dev Get all deployed polls
     * @return Array of poll contract addresses
     */
    function getDeployedPolls() public view returns (address[] memory) {
        return deployedPolls;
    }
    
    /**
     * @dev Get polls created by a specific address
     * @param _creator Creator address
     * @return Array of poll addresses created by this address
     */
    function getPollsByCreator(address _creator) public view returns (address[] memory) {
        return creatorToPolls[_creator];
    }
    
    /**
     * @dev Get total number of polls
     * @return Count of all polls created
     */
    function getPollsCount() public view returns (uint256) {
        return deployedPolls.length;
    }
}