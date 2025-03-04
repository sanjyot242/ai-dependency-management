// frontend/src/components/DependencyScanner.jsx
import { useState } from 'react';

function DependencyScanner({ repoId }) {
  const [scanData, setScanData] = useState(null); // store an object with .dependencies, .scannedAt
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleScan = async () => {
    try {
      setLoading(true);
      setError('');

      // 1. Trigger the scan
      const scanResponse = await fetch('http://localhost:3001/dependencies/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoId }),
      });
      if (!scanResponse.ok) {
        const errBody = await scanResponse.json();
        throw new Error(errBody.error || 'Scan failed');
      }

      // 2. fetch the latest
      const latestScanRes = await fetch(
        `http://localhost:3001/dependencies/${repoId}/latest`
      );
      if (!latestScanRes.ok) {
        const errBody2 = await latestScanRes.json();
        throw new Error(errBody2.error || 'Fetching latest scan failed');
      }

      const latestScanData = await latestScanRes.json();
      setScanData(latestScanData); // e.g. { _id, scannedAt, dependencies: [...] }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderDependencies = () => {
    if (!scanData || !scanData.dependencies) return null;
    if (scanData.dependencies.length === 0) {
      return <p>No dependencies found or all up to date.</p>;
    }
    return (
      <ul className='list-disc pl-5'>
        {scanData.dependencies.map((dep) => (
          <li key={dep.packageName} className='mb-2'>
            <strong>{dep.packageName}</strong> - Current: {dep.currentVersion}, Latest: {dep.latestVersion}
            {dep.isOutdated && <span className='text-red-500'> (Outdated)</span>}
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className='p-4 border rounded'>
      <button
        onClick={handleScan}
        className='px-4 py-2 bg-blue-500 text-white rounded'
        disabled={loading}>
        {loading ? 'Scanning...' : 'Scan Dependencies'}
      </button>
      {error && <p className='text-red-500 mt-2'>{error}</p>}

      {scanData && (
        <div className='mt-4'>
          <h3 className='font-bold'>
            Scan Results (scanned at {new Date(scanData.scannedAt).toLocaleString()})
          </h3>
          {renderDependencies()}
        </div>
      )}
    </div>
  );
}

export default DependencyScanner;
