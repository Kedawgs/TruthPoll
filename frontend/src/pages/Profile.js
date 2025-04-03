// src/pages/Profile.js
// This code defines the LOOK of the main /profile PAGE, matching the screenshot.
// It does NOT affect the profile display in the Navbar component.

import React, { useState, useEffect } from 'react';
import { useAppContext } from '../hooks/useAppContext';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { formatAddress } from '../utils/web3Helper'; // Assuming this formats like 0x123...abcd
import './Profile.css'; // Import the specific CSS for this page

// --- Placeholder Icon Components (Replace with your actual icons) ---
// You can use libraries like react-icons or import your own SVG components
const PlaceholderIcon = ({ className = "w-6 h-6 text-gray-500" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
);
// Example styling within the component - you might prefer to style via CSS
const RewardsIcon = ({ className }) => <div className={`${className} bg-green-100 text-green-600 rounded-full p-1.5 flex items-center justify-center`}><PlaceholderIcon className="w-5 h-5"/></div>;
const VotesIcon = ({ className }) => <div className={`${className} bg-blue-100 text-blue-600 rounded-full p-1.5 flex items-center justify-center`}><PlaceholderIcon className="w-5 h-5"/></div>;
const PollsIcon = ({ className }) => <div className={`${className} bg-purple-100 text-purple-600 rounded-full p-1.5 flex items-center justify-center`}><PlaceholderIcon className="w-5 h-5"/></div>;
const ActivityIcon = ({ className }) => <div className={`${className} p-1`}><PlaceholderIcon className="w-5 h-5" /></div>;
const MyPollsIcon = ({ className }) => <div className={`${className} p-1`}><PlaceholderIcon className="w-5 h-5" /></div>;
const ActionIcon = ({ className }) => <div className={`${className} w-4 h-4 text-gray-400`}><PlaceholderIcon className="w-full h-full"/></div>;
// --- End Placeholder Icons ---


const Profile = () => {
    const navigate = useNavigate();
    const {
        isConnected,
        account,
        userProfile, // Contains username if set
        openAuthModal,
        getReceivedRewards // Assuming this fetches activity/rewards list
    } = useAppContext();

    // State
    const [activity, setActivity] = useState([]);
    const [stats, setStats] = useState({ rewards: 0, votes: 0, polls: 0 });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('activity'); // 'activity' or 'polls'
    const [level, setLevel] = useState(1); // Placeholder - fetch actual level
    const [progress, setProgress] = useState(52); // Placeholder - fetch actual progress

    // Fetch profile data
    useEffect(() => {
        const loadProfileData = async () => {
            if (!isConnected || !account) {
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                // Fetch activity/rewards
                // Assuming getReceivedRewards returns an object like { success: true, data: [...] }
                const rewardsResponse = await getReceivedRewards();
                if (rewardsResponse?.success && Array.isArray(rewardsResponse.data)) {
                    setActivity(rewardsResponse.data);
                } else {
                     setActivity([]); // Ensure it's an array
                }


                // --- Fetch User Stats - REPLACE WITH YOUR ACTUAL API LOGIC ---
                let rewardsEarned = 314; // Default Placeholder
                if (rewardsResponse?.success && Array.isArray(rewardsResponse.data)) {
                     // Example calculation if rewards data has amounts
                     rewardsEarned = rewardsResponse.data.reduce((sum, reward) => sum + (Number(reward.amount) || 0), 0);
                }

                let votesCount = 224; // Default Placeholder
                try {
                    const votesResponse = await api.get(`/users/votes/${account}`);
                    if (votesResponse?.data?.success) {
                         votesCount = votesResponse.data.data.totalVotes || 0;
                    }
                } catch (voteErr) {
                     console.warn("Could not fetch precise vote count:", voteErr);
                     // Use fallback if needed
                     votesCount = rewardsResponse?.data?.length || 224; // Example fallback
                }

                let pollsCreatedCount = 36; // Default Placeholder
                try {
                     const pollsResponse = await api.get(`/polls?creator=${account}&limit=1&countOnly=true`); // Check if backend supports countOnly
                     if (pollsResponse?.data?.success) {
                         pollsCreatedCount = pollsResponse.data.total || 0;
                     }
                 } catch (pollErr) {
                     console.warn("Could not fetch created poll count:", pollErr);
                 }
                 // --- End Stat Fetching Example ---

                setStats({
                    rewards: rewardsEarned,
                    votes: votesCount,
                    polls: pollsCreatedCount
                });

                // Fetch Level & Progress if available from API/Context
                // Example: const profileDetails = await api.get(`/users/profile/${account}`);
                // setLevel(profileDetails?.data?.level || 1);
                // setProgress(profileDetails?.data?.progress || 52);

                setLoading(false);
            } catch (err) {
                console.error('Error loading profile data:', err);
                // Set placeholders even on error to avoid breaking UI
                setStats({ rewards: 314, votes: 224, polls: 36 });
                setActivity([]);
                setLoading(false);
            }
        };

        loadProfileData();
    }, [isConnected, account, getReceivedRewards]); // Dependencies for re-fetching

    // Helper function to get profile initial for avatar
    const getProfileInitial = () => {
        if (userProfile?.username) {
            return userProfile.username.charAt(0).toUpperCase();
        }
        if (account) {
            return account.substring(2, 3).toUpperCase();
        }
        return '?';
    };

    // --- Render Functions for Tab Content ---
    const renderActivityList = () => (
        <div className="table-container"> {/* Added container for potential overflow */}
            <table className="activity-table">
                <thead>
                    <tr>
                        <th>Action</th>
                        <th>Details</th>
                        <th>Time</th>
                    </tr>
                </thead>
                <tbody>
                    {!loading && activity.length === 0 && ( // Show only example if not loading and no real data
                         <>
                            {/* Example Rows - Remove or conditionalize based on preference */}
                            <tr><td><span className="action-cell"><ActionIcon /> Vote Placed</span></td><td>Example Poll: Who will win the next election?</td><td>09:24 12/03/2024</td></tr>
                            <tr><td><span className="action-cell"><ActionIcon /> Poll Created</span></td><td>Example Poll: Market Sentiment on ETH?</td><td>08:15 12/03/2024</td></tr>
                            <tr><td><span className="action-cell"><ActionIcon /> Payout</span></td><td>Example Poll: Result for Weather Prediction</td><td>14:30 11/03/2024</td></tr>
                         </>
                    )}
                    {activity.map((item, index) => ( // Render real data if available
                        <tr key={item._id || index}>
                            {/* Use more specific action types if available */}
                            <td><span className="action-cell"><ActionIcon /> {item.action || 'Activity'}</span></td>
                            {/* Make details linkable if desired */}
                            <td title={item.pollTitle || ''}>{item.pollTitle || 'N/A'}</td>
                             {/* Format date/time */}
                            <td>
                                {item.timestamp ?
                                    `${new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} ${new Date(item.timestamp).toLocaleDateString()}`
                                    : 'N/A'
                                }
                           </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderPollsList = () => (
        // --- Replace with your actual Polls List Component ---
        <div className="polls-list-placeholder">
             <div className="table-container">
                 <table className="activity-table">
                     <thead>
                         <tr>
                             <th>Poll Title</th>
                             <th>Status</th>
                             <th>Date Created</th>
                             {/* Add more columns like 'Your Vote', 'Potential Payout' etc. */}
                         </tr>
                     </thead>
                      <tbody>
                          {/* Map over user's created polls here */}
                          <tr><td colSpan="3" className="no-data-cell">You haven't created any polls yet.</td></tr>
                          {/* Example Rows */}
                          <tr><td>Example Poll 1: Future of AI</td><td>Active</td><td>11/03/2024</td></tr>
                          <tr><td>Example Poll 2: Crypto Prices</td><td>Ended</td><td>10/03/2024</td></tr>
                      </tbody>
                 </table>
             </div>
        </div>
        // --- End Polls List Placeholder ---
    );

     // Render loading state for the main content area
     if (loading && isConnected) {
         // You might want a more styled loading indicator
         return <div className="profile-container profile-loading">Loading Profile Data...</div>;
     }

    // Render disconnected state
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

    // --- Render Main Profile Content ---
    return (
        // Add overall padding and background in a higher-level container or via body style if needed
        <div className="profile-page-container"> {/* Use this for overall page padding/background */}
            <div className="profile-container"> {/* Container for the profile content */}
                {/* --- Top Header Section --- */}
                <div className="profile-header">
                    <div className="profile-info">
                        {/* Avatar with user image if available */}
                        <div className="profile-avatar-img overflow-hidden">
                            {userProfile && userProfile.avatarUrl ? (
                                <img
                                    src={userProfile.avatarUrl}
                                    alt="Profile Avatar"
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <div className="h-full w-full flex items-center justify-center bg-gray-200 text-gray-500 text-2xl font-semibold">
                                    {getProfileInitial()}
                                </div>
                            )}
                        </div>
                        <div className="profile-name-level">
                            <h1 className="profile-name">{userProfile?.username || formatAddress(account)}</h1>
                            {/* Show address only if no username, or keep both */}
                            {!userProfile?.username && (
                                <p className="profile-address" title={account}>{formatAddress(account)}</p>
                            )}
                            <p className="profile-level">Level {level}</p>
                        </div>
                    </div>
                    <div className="profile-progress-area">
                         <div className="profile-progress-bar-container">
                             <div className="profile-progress-bar" style={{ width: `${progress}%` }}></div>
                         </div>
                         <span className="profile-progress-percentage">{progress}%</span> {/* Use actual progress */}
                    </div>
                    <div className="profile-actions">
                        {/* Add onClick handlers to navigate or open modals */}
                        <button className="btn btn-create-poll" onClick={() => navigate('/create-poll')}>Create Poll</button>
                        <button className="btn btn-profile-settings" onClick={() => navigate('/settings/profile')}>Profile Settings</button>
                    </div>
                </div>

                {/* --- Stats Section --- */}
                <div className="stats-grid">
                    {/* Rewards Card */}
                    <div className="stat-card">
                        <div className="stat-header">
                            <RewardsIcon className="stat-icon" />
                            <div className="stat-title-group">
                                <h3 className="stat-title">Rewards Earned</h3>
                                <p className="stat-subtitle">Last 7 days</p> {/* Adjust time frame */}
                            </div>
                        </div>
                        <p className="stat-value">${stats.rewards.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                        {/* Placeholder - Add real data/logic */}
                        <div className="stat-change increase">22% ▲</div>
                    </div>

                    {/* Votes Card */}
                    <div className="stat-card">
                         <div className="stat-header">
                            <VotesIcon className="stat-icon" />
                            <div className="stat-title-group">
                                <h3 className="stat-title">Times Voted</h3>
                                <p className="stat-subtitle">Last 7 days</p> {/* Adjust time frame */}
                            </div>
                        </div>
                        <p className="stat-value">{stats.votes.toLocaleString()}</p>
                         {/* Placeholder - Add real data/logic */}
                         <div className="stat-change decrease">0% ▼</div>
                    </div>

                    {/* Polls Posted Card */}
                     <div className="stat-card">
                         <div className="stat-header">
                            <PollsIcon className="stat-icon" />
                            <div className="stat-title-group">
                                <h3 className="stat-title">Polls Posted</h3>
                                <p className="stat-subtitle">Lifetime</p> {/* Adjust time frame */}
                            </div>
                        </div>
                        <p className="stat-value">{stats.polls.toLocaleString()}</p>
                         {/* Placeholder - Add real data/logic */}
                         <div className="stat-change increase">3% ▲</div>
                     </div>
                </div>

                 {/* --- Tabs Section --- */}
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

                 {/* --- Tab Content Section --- */}
                  <div className="profile-tab-content">
                      {loading ? (
                           <div className="tab-loading">Loading data...</div> // Add a loading state for tab content
                       ) : (
                           activeTab === 'activity' ? renderActivityList() : renderPollsList()
                       )}
                  </div>

            </div> {/* End profile-container */}
        </div> // End profile-page-container
    );
};

export default Profile;