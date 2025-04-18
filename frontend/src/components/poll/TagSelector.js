// src/components/poll/TagSelector.js
import React, { useState, useEffect } from 'react';
import TagRangeSelector from './TagRangeSelector';

// Constants
const AVAILABLE_TAGS = [
  'Age', 'Gender', 'Race', 'Income', 'Pet Owner', 'Relationship', 'Education', 'Politics'
];
const MAX_SELECTED_TAGS = 5;

// Tags that have range filters
const RANGE_TAGS = ['Age', 'Income', 'Education', 'Politics'];

const TagSelector = ({ selectedTags, setSelectedTags, tagFilters, setTagFilters, errors }) => {
  const [expandedTag, setExpandedTag] = useState(null);
  
  // When selectedTags changes, expand the newly added tag if it has a range
  useEffect(() => {
    // Find first range tag that's selected but doesn't have filters set
    const newRangeTag = selectedTags.find(tag => 
      RANGE_TAGS.includes(tag) && 
      (!tagFilters || !tagFilters[tag])
    );
    
    if (newRangeTag) {
      setExpandedTag(newRangeTag);
    }
  }, [selectedTags, tagFilters]);

  // Toggle tag selection
  const toggleTag = (tag) => {
    if (selectedTags.includes(tag)) {
      // Remove tag
      setSelectedTags(selectedTags.filter(t => t !== tag));
      
      // Also remove any filters for this tag
      if (tagFilters && tagFilters[tag]) {
        const newFilters = { ...tagFilters };
        delete newFilters[tag];
        setTagFilters(newFilters);
      }
      
      // If this was the expanded tag, collapse it
      if (expandedTag === tag) {
        setExpandedTag(null);
      }
    } else if (selectedTags.length < MAX_SELECTED_TAGS) {
      // Add tag
      setSelectedTags([...selectedTags, tag]);
      
      // If this tag has range options, expand it
      if (RANGE_TAGS.includes(tag)) {
        setExpandedTag(tag);
      }
    }
  };

  // Handle range filter changes
  const handleRangeChange = (tag, values) => {
    setTagFilters({
      ...tagFilters,
      [tag]: values
    });
  };

  // Format tag display text based on any filters
  const getTagDisplayText = (tag) => {
    if (!tagFilters || !tagFilters[tag]) return tag;
    
    const filter = tagFilters[tag];
    
    if (tag === 'Age' && filter.min !== undefined && filter.max !== undefined) {
      return `Age: ${filter.min}-${filter.max}`;
    }
    
    if (tag === 'Income' && filter.min !== undefined && filter.max !== undefined) {
      // Format currency values
      const minFormatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0
      }).format(filter.min);
      
      const maxFormatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0
      }).format(filter.max);
      
      return `Income: ${minFormatted}-${maxFormatted}`;
    }
    
    if (tag === 'Education' && filter.level) {
      if (filter.displayValue) {
        return `Education: ${filter.displayValue}`;
      }
      
      const levelMap = {
        'high-school': 'High School or Less',
        'some-college': 'Some College',
        'bachelor': 'Bachelor\'s Degree',
        'graduate': 'Graduate Degree'
      };
      
      return `Education: ${levelMap[filter.level] || filter.level}`;
    }
    
    if (tag === 'Politics' && filter.value !== undefined) {
      if (filter.displayText) {
        return `Politics: ${filter.displayText}`;
      }
      
      // Generate display text based on value if not provided
      let position = 'Moderate';
      const value = filter.value;
      
      if (value < 15) position = 'Very Liberal';
      else if (value < 35) position = 'Liberal';
      else if (value >= 35 && value <= 65) position = 'Moderate';
      else if (value < 85) position = 'Conservative';
      else position = 'Very Conservative';
      
      return `Politics: ${position}`;
    }
    
    return tag;
  };

  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-2">
        <label className="block text-sm font-medium">Tags (Optional)</label>
        <span className="text-xs text-gray-500">{selectedTags.length}/{MAX_SELECTED_TAGS} selected</span>
      </div>
      
      {/* Selected Tags Display */}
      {selectedTags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {selectedTags.map(tag => (
            <div key={tag} className="group relative">
              <button
                type="button"
                onClick={() => toggleTag(tag)}
                className="px-3 py-1 text-sm rounded-full bg-primary-100 text-primary-800 font-medium flex items-center gap-1"
              >
                <span>{getTagDisplayText(tag)}</span>
                <svg className="w-3.5 h-3.5 opacity-70" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
              
              {RANGE_TAGS.includes(tag) && tag !== expandedTag && (
                <button
                  type="button"
                  onClick={() => setExpandedTag(tag)}
                  className="absolute -top-1 -right-1 px-1 rounded-full bg-blue-500 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Edit range"
                >
                  ⚙️
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      
      {/* Range Selector for expanded tag */}
      {expandedTag && (
        <div className="mb-3">
          <div className="flex justify-between items-center mb-1">
            <h4 className="text-sm font-medium text-gray-700">Set {expandedTag} Range</h4>
            <button 
              type="button" 
              onClick={() => setExpandedTag(null)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Done
            </button>
          </div>
          <TagRangeSelector 
            tag={expandedTag} 
            value={tagFilters && tagFilters[expandedTag]}
            onChange={handleRangeChange} 
          />
        </div>
      )}
      
      {/* Available Tags */}
      <div className="flex flex-wrap gap-2">
        {AVAILABLE_TAGS.map(tag => (
          <button
            key={tag}
            type="button"
            onClick={() => toggleTag(tag)}
            className={`px-3 py-1 text-sm rounded-full ${
              selectedTags.includes(tag)
                ? 'bg-primary-100 text-primary-800 font-medium'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            } ${selectedTags.length >= MAX_SELECTED_TAGS && !selectedTags.includes(tag) ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={selectedTags.length >= MAX_SELECTED_TAGS && !selectedTags.includes(tag)}
          >
            {tag}
          </button>
        ))}
      </div>
      {errors?.tags && (
        <p className="mt-1 text-sm text-red-600">{errors.tags}</p>
      )}
    </div>
  );
};

export default TagSelector;