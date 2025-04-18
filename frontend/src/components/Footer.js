import React from 'react';
import { Link } from 'react-router-dom';
import { FaDiscord, FaLinkedin, FaTwitter } from 'react-icons/fa';
import logo from '../assets/test123.png';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="w-full mt-auto">
      {/* Main footer content with subtle gradient background and rounded top corners */}
      <div className="bg-gradient-to-r from-gray-100 to-blue-100 rounded-t-3xl">
        <div className="container mx-auto px-6 py-12">
          <div className="flex flex-col md:flex-row justify-between gap-12">
            {/* Left column - Logo and contact info */}
            <div className="flex flex-col">
              <div className="mb-3">
                <Link to="/">
                  <img src={logo} alt="TruthPoll Logo" className="h-16" />
                </Link>
              </div>
              <div className="text-gray-700 text-sm">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Contact</h3>
                <p className="mb-3">contact@truthpoll.io</p>
                <address className="not-italic">
                  <p>New York, NY</p>
                  <p>United States</p>
                </address>
              </div>
            </div>

            {/* Center column - Links */}
            <div className="flex flex-col">
              <h3 className="text-lg font-semibold text-gray-800 mb-6">Company</h3>
              <div className="flex flex-col gap-3">
                <Link to="/about" className="text-gray-700 hover:text-cyan-600 transition-colors">
                  About Us
                </Link>
                <Link to="/guides" className="text-gray-700 hover:text-cyan-600 transition-colors">
                  Guides and Articles
                </Link>
                <Link to="/how-it-works" className="text-gray-700 hover:text-cyan-600 transition-colors">
                  How it Works
                </Link>
                <Link to="/terms" className="text-gray-700 hover:text-cyan-600 transition-colors">
                  Terms of Service
                </Link>
                <Link to="/privacy" className="text-gray-700 hover:text-cyan-600 transition-colors">
                  Privacy Policy
                </Link>
              </div>
            </div>

            {/* Right column - Social and Discord */}
            <div className="flex flex-col">
              <h3 className="text-lg font-semibold text-gray-800 mb-6">Follow Us</h3>
              <div className="flex gap-4 mb-8">
                <a 
                  href="https://twitter.com/truthpoll" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-gray-700 hover:text-cyan-600 transition-colors"
                  aria-label="Follow us on Twitter"
                >
                  <FaTwitter className="text-xl" />
                </a>
                <a 
                  href="https://linkedin.com/company/truthpoll" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-gray-700 hover:text-blue-600 transition-colors"
                  aria-label="Follow us on LinkedIn"
                >
                  <FaLinkedin className="text-xl" />
                </a>
              </div>
              
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Join the Community</h3>
              <a 
                href="https://discord.gg/RWPKFVQxhS" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <FaDiscord className="text-lg" />
                <span>Discord</span>
              </a>
            </div>
          </div>
        </div>
      </div>
      
      {/* Copyright bar with thin border */}
      <div className="bg-gray-50 border-t border-gray-200 py-4 px-6">
        <div className="container mx-auto flex justify-end">
          <p className="text-sm text-gray-500">
            &copy; {currentYear} TruthPoll. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;