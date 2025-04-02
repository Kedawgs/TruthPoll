// src/pages/CreatePoll.js
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../hooks/useAppContext'; // Adjust path if necessary
import api from '../utils/api'; // Added for image upload

// --- Icons ---
const ImagePlaceholderIcon = () => (
    <svg className="h-6 w-6 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    </svg>
);

const RemoveIcon = () => (
    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
);

// --- Constants ---
const AVAILABLE_TAGS = [
  'Age', 'Gender', 'Race', 'Income', 'Pet Owner', 'Relationship', 'Education', 'Politics'
];
const MAX_SELECTED_TAGS = 5;

const CreatePoll = () => {
  const navigate = useNavigate();
  const {
    createPoll, isConnected, openAuthModal,
    pollLoading, pollError // Assuming context provides these
  } = useAppContext();

  // --- State ---
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [selectedTags, setSelectedTags] = useState([]);
  const [voteLimit, setVoteLimit] = useState('');
  const [rewardPerVoter, setRewardPerVoter] = useState('');
  const [formError, setFormError] = useState('');
  const [previewVotes, setPreviewVotes] = useState(0);
  const [previewVotePercentage, setPreviewVotePercentage] = useState(0);
  const [duration] = useState('0'); // Default duration (no UI)
  const [pollCreationSuccess, setPollCreationSuccess] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null); // State for uploaded image file

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


  // --- Event Handlers ---
  const addOption = () => setOptions([...options, '']);

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
  };

  const handleRemoveTag = (tagToRemove) => {
    setSelectedTags(selectedTags.filter(tag => tag !== tagToRemove));
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

    // Optional: Add validation for file size or type if needed
    // if (selectedFile && selectedFile.size > MAX_FILE_SIZE) return 'Image file is too large.';
    // if (selectedFile && !ALLOWED_FILE_TYPES.includes(selectedFile.type)) return 'Invalid image file type.';

    return ''; // No errors
  };

  // --- Form Submission ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setPollCreationSuccess(false);

    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Filter out empty options before submission
    const validOptionsSubmit = options.filter(option => option.trim().length > 0);

    // --- NEW handleSubmit try...catch block starts here ---
    try {
      // Prepare base poll data
      const pollData = {
        title: title.trim(),
        description: description.trim(),
        options: validOptionsSubmit,
        duration: parseInt(duration || '0'),
        tags: selectedTags,
        category: 'General', // You may want to add a category selector
        rewardPerVoter: isRewardEnabled ? rewardPerVoter : '0',
        voteLimit: parseInt(voteLimit),
        image: null, // Initialize image field (S3 key)
        imageUrl: null // Initialize imageUrl field (Full S3 URL)
      };

      // --- Enhanced Image Upload Logic ---
      if (selectedFile) {
        const formData = new FormData();
        formData.append('image', selectedFile); // 'image' should match backend field name

        // Check authentication before upload
        const authToken = localStorage.getItem('authToken');
        if (!authToken && isConnected) {
          console.warn("No auth token found. May encounter authentication issues with upload.");
        }

        try {
          console.log("Attempting to upload image...");
          const uploadResponse = await api.post('/polls/upload-image', formData, {
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          });

          // Check structure of uploadResponse
          if (uploadResponse.data && uploadResponse.data.success) {
            // Store both the S3 key and the full URL
            pollData.image = uploadResponse.data.image; // S3 key
            pollData.imageUrl = uploadResponse.data.imageUrl; // Full S3 URL
            console.log("Image uploaded successfully:", pollData.imageUrl);
          } else {
            console.warn("Image upload response invalid:", uploadResponse.data);
            throw new Error(uploadResponse.data?.message || 'Image upload failed.');
          }
        } catch (uploadErr) {
          // Special handling for auth errors
          if (uploadErr.response && uploadErr.response.status === 401) {
            console.error('Authentication error during image upload:', uploadErr);
            const retryWithAuth = window.confirm(
              "Authentication error uploading image. Would you like to reconnect your wallet and try again?"
            );

            if (retryWithAuth) {
              // Open auth modal and abort current submission
              openAuthModal();
              setFormError("Please reconnect your wallet and try again");
              // setWalletLoading(false); // Removed: setWalletLoading is not defined here
              return; // Exit early
            } else {
              // Continue without image
              console.log("Continuing poll creation without image");
              pollData.image = null;
              pollData.imageUrl = null;
            }
          } else {
            // Handle other upload errors
            console.error('Error uploading image:', uploadErr);
            const uploadErrorMsg = uploadErr?.response?.data?.message || uploadErr.message || 'Failed to upload image.';
            setFormError(`Poll not created: ${uploadErrorMsg}`);
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return; // Stop submission if image upload fails
          }
        }
      }
      // --- End Enhanced Image Upload Logic ---

      console.log("Submitting Final Poll Data:", pollData);
      const response = await createPoll(pollData); // Pass data including the image URL/ID

      if (response?.data?.poll?._id) {
        // Show success message briefly before redirecting
        setPollCreationSuccess(true);
        setTimeout(() => {
            // Using the redirect path from the new snippet
          navigate(`/polls/id/${response.data.poll._id}`);
        }, 1000);
      } else {
        console.warn("Poll created but response format unexpected:", response);
        setFormError("Poll created, but couldn't redirect to the poll page. Please check your polls list.");
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err) {
      console.error('Error creating poll:', err);
      // Improved error message extraction
      const errorMsg = err?.response?.data?.error ||
                       err?.response?.data?.message ||
                       err.message ||
                       'An unexpected error occurred during poll creation.';
      setFormError(errorMsg);

      // Scroll to the error message
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    // --- NEW handleSubmit try...catch block ends here ---
  };

  // --- Render Logic ---
  if (!isConnected) {
       return ( // Connect Wallet Prompt
        <div className="max-w-md mx-auto mt-20 p-8 bg-white rounded-xl shadow-lg text-center border border-gray-200">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">Create Your Poll</h2>
            <p className="mb-6 text-gray-600"> Connect your wallet or sign in to start creating decentralized polls. </p>
            <button onClick={openAuthModal} className="inline-flex items-center px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold rounded-lg shadow hover:from-cyan-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-150 ease-in-out"> Connect / Sign In </button>
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
          <form onSubmit={handleSubmit} className="space-y-6">

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
                            accept="image/*" // Standard image types
                            className="sr-only"
                            onChange={onFileChange} // Attach the handler
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

             {/* Tags Word Bank - Fixed to be 2 rows high */}
             <div>
               <label className="block text-sm font-bold text-gray-700 mb-2">
                Tags (Select up to {MAX_SELECTED_TAGS})
               </label>

               {/* Selected Tags Area */}
               <div className="mb-3 p-3 border border-gray-200 rounded-lg bg-slate-50 min-h-[44px] flex flex-wrap gap-2 items-center">
                   {selectedTags.length === 0 && (
                     <span className="text-sm text-gray-400 italic">Click tags below to add</span>
                   )}
                   {selectedTags.map((tag) => (
                     <span key={tag} className="inline-flex items-center pl-3 pr-1.5 py-1 rounded-full text-sm font-medium bg-cyan-600 text-white shadow-sm">
                       {tag}
                       <button
                         type="button"
                         onClick={() => handleRemoveTag(tag)}
                         className="ml-1.5 flex-shrink-0 p-0.5 text-cyan-100 hover:text-white hover:bg-cyan-700 rounded-full focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-cyan-400"
                         aria-label={`Remove ${tag} tag`}
                       >
                         <RemoveIcon />
                       </button>
                     </span>
                   ))}
               </div>

               {/* Fixed Available Tags Area - 2 rows high with horizontal scroll */}
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
                      required={index < 2} // Only first two options required by HTML5
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
                    Creating Poll...
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
                  <p className="text-xs text-gray-500 mt-1 truncate">by 0x123...abc (Creator)</p> {/* Placeholder address */}
              </div>
              <div className="text-right ml-2 flex-shrink-0 pl-2">
                  <p className="text-sm font-semibold text-gray-800">
                      <span className="text-lg">{previewVotes}</span> / { voteLimit || <span className="text-gray-400 italic">N/A</span> }
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

            {/* --- Preview Content Area (Reordered) --- */}
            <div className="flex flex-col flex-grow">
                {/* 1. Tags Preview */}
                {selectedTags.length > 0 && (
                    <div className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 flex-shrink-0">
                        {selectedTags.map((tag) => (
                            <span key={tag} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {tag}
                            </span>
                        ))}
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


                {/* 5. Options Preview (Pushed to bottom) */}
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
    </div> // End container
  );
};

export default CreatePoll;