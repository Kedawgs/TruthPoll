// src/pages/CreatePoll.js
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../hooks/useAppContext'; // Adjust path if necessary

// --- Icons ---
const ImagePlaceholderIcon = () => (
    <svg className="h-6 w-6 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    </svg>
);

const RemoveIcon = () => (
  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
);

// --- Constants ---
const AVAILABLE_TAGS = [
    'Politics', 'Technology', 'Sports', 'Entertainment', 'Finance', 'Web3',
    'Crypto', 'Gaming', 'Science', 'Food', 'Travel', 'Health', 'Lifestyle',
    'Opinion', 'Survey', 'Fun', 'Local', 'Global', 'Art', 'Music'
];
const MAX_SELECTED_TAGS = 5;

const CreatePoll = () => {
  const navigate = useNavigate();
  const {
    createPoll,
    isConnected,
    openAuthModal,
    // deploySmartWalletIfNeeded, // Uncomment if needed
    pollLoading,
    pollError
  } = useAppContext();

  // --- State ---
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [selectedTags, setSelectedTags] = useState([]);
  const [voteLimit, setVoteLimit] = useState('');
  const [rewardPerVoter, setRewardPerVoter] = useState('');
  const [formError, setFormError] = useState('');

  // Default duration and category (no UI inputs)
  const [duration] = useState('0');
  const [category] = useState('General');

  // Memoized derived state
  const isRewardEnabled = useMemo(() => rewardPerVoter && parseFloat(rewardPerVoter) > 0, [rewardPerVoter]);
  const validOptions = useMemo(() => options.filter(option => option.trim().length > 0), [options]);
  const canAddMoreTags = useMemo(() => selectedTags.length < MAX_SELECTED_TAGS, [selectedTags]);

  // --- Event Handlers ---
  const addOption = () => {
    setOptions([...options, '']);
  };

  const removeOption = (index) => {
    if (options.length <= 2) {
        setFormError('Poll must have at least two options.');
        return;
    };
    const newOptions = [...options];
    newOptions.splice(index, 1);
    setOptions(newOptions);
    if (formError === 'At least two valid options are required') setFormError('');
  };

  const handleOptionChange = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleAddTag = (tagToAdd) => {
      if (canAddMoreTags && !selectedTags.includes(tagToAdd)) {
          setSelectedTags([...selectedTags, tagToAdd]);
          if (formError.includes('maximum of')) setFormError(''); // Clear max tag error if adding succeeds
      } else if (!canAddMoreTags && !selectedTags.includes(tagToAdd)) { // Only show error if trying to add *new* tag when full
          setFormError(`You can select a maximum of ${MAX_SELECTED_TAGS} tags.`);
          setTimeout(() => { if (formError === `You can select a maximum of ${MAX_SELECTED_TAGS} tags.`) setFormError(''); }, 3000); // Auto-clear error
      }
  };

  const handleRemoveTag = (tagToRemove) => {
      setSelectedTags(selectedTags.filter(tag => tag !== tagToRemove));
      if (formError.includes('maximum of')) setFormError(''); // Clear max tag error if removing a tag
  };

  // --- Form Validation ---
  const validateForm = () => {
    if (!title.trim()) return 'Poll Title is required.';
    if (validOptions.length < 2) return 'At least two valid options are required.';
    if (!voteLimit || parseInt(voteLimit) <= 0) return 'Max Votes is required and must be a positive number.';
    if (rewardPerVoter && parseFloat(rewardPerVoter) < 0) return 'Reward per voter cannot be negative.';
    if (!isConnected) return 'Please connect your wallet first.';
    // Add any other validation rules here (e.g., minimum tags if required)
    return ''; // No errors
  };

  // --- Form Submission ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    // Optional: Smart wallet check/deployment
    // try { await deploySmartWalletIfNeeded(); } catch (err) { setFormError(err.message); return; }

    try {
       const pollData = {
         title: title.trim(),
         description: description.trim(),
         options: validOptions,
         duration: parseInt(duration),
         category: category,
         tags: selectedTags, // Send array of selected tags
         rewardEnabled: isRewardEnabled,
         rewardPerVoter: isRewardEnabled ? rewardPerVoter : '0',
         voteLimit: parseInt(voteLimit), // Required field
         // Add 'imageUrl' or similar field if image upload is implemented
       };

       console.log("Submitting Poll Data:", pollData);
       const response = await createPoll(pollData);

       if (response?.data?.poll?._id) {
          navigate(`/polls/${response.data.poll._id}`);
       } else {
          console.warn("Poll possibly created, but ID not found in response:", response);
          setFormError("Poll created, but couldn't get the Poll ID to redirect.");
       }

    } catch (err) {
      console.error('Error creating poll:', err);
      // Prioritize specific error from backend if available, otherwise use generic message
      setFormError(err?.response?.data?.message || err.message || 'An unexpected error occurred while creating the poll.');
    }
  };

  // --- Render Logic ---
  if (!isConnected) {
      return ( // Connect Wallet Prompt
          <div className="max-w-md mx-auto mt-20 p-8 bg-white rounded-xl shadow-lg text-center border border-gray-200">
              <h2 className="text-2xl font-bold mb-4 text-gray-800">Create Your Poll</h2>
              <p className="mb-6 text-gray-600">
                  Connect your wallet or sign in to start creating decentralized polls.
              </p>
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
      {/* Error Display Area */}
      {(formError || pollError) && (
        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-400 text-red-700 rounded-md shadow-sm" role="alert">
          <p className="font-semibold">Error</p>
          <p>{formError || pollError}</p> {/* Display form validation error or context error */}
        </div>
      )}

      {/* Main 2-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 xl:gap-12 items-start">

        {/* --- Left Column: Form --- */}
        <div className="bg-white p-6 md:p-8 rounded-xl border border-gray-200 shadow-lg">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">Poll Details</h2>
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Title & Image Icon Row */}
            <div className="flex items-start space-x-3 sm:space-x-4">
                {/* Circular Image Upload Placeholder */}
                <div className="flex-shrink-0 mt-1">
                    <label htmlFor="poll-image-upload" className="cursor-pointer group block" title="Upload Poll Icon (Coming Soon)">
                        <span className="block w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gray-100 group-hover:bg-gray-200 border border-gray-300 flex items-center justify-center transition-colors overflow-hidden">
                           {/* Add state logic here to show uploaded image preview instead of icon */}
                           <ImagePlaceholderIcon />
                        </span>
                        <input id="poll-image-upload" type="file" accept="image/*" className="sr-only" disabled />
                    </label>
                     {/* Removed text label below icon */}
                </div>
                {/* Title Label and Input */}
                <div className="flex-grow min-w-0">
                    <label htmlFor="title" className="block text-sm font-bold text-gray-700 mb-1">
                        Poll Title <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        id="title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="block w-full border-gray-300 rounded-md shadow-sm py-2 px-3 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        placeholder="What's your question?"
                        required
                        aria-required="true"
                    />
                </div>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="block w-full border-gray-300 rounded-md shadow-sm py-2 px-3 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholder="Add context, background, or rules..."
                rows={4}
              ></textarea>
            </div>

            {/* Vote Limit (Required) & Reward Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="voteLimit" className="block text-sm font-bold text-gray-700 mb-1">Max Votes <span className="text-red-500">*</span></label>
                <input
                    id="voteLimit"
                    type="number"
                    value={voteLimit}
                    onChange={(e) => setVoteLimit(e.target.value)}
                    placeholder="e.g., 1000"
                    min="1"
                    required
                    aria-required="true"
                    className="block w-full border-gray-300 rounded-md shadow-sm py-2 px-3 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>
              <div>
                <label htmlFor="rewardPerVoter" className="block text-sm font-medium text-gray-700 mb-1">Reward / Vote (Optional)</label>
                 <input
                    type="number"
                    id="rewardPerVoter"
                    value={rewardPerVoter}
                    onChange={(e) => setRewardPerVoter(e.target.value)}
                    className="block w-full border-gray-300 rounded-md shadow-sm py-2 px-3 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    placeholder="e.g., 0.01 (Tokens)"
                    step="any"
                    min="0"
                 />
              </div>
            </div>

             {/* Tags Word Bank */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Tags (Select up to {MAX_SELECTED_TAGS})
              </label>
              {/* Selected Tags Area */}
              <div className="mb-3 p-3 border border-gray-200 rounded-md bg-gray-50 min-h-[44px] flex flex-wrap gap-2 items-center">
                  {selectedTags.length === 0 && (
                    <span className="text-sm text-gray-400 italic">Click tags below to add</span>
                  )}
                  {selectedTags.map((tag) => (
                      <span key={tag} className="inline-flex items-center pl-2.5 pr-1 py-1 rounded-full text-sm font-medium bg-blue-500 text-white shadow-sm">
                          {tag}
                          <button
                              type="button"
                              onClick={() => handleRemoveTag(tag)}
                              className="ml-1.5 flex-shrink-0 p-0.5 text-blue-100 hover:text-white hover:bg-blue-600 rounded-full focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-blue-300"
                              aria-label={`Remove ${tag} tag`}
                          >
                             <RemoveIcon />
                          </button>
                      </span>
                  ))}
              </div>
              {/* Available Tags Area */}
              <div className="flex flex-wrap gap-2">
                  {AVAILABLE_TAGS.map((tag) => {
                      const isSelected = selectedTags.includes(tag);
                      const isDisabled = !canAddMoreTags && !isSelected; // Disable adding NEW tags if limit reached
                      return (
                          <button
                              key={tag}
                              type="button"
                              onClick={() => isSelected ? handleRemoveTag(tag) : handleAddTag(tag)} // Click to add OR remove
                              disabled={isDisabled && !isSelected} // Can always click to remove, disable adding if limit reached
                              title={isSelected ? `Remove ${tag}` : isDisabled ? `Max ${MAX_SELECTED_TAGS} tags reached` : `Add ${tag}`}
                              className={`px-3 py-1 border rounded-full text-sm font-medium transition-all duration-150 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-blue-500
                                ${isSelected
                                  ? 'border-blue-500 bg-blue-100 text-blue-700 ring-1 ring-blue-300' // Style for selected in available list
                                  : isDisabled
                                    ? 'border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed opacity-60' // Style for disabled adding
                                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-100 hover:border-gray-400' // Style for available
                                }`}
                          >
                             {tag}
                          </button>
                      );
                  })}
              </div>
            </div>


            {/* Options */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Options <span className="text-red-500">*</span></label>
              <div className="space-y-3">
                 {options.map((option, index) => (
                    <div key={index} className="flex items-center space-x-2">
                       <input
                          type="text"
                          value={option}
                          onChange={(e) => handleOptionChange(index, e.target.value)}
                          className="block w-full border-gray-300 rounded-md shadow-sm py-2 px-3 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
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
              <button
                type="button"
                onClick={addOption}
                className="mt-3 px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 transition-colors"
              >
                + Add Option
              </button>
            </div>

            {/* Create Poll Button */}
            <div className="pt-4">
                <button
                  type="submit"
                  disabled={pollLoading}
                  className={`w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-base font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ease-in-out ${
                    pollLoading
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 active:scale-[0.98]'
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
                  ) : 'Create Poll'}
                </button>
            </div>
          </form>
        </div> {/* End Left Column */}

        {/* --- Right Column: Preview --- */}
        <div className="sticky top-10 bg-gray-50 p-6 md:p-8 rounded-xl border border-gray-200 shadow-lg">
          <h2 className="text-xl font-semibold mb-4 text-gray-800 text-center">Live Preview</h2>
          {/* Inner preview card */}
          <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-inner min-h-[300px] flex flex-col"> {/* Added flex flex-col */}
            {/* Header */}
            <div className="flex items-start mb-4 pb-4 border-b border-gray-100">
               {/* Preview Icon */}
               <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gray-200 border border-gray-300 mr-3 sm:mr-4 flex-shrink-0 flex items-center justify-center overflow-hidden">
                   {/* Add logic to show image preview here */}
                   <ImagePlaceholderIcon />
               </div>
               {/* Title and Creator */}
               <div className="flex-grow min-w-0">
                  <h3 className="font-semibold text-base sm:text-lg text-gray-900 break-words leading-tight">
                    {title.trim() || <span className="text-gray-400 italic">Poll Title Preview</span>}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1 truncate">by 0x123...abc (Creator)</p> {/* Placeholder address */}
               </div>
               {/* Vote Limit / Count */}
               <div className="text-right ml-2 flex-shrink-0 pl-2">
                  <p className="text-sm font-semibold text-gray-800">
                    <span className="text-lg">0</span> / { voteLimit || <span className="text-gray-400 italic">N/A</span> }
                  </p>
                  <p className="text-xs text-gray-500">Votes</p>
               </div>
            </div>

            {/* Description Preview */}
            {description.trim() ? (
              <p className="text-sm text-gray-700 mb-4 break-words flex-shrink-0">{description.trim()}</p>
             ) : (
              <p className="text-sm text-gray-400 italic mb-4 flex-shrink-0">Poll description appears here...</p>
             )}

            {/* Tags & Category Preview */}
            {(selectedTags.length > 0 || category) && (
              <div className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 flex-shrink-0">
                  <span className="text-sm font-medium text-gray-600 mr-1">Category:</span>
                  {category && (<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">{category}</span>)}
                  {/* Render selected tags */}
                  {selectedTags.map((tag) => (
                    <span key={tag} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                       {tag}
                    </span>
                 ))}
              </div>
            )}

             {/* Reward Indicator Preview */}
             {isRewardEnabled && (
                <div className="mb-4 p-2.5 bg-green-50 border border-green-200 rounded-md text-sm text-green-700 flex items-center shadow-sm flex-shrink-0">
                    <span className="text-xl mr-2">💰</span>
                    <div>
                        <span className="font-semibold">{rewardPerVoter}</span> Tokens per Vote
                        <span className="text-xs block text-green-600">(Approx. value)</span>
                    </div>
                </div>
             )}

            {/* Options Preview */}
            <div className="space-y-2 mt-auto pt-4"> {/* Pushed to bottom with mt-auto */}
               <p className="text-sm font-medium text-gray-600 mb-2">Options:</p>
               {options.map((option, index) => (
                  option.trim() ? (
                     <div key={index} className="p-3 border border-gray-200 rounded-md bg-gray-50 hover:bg-gray-100 text-gray-800 shadow-sm transition-colors duration-150 flex items-center space-x-3">
                        <span className="font-semibold text-gray-500">{String.fromCharCode(65 + index)}.</span>
                        <span className="flex-grow break-words">{option}</span>
                     </div>
                   ) : null // Don't render empty options
               ))}
               {/* Placeholder previews */}
               {validOptions.length === 0 && (
                  <>
                    <div className="p-3 border border-dashed border-gray-300 rounded-md bg-gray-100 text-gray-400 text-sm italic h-[44px] flex items-center">Option A preview...</div>
                    <div className="p-3 border border-dashed border-gray-300 rounded-md bg-gray-100 text-gray-400 text-sm italic h-[44px] flex items-center">Option B preview...</div>
                  </>
               )}
                {validOptions.length === 1 && (
                  <div className="p-3 border border-dashed border-gray-300 rounded-md bg-gray-100 text-gray-400 text-sm italic h-[44px] flex items-center">Option B preview...</div>
               )}
            </div>

          </div> {/* End inner preview card */}
        </div> {/* End Right Column */}

      </div> {/* End main grid */}
    </div> // End container
  );
};

export default CreatePoll;