// src/components/poll/OptionInput.js
import React from 'react';

const RemoveIcon = () => (
  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
  </svg>
);

const OptionInput = ({ 
  options, 
  setOptions, 
  errors 
}) => {
  // Add a new poll option
  const addOption = () => {
    if (options.length < 10) {
      setOptions([...options, '']);
    }
  };

  // Remove a poll option
  const removeOption = (index) => {
    if (options.length > 2) {
      const newOptions = [...options];
      newOptions.splice(index, 1);
      setOptions(newOptions);
    }
  };

  // Update a poll option
  const updateOption = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-2">
        <label className="block text-sm font-medium">Poll Options</label>
        <span className="text-xs text-gray-500">{options.length}/10 options</span>
      </div>
      <div className="space-y-2">
        {options.map((option, index) => (
          <div key={index} className="flex items-center space-x-2">
            <input
              type="text"
              className={`block w-full px-3 py-2 border ${
                errors?.options?.[index] ? 'border-red-500' : 'border-gray-300'
              } rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500`}
              placeholder={`Option ${index + 1}`}
              value={option}
              onChange={(e) => updateOption(index, e.target.value)}
              maxLength={100}
            />
            {options.length > 2 && (
              <button
                type="button"
                onClick={() => removeOption(index)}
                className="text-gray-400 hover:text-gray-500 p-1"
                aria-label="Remove option"
              >
                <RemoveIcon />
              </button>
            )}
          </div>
        ))}
        {options.length < 10 && (
          <button
            type="button"
            onClick={addOption}
            className="mt-2 text-sm text-primary-600 hover:text-primary-700"
          >
            + Add another option
          </button>
        )}
        {errors?.options && typeof errors.options === 'string' && (
          <p className="mt-1 text-sm text-red-600">{errors.options}</p>
        )}
      </div>
    </div>
  );
};

export default OptionInput;