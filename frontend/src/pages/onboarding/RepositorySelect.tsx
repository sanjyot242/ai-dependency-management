// web/src/pages/onboarding/RepositorySelect.tsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import { motion } from 'framer-motion';
import { FaGithub, FaSearch, FaSpinner, FaLock, FaCheck } from 'react-icons/fa';

interface Repository {
  id: string;
  name: string;
  fullName: string;
  description: string;
  private: boolean;
  language: string;
  stars: number;
  selected: boolean;
}

const RepositorySelect: React.FC = () => {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCount, setSelectedCount] = useState(0);
  
  const API_URL = 'http://localhost:3001/api';

  useEffect(() => {
    const fetchRepositories = async () => {
      try {
        setLoading(true);
        const token = getToken();
        
        if (!token) {
          setError('Not authenticated');
          setLoading(false);
          return;
        }
        
        const response = await axios.get(`${API_URL}/repositories/github`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        if (response.status === 200) {
          // Transform the data to include the selected state
          const repos = response.data.map((repo: any) => ({
            id: repo.id,
            name: repo.name,
            fullName: repo.full_name,
            description: repo.description || 'No description',
            private: repo.private,
            language: repo.language || 'Unknown',
            stars: repo.stargazers_count,
            selected: false
          }));
          
          setRepositories(repos);
        }
      } catch (error) {
        console.error('Error fetching repositories:', error);
        setError('Failed to fetch repositories from GitHub');
      } finally {
        setLoading(false);
      }
    };
    
    fetchRepositories();
  }, [API_URL, getToken]);

  // Filter repositories based on search term
  const filteredRepositories = repositories.filter(repo =>
    repo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    repo.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Toggle repository selection
  const toggleRepository = (id: string) => {
    setRepositories(
      repositories.map(repo => {
        if (repo.id === id) {
          const newSelected = !repo.selected;
          return { ...repo, selected: newSelected };
        }
        return repo;
      })
    );
    
    // Update selected count
    const selectedRepo = repositories.find(repo => repo.id === id);
    if (selectedRepo) {
      setSelectedCount(prev => selectedRepo.selected ? prev - 1 : prev + 1);
    }
  };

  // Continue to the next step
  const handleContinue = async () => {
    try {
      const token = getToken();
      const selectedRepos = repositories
        .filter(repo => repo.selected)
        .map(repo => ({
          id: repo.id,
          fullName: repo.fullName,
          private: repo.private
        }));
      
      // Save selected repositories to backend
      await axios.post(
        `${API_URL}/onboarding/repositories`,
        { repositories: selectedRepos },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      
      // Navigate to the next step
      navigate('/onboarding/config-setup');
    } catch (error) {
      console.error('Error saving repository selection:', error);
      setError('Failed to save your repository selection');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <FaSpinner className="text-4xl text-blue-500 animate-spin mb-4" />
        <h2 className="text-lg text-gray-600">Loading your repositories...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">Error Loading Repositories</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/onboarding/welcome')}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="max-w-5xl mx-auto"
      >
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="px-6 py-8 sm:px-10 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-800">
                Select Repositories
              </h1>
              <div className="flex items-center">
                <span className="text-sm text-gray-500 mr-2">Step 2 of 4</span>
                <div className="w-24 h-2 bg-gray-200 rounded-full">
                  <div className="w-1/2 h-full bg-blue-500 rounded-full"></div>
                </div>
              </div>
            </div>
            <p className="mt-2 text-gray-600">
              Choose the repositories you want to monitor for dependency updates.
              We'll analyze their dependencies and help you keep them up to date.
            </p>
          </div>

          <div className="px-6 py-4 bg-gray-50">
            <div className="relative">
              <input
                type="text"
                placeholder="Search repositories..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <FaSearch className="absolute left-3 top-3 text-gray-400" />
            </div>
          </div>

          <div className="px-6 py-4">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm text-gray-500">
                {filteredRepositories.length} repositories found
              </span>
              <span className="text-sm text-blue-600 font-medium">
                {selectedCount} selected
              </span>
            </div>

            <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
              {filteredRepositories.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No repositories found matching your search</p>
                </div>
              ) : (
                filteredRepositories.map(repo => (
                  <motion.div
                    key={repo.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                      repo.selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => toggleRepository(repo.id)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center">
                          <h3 className="text-base font-medium text-gray-800">{repo.name}</h3>
                          {repo.private && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                              <FaLock className="mr-1" size={10} />
                              Private
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-gray-600 line-clamp-2">{repo.description}</p>
                        <div className="mt-2 flex items-center text-xs text-gray-500">
                          <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-1"></span>
                          <span>{repo.language}</span>
                          <span className="mx-2">•</span>
                          <span>{repo.stars} stars</span>
                        </div>
                      </div>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                        repo.selected
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-200 text-gray-400'
                      }`}>
                        <FaCheck size={12} />
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>

          <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center">
            <button
              onClick={() => navigate('/onboarding/welcome')}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Back
            </button>
            <div>
              <button
                onClick={() => navigate('/onboarding/config-setup')}
                className="mr-3 px-4 py-2 text-gray-500 hover:text-gray-700 transition-colors"
              >
                Skip
              </button>
              <button
                onClick={handleContinue}
                disabled={selectedCount === 0}
                className={`px-6 py-2 rounded-md shadow-sm text-white ${
                  selectedCount === 0
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                Continue ({selectedCount})
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default RepositorySelect;