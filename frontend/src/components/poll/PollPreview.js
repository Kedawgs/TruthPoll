// src/components/poll/PollPreview.js
import React from 'react';

const PollPreview = ({ 
  title, 
  options, 
  previewUrl, 
  previewVotes = 0,
  previewVotePercentage = 0 
}) => {
  // Helper to get a random percentage for the poll options
  const getRandomPercentage = (max = 100) => Math.floor(Math.random() * max);

  // Generate random percentages for preview options that sum to 100%
  const generateRandomPercentages = (optionsCount) => {
    if (optionsCount === 0) return [];
    let remaining = 100;
    const percentages = [];
    
    for (let i = 0; i < optionsCount - 1; i++) {
      // For all but the last option, get a random percentage of what's left
      const slice = Math.floor(Math.random() * (remaining / 2));
      percentages.push(slice);
      remaining -= slice;
    }
    
    // Last option gets whatever is left
    percentages.push(remaining);
    
    // Shuffle the array to make it more random
    return percentages.sort(() => Math.random() - 0.5);
  };

  // Generate preview percentages
  const optionPercentages = React.useMemo(() => {
    const filteredOptions = options.filter(opt => opt.trim());
    return generateRandomPercentages(filteredOptions.length);
  }, [options]);

  // Get filtered options (non-empty)
  const filteredOptions = options.filter(opt => opt.trim());

  return (
    <div className="poll-preview bg-white p-4 rounded-lg shadow-sm">
      {/* Poll Header with Title and Image */}
      <div className="flex items-center mb-4">
        {/* Poll Image (if provided) */}
        <div className="mr-4 flex-shrink-0">
          {previewUrl ? (
            <img 
              src={previewUrl} 
              alt="Poll preview" 
              className="w-16 h-16 object-cover rounded-full border-2 border-gray-200"
            />
          ) : (
            <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
        </div>
        
        {/* Poll Title */}
        <h4 className="text-xl font-semibold text-gray-900">
          {title || "Your Poll Title"}
        </h4>
      </div>
      
      {/* Poll Options */}
      <div className="space-y-3 mt-6">
        {filteredOptions.length > 0 ? (
          filteredOptions.map((option, index) => (
            <div key={index} className="poll-option">
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium text-gray-700">{option}</span>
                <span className="text-gray-500">{optionPercentages[index]}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-primary-600 h-2.5 rounded-full" 
                  style={{ width: `${optionPercentages[index]}%` }}
                ></div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-gray-500 text-sm py-4 text-center">
            Add options to see how they'll appear in your poll
          </div>
        )}
      </div>
      
      {/* Vote Count */}
      <div className="mt-4 text-sm text-gray-500 flex justify-between items-center">
        <span>{previewVotes || Math.floor(Math.random() * 100)} votes</span>
        <span className="text-xs text-gray-400">Preview</span>
      </div>
    </div>
  );
};

export default PollPreview;