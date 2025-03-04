// frontend/src/pages/ReposList.jsx
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import DependencyScanner from '../components/DependencyScanner';
import axios from 'axios';

function ReposList() {
  const user = useSelector((state) => state.auth.user);
  const [repos, setRepos] = useState([]);
  const [error, setError] = useState('');

  // Fetch repos from your Node service. Currently done via button "Fetch Repos".
  // You could also do this automatically in useEffect if you prefer.
  const fetchRepos = async () => {
    try {
      const res = await axios.get(
        `http://localhost:3001/repos/?userId=${user._id}`
      );
      console.log('Repos response:', res);
      setRepos(res.data);
    } catch (err) {
      console.log('Error fetching repos:', err);
      setError(err.message);
    }
  };

  // Creates a PR by calling your Node endpoint with just { userId, repoId }
  const handleCreatePR = async (repo) => {
    try {
      // We only send userId and repoId as requested
      const bodyData = {
        userId: user._id,
        repoId: repo._id,
      };

      const response = await fetch('http://localhost:3001/pull-requests/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to create PR');
      }

      // If success, it might return { success: true, prUrl: "...", ... }
      alert(`PR created successfully! View it at: ${result.prUrl}`);
    } catch (err) {
      alert('Error creating PR: ' + err.message);
    }
  };

  if (error) return <p className='text-red-500'>{error}</p>;

  return (
    <div className='p-4'>
      <h1 className='text-2xl font-bold'>My Repositories</h1>

      {/* Button to fetch repos from the server */}
      <button className='p-4 m-4 bg-slate-700 text-white' onClick={fetchRepos}>
        Fetch Repos
      </button>

      <ul className='space-y-4'>
        {repos.length > 0 &&
          repos.map((repo) => (
            <li key={repo._id} className='border p-4 rounded'>
              <p className='font-semibold'>
                {/* Example fields from your DB: repo.fullName, repo.htmlUrl */}
                {repo.fullName} {repo.htmlUrl ? `(${repo.htmlUrl})` : null}
              </p>

              {/* The existing "Scan Dependencies" component */}
              <DependencyScanner repoId={repo._id} />

              {/* New "Create PR" button */}
              <button
                className='mt-2 px-4 py-2 bg-blue-600 text-white rounded'
                onClick={() => handleCreatePR(repo)}>
                Create PR
              </button>
            </li>
          ))}
      </ul>
    </div>
  );
}

export default ReposList;
