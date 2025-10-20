import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient, {
  Dependency,
  ScanResult
} from '../api';

const DependencyDetails: React.FC = () => {
  const { repositoryId } = useParams<{ repositoryId: string }>();
  const navigate = useNavigate();
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedDeps, setExpandedDeps] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<'all' | 'vulnerable' | 'outdated'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'transitive' | 'vulnerable'>('transitive');
  const [activeTab, setActiveTab] = useState<'dependencies' | 'timeline' | 'metadata'>('dependencies');

  useEffect(() => {
    const fetchScanDetails = async () => {
      if (!repositoryId) {
        setError('Repository ID is required');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await apiClient.getLatestRepositoryScan(repositoryId);
        setScan(response.data);
      } catch (error) {
        console.error('Error fetching scan details:', error);
        setError('Failed to load dependency data');
      } finally {
        setLoading(false);
      }
    };

    fetchScanDetails();
  }, [repositoryId]);

  const toggleExpanded = (packageName: string) => {
    setExpandedDeps((prev) => {
      const next = new Set(prev);
      if (next.has(packageName)) {
        next.delete(packageName);
      } else {
        next.add(packageName);
      }
      return next;
    });
  };

  const getFilteredDependencies = () => {
    if (!scan?.dependencies) return [];

    let filtered = [...scan.dependencies];

    if (filterType === 'vulnerable') {
      filtered = filtered.filter(dep =>
        (dep.vulnerabilities && dep.vulnerabilities.length > 0) ||
        (dep.transitiveDependencies && dep.transitiveDependencies.vulnerableCount > 0)
      );
    } else if (filterType === 'outdated') {
      filtered = filtered.filter(dep =>
        dep.isOutdated ||
        (dep.transitiveDependencies && dep.transitiveDependencies.outdatedCount > 0)
      );
    }

    filtered.sort((a, b) => {
      if (sortBy === 'name') {
        return a.packageName.localeCompare(b.packageName);
      } else if (sortBy === 'transitive') {
        const countA = a.transitiveDependencies?.count || 0;
        const countB = b.transitiveDependencies?.count || 0;
        return countB - countA;
      } else if (sortBy === 'vulnerable') {
        const vulnA = (a.transitiveDependencies?.vulnerableCount || 0) + (a.vulnerabilities?.length || 0);
        const vulnB = (b.transitiveDependencies?.vulnerableCount || 0) + (b.vulnerabilities?.length || 0);
        return vulnB - vulnA;
      }
      return 0;
    });

    return filtered;
  };

  const getSeverityBadge = (dep: Dependency) => {
    const transitiveVuln = dep.transitiveDependencies?.vulnerableCount || 0;
    const directVuln = dep.vulnerabilities?.length || 0;
    const totalVuln = transitiveVuln + directVuln;

    if (totalVuln > 5) {
      return <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800 font-medium">High Risk</span>;
    } else if (totalVuln > 0) {
      return <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800 font-medium">Medium Risk</span>;
    } else if (dep.transitiveDependencies && dep.transitiveDependencies.outdatedCount > 50) {
      return <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800 font-medium">Many Updates</span>;
    } else {
      return <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800 font-medium">Low Risk</span>;
    }
  };

  const getVulnerabilitySeverityBreakdown = () => {
    if (!scan?.dependencies) return { critical: 0, high: 0, medium: 0, low: 0, info: 0 };

    const breakdown = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    scan.dependencies.forEach(dep => {
      dep.vulnerabilities?.forEach(vuln => {
        breakdown[vuln.severity]++;
      });
    });
    return breakdown;
  };

  const formatDuration = (start?: string, end?: string) => {
    if (!start || !end) return 'N/A';
    const duration = new Date(end).getTime() - new Date(start).getTime();
    const seconds = Math.floor(duration / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const getStateIcon = (state: string) => {
    switch (state) {
      case 'completed':
        return '✓';
      case 'failed':
        return '✗';
      case 'in-progress':
        return '⟳';
      default:
        return '○';
    }
  };

  const getStateColor = (state: string) => {
    switch (state) {
      case 'completed':
      case 'pr-created':
      case 'vulnerabilities-scanned':
      case 'dependencies-scanned':
        return 'text-green-600 bg-green-50';
      case 'failed':
        return 'text-red-600 bg-red-50';
      case 'in-progress':
      case 'dependency-scanning':
      case 'vulnerability-scanning':
      case 'pr-creation':
        return 'text-blue-600 bg-blue-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg p-8 shadow-lg">
          <div className="flex justify-center">
            <div className="animate-spin h-12 w-12 border-4 border-blue-500 rounded-full border-t-transparent"></div>
          </div>
          <p className="mt-4 text-gray-600">Loading scan details...</p>
        </div>
      </div>
    );
  }

  if (error || !scan) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg p-8 max-w-md shadow-lg">
          <div className="text-red-500 mb-4">{error || 'No data available'}</div>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const filteredDeps = getFilteredDependencies();
  const vulnerabilityBreakdown = getVulnerabilitySeverityBreakdown();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-3xl font-bold">Scan Analysis Report</h2>
              <p className="text-blue-100 text-sm mt-2">
                Comprehensive dependency and vulnerability analysis
              </p>
              <div className="flex gap-4 mt-3 text-sm">
                <span className="bg-blue-900 bg-opacity-50 px-3 py-1 rounded text-white">
                  Scan ID: {scan.id}
                </span>
                <span className="bg-blue-900 bg-opacity-50 px-3 py-1 rounded text-white">
                  Trigger: {scan.triggerType}
                </span>
                <span className="bg-blue-900 bg-opacity-50 px-3 py-1 rounded text-white">
                  Status: {scan.status}
                </span>
              </div>
            </div>
            <button
              onClick={() => navigate(-1)}
              className="px-5 py-2 bg-white text-blue-800 hover:bg-blue-50 rounded transition-colors font-medium">
              Back to Dashboard
            </button>
          </div>
        </div>

        {/* Summary Dashboard */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-6 bg-gray-50 border-b">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-3xl font-bold text-blue-600">
              {scan.dependencies?.length || 0}
            </div>
            <div className="text-sm text-gray-600 mt-1">Direct Dependencies</div>
            <div className="text-xs text-gray-400 mt-1">
              {scan.transitiveDependencyCount || 0} transitive
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-3xl font-bold text-red-600">
              {scan.vulnerabilityCount || 0}
            </div>
            <div className="text-sm text-gray-600 mt-1">Vulnerabilities</div>
            <div className="text-xs text-gray-400 mt-1">
              {scan.highSeverityCount || 0} high/critical
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-3xl font-bold text-yellow-600">
              {scan.outdatedCount || 0}
            </div>
            <div className="text-sm text-gray-600 mt-1">Outdated</div>
            <div className="text-xs text-gray-400 mt-1">
              {scan.outdatedTransitiveDependencyCount || 0} in transitives
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-3xl font-bold text-purple-600">
              {scan.maxTransitiveDependencyDepth || 0}
            </div>
            <div className="text-sm text-gray-600 mt-1">Max Depth</div>
            <div className="text-xs text-gray-400 mt-1">
              dependency chain
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-3xl font-bold text-indigo-600">
              {formatDuration(scan.startedAt, scan.completedAt)}
            </div>
            <div className="text-sm text-gray-600 mt-1">Duration</div>
            <div className="text-xs text-gray-400 mt-1">
              scan time
            </div>
          </div>
        </div>

        {/* Vulnerability Severity Breakdown */}
        {scan.vulnerabilityCount > 0 && (
          <div className="px-6 py-4 bg-red-50 border-b">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Vulnerability Severity Distribution</h3>
            <div className="flex gap-6">
              {vulnerabilityBreakdown.critical > 0 && (
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 text-xs rounded bg-purple-600 text-white font-bold">CRITICAL</span>
                  <span className="text-sm font-medium">{vulnerabilityBreakdown.critical}</span>
                </div>
              )}
              {vulnerabilityBreakdown.high > 0 && (
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 text-xs rounded bg-red-600 text-white font-bold">HIGH</span>
                  <span className="text-sm font-medium">{vulnerabilityBreakdown.high}</span>
                </div>
              )}
              {vulnerabilityBreakdown.medium > 0 && (
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 text-xs rounded bg-yellow-600 text-white font-bold">MEDIUM</span>
                  <span className="text-sm font-medium">{vulnerabilityBreakdown.medium}</span>
                </div>
              )}
              {vulnerabilityBreakdown.low > 0 && (
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 text-xs rounded bg-blue-600 text-white font-bold">LOW</span>
                  <span className="text-sm font-medium">{vulnerabilityBreakdown.low}</span>
                </div>
              )}
              {vulnerabilityBreakdown.info > 0 && (
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 text-xs rounded bg-gray-600 text-white font-bold">INFO</span>
                  <span className="text-sm font-medium">{vulnerabilityBreakdown.info}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PR Information */}
        {scan.prUrl && (
          <div className="px-6 py-4 bg-green-50 border-b">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-700">Pull Request Created</h3>
                <p className="text-xs text-gray-600 mt-1">
                  PR #{scan.prNumber} has been created with dependency updates
                </p>
              </div>
              <a
                href={scan.prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm font-medium">
                View Pull Request →
              </a>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b bg-white">
          <div className="flex px-6">
            <button
              onClick={() => setActiveTab('dependencies')}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'dependencies'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}>
              Dependencies ({scan.dependencies?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('timeline')}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'timeline'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}>
              Timeline ({scan.stateHistory?.length || 0} events)
            </button>
            <button
              onClick={() => setActiveTab('metadata')}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'metadata'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}>
              Metadata
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Dependencies Tab */}
          {activeTab === 'dependencies' && (
            <div>
              {/* Filters and Sort */}
              <div className="p-4 bg-white border-b flex flex-wrap gap-4 items-center sticky top-0 z-10">
                <div className="flex gap-2">
                  <span className="text-sm font-medium text-gray-700 self-center">Filter:</span>
                  <button
                    onClick={() => setFilterType('all')}
                    className={`px-3 py-1 text-sm rounded ${
                      filterType === 'all'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}>
                    All ({scan.dependencies?.length || 0})
                  </button>
                  <button
                    onClick={() => setFilterType('vulnerable')}
                    className={`px-3 py-1 text-sm rounded ${
                      filterType === 'vulnerable'
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}>
                    Vulnerable
                  </button>
                  <button
                    onClick={() => setFilterType('outdated')}
                    className={`px-3 py-1 text-sm rounded ${
                      filterType === 'outdated'
                        ? 'bg-yellow-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}>
                    Outdated
                  </button>
                </div>

                <div className="flex gap-2">
                  <span className="text-sm font-medium text-gray-700 self-center">Sort by:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'name' | 'transitive' | 'vulnerable')}
                    className="px-3 py-1 text-sm border rounded">
                    <option value="transitive">Transitive Count</option>
                    <option value="vulnerable">Vulnerability Count</option>
                    <option value="name">Package Name</option>
                  </select>
                </div>

                <div className="ml-auto text-sm text-gray-600">
                  Showing {filteredDeps.length} of {scan.dependencies?.length || 0}
                </div>
              </div>

              {/* Dependency List */}
              <div className="p-6">
                {filteredDeps.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    No dependencies match the current filter
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredDeps.map((dep) => (
                      <div
                        key={dep.packageName}
                        className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
                        {/* Dependency Header */}
                        <div
                          className="bg-white p-4 cursor-pointer hover:bg-gray-50"
                          onClick={() => toggleExpanded(dep.packageName)}>
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 flex-wrap">
                                <h3 className="text-lg font-semibold text-gray-900">
                                  {dep.packageName}
                                </h3>
                                {getSeverityBadge(dep)}
                                {dep.isOutdated && (
                                  <span className="px-2 py-1 text-xs rounded-full bg-amber-100 text-amber-800">
                                    Update Available
                                  </span>
                                )}
                                {dep.dependencyType && (
                                  <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700">
                                    {dep.dependencyType}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-4 mt-2 text-sm text-gray-600 flex-wrap">
                                <span>
                                  <span className="font-medium">{dep.currentVersion}</span>
                                  {dep.latestVersion && dep.isOutdated && (
                                    <> → <span className="text-green-600 font-medium">{dep.latestVersion}</span></>
                                  )}
                                </span>
                                {dep.filePath && (
                                  <span className="text-xs text-gray-500">
                                    {dep.filePath}
                                  </span>
                                )}
                                {dep.transitiveDependencies && (
                                  <span className="flex items-center gap-1">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                    {dep.transitiveDependencies.count} transitive
                                  </span>
                                )}
                              </div>
                            </div>
                            <svg
                              className={`w-5 h-5 text-gray-400 transform transition-transform ${
                                expandedDeps.has(dep.packageName) ? 'rotate-180' : ''
                              }`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>

                        {/* Expanded Details */}
                        {expandedDeps.has(dep.packageName) && (
                          <div className="bg-gray-50 border-t border-gray-200 p-6">
                            {/* Transitive Impact Section */}
                            {dep.transitiveDependencies && (
                              <div className="mb-6">
                                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                  </svg>
                                  Transitive Dependency Impact
                                  <span className="ml-2 text-xs text-gray-500">
                                    (Storage: {dep.transitiveDependencies.storageType})
                                  </span>
                                </h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                  <div className="bg-white p-3 rounded border">
                                    <div className="text-2xl font-bold text-blue-600">
                                      {dep.transitiveDependencies.count}
                                    </div>
                                    <div className="text-xs text-gray-600">Total Dependencies</div>
                                  </div>
                                  <div className="bg-white p-3 rounded border">
                                    <div className="text-2xl font-bold text-red-600">
                                      {dep.transitiveDependencies.vulnerableCount}
                                    </div>
                                    <div className="text-xs text-gray-600">Vulnerable</div>
                                  </div>
                                  <div className="bg-white p-3 rounded border">
                                    <div className="text-2xl font-bold text-yellow-600">
                                      {dep.transitiveDependencies.outdatedCount}
                                    </div>
                                    <div className="text-xs text-gray-600">Outdated</div>
                                  </div>
                                  <div className="bg-white p-3 rounded border">
                                    <div className="text-2xl font-bold text-purple-600">
                                      {dep.transitiveDependencies.maxDepth}
                                    </div>
                                    <div className="text-xs text-gray-600">Max Depth</div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Direct Vulnerabilities */}
                            {dep.vulnerabilities && dep.vulnerabilities.length > 0 && (
                              <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                                  <svg className="w-5 h-5 mr-2 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                  </svg>
                                  Direct Vulnerabilities ({dep.vulnerabilities.length})
                                </h4>
                                <div className="space-y-2">
                                  {dep.vulnerabilities.map((vuln) => (
                                    <div key={vuln.id} className="bg-white p-4 rounded border border-red-200">
                                      <div className="flex justify-between items-start mb-2">
                                        <span className="font-mono text-sm font-medium">{vuln.id}</span>
                                        <span className={`px-2 py-1 text-xs rounded font-bold ${
                                          vuln.severity === 'critical'
                                            ? 'bg-purple-100 text-purple-800'
                                            : vuln.severity === 'high'
                                            ? 'bg-red-100 text-red-800'
                                            : vuln.severity === 'medium'
                                            ? 'bg-yellow-100 text-yellow-800'
                                            : vuln.severity === 'low'
                                            ? 'bg-blue-100 text-blue-800'
                                            : 'bg-gray-100 text-gray-800'
                                        }`}>
                                          {vuln.severity.toUpperCase()}
                                        </span>
                                      </div>
                                      <p className="text-sm text-gray-700 mb-2">{vuln.description}</p>
                                      {vuln.fixedIn && (
                                        <p className="text-xs text-green-700 mb-2">
                                          <span className="font-medium">Fixed in:</span> {vuln.fixedIn}
                                        </p>
                                      )}
                                      {vuln.references && vuln.references.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                          {vuln.references.map((ref, idx) => (
                                            <a
                                              key={idx}
                                              href={ref}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-xs text-blue-600 hover:underline">
                                              Reference {idx + 1} →
                                            </a>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* No Issues */}
                            {(!dep.vulnerabilities || dep.vulnerabilities.length === 0) &&
                             (!dep.transitiveDependencies ||
                              (dep.transitiveDependencies.vulnerableCount === 0 &&
                               dep.transitiveDependencies.outdatedCount === 0)) && (
                              <div className="text-center py-6 text-green-600">
                                <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p className="font-medium">No vulnerabilities or outdated dependencies detected</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Timeline Tab */}
          {activeTab === 'timeline' && (
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Scan Execution Timeline</h3>
              {scan.stateHistory && scan.stateHistory.length > 0 ? (
                <div className="space-y-3">
                  {scan.stateHistory.map((transition, idx) => (
                    <div key={idx} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${getStateColor(transition.state)}`}>
                          {getStateIcon(transition.state)}
                        </div>
                        {idx < scan.stateHistory.length - 1 && (
                          <div className="w-0.5 h-12 bg-gray-300"></div>
                        )}
                      </div>
                      <div className="flex-1 pb-8">
                        <div className="bg-white border rounded-lg p-4">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-semibold text-gray-900 capitalize">
                              {transition.state.replace(/-/g, ' ')}
                            </h4>
                            <span className="text-sm text-gray-500">
                              {new Date(transition.timestamp).toLocaleString()}
                            </span>
                          </div>
                          {transition.metadata && Object.keys(transition.metadata).length > 0 && (
                            <div className="mt-2 bg-gray-50 rounded p-3">
                              <p className="text-xs font-semibold text-gray-600 mb-2">Metadata:</p>
                              <div className="space-y-1">
                                {Object.entries(transition.metadata).map(([key, value]) => (
                                  <div key={key} className="text-sm">
                                    <span className="font-medium text-gray-700">{key}:</span>{' '}
                                    <span className="text-gray-600">
                                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  No timeline data available
                </div>
              )}
            </div>
          )}

          {/* Metadata Tab */}
          {activeTab === 'metadata' && (
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Scan Metadata</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* General Information */}
                <div className="bg-white border rounded-lg p-5">
                  <h4 className="font-semibold text-gray-700 mb-3 flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    General Information
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Scan ID:</span>
                      <span className="font-mono text-gray-900">{scan.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Repository ID:</span>
                      <span className="font-mono text-gray-900">{scan.repositoryId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">User ID:</span>
                      <span className="font-mono text-gray-900">{scan.userId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status:</span>
                      <span className="font-semibold text-gray-900">{scan.status}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">State:</span>
                      <span className="font-semibold text-gray-900">{scan.state}</span>
                    </div>
                    {scan.branch && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Branch:</span>
                        <span className="font-mono text-gray-900">{scan.branch}</span>
                      </div>
                    )}
                    {scan.commit && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Commit:</span>
                        <span className="font-mono text-gray-900">{scan.commit.substring(0, 8)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Scan Configuration */}
                <div className="bg-white border rounded-lg p-5">
                  <h4 className="font-semibold text-gray-700 mb-3 flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Scan Configuration
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Trigger Type:</span>
                      <span className="font-semibold capitalize text-gray-900">{scan.triggerType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Include Vulnerabilities:</span>
                      <span className={scan.includeVulnerabilities ? 'text-green-600 font-semibold' : 'text-gray-400'}>
                        {scan.includeVulnerabilities ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Create PR:</span>
                      <span className={scan.createPR ? 'text-green-600 font-semibold' : 'text-gray-400'}>
                        {scan.createPR ? 'Yes' : 'No'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Timestamps */}
                <div className="bg-white border rounded-lg p-5">
                  <h4 className="font-semibold text-gray-700 mb-3 flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Timestamps
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Created:</span>
                      <span className="text-gray-900">{new Date(scan.createdAt).toLocaleString()}</span>
                    </div>
                    {scan.startedAt && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Started:</span>
                        <span className="text-gray-900">{new Date(scan.startedAt).toLocaleString()}</span>
                      </div>
                    )}
                    {scan.completedAt && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Completed:</span>
                        <span className="text-gray-900">{new Date(scan.completedAt).toLocaleString()}</span>
                      </div>
                    )}
                    {scan.updatedAt && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Last Updated:</span>
                        <span className="text-gray-900">{new Date(scan.updatedAt).toLocaleString()}</span>
                      </div>
                    )}
                    {scan.startedAt && scan.completedAt && (
                      <div className="flex justify-between pt-2 border-t">
                        <span className="text-gray-600 font-semibold">Duration:</span>
                        <span className="font-semibold text-blue-600">
                          {formatDuration(scan.startedAt, scan.completedAt)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Transitive Analysis Status */}
                <div className="bg-white border rounded-lg p-5">
                  <h4 className="font-semibold text-gray-700 mb-3 flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                    </svg>
                    Transitive Analysis
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status:</span>
                      <span className="font-semibold capitalize text-gray-900">
                        {scan.transitiveDependenciesStatus || 'N/A'}
                      </span>
                    </div>
                    {scan.transitiveDependencyFallbackMethod && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Method:</span>
                        <span className="font-mono text-gray-900 capitalize">
                          {scan.transitiveDependencyFallbackMethod}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Transitive:</span>
                      <span className="font-semibold text-gray-900">
                        {scan.transitiveDependencyCount || 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Vulnerable:</span>
                      <span className="font-semibold text-red-600">
                        {scan.vulnerableTransitiveDependencyCount || 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Outdated:</span>
                      <span className="font-semibold text-yellow-600">
                        {scan.outdatedTransitiveDependencyCount || 0}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Error Information */}
                {scan.errorMessage && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-5 md:col-span-2">
                    <h4 className="font-semibold text-red-700 mb-3 flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Error Information
                    </h4>
                    <p className="text-sm text-red-900 font-mono bg-white p-3 rounded">
                      {scan.errorMessage}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DependencyDetails;
