// src/components/poll/TagRangeSelector.js
import React, { useState, useEffect } from 'react';

const TagRangeSelector = ({ tag, value, onChange }) => {
  const [rangeValues, setRangeValues] = useState(value || getDefaultRangeValues(tag));
  
  useEffect(() => {
    if (value) {
      setRangeValues(value);
    }
  }, [value]);

  const handleChange = (newValues) => {
    setRangeValues(newValues);
    onChange(tag, newValues);
  };

  if (tag === 'Age') {
    return (
      <AgeRangeSelector 
        value={rangeValues} 
        onChange={handleChange} 
      />
    );
  } else if (tag === 'Gender') {
    return (
      <GenderSelector 
        value={rangeValues} 
        onChange={handleChange} 
      />
    );
  } else if (tag === 'Race') {
    return (
      <RaceSelector 
        value={rangeValues} 
        onChange={handleChange} 
      />
    );
  } else if (tag === 'Income') {
    return (
      <IncomeRangeSelector 
        value={rangeValues} 
        onChange={handleChange} 
      />
    );
  } else if (tag === 'Pet Owner') {
    return (
      <PetOwnerSelector 
        value={rangeValues} 
        onChange={handleChange} 
      />
    );
  } else if (tag === 'Relationship') {
    return (
      <RelationshipSelector 
        value={rangeValues} 
        onChange={handleChange} 
      />
    );
  } else if (tag === 'Education') {
    return (
      <EducationLevelSelector 
        value={rangeValues} 
        onChange={handleChange} 
      />
    );
  } else if (tag === 'Politics') {
    return (
      <PoliticsSelector 
        value={rangeValues} 
        onChange={handleChange} 
      />
    );
  }
  
  return null;
};

// Helper function to get default range values based on tag
function getDefaultRangeValues(tag) {
  switch (tag) {
    case 'Age':
      return { min: 18, max: 65 };
    case 'Gender':
      return { gender: 'male' };
    case 'Race':
      return { race: 'white' };
    case 'Income':
      return { 
        range: 'low', 
        min: 0, 
        max: 50000,
        label: '$0 - $50,000'
      };
    case 'Pet Owner':
      return { 
        pet: 'dog',
        displayValue: 'Dog'
      };
    case 'Relationship':
      return { 
        status: 'single',
        displayValue: 'Single' 
      };
    case 'Education':
      return { 
        level: 'high-school',
        displayValue: 'High School or Less'
      };
    case 'Politics':
      return { 
        value: 50, // Middle of the spectrum by default
        displayText: 'Moderate'
      };
    default:
      return {};
  }
}

// Age Range Selector Component
const AgeRangeSelector = ({ value, onChange }) => {
  const [minAge, setMinAge] = useState(value?.min || 18);
  const [maxAge, setMaxAge] = useState(value?.max || 65);
  
  useEffect(() => {
    if (value?.min !== undefined) setMinAge(value.min);
    if (value?.max !== undefined) setMaxAge(value.max);
  }, [value]);

  const handleMinChange = (e) => {
    const newMin = Math.min(parseInt(e.target.value), maxAge);
    setMinAge(newMin);
    onChange({ min: newMin, max: maxAge });
  };

  const handleMaxChange = (e) => {
    const newMax = Math.max(parseInt(e.target.value), minAge);
    setMaxAge(newMax);
    onChange({ min: minAge, max: newMax });
  };

  return (
    <div className="my-3 p-4 bg-gray-50 rounded-lg">
      <div className="mb-2">
        <label className="block text-xs text-gray-600 mb-1">Age Range</label>
        <div className="flex items-center">
          <input
            type="range"
            min="13"
            max="100"
            value={minAge}
            onChange={handleMinChange}
            className="w-full h-2 bg-blue-100 rounded-lg appearance-none cursor-pointer"
          />
          <span className="ml-2 w-9 text-center text-sm text-gray-700">{minAge}</span>
        </div>
      </div>
      <div>
        <div className="flex items-center">
          <input
            type="range"
            min="13"
            max="100"
            value={maxAge}
            onChange={handleMaxChange}
            className="w-full h-2 bg-blue-100 rounded-lg appearance-none cursor-pointer"
          />
          <span className="ml-2 w-9 text-center text-sm text-gray-700">{maxAge}</span>
        </div>
      </div>
      <div className="mt-2 text-center text-xs text-gray-500">
        Current selection: Ages {minAge} to {maxAge}
      </div>
    </div>
  );
};

