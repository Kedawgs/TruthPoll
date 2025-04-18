// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./Poll.sol";

contract PollFactory is Ownable {
    using SafeERC20 for IERC20;

    // Store all created polls
    address[] public deployedPolls;
    address public immutable usdtAddress;
    
    // Mapping from creator address to their polls
    mapping(address => address[]) public creatorToPolls;
    
    // Platform fee percentage (e.g., 600 = 6.00%)
    uint256 public platformFeePercent = 600;
    
    // Platform fee recipient
    address public feeRecipient;
    
    // Events
    event PollCreated(address indexed pollAddress, string title, address indexed creator);
    event PollCreatedAndFunded(address indexed pollAddress, string title, address indexed creator, uint256 fundAmount, uint256 platformFee);
    event PlatformFeeUpdated(uint256 oldFee, uint256 newFee);
    event FeeRecipientUpdated(address oldRecipient, address newRecipient);
    
    constructor(address _usdtAddress) Ownable(msg.sender) {
        usdtAddress = _usdtAddress;
        feeRecipient = msg.sender; // Default to contract deployer
    }
    
    /**
     * @dev Create a new poll
     * @param _title Poll title
     * @param _options Array of poll options
     * @param _duration Duration in seconds (0 for no end time)
     * @param _rewardPerVoter USDT reward per voter (0 for no rewards)
     * @return Address of the newly created poll
     */
    function createPoll(
        string memory _title,
        string[] memory _options,
        uint256 _duration,
        uint256 _rewardPerVoter
    ) public returns (address) {
        // Create new poll contract
        Poll newPoll = new Poll(
            _title,
            _options,
            _duration,
            msg.sender,
            usdtAddress,
            _rewardPerVoter
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
     * @dev Create a new poll with initial funding in one transaction
     * @param _title Poll title
     * @param _options Array of poll options
     * @param _duration Duration in seconds (0 for no end time)
     * @param _rewardPerVoter USDT reward per voter
     * @param _fundAmount Total amount to fund the poll with
     * @return Address of the newly created poll
     */
    function createAndFundPoll(
        string memory _title,
        string[] memory _options,
        uint256 _duration,
        uint256 _rewardPerVoter,
        uint256 _fundAmount
    ) external returns (address) {
        require(_rewardPerVoter > 0, "Reward per voter must be positive");
        require(_fundAmount > 0, "Fund amount must be positive");
        
        // Calculate platform fee (6% by default)
        uint256 platformFee = (_fundAmount * platformFeePercent) / 10000;
        uint256 totalAmount = _fundAmount + platformFee;
        
        // Transfer USDT from sender for both rewards and platform fee
        IERC20 usdt = IERC20(usdtAddress);
        usdt.safeTransferFrom(msg.sender, address(this), totalAmount);
        
        // Create the poll
        address pollAddress = createPoll(
            _title,
            _options,
            _duration,
            _rewardPerVoter
        );
        
        // Get the newly created poll
        Poll poll = Poll(pollAddress);
        
        // Transfer platform fee to recipient
        if (platformFee > 0 && feeRecipient != address(0)) {
            usdt.safeTransfer(feeRecipient, platformFee);
        }
        
        // Transfer funds to the poll
        usdt.safeTransfer(pollAddress, _fundAmount);
        
        // Notify the poll that it has received funds
        poll.notifyFunded(_fundAmount);
        
        // Emit event with additional funding information
        emit PollCreatedAndFunded(pollAddress, _title, msg.sender, _fundAmount, platformFee);
        
        return pollAddress;
    }
    
    /**
     * @dev Update platform fee percentage
     * @param _newFeePercent New fee percentage (e.g., 600 = 6.00%)
     */
    function updatePlatformFee(uint256 _newFeePercent) external onlyOwner {
        require(_newFeePercent <= 2000, "Fee cannot exceed 20%");
        uint256 oldFee = platformFeePercent;
        platformFeePercent = _newFeePercent;
        emit PlatformFeeUpdated(oldFee, _newFeePercent);
    }
    
    /**
     * @dev Update fee recipient address
     * @param _newRecipient New fee recipient address
     */
    function updateFeeRecipient(address _newRecipient) external onlyOwner {
        require(_newRecipient != address(0), "Cannot set fee recipient to zero address");
        address oldRecipient = feeRecipient;
        feeRecipient = _newRecipient;
        emit FeeRecipientUpdated(oldRecipient, _newRecipient);
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
    
    /**
     * @dev Calculate platform fee for a given amount
     * @param _amount Amount to calculate fee for
     * @return Fee amount
     */
    function calculatePlatformFee(uint256 _amount) public view returns (uint256) {
        return (_amount * platformFeePercent) / 10000;
    }
}