// src/components/PollConfirmationModal.js
import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../hooks/useAppContext';

// Default Icon (Example: Document Icon)
const DefaultPollIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const PollConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  pollData,
  isProcessing
}) => {
  const { getConfigValue } = useAppContext();

  const [calculations, setCalculations] = useState({
    pollCreationCost: 0,
    rewardCost: 0,
    appFee: 0,
    totalCost: 0
  });

  // --- Blob URL generation and cleanup ---
  const modalPreviewUrl = useMemo(() => {
    if (pollData?.previewFile instanceof File) {
      try { return URL.createObjectURL(pollData.previewFile); }
      catch (e) { console.error("Error creating object URL:", e); return null; }
    }
    return null;
  }, [pollData?.previewFile]);

  useEffect(() => {
    return () => { if (modalPreviewUrl) { URL.revokeObjectURL(modalPreviewUrl); } };
  }, [modalPreviewUrl]);
  // --- End Blob URL Logic ---

  // --- Calculate Costs ---
  useEffect(() => {
    const calculateCosts = () => {
      if (!isOpen || !pollData || typeof pollData.voteLimit === 'undefined' || typeof pollData.rewardPerVoter === 'undefined') {
        setCalculations({ pollCreationCost: 0, rewardCost: 0, appFee: 0, totalCost: 0 });
        return;
      }
      try {
        const averageTxCost = parseFloat(getConfigValue('ESTIMATED_TX_COST', 0.001));
        const voteCount = parseInt(pollData.voteLimit) || 0;
        const rewardPerVoter = parseFloat(pollData.rewardPerVoter) || 0;
        const calculatedPollCreationCost = (averageTxCost * 2 * voteCount) * 1.05;
        const totalRewards = voteCount * rewardPerVoter;
        const subtotal = calculatedPollCreationCost + totalRewards;
        const feePercent = 0.06;
        const appFee = subtotal * feePercent;
        const totalCost = subtotal + appFee;

        setCalculations({
          pollCreationCost: calculatedPollCreationCost.toFixed(4),
          rewardCost: totalRewards.toFixed(2),
          appFee: appFee.toFixed(4), // 4 decimals
          totalCost: totalCost.toFixed(2)
        });
      } catch (error) {
        console.error("Error calculating poll costs:", error);
        setCalculations({ pollCreationCost: 0, rewardCost: 0, appFee: 0, totalCost: 0 });
      }
    };
    calculateCosts();
  }, [isOpen, pollData, getConfigValue]);


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 transition-opacity duration-300 ease-out">
      {/* Modal Panel */}
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden transform transition-all duration-300 ease-out scale-95 opacity-0 animate-modal-scale-fade-in">
        {/* Modal Header */}
        <div className="flex justify-between items-center p-5 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Confirm Your Poll</h3>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="text-gray-400 hover:text-gray-600 focus:outline-none disabled:opacity-50"
            aria-label="Close confirmation modal"
          >
            {/* Close Icon SVG */}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="p-6 space-y-5">

           {/* Poll Info Section (with background) */}
           <div className="bg-slate-50 border border-slate-200/75 rounded-lg p-4 shadow-sm">
             <div className="flex items-center">
               {/* Icon/Image Preview */}
               <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0 border border-slate-300 overflow-hidden mr-4">
                 {modalPreviewUrl ? (
                     <img src={modalPreviewUrl} alt={pollData?.title || 'Poll Icon'} className="w-full h-full object-cover" />
                 ) : ( <DefaultPollIcon /> )}
               </div>
               {/* Title */}
               <div className="flex-grow min-w-0">
                   <h4 className="text-base font-semibold text-gray-900 leading-tight">{pollData?.title || 'Poll Question'}</h4>
               </div>
               {/* Rewards */}
               <div className="ml-2 text-right flex-shrink-0 pl-2">
                    <p className="text-base font-semibold text-gray-800">${calculations.rewardCost}</p>
                    <p className="text-xs text-gray-500 -mt-1">Total Rewards</p>
               </div>
             </div>
           </div>

            {/* --- ADDED Separator Line --- */}
            <div className="border-t border-slate-200/75"></div>
            {/* --- End Separator Line --- */}

          {/* Cost Breakdown Section (no background) */}
          <div className="space-y-3 pt-1"> {/* Added small padding top */}
            {/* Poll Transaction Cost */}
            <div className="flex justify-between text-sm items-center">
              <span className="text-gray-600">Poll Transaction Cost</span>
              <span className="font-medium text-gray-900">${calculations.pollCreationCost}</span>
            </div>
            {/* Total Reward Cost */}
            <div className="flex justify-between text-sm items-center">
              <span className="text-gray-600">Total Reward Cost</span>
              <span className="font-medium text-gray-900">${calculations.rewardCost}</span>
            </div>
            {/* App Fee (4 decimals) */}
            <div className="flex justify-between text-sm items-center">
              <span className="text-gray-600">Truth Poll App Fee</span>
              <span className="font-medium text-gray-900">${calculations.appFee}</span>
            </div>
          </div>

          {/* Total Cost Section (no background) */}
          <div className="flex justify-between items-center border-t border-gray-200 pt-4 pb-1">
            <span className="text-base font-semibold text-gray-800">Total Cost</span>
            <span className="text-base font-bold text-gray-900">${calculations.totalCost}</span>
          </div>

          {/* Help Text Section (with background) */}
          <div className="bg-slate-50 border border-slate-200/75 rounded-lg p-3 shadow-sm text-xs text-gray-500">
            <p>These fees cover the cost of hosting and maintaining the poll on our platform.</p>
            <p className="mt-1">All payments are final and non-refundable.</p>
          </div>

        </div> {/* End Modal Content Body */}

        {/* Modal Footer / Action Buttons Area */}
        <div className="flex border-t border-gray-200 bg-gray-50 px-6 py-4">
          {/* Edit Poll Button */}
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            // --- Changed: rounded-full ---
            className="flex-1 mr-2 py-2 px-4 bg-white border border-gray-300 rounded-full shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Edit Poll
          </button>
          {/* Proceed Button */}
          <button
            type="button"
            onClick={onConfirm}
            disabled={isProcessing}
             // --- Changed: rounded-full ---
            className={`flex-1 ml-2 py-2 px-4 border border-transparent rounded-full shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 transition-colors duration-150 ease-in-out ${
              isProcessing
                ? 'bg-gray-400 cursor-not-allowed' // Disabled style
                : 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600' // Active style
            } disabled:opacity-75`}
          >
            {isProcessing ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" /* ... */><circle /* ... */ /><path /* ... */ /></svg>
                Processing...
              </span>
            ) : (
              'Proceed'
            )}
          </button>
        </div>
      </div> {/* End Modal Panel */}

      {/* Simple CSS Animation definition (optional) */}
      <style jsx global>{`
        @keyframes modal-scale-fade-in {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-modal-scale-fade-in {
          animation: modal-scale-fade-in 0.3s ease-out forwards;
        }
      `}</style>

    </div> // End Modal Backdrop
  );
};

export default PollConfirmationModal;