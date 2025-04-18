// src/components/poll/RewardSettings.js
import React, { useState, useEffect } from 'react';
import { formatUSDT } from '../../utils/web3Helper';

const RewardSettings = ({ 
  rewardEnabled, 
  setRewardEnabled, 
  rewardPerVoter, 
  setRewardPerVoter,
  voteLimit,
  setVoteLimit,
  getConfigValue,
  usdtBalance,
  errors
}) => {
  const [minReward, setMinReward] = useState(0.01);
  const [maxReward, setMaxReward] = useState(10);
  const [platformFee, setPlatformFee] = useState(6);
  
  // Calculate total costs
  const calculatedRewardCost = rewardEnabled 
    ? parseFloat(rewardPerVoter || 0) * parseFloat(voteLimit || 0) 
    : 0;
  
  const calculatedFee = calculatedRewardCost * (platformFee / 100);
  const totalCost = calculatedRewardCost + calculatedFee;
  
  // Load config values
  useEffect(() => {
    const loadConfig = async () => {
      if (getConfigValue) {
        const minValue = await getConfigValue('MIN_REWARD_AMOUNT', 0.01);
        const maxValue = await getConfigValue('MAX_REWARD_AMOUNT', 10);
        const feeValue = await getConfigValue('PLATFORM_FEE_PERCENT', 6);
        
        setMinReward(parseFloat(minValue));
        setMaxReward(parseFloat(maxValue));
        setPlatformFee(parseFloat(feeValue));
      }
    };
    
    loadConfig();
  }, [getConfigValue]);

  // Toggle reward setting
  const toggleReward = () => {
    if (!rewardEnabled && (!rewardPerVoter || parseFloat(rewardPerVoter) === 0)) {
      setRewardPerVoter(minReward.toString());
    }
    setRewardEnabled(!rewardEnabled);
  };

  return (
    <div className="space-y-6">
      <div className="border-t border-gray-200 pt-6">
        <h3 className="text-lg font-semibold mb-3">Reward Settings</h3>
        
        <div className="mb-4">
          <div className="flex items-center">
            <input
              id="rewardEnabled"
              type="checkbox"
              checked={rewardEnabled}
              onChange={toggleReward}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 rounded"
            />
            <label htmlFor="rewardEnabled" className="ml-2">
              Enable USDT rewards for voters
            </label>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Reward voters with USDT for participating in your poll
          </p>
        </div>
        
        {rewardEnabled && (
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Reward amount per voter (USDT)
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    type="number"
                    value={rewardPerVoter}
                    onChange={(e) => setRewardPerVoter(e.target.value)}
                    min={minReward}
                    max={maxReward}
                    step="0.01"
                    className={`block w-full pr-16 shadow-sm rounded-md ${
                      errors?.rewardPerVoter ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">USDT</span>
                  </div>
                </div>
                {errors?.rewardPerVoter && (
                  <p className="mt-1 text-sm text-red-600">{errors.rewardPerVoter}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  Min: {minReward} USDT, Max: {maxReward} USDT per voter
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">
                  Maximum number of rewards
                </label>
                <input
                  type="number"
                  value={voteLimit}
                  onChange={(e) => setVoteLimit(e.target.value)}
                  min="1"
                  max="10000"
                  className={`block w-full rounded-md shadow-sm ${
                    errors?.voteLimit ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors?.voteLimit && (
                  <p className="mt-1 text-sm text-red-600">{errors.voteLimit}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  How many voters can receive rewards
                </p>
              </div>
              
              <div className="bg-white p-3 rounded-md">
                <h4 className="text-sm font-medium mb-2">Cost breakdown</h4>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span>Reward pool:</span>
                    <span>
                      {formatUSDT(calculatedRewardCost)} USDT
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Platform fee ({platformFee}%):</span>
                    <span>
                      {formatUSDT(calculatedFee)} USDT
                    </span>
                  </div>
                  <div className="border-t border-gray-200 pt-1 mt-1 font-medium flex justify-between">
                    <span>Total cost:</span>
                    <span>
                      {formatUSDT(totalCost)} USDT
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="bg-blue-100 text-blue-800 p-3 rounded-md text-sm">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-3 flex-1">
                    <p className="font-medium">Your balance: {formatUSDT(usdtBalance || 0)} USDT</p>
                    {parseFloat(usdtBalance || 0) < totalCost && (
                      <p className="text-red-600 font-medium mt-1">
                        Insufficient balance - need {formatUSDT(totalCost)} USDT
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RewardSettings;