import React, { useState, useEffect, useCallback, useReducer } from 'react';
import { Search, Folder, Mail, User, Tag, Clock } from 'lucide-react';

// --- MOCK DATA & API SIMULATION (REPLACES NODE.JS/EXPRESS BACKEND) ---

// Define the structure of the data expected from the backend
const FOLDERS = ['INBOX', 'Sent', 'Spam', 'Drafts'];
const ACCOUNTS = ['reachinbox@sales.com', 'admin@support.com'];
const AI_CATEGORIES = ['Interested', 'Meeting Booked', 'Not Interested', 'Spam', 'Out of Office', 'Uncategorized'];

const mockEmails = Array.from({ length: 50 }).map((_, i) => ({
  id: `msg-${i + 1}`,
  accountId: ACCOUNTS[i % 2],
  folder: FOLDERS[i % 4],
  subject: i % 5 === 0 ? `Urgent: Interested in your ${ACCOUNTS[i % 2].split('@')[0]} product!` : `Re: Follow-up on project proposal ${i + 1}`,
  body: `This is the body of email ${i + 1}. It contains important information about the query.`,
  from: `client_${i}@partner.net`,
  date: new Date(Date.now() - (i * 1000 * 60 * 60 * 2)).toISOString(), // Older emails first
  aiCategory: AI_CATEGORIES[i % 6],
}));

/**
 * Mocks the backend API call to the Elasticsearch search endpoint.
 * Logic simulates filtering by keyword and account/folder terms.
 */
const mockSearchApi = ({ query, account, folder }) => {
  return new Promise(resolve => {
    setTimeout(() => {
      let results = mockEmails;

      // Filter by Account
      if (account && account !== 'All Accounts') {
        results = results.filter(email => email.accountId === account);
      }

      // Filter by Folder
      if (folder && folder !== 'All Folders') {
        results = results.filter(email => email.folder === folder);
      }

      // Filter by Query (Simulating multi_match on subject and body)
      if (query) {
        const q = query.toLowerCase();
        results = results.filter(email => 
          email.subject.toLowerCase().includes(q) || 
          email.body.toLowerCase().includes(q)
        );
      }

      // Sort by date (latest first)
      results.sort((a, b) => new Date(b.date) - new Date(a.date));

      resolve(results.slice(0, 20)); // Return a paginated-like result
    }, 500); // Simulate network latency
  });
};

// --- REDUCER AND INITIAL STATE ---

const initialState = {
  emails: [],
  accounts: ACCOUNTS,
  folders: FOLDERS,
  currentQuery: '',
  currentFolder: 'All Folders',
  currentAccount: 'All Accounts',
  loading: false,
};

function oneboxReducer(state, action) {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_EMAILS':
      return { ...state, emails: action.payload };
    case 'SET_QUERY':
      return { ...state, currentQuery: action.payload };
    case 'SET_FOLDER':
      return { ...state, currentFolder: action.payload };
    case 'SET_ACCOUNT':
      return { ...state, currentAccount: action.payload };
    default:
      return state;
  }
}

// --- UTILITIES & STYLING ---

