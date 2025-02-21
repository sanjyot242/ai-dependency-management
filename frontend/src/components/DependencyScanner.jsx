// frontend/src/components/DependencyScanner.jsx
import { useState } from 'react';

function DependencyScanner({ repoId }) {
  const [scanData, setScanData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleScan = async () => {
    try {
      setLoading(true);
      setError('');

      // 1. Trigger the scan
      const scanResponse = await fetch(
        'http://localhost:3001/dependencies/scan',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repoId }),
        }
      );
      if (!scanResponse.ok) {
        const errBody = await scanResponse.json();
        throw new Error(errBody.error || 'Scan failed');
      }

      // 2. We have a new scan doc, but let's fetch the latest to ensure data is consistent
      const latestScanRes = await fetch(
        `http://localhost:3001/dependencies/${repoId}/latest`
      );
      if (!latestScanRes.ok) {
        const errBody2 = await latestScanRes.json();
        throw new Error(errBody2.error || 'Fetching latest scan failed');
      }
      const latestScanData = await latestScanRes.json();
      setScanData(latestScanData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
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
            Scan Results (scanned at{' '}
            {new Date(scanData.scannedAt).toLocaleString()})
          </h3>
          <ul className='list-disc pl-5'>
            {scanData.dependencies.map((dep) => (
              <li key={dep.packageName} className='mb-2'>
                <strong>{dep.packageName}</strong> - Current:{' '}
                {dep.currentVersion}, Latest: {dep.latestVersion}
                {dep.isOutdated && (
                  <span className='text-red-500'> (Outdated)</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default DependencyScanner;
