// web/src/pages/dashboard/Dashboard.tsx

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';


interface Repository {
  id: string;
  name: string;
  fullName: string;
  lastScanDate?: string;
  outdatedDependencies: number;
  vulnerabilities: number;
}

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);


  useEffect(() => {
    const fetchRepositories = async () => {
      try {
        setLoading(true);
        // In a real implementation, this would fetch from your API
        // For now, we'll use mock data
        
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Mock data
        const mockRepositories: Repository[] = [
          {
            id: '1',
            name: 'example-project',
            fullName: 'user/example-project',
            lastScanDate: new Date().toISOString(),
            outdatedDependencies: 5,
            vulnerabilities: 2
          },
          {
            id: '2',
            name: 'another-project',
            fullName: 'user/another-project',
            lastScanDate: new Date().toISOString(),
            outdatedDependencies: 3,
            vulnerabilities: 0
          }
        ];
        
        setRepositories(mockRepositories);
      } catch (error) {
        console.error('Error fetching repositories:', error);
        setError('Failed to load repositories');
      } finally {
        setLoading(false);
      }
    };
    
    fetchRepositories();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">AI Dependency Manager</h1>
          <div className="flex items-center space-x-4">
            <span className="text-gray-600">Welcome, {user?.name || 'User'}</span>
            <button
              onClick={logout}
              className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">Your Repositories</h2>
          
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 text-red-600 rounded-md p-4 mb-4">
              {error}
            </div>
          ) : repositories.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No repositories found.</p>
              <button
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                onClick={() => {/* Navigate to add repositories */}}
              >
                Add Repositories
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Repository
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Scan
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Outdated
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Vulnerabilities
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {repositories.map((repo) => (
                    <tr key={repo.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{repo.name}</div>
                        <div className="text-sm text-gray-500">{repo.fullName}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {repo.lastScanDate 
                            ? new Date(repo.lastScanDate).toLocaleDateString() 
                            : 'Never'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          repo.outdatedDependencies > 0 
                            ? 'bg-yellow-100 text-yellow-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {repo.outdatedDependencies}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          repo.vulnerabilities > 0 
                            ? 'bg-red-100 text-red-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {repo.vulnerabilities}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          className="text-blue-600 hover:text-blue-900 mr-3"
                          onClick={() => {/* View details action */}}
                        >
                          View Details
                        </button>
                        <button
                          className="text-indigo-600 hover:text-indigo-900"
                          onClick={() => {/* Scan now action */}}
                        >
                          Scan Now
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;