// Income Range Selector Component
const IncomeRangeSelector = ({ value, onChange }) => {
  const [incomeRange, setIncomeRange] = useState(value?.range || 'low');

  useEffect(() => {
    if (value?.range) setIncomeRange(value.range);
  }, [value]);

  const incomeOptions = [
    { id: 'low', label: '$0 - $50,000', min: 0, max: 50000 },
    { id: 'medium', label: '$50,000 - $100,000', min: 50000, max: 100000 },
    { id: 'high', label: '$100,000 - $1,000,000', min: 100000, max: 1000000 },
    { id: 'very-high', label: '$1,000,000+', min: 1000000, max: null }
  ];

  const handleChange = (newRange) => {
    setIncomeRange(newRange);
    // Find the selected option
    const selectedOption = incomeOptions.find(option => option.id === newRange);
    onChange({ 
      range: newRange,
      min: selectedOption.min,
      max: selectedOption.max,
      label: selectedOption.label
    });
  };

  return (
    <div className="my-3 p-4 bg-gray-50 rounded-lg">
      <label className="block text-xs text-gray-600 mb-3">Select Income Range</label>
      <div className="grid grid-cols-1 gap-2">
        {incomeOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
              incomeRange === option.id
                ? 'bg-blue-100 border-blue-300 text-blue-700 shadow-sm'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
            onClick={() => handleChange(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
};

// Education Level Selector Component
const EducationLevelSelector = ({ value, onChange }) => {
  const [level, setLevel] = useState(value?.level || 'high-school');
  
  useEffect(() => {
    if (value?.level) setLevel(value.level);
  }, [value]);

  // Updated with simplified 4 options as requested
  const educationLevels = [
    { id: 'high-school', label: 'High School or Less' },
    { id: 'some-college', label: 'Some College' },
    { id: 'bachelor', label: 'Bachelor\'s Degree' },
    { id: 'graduate', label: 'Graduate Degree' }
  ];

  const handleChange = (newLevel) => {
    setLevel(newLevel);
    const option = educationLevels.find(edu => edu.id === newLevel);
    onChange({ 
      level: newLevel,
      displayValue: option.label
    });
  };

  return (
    <div className="my-3 p-4 bg-gray-50 rounded-lg">
      <label className="block text-xs text-gray-600 mb-3">Education Level</label>
      <div className="grid grid-cols-1 gap-2">
        {educationLevels.map((edu) => (
          <button
            key={edu.id}
            type="button"
            className={`px-4 py-2 text-sm rounded-lg border text-left ${
              level === edu.id
                ? 'bg-blue-100 border-blue-300 text-blue-700 shadow-sm'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
            onClick={() => handleChange(edu.id)}
          >
            {edu.label}
          </button>
        ))}
      </div>
    </div>
  );
};

// Gender Selector Component
const GenderSelector = ({ value, onChange }) => {
  const [gender, setGender] = useState(value?.gender || 'male');

  useEffect(() => {
    if (value?.gender) setGender(value.gender);
  }, [value]);

  const genderOptions = [
    { id: 'male', label: 'Male' },
    { id: 'female', label: 'Female' }
  ];

  const handleChange = (newGender) => {
    setGender(newGender);
    onChange({ gender: newGender });
  };

  return (
    <div className="my-3 p-4 bg-gray-50 rounded-lg">
      <label className="block text-xs text-gray-600 mb-3">Select Gender</label>
      <div className="flex gap-3 justify-center">
        {genderOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`px-5 py-2 rounded-lg border text-sm font-medium transition-all ${
              gender === option.id
                ? 'bg-blue-100 border-blue-300 text-blue-700 shadow-sm'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
            onClick={() => handleChange(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
};

// Race Selector Component
const RaceSelector = ({ value, onChange }) => {
  const [race, setRace] = useState(value?.race || 'white');

  useEffect(() => {
    if (value?.race) setRace(value.race);
  }, [value]);

  const raceOptions = [
    { id: 'white', label: 'White' },
    { id: 'black', label: 'Black or African American' },
    { id: 'american-indian', label: 'American Indian or Alaska Native' },
    { id: 'asian', label: 'Asian' },
    { id: 'pacific-islander', label: 'Native Hawaiian or Other Pacific Islander' }
  ];

  const handleChange = (newRace) => {
    setRace(newRace);
    onChange({ race: newRace });
  };

  return (
    <div className="my-3 p-4 bg-gray-50 rounded-lg">
      <label className="block text-xs text-gray-600 mb-3">Select Race</label>
      <div className="grid grid-cols-1 gap-2">
        {raceOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all text-left ${
              race === option.id
                ? 'bg-blue-100 border-blue-300 text-blue-700 shadow-sm'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
            onClick={() => handleChange(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
};

// Pet Owner Selector Component
const PetOwnerSelector = ({ value, onChange }) => {
  const [petType, setPetType] = useState(value?.pet || 'dog');
  const [otherPet, setOtherPet] = useState(value?.otherValue || '');
  const [showOtherInput, setShowOtherInput] = useState(petType === 'other');

  useEffect(() => {
    if (value?.pet) {
      setPetType(value.pet);
      setShowOtherInput(value.pet === 'other');
    }
    if (value?.otherValue) {
      setOtherPet(value.otherValue);
    }
  }, [value]);

  const petOptions = [
    { id: 'dog', label: 'Dog' },
    { id: 'cat', label: 'Cat' },
    { id: 'other', label: 'Other' }
  ];

  const handlePetChange = (newPet) => {
    setPetType(newPet);
    setShowOtherInput(newPet === 'other');
    
    if (newPet === 'other') {
      // When switching to "Other", keep the previous custom value if it exists
      onChange({ 
        pet: newPet, 
        otherValue: otherPet || '',
        // Store normalized lowercase value for case-insensitive comparison
        searchValue: otherPet ? otherPet.toLowerCase() : '',
        displayValue: otherPet || 'Other'
      });
    } else {
      // For standard options, use the predefined label
      const option = petOptions.find(opt => opt.id === newPet);
      onChange({ 
        pet: newPet,
        // Store normalized lowercase value for case-insensitive comparison
        searchValue: option.label.toLowerCase(),
        displayValue: option.label
      });
    }
  };

  const handleOtherPetChange = (e) => {
    const value = e.target.value;
    setOtherPet(value);
    onChange({
      pet: 'other',
      otherValue: value,
      // Store normalized lowercase value for case-insensitive comparison
      searchValue: value.toLowerCase(),
      displayValue: value || 'Other'
    });
  };

  return (
    <div className="my-3 p-4 bg-gray-50 rounded-lg">
      <label className="block text-xs text-gray-600 mb-3">Select Pet Type</label>
      <div className="flex flex-wrap gap-3 justify-center mb-3">
        {petOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`px-5 py-2 rounded-lg border text-sm font-medium transition-all ${
              petType === option.id
                ? 'bg-blue-100 border-blue-300 text-blue-700 shadow-sm'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
            onClick={() => handlePetChange(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
      
      {showOtherInput && (
        <div className="mt-3">
          <label htmlFor="otherPet" className="block text-xs text-gray-600 mb-1">
            Specify Pet Type
          </label>
          <input
            id="otherPet"
            type="text"
            value={otherPet}
            onChange={handleOtherPetChange}
            placeholder="e.g., Bird, Fish, Rabbit..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
          <p className="mt-1 text-xs text-gray-500">
            Note: Matching is case-insensitive
          </p>
        </div>
      )}
    </div>
  );
};

// Relationship Selector Component
const RelationshipSelector = ({ value, onChange }) => {
  const [status, setStatus] = useState(value?.status || 'single');

  useEffect(() => {
    if (value?.status) setStatus(value.status);
  }, [value]);

  const relationshipOptions = [
    { id: 'single', label: 'Single' },
    { id: 'relationship', label: 'In a Relationship' },
    { id: 'married', label: 'Married' },
    { id: 'divorced', label: 'Divorced' }
  ];

  const handleChange = (newStatus) => {
    setStatus(newStatus);
    const option = relationshipOptions.find(opt => opt.id === newStatus);
    onChange({ 
      status: newStatus,
      displayValue: option.label
    });
  };

  return (
    <div className="my-3 p-4 bg-gray-50 rounded-lg">
      <label className="block text-xs text-gray-600 mb-3">Select Relationship Status</label>
      <div className="grid grid-cols-1 gap-2">
        {relationshipOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all text-left ${
              status === option.id
                ? 'bg-blue-100 border-blue-300 text-blue-700 shadow-sm'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
            onClick={() => handleChange(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
};

// Politics Selector Component
const PoliticsSelector = ({ value, onChange }) => {
  const [sliderValue, setSliderValue] = useState(value?.value || 50);
  
  useEffect(() => {
    if (value?.value !== undefined) setSliderValue(value.value);
  }, [value]);

  const getPositionText = (val) => {
    if (val < 15) return 'Very Liberal';
    if (val < 35) return 'Liberal';
    if (val >= 35 && val <= 65) return 'Moderate';
    if (val < 85) return 'Conservative';
    return 'Very Conservative';
  };
  
  const handleChange = (e) => {
    const newValue = parseInt(e.target.value);
    setSliderValue(newValue);
    
    const displayText = getPositionText(newValue);
    onChange({ 
      value: newValue,
      displayText: displayText
    });
  };

  return (
    <div className="my-3 p-4 bg-gray-50 rounded-lg">
      <label className="block text-xs text-gray-600 mb-3">Political Orientation</label>
      
      <div className="relative pt-1">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-blue-700 font-semibold">Liberal</span>
          <span className="text-xs text-red-700 font-semibold">Conservative</span>
        </div>
        
        <input
          type="range"
          min="0"
          max="100"
          value={sliderValue}
          onChange={handleChange}
          className="w-full h-2 bg-gradient-to-r from-blue-400 via-purple-200 to-red-400 rounded-lg appearance-none cursor-pointer"
        />
        
        <div className="flex justify-center mt-4">
          <span className="inline-block py-1 px-3 bg-gray-100 text-gray-800 text-sm font-medium rounded-full border border-gray-300">
            {getPositionText(sliderValue)}
          </span>
        </div>
        
        {/* Value indicator ticks */}
        <div className="relative mt-2">
          <div className="flex justify-between">
            <div className="text-xs text-gray-500">|</div>
            <div className="text-xs text-gray-500">|</div>
            <div className="text-xs text-gray-500">|</div>
            <div className="text-xs text-gray-500">|</div>
            <div className="text-xs text-gray-500">|</div>
          </div>
          <div className="flex justify-between text-[10px] text-gray-500 px-1">
            <div>V. Liberal</div>
            <div>Liberal</div>
            <div>Moderate</div>
            <div>Conservative</div>
            <div>V. Conservative</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TagRangeSelector;