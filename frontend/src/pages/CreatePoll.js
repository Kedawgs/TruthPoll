// src/pages/CreatePoll.js
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../hooks/useAppContext';
import api from '../utils/api';
import PollConfirmationModal from '../components/PollConfirmationModal';
import { formatUSDT } from '../utils/web3Helper';
import './CreatePoll.css';

// Import refactored components
import OptionInput from '../components/poll/OptionInput';
import TagSelector from '../components/poll/TagSelector';
import ImageUpload from '../components/poll/ImageUpload';
import RewardSettings from '../components/poll/RewardSettings';

// --- Icons ---
const ImagePlaceholderIcon = () => (
  <svg className="h-6 w-6 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
  </svg>
);

const RemoveIcon = () => (
  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
  </svg>
);

// --- Constants ---
const AVAILABLE_TAGS = [
  'Age', 'Gender', 'Race', 'Income', 'Pet Owner', 'Relationship', 'Education', 'Politics'
];
const MAX_SELECTED_TAGS = 5;

const CreatePoll = () => {
  const navigate = useNavigate();
  const {
    createPoll, isConnected, account, openAuthModal,
    pollLoading, pollError, usdtBalance, refreshUSDTBalance,
    smartWalletAddress, getConfigValue
  } = useAppContext();

  // --- State ---
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [selectedTags, setSelectedTags] = useState([]);
  const [tagFilters, setTagFilters] = useState({}); // Store filter ranges for tags like age
  const [expandedTag, setExpandedTag] = useState(null); // Track which tag's selector is open
  const [voteLimit, setVoteLimit] = useState('');
  const [rewardPerVoter, setRewardPerVoter] = useState('');
  const [formError, setFormError] = useState('');
  const [previewVotes, setPreviewVotes] = useState(0);
  const [previewVotePercentage, setPreviewVotePercentage] = useState(0);
  const [duration, setDuration] = useState('0'); // Default duration
  const [pollCreationSuccess, setPollCreationSuccess] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null); // State for uploaded image file
  
  // Confirmation modal state
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [preparedPollData, setPreparedPollData] = useState(null);
  const [uploadedImageData, setUploadedImageData] = useState(null); // Store uploaded image data

  // --- Memoized derived state ---
  const isRewardEnabled = useMemo(() => rewardPerVoter && parseFloat(rewardPerVoter) > 0, [rewardPerVoter]);
  const validOptions = useMemo(() => options.filter(option => option.trim().length > 0), [options]);
  const canAddMoreTags = useMemo(() => selectedTags.length < MAX_SELECTED_TAGS, [selectedTags]);
  const imagePreviewUrl = useMemo(() => selectedFile ? URL.createObjectURL(selectedFile) : null, [selectedFile]); // For preview

  // --- Effect to update preview votes ---
  useEffect(() => {
    const currentVoteLimit = voteLimit ? parseInt(voteLimit) : 0;
    if (currentVoteLimit > 0) {
      const randomVotes = Math.floor(Math.random() * (currentVoteLimit + 1));
      setPreviewVotes(randomVotes);
      setPreviewVotePercentage((randomVotes / currentVoteLimit) * 100);
    } else {
      setPreviewVotes(0);
      setPreviewVotePercentage(0);
    }
  }, [voteLimit]);

  // --- Effect to revoke object URL ---
  useEffect(() => {
    // Clean up the object URL when the component unmounts or the file changes
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  // --- Refresh USDT balance when component loads ---
  useEffect(() => {
    if (isConnected && refreshUSDTBalance) {
      refreshUSDTBalance();
    }
  }, [isConnected, refreshUSDTBalance]);

  // --- Event Handlers ---
  const addOption = () => {
    if (options.length < 10) {
      setOptions([...options, '']);
    }
  };

  const removeOption = (index) => {
    if (options.length <= 2) {
      setFormError('Poll must have at least two options.');
      return;
    }
    const newOptions = [...options];
    newOptions.splice(index, 1);
    setOptions(newOptions);
    setFormError(''); // Clear error immediately
  };

  const handleOptionChange = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
    // Clear error if we now have enough valid options
    if (formError === 'At least two valid options are required.' &&
        newOptions.filter(opt => opt.trim()).length >= 2) {
      setFormError('');
    }
  };

  const handleAddTag = (tagToAdd) => {
    // Clear any previous tag-related errors
    if (formError && formError.includes('tags')) {
      setFormError('');
    }

    if (selectedTags.includes(tagToAdd)) {
      // Tag already selected, remove it
      handleRemoveTag(tagToAdd);
      return;
    }

    if (selectedTags.length >= MAX_SELECTED_TAGS) {
      setFormError(`You can select a maximum of ${MAX_SELECTED_TAGS} tags.`);
      return;
    }

    // Add the tag
    setSelectedTags([...selectedTags, tagToAdd]);
    
    // Initialize tag filters for tags that need them
    if (['Age', 'Gender', 'Race', 'Income', 'Pet Owner', 'Relationship', 'Education', 'Politics'].includes(tagToAdd)) {
      let initialValue = {};
      
      switch (tagToAdd) {
        case 'Age':
          initialValue = { min: 18, max: 65 };
          break;
        case 'Gender':
          initialValue = { gender: 'male' };
          break;
        case 'Race':
          initialValue = { race: 'white' };
          break;
        case 'Income':
          initialValue = { 
            range: 'low', 
            min: 0, 
            max: 50000,
            label: '$0 - $50,000'
          };
          break;
        case 'Pet Owner':
          initialValue = { 
            pet: 'dog',
            searchValue: 'dog',
            displayValue: 'Dog'
          };
          break;
        case 'Relationship':
          initialValue = { 
            status: 'single',
            displayValue: 'Single' 
          };
          break;
        case 'Education':
          initialValue = { 
            level: 'high-school',
            displayValue: 'High School or Less'
          };
          break;
        case 'Politics':
          initialValue = { 
            value: 50, 
            displayText: 'Moderate'
          };
          break;
        default:
          break;
      }
      
      setTagFilters({
        ...tagFilters,
        [tagToAdd]: initialValue
      });
      
      // Open this tag's selector and close any previously open one
      setExpandedTag(tagToAdd);
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setSelectedTags(selectedTags.filter(tag => tag !== tagToRemove));
    
    // Also remove any filters for this tag
    if (tagFilters && tagFilters[tagToRemove]) {
      const newFilters = { ...tagFilters };
      delete newFilters[tagToRemove];
      setTagFilters(newFilters);
    }
    
    // If this was the expanded tag, close it
    if (expandedTag === tagToRemove) {
      setExpandedTag(null);
    }
    
    // Clear any tag-related errors
    if (formError && formError.includes('tags')) {
      setFormError('');
    }
  };

  // Handler for file input change
  const onFileChange = (event) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      // Optional: Add file size/type validation here
      setSelectedFile(file);
      setFormError(''); // Clear any previous errors related to file selection
    }
  };

  // --- Form Validation ---
  const validateForm = () => {
    if (!title.trim()) return 'Poll Title is required.';

    // Check for minimum option count and empty options
    const filteredOptions = options.filter(option => option.trim().length > 0);
    if (filteredOptions.length < 2) return 'At least two valid options are required.';

    // Validate max votes/vote limit
    if (!voteLimit) return 'Max Votes is required.';
    const voteLimitNum = parseInt(voteLimit);
    if (isNaN(voteLimitNum) || voteLimitNum <= 0) return 'Max Votes must be a positive number.';

    // Validate reward format if present
    if (rewardPerVoter) {
      const rewardNum = parseFloat(rewardPerVoter);
      if (isNaN(rewardNum)) return 'Reward per voter must be a valid number.';
      if (rewardNum < 0) return 'Reward per voter cannot be negative.';
    }

    // Check authentication
    if (!isConnected) return 'Please connect your wallet first.';

    return ''; // No errors
  };

  // --- Handle Image Upload ---
  const handleImageUpload = async () => {
    if (!selectedFile) return { image: null, imageUrl: null };
    
    const formData = new FormData();
    formData.append('image', selectedFile);
    
    try {
      const uploadResponse = await api.post('/polls/upload-image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      if (uploadResponse.data && uploadResponse.data.success) {
        return {
          image: uploadResponse.data.image,
          imageUrl: uploadResponse.data.imageUrl
        };
      } else {
        throw new Error(uploadResponse.data?.message || 'Image upload failed.');
      }
    } catch (uploadErr) {
      if (uploadErr.response && uploadErr.response.status === 401) {
        console.error('Authentication error during image upload:', uploadErr);
        const retryWithAuth = window.confirm(
          "Authentication error uploading image. Would you like to reconnect your wallet and try again?"
        );
        
        if (retryWithAuth) {
          openAuthModal();
          setFormError("Please reconnect your wallet and try again");
          throw new Error("Authentication required");
        }
      }
      
      console.error('Error uploading image:', uploadErr);
      throw uploadErr;
    }
  };

  // --- New Initial Form Submit (Show Confirmation) ---
  const handleInitialSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setPollCreationSuccess(false);

    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Filter out empty options
    const validOptionsSubmit = options.filter(option => option.trim().length > 0);

    try {
      // Upload image if needed
      let imageData = { image: null, imageUrl: null };
      
      if (selectedFile) {
        try {
          imageData = await handleImageUpload();
          setUploadedImageData(imageData);
        } catch (uploadErr) {
          // If it's an auth error, we'll return early
          if (uploadErr.message === "Authentication required") return;
          
          // For other errors, we'll continue without the image
          console.warn("Continuing without image due to upload error");
        }
      }

      // Prepare poll data
      const pollData = {
        title: title.trim(),
        description: description.trim(),
        options: validOptionsSubmit,
        duration: parseInt(duration || '0'),
        tags: selectedTags,
        tagFilters: tagFilters, // Include tag filters for restrictions
        category: 'General',
        rewardPerVoter: isRewardEnabled ? rewardPerVoter : '0',
        voteLimit: parseInt(voteLimit),
        image: imageData.image,
        imageUrl: imageData.imageUrl,
        previewFile: selectedFile // For preview in confirmation modal
      };

      // Store prepared data for confirmation modal
      setPreparedPollData(pollData);
      
      // Show confirmation modal
      setShowConfirmationModal(true);
    } catch (err) {
      console.error('Error preparing poll data:', err);
      setFormError(err?.message || 'An error occurred while preparing your poll.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // --- Final Form Submit (After Confirmation) ---
  const handleFinalSubmit = async (modifiedPollData) => {
    try {
      // Use modified poll data from confirmation modal if provided, otherwise use prepared data
      const dataToSubmit = modifiedPollData || preparedPollData;
      
      if (!dataToSubmit) {
        throw new Error("Poll data is missing");
      }
      
      console.log("Submitting poll with data:", dataToSubmit);
      
      // Submit the final poll data with fee calculations
      const response = await createPoll(dataToSubmit);
      
      if (response?.data?.poll?._id) {
        // Show success message briefly before redirecting
        setPollCreationSuccess(true);
        setTimeout(() => {
          navigate(`/polls/id/${response.data.poll._id}`);
        }, 1000);
        return {
          success: true,
          data: response.data
        };
      } else {
        console.warn("Poll created but response format unexpected:", response);
        setFormError("Poll created, but couldn't redirect to the poll page. Please check your polls list.");
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return false;
      }
    } catch (err) {
      console.error('Error creating poll:', err);
      // Improved error message extraction
      const errorMsg = err?.response?.data?.error ||
                     err?.response?.data?.message ||
                     err.message ||
                     'An unexpected error occurred during poll creation.';
      setFormError(errorMsg);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setShowConfirmationModal(false);
      return false;
    }
  };

  // --- Handle modal close ---
  const handleCloseConfirmationModal = () => {
    setShowConfirmationModal(false);
  };

  // --- Render Logic ---
  if (!isConnected) {
    return ( // Connect Wallet Prompt
      <div className="max-w-md mx-auto mt-20 p-8 bg-white rounded-xl shadow-lg text-center border border-gray-200">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">Create Your Poll</h2>
        <p className="mb-6 text-gray-600">Connect your wallet or sign in to start creating decentralized polls.</p>
        <button 
          onClick={openAuthModal} 
          className="inline-flex items-center px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold rounded-lg shadow hover:from-cyan-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-150 ease-in-out"
        >
          Connect / Sign In
        </button>
      </div>
    );
  }

  // Main Create Poll Form
  return (
    <div className="max-w-7xl mx-auto my-10 px-4 sm:px-6 lg:px-8">
      {/* Improved Error Display */}
      {(formError || pollError) && (
        <div className="sticky top-0 z-50 mb-6 p-4 bg-red-50 border-l-4 border-red-400 text-red-700 rounded-md shadow-md" role="alert">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium">{formError || pollError}</p>
            </div>
          </div>
        </div>
      )}

      {/* Success Message */}
      {pollCreationSuccess && (
        <div className="sticky top-0 z-50 mb-6 p-4 bg-green-50 border-l-4 border-green-400 text-green-700 rounded-md shadow-md" role="alert">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium">Poll created successfully! Redirecting...</p>
            </div>
          </div>
        </div>
      )}

      {/* Main 2-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 xl:gap-12 items-start">
        {/* --- Left Column: Form --- */}
        <div className="bg-white p-6 md:p-8 rounded-xl border border-gray-200/75 shadow-lg">
          <form onSubmit={handleInitialSubmit} className="space-y-6">
            {/* Title & Image Icon Row */}
            <div className="flex items-start space-x-3 sm:space-x-4">
              <div className="flex-shrink-0 mt-1">
                <label htmlFor="poll-image-upload" className="cursor-pointer group block" title="Upload Poll Icon">
                  <span className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-slate-100 group-hover:bg-slate-200 border border-slate-300/75 transition-colors overflow-hidden">
                    {imagePreviewUrl ? (
                      <img src={imagePreviewUrl} alt="Poll Icon Preview" className="w-full h-full object-cover" />
                    ) : (
                      <ImagePlaceholderIcon />
                    )}
                  </span>
                  <input
                    id="poll-image-upload"
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={onFileChange}
                  />
                </label>
              </div>

              <div className="flex-grow min-w-0">
                <label htmlFor="title" className="block text-sm font-bold text-gray-700 mb-1">
                  Poll Title <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    id="title"
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      // Clear error if field was previously empty but now has content
                      if (formError === 'Poll Title is required.' && e.target.value.trim()) {
                        setFormError('');
                      }
                    }}
                    className={`block w-full ${
                      formError === 'Poll Title is required.'
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                        : 'border-gray-300 focus:border-cyan-500 focus:ring-cyan-500'
                    } rounded-lg shadow-sm py-2.5 px-3.5 sm:text-sm`}
                    placeholder="What's your question?"
                    required
                    aria-required="true"
                  />
                  {formError === 'Poll Title is required.' && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
                {formError === 'Poll Title is required.' && (
                  <p className="mt-1 text-sm text-red-600">Please enter a poll title</p>
                )}
              </div>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="block w-full border-gray-300 rounded-lg shadow-sm py-2.5 px-3.5 focus:border-cyan-500 focus:ring-cyan-500 sm:text-sm"
                rows={4}
                placeholder="Add context, background, or rules..."
              ></textarea>
            </div>

            {/* Vote Limit & Reward Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="voteLimit" className="block text-sm font-bold text-gray-700 mb-1">
                  Max Votes <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="voteLimit"
                    type="number"
                    value={voteLimit}
                    onChange={(e) => {
                      setVoteLimit(e.target.value);
                      if (formError && formError.includes('Max Votes')) {
                        setFormError('');
                      }
                    }}
                    className={`block w-full ${
                      formError && formError.includes('Max Votes')
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                        : 'border-gray-300 focus:border-cyan-500 focus:ring-cyan-500'
                    } rounded-lg shadow-sm py-2.5 px-3.5 sm:text-sm`}
                    placeholder="e.g., 1000"
                    min="1"
                    required
                    aria-required="true"
                  />
                  {formError && formError.includes('Max Votes') && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
                {formError && formError.includes('Max Votes') && (
                  <p className="mt-1 text-sm text-red-600">{formError}</p>
                )}
              </div>

              <div>
                <label htmlFor="rewardPerVoter" className="block text-sm font-medium text-gray-700 mb-1">
                  Reward / Vote (Optional)
                </label>
                <div className="relative">
                  <input
                    id="rewardPerVoter"
                    type="number"
                    value={rewardPerVoter}
                    onChange={(e) => {
                      setRewardPerVoter(e.target.value);
                      if (formError && formError.includes('Reward')) {
                        setFormError('');
                      }
                    }}
                    className={`block w-full ${
                      formError && formError.includes('Reward')
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                        : 'border-gray-300 focus:border-cyan-500 focus:ring-cyan-500'
                    } rounded-lg shadow-sm py-2.5 px-3.5 sm:text-sm`}
                    placeholder="e.g., 0.01"
                    step="any"
                    min="0"
                  />
                  {formError && formError.includes('Reward') && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
                {formError && formError.includes('Reward') && (
                  <p className="mt-1 text-sm text-red-600">{formError}</p>
                )}
              </div>
            </div>

            {/* Tags Selector with Range Support */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Tags (Select up to {MAX_SELECTED_TAGS})
              </label>
              
              {/* Using the enhanced TagSelector component */}
              <div className="mb-3 p-3 border border-gray-200 rounded-lg bg-slate-50 min-h-[44px] flex flex-col">
                {selectedTags.length === 0 ? (
                  <span className="text-sm text-gray-400 italic">Click tags below to add</span>
                ) : (
                  <div className="flex flex-wrap gap-2 items-center">
                    {selectedTags.map((tag) => {
                      // Format tag display text based on any range filters
                      let displayText = tag;
                      
                      if (tagFilters && tagFilters[tag]) {
                        if (tag === 'Age' && tagFilters[tag].min !== undefined && tagFilters[tag].max !== undefined) {
                          displayText = `Age: ${tagFilters[tag].min}-${tagFilters[tag].max}`;
                        } else if (tag === 'Gender' && tagFilters[tag].gender) {
                          displayText = `Gender: ${tagFilters[tag].gender.charAt(0).toUpperCase() + tagFilters[tag].gender.slice(1)}`;
                        } else if (tag === 'Race' && tagFilters[tag].race) {
                          const raceMap = {
                            'white': 'White',
                            'black': 'Black or African American',
                            'american-indian': 'American Indian or Alaska Native',
                            'asian': 'Asian',
                            'pacific-islander': 'Native Hawaiian or Pacific Islander'
                          };
                          displayText = `Race: ${raceMap[tagFilters[tag].race] || tagFilters[tag].race}`;
                        } else if (tag === 'Income' && tagFilters[tag].range) {
                          if (tagFilters[tag].label) {
                            displayText = `Income: ${tagFilters[tag].label}`;
                          } else {
                            const rangeLabels = {
                              'low': '$0 - $50,000',
                              'medium': '$50,000 - $100,000',
                              'high': '$100,000 - $1,000,000',
                              'very-high': '$1,000,000+'
                            };
                            displayText = `Income: ${rangeLabels[tagFilters[tag].range] || tagFilters[tag].range}`;
                          }
                        } else if (tag === 'Education' && tagFilters[tag].level) {
                          if (tagFilters[tag].displayValue) {
                            displayText = `Education: ${tagFilters[tag].displayValue}`;
                          } else {
                            const levelMap = {
                              'high-school': 'High School or Less',
                              'some-college': 'Some College',
                              'bachelor': 'Bachelor\'s Degree',
                              'graduate': 'Graduate Degree'
                            };
                            displayText = `Education: ${levelMap[tagFilters[tag].level] || tagFilters[tag].level}`;
                          }
                        }
                      }
                      
                      const isFilterableTag = ['Age', 'Gender', 'Race', 'Income', 'Pet Owner', 'Relationship', 'Education', 'Politics'].includes(tag);
                      
                      return (
                        <span key={tag} className="inline-flex items-center pl-3 pr-1.5 py-1 rounded-full text-sm font-medium bg-cyan-600 text-white shadow-sm">
                          {displayText}
                          {isFilterableTag && (
                            <button
                              type="button"
                              onClick={() => setExpandedTag(expandedTag === tag ? null : tag)}
                              className="ml-1 flex-shrink-0 p-0.5 text-cyan-100 hover:text-white hover:bg-cyan-700/50 rounded-full focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-cyan-400"
                              aria-label={`Edit ${tag} filter`}
                            >
                              ⚙️
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(tag)}
                            className="ml-0.5 flex-shrink-0 p-0.5 text-cyan-100 hover:text-white hover:bg-cyan-700 rounded-full focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-cyan-400"
                            aria-label={`Remove ${tag} tag`}
                          >
                            <RemoveIcon />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
                
                {/* Range Selector for Tags */}
                {selectedTags.some(tag => ['Age', 'Gender', 'Race', 'Income', 'Pet Owner', 'Relationship', 'Education', 'Politics'].includes(tag)) && (
                  <div className="mt-4 border-t border-gray-200 pt-4">
                    {/* Show filter configuration for expanded tag */}
                    
                    {/* Tag Range Selectors */}
                    {expandedTag === 'Age' && (
                      <div key="age-range" className="mb-3">
                        <div className="flex justify-between items-center mb-1">
                          <h4 className="text-sm font-medium text-gray-700">Set Age Range</h4>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <div className="flex flex-col space-y-3">
                            <div className="flex items-center">
                              <span className="w-10 text-xs text-gray-500">Min</span>
                              <input
                                type="range"
                                min="13"
                                max="100"
                                value={tagFilters?.Age?.min || 18}
                                onChange={(e) => {
                                  const newMin = Math.min(parseInt(e.target.value), tagFilters?.Age?.max || 65);
                                  setTagFilters({
                                    ...tagFilters,
                                    Age: { 
                                      ...tagFilters?.Age,
                                      min: newMin 
                                    }
                                  });
                                }}
                                className="flex-grow h-2 bg-blue-100 rounded-lg appearance-none cursor-pointer"
                              />
                              <span className="ml-2 w-8 text-center text-sm text-gray-700">
                                {tagFilters?.Age?.min || 18}
                              </span>
                            </div>
                            <div className="flex items-center">
                              <span className="w-10 text-xs text-gray-500">Max</span>
                              <input
                                type="range"
                                min="13"
                                max="100"
                                value={tagFilters?.Age?.max || 65}
                                onChange={(e) => {
                                  const newMax = Math.max(parseInt(e.target.value), tagFilters?.Age?.min || 18);
                                  setTagFilters({
                                    ...tagFilters,
                                    Age: { 
                                      ...tagFilters?.Age,
                                      max: newMax 
                                    }
                                  });
                                }}
                                className="flex-grow h-2 bg-blue-100 rounded-lg appearance-none cursor-pointer"
                              />
                              <span className="ml-2 w-8 text-center text-sm text-gray-700">
                                {tagFilters?.Age?.max || 65}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {expandedTag === 'Gender' && (
                      <div key="gender-select" className="mb-3">
                        <div className="flex justify-between items-center mb-1">
                          <h4 className="text-sm font-medium text-gray-700">Select Gender</h4>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <div className="flex justify-center gap-3">
                            {[
                              { id: 'male', label: 'Male' },
                              { id: 'female', label: 'Female' }
                            ].map((option) => (
                              <button
                                key={option.id}
                                type="button"
                                className={`px-5 py-2 rounded-lg border text-sm font-medium transition-all ${
                                  (tagFilters?.Gender?.gender || 'male') === option.id
                                    ? 'bg-blue-100 border-blue-300 text-blue-700 shadow-sm'
                                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                }`}
                                onClick={() => setTagFilters({
                                  ...tagFilters,
                                  Gender: { gender: option.id }
                                })}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {expandedTag === 'Race' && (
                      <div key="race-select" className="mb-3">
                        <div className="flex justify-between items-center mb-1">
                          <h4 className="text-sm font-medium text-gray-700">Select Race</h4>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <div className="grid grid-cols-1 gap-2">
                            {[
                              { id: 'white', label: 'White' },
                              { id: 'black', label: 'Black or African American' },
                              { id: 'american-indian', label: 'American Indian or Alaska Native' },
                              { id: 'asian', label: 'Asian' },
                              { id: 'pacific-islander', label: 'Native Hawaiian or Other Pacific Islander' }
                            ].map((option) => (
                              <button
                                key={option.id}
                                type="button"
                                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all text-left ${
                                  (tagFilters?.Race?.race || 'white') === option.id
                                    ? 'bg-blue-100 border-blue-300 text-blue-700 shadow-sm'
                                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                }`}
                                onClick={() => setTagFilters({
                                  ...tagFilters,
                                  Race: { race: option.id }
                                })}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {expandedTag === 'Income' && (
                      <div key="income-select" className="mb-3">
                        <div className="flex justify-between items-center mb-1">
                          <h4 className="text-sm font-medium text-gray-700">Select Income Range</h4>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <div className="grid grid-cols-1 gap-2">
                            {[
                              { id: 'low', label: '$0 - $50,000', min: 0, max: 50000 },
                              { id: 'medium', label: '$50,000 - $100,000', min: 50000, max: 100000 },
                              { id: 'high', label: '$100,000 - $1,000,000', min: 100000, max: 1000000 },
                              { id: 'very-high', label: '$1,000,000+', min: 1000000, max: null }
                            ].map((option) => (
                              <button
                                key={option.id}
                                type="button"
                                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all text-left ${
                                  (tagFilters?.Income?.range || 'low') === option.id
                                    ? 'bg-blue-100 border-blue-300 text-blue-700 shadow-sm'
                                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                }`}
                                onClick={() => setTagFilters({
                                  ...tagFilters,
                                  Income: { 
                                    range: option.id,
                                    min: option.min,
                                    max: option.max,
                                    label: option.label
                                  }
                                })}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {expandedTag === 'Pet Owner' && (
                      <div key="pet-owner-select" className="mb-3">
                        <div className="flex justify-between items-center mb-1">
                          <h4 className="text-sm font-medium text-gray-700">Select Pet Type</h4>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <div className="flex flex-wrap gap-3 justify-center mb-3">
                            {[
                              { id: 'dog', label: 'Dog' },
                              { id: 'cat', label: 'Cat' },
                              { id: 'other', label: 'Other' }
                            ].map((option) => (
                              <button
                                key={option.id}
                                type="button"
                                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                                  (tagFilters?.['Pet Owner']?.pet || 'dog') === option.id
                                    ? 'bg-blue-100 border-blue-300 text-blue-700 shadow-sm'
                                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                }`}
                                onClick={() => {
                                  if (option.id === 'other') {
                                    setTagFilters({
                                      ...tagFilters,
                                      'Pet Owner': { 
                                        pet: option.id,
                                        otherValue: tagFilters?.['Pet Owner']?.otherValue || '',
                                        searchValue: (tagFilters?.['Pet Owner']?.otherValue || '').toLowerCase(),
                                        displayValue: tagFilters?.['Pet Owner']?.otherValue || 'Other'
                                      }
                                    });
                                  } else {
                                    setTagFilters({
                                      ...tagFilters,
                                      'Pet Owner': { 
                                        pet: option.id,
                                        searchValue: option.label.toLowerCase(),
                                        displayValue: option.label
                                      }
                                    });
                                  }
                                }}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                          
                          {tagFilters?.['Pet Owner']?.pet === 'other' && (
                            <div className="mt-3">
                              <label className="block text-xs text-gray-600 mb-1">
                                Specify Pet Type
                              </label>
                              <input
                                type="text"
                                value={tagFilters?.['Pet Owner']?.otherValue || ''}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  setTagFilters({
                                    ...tagFilters,
                                    'Pet Owner': {
                                      pet: 'other',
                                      otherValue: value,
                                      searchValue: value.toLowerCase(),
                                      displayValue: value || 'Other'
                                    }
                                  });
                                }}
                                placeholder="e.g., Bird, Fish, Rabbit..."
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                              />
                              <p className="mt-1 text-xs text-gray-500">
                                Note: Matching is case-insensitive
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {expandedTag === 'Relationship' && (
                      <div key="relationship-select" className="mb-3">
                        <div className="flex justify-between items-center mb-1">
                          <h4 className="text-sm font-medium text-gray-700">Select Relationship Status</h4>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <div className="grid grid-cols-1 gap-2">
                            {[
                              { id: 'single', label: 'Single' },
                              { id: 'relationship', label: 'In a Relationship' },
                              { id: 'married', label: 'Married' },
                              { id: 'divorced', label: 'Divorced' }
                            ].map((option) => (
                              <button
                                key={option.id}
                                type="button"
                                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all text-left ${
                                  (tagFilters?.['Relationship']?.status || 'single') === option.id
                                    ? 'bg-blue-100 border-blue-300 text-blue-700 shadow-sm'
                                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                }`}
                                onClick={() => setTagFilters({
                                  ...tagFilters,
                                  'Relationship': {
                                    status: option.id,
                                    displayValue: option.label
                                  }
                                })}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                    {expandedTag === 'Education' && (
                      <div key="education-select" className="mb-3">
                        <div className="flex justify-between items-center mb-1">
                          <h4 className="text-sm font-medium text-gray-700">Select Education Level</h4>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <div className="grid grid-cols-1 gap-2">
                            {[
                              { id: 'high-school', label: 'High School or Less' },
                              { id: 'some-college', label: 'Some College' },
                              { id: 'bachelor', label: 'Bachelor\'s Degree' },
                              { id: 'graduate', label: 'Graduate Degree' }
                            ].map((option) => (
                              <button
                                key={option.id}
                                type="button"
                                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all text-left ${
                                  (tagFilters?.Education?.level || 'high-school') === option.id
                                    ? 'bg-blue-100 border-blue-300 text-blue-700 shadow-sm'
                                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                }`}
                                onClick={() => setTagFilters({
                                  ...tagFilters,
                                  Education: { 
                                    level: option.id,
                                    displayValue: option.label
                                  }
                                })}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {expandedTag === 'Politics' && (
                      <div key="politics-select" className="mb-3">
                        <div className="flex justify-between items-center mb-1">
                          <h4 className="text-sm font-medium text-gray-700">Political Orientation</h4>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <div className="relative pt-1">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs text-blue-700 font-semibold">Liberal</span>
                              <span className="text-xs text-red-700 font-semibold">Conservative</span>
                            </div>
                            
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={tagFilters?.Politics?.value || 50}
                              onChange={(e) => {
                                const newValue = parseInt(e.target.value);
                                let displayText = 'Moderate';
                                
                                if (newValue < 15) displayText = 'Very Liberal';
                                else if (newValue < 35) displayText = 'Liberal';
                                else if (newValue >= 35 && newValue <= 65) displayText = 'Moderate';
                                else if (newValue < 85) displayText = 'Conservative';
                                else displayText = 'Very Conservative';
                                
                                setTagFilters({
                                  ...tagFilters,
                                  Politics: { 
                                    value: newValue,
                                    displayText
                                  }
                                });
                              }}
                              className="w-full h-3 bg-gradient-to-r from-blue-500 via-purple-300 to-red-500 rounded-lg appearance-none cursor-pointer focus:outline-none"
                            />
                            
                            <div className="flex justify-center mt-4">
                              <span className="inline-block py-1 px-3 bg-gray-100 text-gray-800 text-sm font-medium rounded-full border border-gray-300">
                                {(() => {
                                  const value = tagFilters?.Politics?.value || 50;
                                  if (value < 15) return 'Very Liberal';
                                  if (value < 35) return 'Liberal';
                                  if (value >= 35 && value <= 65) return 'Moderate';
                                  if (value < 85) return 'Conservative';
                                  return 'Very Conservative';
                                })()}
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
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Available Tags Area */}
              <div className="h-20 overflow-y-hidden overflow-x-auto py-2 flex flex-wrap content-start scrollbar-thin scrollbar-thumb-gray-300 hover:scrollbar-thumb-gray-400 scrollbar-track-gray-100 border-b border-gray-200">
                {AVAILABLE_TAGS.map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  const isDisabled = !canAddMoreTags && !isSelected;
                  return (
                    <button
                      key={tag} type="button"
                      onClick={() => isSelected ? handleRemoveTag(tag) : handleAddTag(tag)}
                      disabled={isDisabled}
                      title={isSelected ? `Remove ${tag}` : isDisabled ? `Max ${MAX_SELECTED_TAGS} tags reached` : `Add ${tag}`}
                      className={`inline-block mr-2 mb-2 px-3 py-1 border rounded-full text-sm font-medium transition-all duration-150 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-cyan-500
                        ${isSelected
                          ? 'border-cyan-500 bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200 opacity-60 cursor-default'
                          : isDisabled
                            ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed opacity-70'
                            : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-400'
                        }`}
                    > {tag} </button>
                  );
                })}
              </div>
              {formError && formError.includes('tags') && (
                <p className="mt-1 text-sm text-red-600">{formError}</p>
              )}
            </div>

            {/* Options */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Options <span className="text-red-500">*</span>
              </label>
              <div className="space-y-3">
                {options.map((option, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => handleOptionChange(index, e.target.value)}
                      className={`block w-full ${
                        formError === 'At least two valid options are required.'
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                          : 'border-gray-300 focus:border-cyan-500 focus:ring-cyan-500'
                      } rounded-lg shadow-sm py-2.5 px-3.5 sm:text-sm`}
                      placeholder={`Option ${index + 1}`}
                      required={index < 2}
                      aria-required={index < 2}
                    />
                    {options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeOption(index)}
                        title="Remove Option"
                        className="flex-shrink-0 p-1.5 text-gray-400 hover:text-red-600 focus:outline-none rounded-full hover:bg-red-100 transition-colors"
                        aria-label={`Remove Option ${index + 1}`}
                      >
                        <RemoveIcon />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {formError === 'At least two valid options are required.' && (
                <p className="mt-1 text-sm text-red-600">Please enter at least two options</p>
              )}
              <button
                type="button"
                onClick={addOption}
                className="mt-3 px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-gray-800 hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-700 transition-colors shadow"
              >
                + Add Option
              </button>
            </div>

            {/* Create Poll Button */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={pollLoading || pollCreationSuccess}
                className={`w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-md text-base font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-400 transition duration-150 ease-in-out ${
                  pollLoading || pollCreationSuccess ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-cyan-400 to-emerald-500 hover:from-cyan-500 hover:to-emerald-600 active:scale-[0.98]'
                }`}
              >
                {pollLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </>
                ) : pollCreationSuccess ? (
                  'Poll Created!'
                ) : (
                  'Create Poll'
                )}
              </button>
            </div>
          </form>
        </div> {/* End Left Column */}

        {/* --- Right Column: Live Preview --- */}
        <div className="sticky top-10 bg-slate-50/75 p-6 md:p-8 rounded-xl border border-gray-200/75 shadow-lg">
          <h2 className="text-xl font-semibold mb-4 text-gray-800 text-center">Live Preview</h2>
          <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-inner min-h-[450px] flex flex-col">
            {/* Preview Header */}
            <div className="flex items-start mb-3 pb-3 border-b border-gray-100 flex-shrink-0">
              {/* Preview Icon */}
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-slate-200 border border-slate-300/75 mr-3 sm:mr-4 flex-shrink-0 flex items-center justify-center overflow-hidden">
                {imagePreviewUrl ? (
                  <img src={imagePreviewUrl} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <ImagePlaceholderIcon />
                )}
              </div>
              <div className="flex-grow min-w-0">
                <h3 className="font-semibold text-base sm:text-lg text-gray-900 break-words leading-tight">
                  {title.trim() || <span className="text-gray-400 italic">Poll Title Preview</span>}
                </h3>
                <p className="text-xs text-gray-500 mt-1 truncate">by 0x123...abc (Creator)</p>
              </div>
              <div className="text-right ml-2 flex-shrink-0 pl-2">
                <p className="text-sm font-semibold text-gray-800">
                  <span className="text-lg">{previewVotes}</span> / {voteLimit || <span className="text-gray-400 italic">N/A</span>}
                </p>
                <p className="text-xs text-gray-500">Votes</p>
              </div>
            </div>
            {/* Preview Vote Count Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-1.5 mb-4 flex-shrink-0 overflow-hidden">
              <div
                className="bg-gradient-to-r from-cyan-400 to-emerald-500 h-1.5 rounded-full transition-width duration-300 ease-in-out"
                style={{ width: `${previewVotePercentage}%` }}
              ></div>
            </div>

            {/* --- Preview Content Area --- */}
            <div className="flex flex-col flex-grow">
              {/* 1. Tags Preview */}
              {selectedTags.length > 0 && (
                <div className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 flex-shrink-0">
                  {selectedTags.map((tag) => {
                    // Format tag display text based on any range filters
                    let displayText = tag;
                    
                    if (tagFilters && tagFilters[tag]) {
                      if (tag === 'Age' && tagFilters[tag].min !== undefined && tagFilters[tag].max !== undefined) {
                        displayText = `Age: ${tagFilters[tag].min}-${tagFilters[tag].max}`;
                      } else if (tag === 'Gender' && tagFilters[tag].gender) {
                        displayText = `Gender: ${tagFilters[tag].gender.charAt(0).toUpperCase() + tagFilters[tag].gender.slice(1)}`;
                      } else if (tag === 'Race' && tagFilters[tag].race) {
                        const raceMap = {
                          'white': 'White',
                          'black': 'Black or African American',
                          'american-indian': 'American Indian or Alaska Native',
                          'asian': 'Asian',
                          'pacific-islander': 'Native Hawaiian or Pacific Islander'
                        };
                        displayText = `Race: ${raceMap[tagFilters[tag].race] || tagFilters[tag].race}`;
                      } else if (tag === 'Income' && tagFilters[tag].range) {
                        if (tagFilters[tag].label) {
                          displayText = `Income: ${tagFilters[tag].label}`;
                        } else {
                          const rangeLabels = {
                            'low': '$0 - $50,000',
                            'medium': '$50,000 - $100,000',
                            'high': '$100,000 - $1,000,000',
                            'very-high': '$1,000,000+'
                          };
                          displayText = `Income: ${rangeLabels[tagFilters[tag].range] || tagFilters[tag].range}`;
                        }
                      } else if (tag === 'Pet Owner' && tagFilters[tag].pet) {
                        if (tagFilters[tag].displayValue) {
                          displayText = `Pet: ${tagFilters[tag].displayValue}`;
                        } else if (tagFilters[tag].pet === 'other' && tagFilters[tag].otherValue) {
                          displayText = `Pet: ${tagFilters[tag].otherValue}`;
                        } else {
                          const petLabels = {
                            'dog': 'Dog',
                            'cat': 'Cat',
                            'other': 'Other'
                          };
                          displayText = `Pet: ${petLabels[tagFilters[tag].pet] || tagFilters[tag].pet}`;
                        }
                      } else if (tag === 'Relationship' && tagFilters[tag].status) {
                        if (tagFilters[tag].displayValue) {
                          displayText = `Relationship: ${tagFilters[tag].displayValue}`;
                        } else {
                          const statusLabels = {
                            'single': 'Single',
                            'relationship': 'In a Relationship',
                            'married': 'Married',
                            'divorced': 'Divorced'
                          };
                          displayText = `Relationship: ${statusLabels[tagFilters[tag].status] || tagFilters[tag].status}`;
                        }
                      } else if (tag === 'Education' && tagFilters[tag].level) {
                        if (tagFilters[tag].displayValue) {
                          displayText = `Education: ${tagFilters[tag].displayValue}`;
                        } else {
                          const levelMap = {
                            'high-school': 'High School or Less',
                            'some-college': 'Some College',
                            'bachelor': 'Bachelor\'s Degree',
                            'graduate': 'Graduate Degree'
                          };
                          displayText = `Education: ${levelMap[tagFilters[tag].level] || tagFilters[tag].level}`;
                        }
                      } else if (tag === 'Politics' && tagFilters[tag].value !== undefined) {
                        if (tagFilters[tag].displayText) {
                          displayText = `Politics: ${tagFilters[tag].displayText}`;
                        } else {
                          // Generate display text based on value if not provided
                          let position = 'Moderate';
                          const value = tagFilters[tag].value;
                          
                          if (value < 15) position = 'Very Liberal';
                          else if (value < 35) position = 'Liberal';
                          else if (value >= 35 && value <= 65) position = 'Moderate';
                          else if (value < 85) position = 'Conservative';
                          else position = 'Very Conservative';
                          
                          displayText = `Politics: ${position}`;
                        }
                      }
                    }
                    
                    return (
                      <span key={tag} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {displayText}
                      </span>
                    );
                  })}
                </div>
              )}

              {/* 2. Description Preview */}
              <div className="flex-shrink-0 mb-4">
                {description.trim() ? (
                  <p className="text-sm text-gray-700 break-words">{description.trim()}</p>
                ) : (
                  <p className="text-sm text-gray-400 italic">Poll description appears here...</p>
                )}
              </div>

              {/* 3. Reward Indicator Preview */}
              {isRewardEnabled && (
                <div className="mb-4 flex-shrink-0">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                    <span className="mr-1">💰</span>
                    <span>{rewardPerVoter} / Vote</span>
                  </span>
                </div>
              )}

              {/* 4. Bar Chart Placeholder */}
              <div className="my-4 flex-shrink-0">
                <div className="flex justify-around items-end h-24 px-2">
                  {/* Static placeholder bars, adjust number/heights as needed */}
                  {[40, 75, 20, 55].slice(0, Math.max(validOptions.length, 2)).map((heightPercent, index) => (
                    <div key={index} className="w-1/5 bg-gradient-to-b from-slate-200 to-slate-300 rounded-t-md" style={{ height: `${heightPercent}%` }} title={`Option ${String.fromCharCode(65 + index)} Votes Preview`}></div>
                  ))}
                </div>
                <div className="flex justify-around text-xs text-gray-500 mt-1 px-2">
                  {/* Labels based on number of valid options (or min 2) */}
                  {['A', 'B', 'C', 'D', 'E', 'F'].slice(0, Math.max(validOptions.length, 2)).map(label => <span key={label} className="w-1/5 text-center">{label}</span>)}
                </div>
              </div>

              {/* 5. Options Preview */}
              <div className="space-y-2 mt-auto pt-4">
                {options.map((option, index) => (
                  option.trim() ? (
                    <div key={index} className="px-4 py-3 border border-gray-200 rounded-lg bg-slate-50/75 hover:bg-slate-100/75 text-gray-800 shadow-sm transition-colors duration-150 flex items-center space-x-3">
                      <span className="font-semibold text-slate-500">{String.fromCharCode(65 + index)}.</span>
                      <span className="flex-grow break-words text-sm">{option}</span>
                    </div>
                  ) : null // Don't render preview for empty options
                ))}
                {/* Placeholder options to fill space if less than 4 valid options */}
                {validOptions.length < 4 && Array(4 - validOptions.length).fill(0).map((_, i) => (
                  <div key={`placeholder-${i}`} className="px-4 py-3 border border-dashed border-gray-300 rounded-lg bg-slate-100/50 text-gray-400 text-sm italic h-[50px] flex items-center">
                    Option {String.fromCharCode(65 + validOptions.length + i)} preview...
                  </div>
                ))}
              </div>
            </div> {/* End Preview Content Area */}
          </div> {/* End inner preview card */}
        </div> {/* End Right Column */}
      </div> {/* End main grid */}

      {/* Poll Confirmation Modal */}
      <PollConfirmationModal
        isOpen={showConfirmationModal}
        onClose={handleCloseConfirmationModal}
        onConfirm={handleFinalSubmit}
        pollData={preparedPollData}
        refreshBalance={refreshUSDTBalance}
      />
    </div> // End container
  );
};

export default CreatePoll;