// src/pages/Profile.js
// Includes console.log statements for debugging avatar update issues.

import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../hooks/useAppContext'; // Assuming this hook exists and is correct now
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { formatAddress } from '../utils/web3Helper'; // Assuming helper exists
import './Profile.css'; // Your specific styles
import logger from '../utils/logger'; // Optional logger

// Define all icons needed for the profile page
const ActionIcon = () => (
    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const RewardsIcon = ({ className }) => (
    <svg className={className || "w-5 h-5 text-green-600"} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const VotesIcon = ({ className }) => (
    <svg className={className || "w-5 h-5 text-blue-600"} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const PollsIcon = ({ className }) => (
    <svg className={className || "w-5 h-5 text-purple-600"} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
);

const ActivityIcon = ({ className }) => (
    <svg className={className || "w-5 h-5 text-gray-600"} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
);

const MyPollsIcon = ({ className }) => (
    <svg className={className || "w-5 h-5 text-indigo-600"} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
    </svg>
);


const Profile = () => {
    const navigate = useNavigate();
    // Ensure all needed values are pulled from your context hook
    const {
        isConnected,
        account,
        userProfile,
        setUserProfile,
        openAuthModal,
        getReceivedRewards, // Assuming this function exists in your context
    } = useAppContext();

    // Component State
    const [activity, setActivity] = useState([]);
    const [stats, setStats] = useState({ rewards: 0, votes: 0, polls: 0 });
    const [loading, setLoading] = useState(true); // For initial data load
    const [activeTab, setActiveTab] = useState('activity');
    const [level, setLevel] = useState(1); // Placeholder - Replace with real data if available
    const [progress, setProgress] = useState(52); // Placeholder - Replace with real data if available
    const [selectedFile, setSelectedFile] = useState(null); // For avatar upload
    const [uploadingAvatar, setUploadingAvatar] = useState(false); // Upload loading state
    const fileInputRef = useRef(null); // Ref for the hidden file input


    // Effect to load initial profile stats and activity
    useEffect(() => {
        const loadProfileData = async () => {
            // Only run if connected and account is available
            if (!isConnected || !account) {
                setLoading(false);
                return;
            }
            setLoading(true); // Indicate loading started

            try {
                // Fetch activity/rewards (assuming function from context)
                const rewardsResponse = await getReceivedRewards();
                let currentActivity = [];
                let rewardsEarned = 0;
                if (rewardsResponse?.success && Array.isArray(rewardsResponse.data)) {
                     currentActivity = rewardsResponse.data;
                     // Example calculation: sum amounts if available
                     rewardsEarned = rewardsResponse.data.reduce((sum, reward) => sum + (Number(reward.amount) || 0), 0);
                }
                setActivity(currentActivity);

                // Fetch votes count (replace with your actual API endpoint/logic)
                let votesCount = 0;
                try {
                    const votesResponse = await api.get(`/users/votes/${account}`);
                    if (votesResponse?.data?.success) {
                         votesCount = votesResponse.data.data.totalVotes || 0;
                    }
                } catch (voteErr) { console.warn("Could not fetch vote count:", voteErr); }

                // Fetch polls created count (replace with your actual API endpoint/logic)
                let pollsCreatedCount = 0;
                try {
                    // Check if your API supports a count-only query
                    const pollsResponse = await api.get(`/polls?creator=${account}&limit=1&countOnly=true`);
                    if (pollsResponse?.data?.success) {
                         pollsCreatedCount = pollsResponse.data.total || 0;
                    }
                 } catch (pollErr) { console.warn("Could not fetch created poll count:", pollErr); }

                // Update the stats state
                setStats({ rewards: rewardsEarned, votes: votesCount, polls: pollsCreatedCount });

            } catch (err) {
                logger.error('Error loading profile stats/activity:', err);
                // Reset states on error
                setStats({ rewards: 0, votes: 0, polls: 0 });
                setActivity([]);
            } finally {
                setLoading(false); // Indicate loading finished
            }
        };

        loadProfileData();
        // Dependencies for this effect. Add others if loadProfileData depends on them.
    }, [isConnected, account, getReceivedRewards]);


    // Helper function to get profile initial character for avatar placeholder
    const getProfileInitial = () => {
        if (userProfile?.username) return userProfile.username.charAt(0).toUpperCase();
        if (account) return account.substring(2, 3).toUpperCase(); // Use first char after '0x'
        return '?';
    };

    // Function called when the hidden file input value changes
    const handleFileChange = (event) => {
         event.preventDefault(); // Good practice, just in case
        if (event.target.files && event.target.files[0]) {
            const file = event.target.files[0];

            // --- Client-side Validation ---
            const maxSize = 5 * 1024 * 1024; // 5MB
            const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

            if (file.size > maxSize) {
                 alert("File is too large. Maximum size is 5MB."); // Replace with better UI feedback
                 if (fileInputRef.current) { fileInputRef.current.value = null; } // Clear input
                 return;
            }
             if (!allowedMimeTypes.includes(file.type)) {
                 alert("Invalid file type. Only images (JPG, PNG, GIF, WEBP) are allowed."); // Replace with better UI feedback
                 if (fileInputRef.current) { fileInputRef.current.value = null; } // Clear input
                 return;
             }
             // --- End Validation ---

            setSelectedFile(file); // If valid, set the file state (triggers the upload effect)
        }
    };

    // Function to perform the avatar upload API call
    const handleUploadAvatar = async () => {
        // Prevent execution if no file/account, or already uploading
        if (!selectedFile || !account || uploadingAvatar) return;

        setUploadingAvatar(true); // Set loading state

        // Prepare form data for multipart request
        const formData = new FormData();
        formData.append('avatar', selectedFile);
        formData.append('address', account); // Send user's address

        try {
            // Make the API call
            const response = await api.post('/users/upload-avatar', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            // Handle success
            if (response.data.success) {
                const newAvatarUrl = response.data.data.avatarUrl;

                // Update the context state
                setUserProfile((prevProfile) => {
                    const updatedProfile = {
                        ...(prevProfile || {}), // Safely spread previous state or empty object
                        avatarUrl: newAvatarUrl, // Set the new URL
                    };
                    return updatedProfile;
                });
                setSelectedFile(null); // Clear the selected file state

            } else { // Handle API error response
                console.error('[handleUploadAvatar] API Error:', response.data.error);
                alert(`Avatar upload failed: ${response.data.error}`); // User feedback
                setSelectedFile(null);
            }
        } catch (error) { // Handle network/server errors
            console.error('[handleUploadAvatar] Network/Server Error:', error);
            alert(`Avatar upload failed: ${error.message}`); // User feedback
            setSelectedFile(null);
        } finally {
            // Ensure loading state is turned off and input is cleared
            setUploadingAvatar(false);
             if (fileInputRef.current) {
                fileInputRef.current.value = null; // Clear the file input visually
            }
        }
    };

    // Effect to automatically trigger upload when 'selectedFile' state changes
    useEffect(() => {
        if (selectedFile) {
            handleUploadAvatar(); // Call the upload function
        }
        // This dependency array ensures the effect runs only when selectedFile changes.
        // handleUploadAvatar is stable if defined outside or wrapped in useCallback (if needed).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedFile]);


    // --- Render Functions for Tab Content ---
    const renderActivityList = () => (
        <div className="table-container">
            <table className="activity-table">
                <thead><tr><th>Action</th><th>Details</th><th>Time</th></tr></thead>
                <tbody>
                    {activity.length === 0 ? (
                        <tr><td colSpan="3" className="no-data-cell">No activity found</td></tr>
                    ) : (
                       activity.map((item, index) => (
                           <tr key={item._id || index}>
                               <td><span className="action-cell"><ActionIcon /> {item.action || 'Activity'}</span></td>
                               <td title={item.pollTitle || ''}>{item.pollTitle || 'N/A'}</td>
                               <td>
                                   {item.timestamp ?
                                       `${new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} ${new Date(item.timestamp).toLocaleDateString()}`
                                       : 'N/A'
                                   }
                              </td>
                           </tr>
                       ))
                    )}
                </tbody>
            </table>
        </div>
    );

    const renderPollsList = () => (
        // Replace with your actual component or logic to display user's polls
        <div className="polls-list-placeholder">
             <div className="table-container">
                 <table className="activity-table">
                     <thead><tr><th>Poll Title</th><th>Status</th><th>Date Created</th></tr></thead>
                      <tbody>
                         <tr><td colSpan="3" className="no-data-cell">You haven't created any polls yet.</td></tr>
                     </tbody>
                 </table>
             </div>
        </div>
    );
    // --- End Tab Render Functions ---

    // --- Conditional Rendering Logic ---
     // Show main loading indicator only if profile isn't loaded yet
     if (loading && !userProfile) {
         return <div className="profile-container profile-loading">Loading Profile Data...</div>;
     }

    // Show connect prompt if wallet is not connected
    if (!isConnected) {
        return (
            <div className="profile-container disconnected-prompt">
                <h2>Profile</h2>
                <p>Please connect your wallet to view your profile.</p>
                <button onClick={openAuthModal} className="btn btn-connect">
                    Connect Wallet
                </button>
            </div>
        );
    }

    // --- Main Component Return (JSX) ---
    return (
        // Overall page container for padding/background
        <div className="profile-page-container">
            {/* Main content container */}
            <div className="profile-container">

                {/* --- Top Header Section --- */}
                <div className="profile-header">
                    {/* Left side: Avatar, Name, Level */}
                    <div className="profile-info">
                        {/* Avatar container with uploading state */}
                        <div className={`profile-avatar-container ${uploadingAvatar ? 'uploading' : ''}`}>
                            {/* Clickable area for avatar */}
                            <div
                                className="profile-avatar-img overflow-hidden cursor-pointer"
                                onClick={() => !uploadingAvatar && fileInputRef.current?.click()} // Trigger file input click
                                title="Click to change avatar" // Tooltip
                            >
                                {/* Display actual avatar or placeholder */}
                                {userProfile && userProfile.avatarUrl ? (
                                    <img
                                        key={userProfile.avatarUrl} // *** Force re-render on URL change ***
                                        src={userProfile.avatarUrl}
                                        alt="Profile Avatar"
                                        className="h-full w-full object-cover"
                                        onError={(e) => { // Handle image load errors
                                            // Hide broken image
                                            e.target.style.display='none';
                                        }}
                                    />
                                ) : (
                                    // Placeholder initial
                                    <div className="h-full w-full flex items-center justify-center bg-gray-200 text-gray-500 text-2xl font-semibold">
                                        {getProfileInitial()}
                                    </div>
                                )}
                                {/* Hidden actual file input */}
                                <input
                                  type="file"
                                  accept="image/jpeg, image/png, image/gif, image/webp" // Specify accepted types
                                  ref={fileInputRef}
                                  style={{ display: 'none' }} // Keep it hidden
                                  onChange={handleFileChange} // Call handler on file selection
                                  disabled={uploadingAvatar} // Disable while an upload is in progress
                                />
                            </div>
                            {/* Spinner overlay shown during upload */}
                            {uploadingAvatar && <div className="avatar-upload-spinner"></div>}
                        </div>
                        {/* Name, Address, Level */}
                        <div className="profile-name-level">
                            <h1 className="profile-name">{userProfile?.username || formatAddress(account)}</h1>
                            {/* Display formatted address if no username */}
                            {!userProfile?.username && (
                                <p className="profile-address" title={account}>{formatAddress(account)}</p>
                            )}
                            <p className="profile-level">Level {level}</p>
                        </div>
                    </div>

                    {/* Middle: Progress Bar */}
                    <div className="profile-progress-area">
                         <div className="profile-progress-bar-container">
                             <div className="profile-progress-bar" style={{ width: `${progress}%` }}></div>
                         </div>
                         <span className="profile-progress-percentage">{progress}%</span>
                    </div>

                    {/* Right side: Action Buttons */}
                    <div className="profile-actions">
                        <button className="btn btn-create-poll" onClick={() => navigate('/create-poll')}>Create Poll</button>
                        <button className="btn btn-profile-settings" onClick={() => navigate('/settings/profile')}>Profile Settings</button>
                    </div>
                </div>
                {/* --- End Header Section --- */}


                {/* --- Stats Grid Section --- */}
                <div className="stats-grid">
                     {/* Rewards Card */}
                    <div className="stat-card">
                        <div className="stat-header">
                            <RewardsIcon className="stat-icon" />
                            <div className="stat-title-group">
                                <h3 className="stat-title">Rewards Earned</h3>
                                <p className="stat-subtitle">Lifetime</p> {/* Adjust time frame if needed */}
                            </div>
                        </div>
                        <p className="stat-value">${stats.rewards.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                        {/* <div className="stat-change increase">22% ▲</div> Example trend indicator */}
                    </div>
                     {/* Votes Card */}
                    <div className="stat-card">
                         <div className="stat-header">
                            <VotesIcon className="stat-icon" />
                            <div className="stat-title-group">
                                <h3 className="stat-title">Times Voted</h3>
                                <p className="stat-subtitle">Lifetime</p>
                            </div>
                        </div>
                        <p className="stat-value">{stats.votes.toLocaleString()}</p>
                         {/* <div className="stat-change decrease">0% ▼</div> Example trend indicator */}
                    </div>
                     {/* Polls Posted Card */}
                     <div className="stat-card">
                         <div className="stat-header">
                            <PollsIcon className="stat-icon" />
                            <div className="stat-title-group">
                                <h3 className="stat-title">Polls Posted</h3>
                                <p className="stat-subtitle">Lifetime</p>
                            </div>
                        </div>
                        <p className="stat-value">{stats.polls.toLocaleString()}</p>
                         {/* <div className="stat-change increase">3% ▲</div> Example trend indicator */}
                     </div>
                </div>
                {/* --- End Stats Grid Section --- */}


                 {/* --- Tabs Navigation Section --- */}
                 <div className="profile-tabs-container">
                     <div className="profile-tabs">
                         <button
                             className={`profile-tab ${activeTab === 'activity' ? 'active' : ''}`}
                             onClick={() => setActiveTab('activity')}
                         >
                             <ActivityIcon className="tab-icon" /> My Activity
                         </button>
                         <button
                             className={`profile-tab ${activeTab === 'polls' ? 'active' : ''}`}
                             onClick={() => setActiveTab('polls')}
                         >
                             <MyPollsIcon className="tab-icon" /> My Polls
                         </button>
                     </div>
                 </div>
                 {/* --- End Tabs Navigation Section --- */}


                  {/* --- Tab Content Display Section --- */}
                  <div className="profile-tab-content">
                      {/* Conditionally render the component based on the active tab */}
                      {activeTab === 'activity' ? renderActivityList() : renderPollsList()}
                  </div>
                  {/* --- End Tab Content Display Section --- */}

            </div> {/* End profile-container */}
        </div> // End profile-page-container
    );
};

export default Profile;