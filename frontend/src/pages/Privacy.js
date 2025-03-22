import React from 'react';
import { Link } from 'react-router-dom';

const Privacy = () => {
  return (
    <div className="max-w-4xl mx-auto my-10 p-8 bg-white rounded-lg shadow-md">
      <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
      
      <div className="prose prose-blue max-w-none">
        <p className="mb-4">
          Last Updated: {new Date().toLocaleDateString()}
        </p>
        
        <h2 className="text-xl font-semibold mt-6 mb-3">1. Introduction</h2>
        <p>
          Welcome to TruthPoll. We respect your privacy and are committed to protecting your personal data. 
          This privacy policy will inform you about how we look after your personal data when you visit our website 
          and tell you about your privacy rights and how the law protects you.
        </p>
        
        <h2 className="text-xl font-semibold mt-6 mb-3">2. Data We Collect</h2>
        <p>
          When you use TruthPoll, we may collect the following types of information:
        </p>
        <ul className="list-disc pl-6 mb-4">
          <li>Public wallet addresses</li>
          <li>Email address (if you sign up with Magic.link email authentication)</li>
          <li>Poll voting data</li>
          <li>Poll creation data</li>
        </ul>
        
        <h2 className="text-xl font-semibold mt-6 mb-3">3. How We Use Your Data</h2>
        <p>
          We use your personal data for the following purposes:
        </p>
        <ul className="list-disc pl-6 mb-4">
          <li>To provide and maintain our service</li>
          <li>To enable blockchain transactions</li>
          <li>To notify you about changes to our service</li>
          <li>To allow you to participate in interactive features of our service when you choose to do so</li>
        </ul>
        
        <h2 className="text-xl font-semibold mt-6 mb-3">4. Blockchain Data</h2>
        <p>
          Please note that blockchain data, including wallet addresses and voting records, is publicly available 
          by the nature of blockchain technology. Any data recorded on the blockchain cannot be deleted or modified.
        </p>
        
        <h2 className="text-xl font-semibold mt-6 mb-3">5. Cookies and Tracking</h2>
        <p>
          We use cookies to enhance your experience on our website. You can set your browser to refuse all or some 
          browser cookies, or to alert you when websites set or access cookies.
        </p>
        
        <h2 className="text-xl font-semibold mt-6 mb-3">6. Contact Us</h2>
        <p>
          If you have any questions about this privacy policy, please contact us at: 
          <a href="mailto:privacy@truthpoll.com" className="text-primary-600 hover:text-primary-800">
            privacy@truthpoll.com
          </a>
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

export default Privacy;