const getCategoryColor = (category) => {
  switch (category) {
    case 'Interested': return 'bg-emerald-100 text-emerald-800';
    case 'Meeting Booked': return 'bg-blue-100 text-blue-800';
    case 'Not Interested': return 'bg-yellow-100 text-yellow-800';
    case 'Spam': return 'bg-red-100 text-red-800';
    case 'Out of Office': return 'bg-purple-100 text-purple-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const formatTime = (dateString) => {
  const date = new Date(dateString);
  if (isNaN(date)) return 'Unknown Date';
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

const formatDate = (dateString) => {
    const date = new Date(dateString);
    if (isNaN(date)) return 'Unknown Date';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};


// --- COMPONENTS ---

const Dropdown = ({ label, value, options, onChange }) => (
  <div className="flex flex-col">
    <label className="text-xs font-medium text-gray-500 mb-1">{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="p-2 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm appearance-none bg-white pr-8 transition duration-150 ease-in-out"
    >
      <option value={`All ${label}s`}>{`All ${label}s`}</option>
      {options.map(option => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  </div>
);

const EmailCard = ({ email }) => (
  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-white border-b hover:bg-indigo-50 transition duration-150 ease-in-out cursor-pointer">
    <div className="flex-1 min-w-0 pr-4">
      <div className="flex items-center space-x-2 mb-1">
        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getCategoryColor(email.aiCategory)}`}>
          <Tag size={10} className="inline mr-1" />
          {email.aiCategory}
        </span>
        <span className="text-xs text-gray-500">
          <User size={12} className="inline mr-0.5" />
          {email.accountId.split('@')[0]}
        </span>
        <span className="text-xs text-gray-500">
          <Folder size={12} className="inline mr-0.5" />
          {email.folder}
        </span>
      </div>
      <p className="text-sm sm:text-base font-semibold truncate text-gray-800">
        {email.subject}
      </p>
      <p className="text-xs sm:text-sm text-gray-600 truncate mt-0.5">
        From: {email.from} — {email.body.substring(0, 80)}...
      </p>
    </div>
    <div className="flex flex-col items-end text-right mt-2 sm:mt-0">
      <span className="text-xs text-gray-400 font-medium">
        <Clock size={12} className="inline mr-0.5" />
        {formatTime(email.date)}
      </span>
      <span className="text-xs text-gray-400">
        {formatDate(email.date)}
      </span>
    </div>
  </div>
);

// --- MAIN APP COMPONENT ---

const App = () => {
  const [state, dispatch] = useReducer(oneboxReducer, initialState);
  const { emails, accounts, folders, currentQuery, currentFolder, currentAccount, loading } = state;

  // Function to fetch and filter emails (simulated API call)
  const fetchEmails = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const results = await mockSearchApi({
        query: currentQuery,
        account: currentAccount,
        folder: currentFolder,
      });
      dispatch({ type: 'SET_EMAILS', payload: results });
    } catch (error) {
      console.error("Failed to fetch emails from Elasticsearch API:", error);
      dispatch({ type: 'SET_EMAILS', payload: [] });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [currentQuery, currentAccount, currentFolder]);

  // Effect to trigger search whenever query or filters change
  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);
  
  // Handlers
  const handleSearchChange = (e) => dispatch({ type: 'SET_QUERY', payload: e.target.value });
  const handleAccountChange = (value) => dispatch({ type: 'SET_ACCOUNT', payload: value });
  const handleFolderChange = (value) => dispatch({ type: 'SET_FOLDER', payload: value });

  return (
    <div className="min-h-screen bg-gray-50 font-[Inter] p-4 sm:p-6">
      <script src="https://cdn.tailwindcss.com"></script>
      
      <h1 className="text-3xl font-extrabold text-gray-900 mb-6 text-center sm:text-left flex items-center justify-center sm:justify-start">
        <Mail className="w-8 h-8 text-indigo-600 mr-3" />
        AI ReachInbox Onebox
      </h1>

      {/* Control Panel: Search and Filters */}
      <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg mb-6">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4 w-full">
          {/* Search Bar (Elasticsearch Query) */}
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="search" className="text-xs font-medium text-gray-500 mb-1 block">Search Emails (Subject & Body)</label>
            <div className="relative">
              <input
                id="search"
                type="text"
                value={currentQuery}
                onChange={handleSearchChange}
                placeholder="Search by keyword..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>
          </div>
          
          {/* Account Filter */}
          <Dropdown
            label="Account Filter"
            value={currentAccount}
            options={accounts}
            onChange={handleAccountChange}
          />

          {/* Folder Filter */}
          <Dropdown
            label="Folder Filter"
            value={currentFolder}
            options={folders}
            onChange={handleFolderChange}
          />
        </div>
      </div>

      {/* Email List Section */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="bg-gray-100 px-4 py-3 sm:px-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">
            {currentAccount !== 'All Accounts' ? `${currentAccount}'s ` : 'All '} Inbox
          </h2>
          <p className="text-sm text-gray-500">
            Showing results for "{currentQuery || 'All'}" in folder "{currentFolder}".
          </p>
        </div>
        
        {loading && (
          <div className="p-8 text-center text-indigo-600">
            <svg className="animate-spin h-6 w-6 mr-3 inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Loading emails... (Simulating API call to Elasticsearch)
          </div>
        )}

        {!loading && emails.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            <Mail className="w-10 h-10 mx-auto mb-2" />
            <p className="font-medium">No emails found matching your criteria.</p>
            <p className="text-sm">Try broadening your search or filter settings.</p>
          </div>
        )}

        {!loading && emails.length > 0 && (
          <div>
            {emails.map(email => (
              <EmailCard key={email.id} email={email} />
            ))}
            <div className="p-4 bg-gray-50 text-center text-sm text-gray-500 border-t">
                Displaying {emails.length} results. (Pagination not fully implemented in mock)
            </div>
          </div>
        )}
      </div>

       {/* Phase 6 Mock Button (for future implementation) */}
      <div className="mt-8 p-4 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-800 text-center">
        <p className="font-semibold">RAG Feature Ready</p>
        <p className="text-sm">The foundation for AI-Powered Suggested Replies (Phase 6) is established. This UI would later display a "Suggest Reply" button on each email card, calling the RAG API.</p>
      </div>

    </div>
  );
};

export default App;
