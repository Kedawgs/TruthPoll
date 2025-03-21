import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Web3Context } from '../context/Web3Context';

const CreatePoll = () => {
  const navigate = useNavigate();
  const { createPoll, isConnected, error: web3Error } = useContext(Web3Context);
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [duration, setDuration] = useState('0'); // 0 means no end time
  const [category, setCategory] = useState('General');
  const [tags, setTags] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Categories list
  const categories = [
    'General',
    'Politics',
    'Technology',
    'Sports',
    'Entertainment',
    'Other'
  ];
  
  // Duration options
  const durationOptions = [
    { value: '0', label: 'No end time' },
    { value: '3600', label: '1 hour' },
    { value: '86400', label: '1 day' },
    { value: '604800', label: '1 week' },
    { value: '2592000', label: '30 days' }
  ];
  
  // Add option field
  const addOption = () => {
    setOptions([...options, '']);
  };
  
  // Remove option field
  const removeOption = (index) => {
    if (options.length > 2) {
      const newOptions = [...options];
      newOptions.splice(index, 1);
      setOptions(newOptions);
    }
  };
  
  // Handle option change
  const handleOptionChange = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate form
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    
    const validOptions = options.filter(option => option.trim().length > 0);
    if (validOptions.length < 2) {
      setError('At least two options are required');
      return;
    }
    
    if (!isConnected) {
      setError('Please connect your wallet first');
      return;
    }
    
    // Prepare tags array
    const tagsArray = tags
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);
    
    try {
      setLoading(true);
      setError('');
      
      // Create poll
      const response = await createPoll({
        title,
        description,
        options: validOptions,
        duration: parseInt(duration),
        category,
        tags: tagsArray
      });
      
      // Redirect to poll page on success
      navigate(`/polls/${response.data._id}`);
    } catch (err) {
      console.error('Error creating poll:', err);
      setError(err.response?.data?.error || 'Failed to create poll');
      setLoading(false);
    }
  };
  
  if (!isConnected) {
    return (
      <div className="max-w-3xl mx-auto mt-10 p-8 bg-white rounded-lg shadow-md">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Connect Wallet to Create a Poll</h2>
          <p className="mb-4 text-gray-600">
            You need to connect your wallet to create a poll. Click the "Connect Wallet" button in the navigation bar.
          </p>
          <button 
            onClick={() => navigate('/')} 
            className="btn btn-primary"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="max-w-3xl mx-auto my-10 p-8 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-6">Create a New Poll</h1>
      
      {error && (
        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700">
          <p>{error}</p>
        </div>
      )}
      
      {web3Error && (
        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700">
          <p>{web3Error}</p>
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        {/* Title */}
        <div className="mb-6">
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            placeholder="Enter poll title"
            required
          />
        </div>
        
        {/* Description */}
        <div className="mb-6">
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows="3"
            className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            placeholder="Enter poll description (optional)"
          ></textarea>
        </div>
        
        {/* Options */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Options <span className="text-red-500">*</span>
          </label>
          
          {options.map((option, index) => (
            <div key={index} className="flex items-center mb-2">
              <input
                type="text"
                value={option}
                onChange={(e) => handleOptionChange(index, e.target.value)}
                className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                placeholder={`Option ${index + 1}`}
                required
              />
              
              {options.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeOption(index)}
                  className="ml-2 text-red-500 hover:text-red-700"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          
          <button
            type="button"
            onClick={addOption}
            className="mt-2 inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded text-primary-700 bg-primary-100 hover:bg-primary-200 focus:outline-none"
          >
            + Add Option
          </button>
        </div>
        
        {/* Duration */}
        <div className="mb-6">
          <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-1">
            Poll Duration
          </label>
          <select
            id="duration"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
          >
            {durationOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        
        {/* Category */}
        <div className="mb-6">
          <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
            Category
          </label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
        
        {/* Tags */}
        <div className="mb-6">
          <label htmlFor="tags" className="block text-sm font-medium text-gray-700 mb-1">
            Tags (comma separated)
          </label>
          <input
            type="text"
            id="tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            placeholder="e.g. blockchain, voting, technology"
          />
          <p className="mt-1 text-sm text-gray-500">
            Separate tags with commas (e.g. blockchain, voting, technology)
          </p>
        </div>
        
        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
          >
            {loading ? 'Creating Poll...' : 'Create Poll'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreatePoll;