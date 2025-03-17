import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../api';
import VulnerabilityDetails from '../../components/VulnerabilityDetails';

interface Repository {
  id: string;
  name: string;
  fullName: string;
  lastScanDate?: string;
  outdatedDependencies: number;
  vulnerabilities: number;
  scanStatus?: 'pending' | 'in-progress' | 'completed' | 'failed' | 'no_scan';
  errorMessage?: string;
  currentScanId?: string;
}

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [scanning, setScanning] = useState<Record<string, boolean>>({});
  const [vulnScanning, setVulnScanning] = useState<Record<string, boolean>>({});
  const [selectedScanId, setSelectedScanId] = useState<string | null>(null);
  const [showVulnerabilityModal, setShowVulnerabilityModal] = useState(false);

  // Add a function to refresh the dashboard
  const refreshDashboard = () => {
    setRefreshCounter((prev) => prev + 1);
  };

  const openVulnerabilityDetails = (scanId: string) => {
    console.log('Opening vulnerability details for scan:', scanId);
    setSelectedScanId(scanId);
    setShowVulnerabilityModal(true);
  };

  const closeVulnerabilityDetails = () => {
    setShowVulnerabilityModal(false);
    setSelectedScanId(null);
  };

  const handleScanVulnerabilities = async (repoId: string, scanId: string) => {
    if (!scanId) return;

    try {
      // Mark this repository as scanning for vulnerabilities
      setVulnScanning((prev) => ({ ...prev, [repoId]: true }));

      // Initiate vulnerability scan
      await apiClient.initiateVulnerabilityScan(scanId);

      // Start polling for scan completion
      const pollingInterval = setInterval(async () => {
        try {
          const response = await apiClient.getCurrentRepositoryScan(repoId);
          const scanData = response.data;

          // If scan is completed, stop polling and refresh dashboard
          if (scanData.status === 'completed') {
            clearInterval(pollingInterval);
            setVulnScanning((prev) => ({ ...prev, [repoId]: false }));
            refreshDashboard();
          }
        } catch (error) {
          console.error('Error polling scan status:', error);
          clearInterval(pollingInterval);
          setVulnScanning((prev) => ({ ...prev, [repoId]: false }));
        }
      }, 3000); // Check every 3 seconds
    } catch (error) {
      console.error('Error initiating vulnerability scan:', error);
      setVulnScanning((prev) => ({ ...prev, [repoId]: false }));
    }
  };

  useEffect(() => {
    const fetchRepositoriesAndScans = async () => {
      try {
        setLoading(true);

        // Get repositories
        const repoResponse = await apiClient.getUserRepositories(true);

        if (repoResponse.status !== 200) {
          throw new Error('Failed to fetch repositories');
        }

        const repos = repoResponse.data;

        // For each repository, get the current scan status
        const reposWithScanData = await Promise.all(
          repos.map(async (repo: any) => {
            try {
              // Use current-scan endpoint instead of latest-scan
              const scanResponse = await apiClient.getCurrentRepositoryScan(
                repo._id
              );

              const scanData = scanResponse.data;

              return {
                id: repo._id,
                name: repo.name,
                fullName: repo.fullName,
                lastScanDate: scanData.completedAt,
                outdatedDependencies: scanData.outdatedCount || 0,
                vulnerabilities: scanData.vulnerabilityCount || 0,
                scanStatus: scanData.status || 'no_scan',
                errorMessage: scanData.errorMessage,
                currentScanId: scanData.id || null,
              };
            } catch (err) {
              // If there's no scan data, return repo with default values
              return {
                id: repo._id,
                name: repo.name,
                fullName: repo.fullName,
                outdatedDependencies: 0,
                vulnerabilities: 0,
                scanStatus: 'no_scan',
                currentScanId: null,
              };
            }
          })
        );

        setRepositories(reposWithScanData);
      } catch (error) {
        console.error('Error fetching repositories:', error);
        setError('Failed to load repositories');
      } finally {
        setLoading(false);
      }
    };

    fetchRepositoriesAndScans();

    // Set up polling for in-progress scans
    const pollingInterval = setInterval(() => {
      const hasInProgressScans = repositories.some(
        (repo) =>
          repo.scanStatus === 'pending' || repo.scanStatus === 'in-progress'
      );

      if (hasInProgressScans) {
        fetchRepositoriesAndScans();
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(pollingInterval);
  }, [refreshCounter]); // Depend on refreshCounter to trigger re-fetch

  const handleScanNow = async (repoId: string) => {
    try {
      setScanning((prev) => ({ ...prev, [repoId]: true }));
      const response = await apiClient.initiateRepositoryScan(repoId);

      // Store the scan ID from the response
      if (response.data && response.data.scanId) {
        // Update repositories with current scan ID
        setRepositories((prev) =>
          prev.map((repo) =>
            repo.id === repoId
              ? { ...repo, currentScanId: response.data.scanId }
              : repo
          )
        );
      }

      // Refresh to show updated status
      refreshDashboard();
    } catch (error) {
      console.error('Error initiating scan:', error);
    } finally {
      setScanning((prev) => ({ ...prev, [repoId]: false }));
    }
  };

  // Function to render scan status
  const renderScanStatus = (repo: Repository) => {
    if (repo.scanStatus === 'pending') {
      return (
        <div className='flex items-center'>
          <div className='mr-2 animate-pulse w-2 h-2 bg-yellow-500 rounded-full'></div>
          <span className='text-sm text-yellow-600'>Scan pending</span>
        </div>
      );
    } else if (repo.scanStatus === 'in-progress') {
      return (
        <div className='flex items-center'>
          <div className='mr-2 animate-spin w-2 h-2 border border-blue-500 border-t-transparent rounded-full'></div>
          <span className='text-sm text-blue-600'>Scanning...</span>
        </div>
      );
    } else if (repo.scanStatus === 'failed') {
      return (
        <div className='flex items-center'>
          <div className='mr-2 w-2 h-2 bg-red-500 rounded-full'></div>
          <span className='text-sm text-red-600'>Scan failed</span>
        </div>
      );
    } else if (repo.scanStatus === 'completed' && repo.lastScanDate) {
      return (
        <div className='text-sm text-gray-500'>
          {new Date(repo.lastScanDate).toLocaleDateString()}
        </div>
      );
    } else {
      return <div className='text-sm text-gray-500'>Never</div>;
    }
  };

  // The rest of the component remains similar
  return (
    <div className='min-h-screen bg-gray-50'>
      <header className='bg-white shadow'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center'>
          <h1 className='text-2xl font-bold text-gray-800'>
            AI Dependency Manager
          </h1>
          <div className='flex items-center space-x-4'>
            <span className='text-gray-600'>
              Welcome, {user?.name || 'User'}
            </span>
            <button
              onClick={logout}
              className='px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors'>
              Logout
            </button>
          </div>
        </div>
      </header>
      <main className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
        <div className='bg-white shadow rounded-lg p-6'>
          <div className='flex justify-between items-center mb-6'>
            <h2 className='text-xl font-semibold text-gray-800'>
              Your Repositories
            </h2>
            <button
              onClick={refreshDashboard}
              className='px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors'>
              Refresh
            </button>
          </div>

          {loading ? (
            <div className='flex justify-center py-8'>
              <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500'></div>
            </div>
          ) : error ? (
            <div className='bg-red-50 border border-red-200 text-red-600 rounded-md p-4 mb-4'>
              {error}
            </div>
          ) : repositories.length === 0 ? (
            <div className='text-center py-8'>
              <p className='text-gray-500'>No repositories found.</p>
              <button
                className='mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors'
                onClick={() => {
                  /* Navigate to add repositories */
                }}>
                Add Repositories
              </button>
            </div>
          ) : (
            <div className='overflow-x-auto'>
              <table className='min-w-full divide-y divide-gray-200'>
                <thead className='bg-gray-50'>
                  <tr>
                    <th
                      scope='col'
                      className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                      Repository
                    </th>
                    <th
                      scope='col'
                      className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                      Last Scan
                    </th>
                    <th
                      scope='col'
                      className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                      Outdated
                    </th>
                    <th
                      scope='col'
                      className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                      Vulnerabilities
                    </th>
                    <th
                      scope='col'
                      className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className='bg-white divide-y divide-gray-200'>
                  {repositories.map((repo) => (
                    <tr key={repo.id}>
                      <td className='px-6 py-4 whitespace-nowrap'>
                        <div className='text-sm font-medium text-gray-900'>
                          {repo.name}
                        </div>
                        <div className='text-sm text-gray-500'>
                          {repo.fullName}
                        </div>
                      </td>
                      <td className='px-6 py-4 whitespace-nowrap'>
                        {renderScanStatus(repo)}
                      </td>
                      <td className='px-6 py-4 whitespace-nowrap'>
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            repo.outdatedDependencies > 0
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-green-100 text-green-800'
                          }`}>
                          {repo.outdatedDependencies}
                        </span>
                      </td>
                      <td className='px-6 py-4 whitespace-nowrap'>
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            repo.vulnerabilities > 0
                              ? 'bg-red-100 text-red-800'
                              : 'bg-green-100 text-green-800'
                          }`}>
                          {repo.vulnerabilities}
                        </span>
                      </td>
                      <td className='px-6 py-4 whitespace-nowrap text-sm font-medium'>
                        <button
                          className='text-blue-600 hover:text-blue-900 mr-3'
                          onClick={() => {
                            /* View details action */
                          }}>
                          View Details
                        </button>

                        <button
                          className='text-indigo-600 hover:text-indigo-900 mr-3'
                          onClick={() => handleScanNow(repo.id)}
                          disabled={
                            repo.scanStatus === 'pending' ||
                            repo.scanStatus === 'in-progress' ||
                            scanning[repo.id]
                          }
                          style={{
                            opacity:
                              repo.scanStatus === 'pending' ||
                              repo.scanStatus === 'in-progress' ||
                              scanning[repo.id]
                                ? 0.5
                                : 1,
                          }}>
                          {repo.scanStatus === 'pending' ||
                          repo.scanStatus === 'in-progress' ||
                          scanning[repo.id]
                            ? 'Scanning...'
                            : 'Scan Now'}
                        </button>

                        <button
                          className='text-green-600 hover:text-green-900 mr-3'
                          onMouseOver={() => console.log('Mouse over button')}
                          onClick={() => {
                            alert('Button clicked for ' + repo.name);
                            openVulnerabilityDetails(repo.currentScanId!);
                          }}
                          style={{
                            opacity:
                              repo.scanStatus !== 'completed' ||
                              !repo.currentScanId ||
                              repo.vulnerabilities === 0
                                ? 0.5
                                : 1,
                          }}>
                          View Vulnerabilities
                        </button>

                        {/* Only show vulnerability scan button if there's a completed scan */}
                        {repo.scanStatus === 'completed' &&
                          repo.currentScanId && (
                            <button
                              className='text-orange-600 hover:text-orange-900'
                              onClick={() =>
                                handleScanVulnerabilities(
                                  repo.id,
                                  repo.currentScanId!
                                )
                              }
                              disabled={vulnScanning[repo.id]}
                              style={{
                                opacity: vulnScanning[repo.id] ? 0.5 : 1,
                              }}>
                              {vulnScanning[repo.id]
                                ? 'OSV Scanning...'
                                : 'Scan Vulnerabilities'}
                            </button>
                          )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
      {/* Vulnerability Modal */}
      {showVulnerabilityModal && selectedScanId && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4'>
          <div className='w-full max-w-4xl max-h-[90vh] overflow-auto'>
            <VulnerabilityDetails
              scanId={selectedScanId}
              onClose={closeVulnerabilityDetails}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
