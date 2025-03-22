import React from 'react';
import { Link } from 'react-router-dom';

const Terms = () => {
  return (
    <div className="max-w-4xl mx-auto my-10 p-8 bg-white rounded-lg shadow-md">
      <h1 className="text-3xl font-bold mb-6">Terms of Service</h1>
      
      <div className="prose prose-blue max-w-none">
        <p className="mb-4">
          Last Updated: {new Date().toLocaleDateString()}
        </p>
        
        <h2 className="text-xl font-semibold mt-6 mb-3">1. Acceptance of Terms</h2>
        <p>
          By accessing or using TruthPoll, you agree to be bound by these Terms of Service and all applicable laws and regulations. 
          If you do not agree with any of these terms, you are prohibited from using or accessing this site.
        </p>
        
        <h2 className="text-xl font-semibold mt-6 mb-3">2. Use License</h2>
        <p>
          Permission is granted to temporarily use TruthPoll for personal, non-commercial transitory viewing only. 
          This is the grant of a license, not a transfer of title, and under this license you may not:
        </p>
        <ul className="list-disc pl-6 mb-4">
          <li>Modify or copy the materials</li>
          <li>Use the materials for any commercial purpose or for any public display</li>
          <li>Attempt to reverse engineer any software contained on TruthPoll</li>
          <li>Remove any copyright or other proprietary notations from the materials</li>
          <li>Transfer the materials to another person or "mirror" the materials on any other server</li>
        </ul>
        
        <h2 className="text-xl font-semibold mt-6 mb-3">3. Blockchain Interactions</h2>
        <p>
          TruthPoll interacts with the Polygon blockchain. You acknowledge and agree that:
        </p>
        <ul className="list-disc pl-6 mb-4">
          <li>Blockchain transactions are irreversible and cannot be deleted or modified once confirmed</li>
          <li>You are responsible for keeping your wallet credentials secure</li>
          <li>All blockchain transactions may incur network fees (gas fees)</li>
          <li>We are not responsible for any loss due to user error or blockchain network issues</li>
        </ul>
        
        <h2 className="text-xl font-semibold mt-6 mb-3">4. Poll Content</h2>
        <p>
          You are solely responsible for any content you create on TruthPoll. You agree not to create polls that:
        </p>
        <ul className="list-disc pl-6 mb-4">
          <li>Are illegal or promote illegal activities</li>
          <li>Infringe upon the rights of others</li>
          <li>Are harmful, fraudulent, deceptive, threatening, harassing, defamatory, obscene, or otherwise objectionable</li>
          <li>Contain malicious code or attempt to interfere with the proper functioning of the service</li>
        </ul>
        
        <h2 className="text-xl font-semibold mt-6 mb-3">5. Limitation of Liability</h2>
        <p>
          In no event shall TruthPoll or its suppliers be liable for any damages (including, without limitation, damages for loss 
          of data or profit, or due to business interruption) arising out of the use or inability to use TruthPoll, even if 
          TruthPoll or a TruthPoll authorized representative has been notified orally or in writing of the possibility of such damage.
        </p>
        
        <h2 className="text-xl font-semibold mt-6 mb-3">6. Governing Law</h2>
        <p>
          These terms and conditions are governed by and construed in accordance with the laws and you irrevocably submit to the 
          exclusive jurisdiction of the courts in that location.
        </p>
      </div>
      
      <div className="mt-8 pt-6 border-t border-gray-200">
        <Link to="/" className="text-primary-600 hover:text-primary-800">
          Return to Home
        </Link>
      </div>
    </div>
  );
};

export default Terms;