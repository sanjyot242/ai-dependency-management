// frontend/src/pages/ReposList.jsx
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import DependencyScanner from '../components/DependencyScanner';
import axios from 'axios';

function ReposList() {
  const user = useSelector((state) => state.auth.user);
  const [repos, setRepos] = useState([]);
  const [error, setError] = useState('');

  const fetchRepos = async () => {
    try {
      const res = await axios.get(
        `http://localhost:3001/repos/?userId=${user._id}`
      );
      console.log(res);

      setRepos(res.data);
    } catch (err) {
      console.log('In erore');
      setError(err.message);
    }
  };

  if (error) return <p className='text-red-500'>{error}</p>;

  return (
    <div className='p-4'>
      <h1 className='text-2xl font-bold'>My Repositories</h1>
      <button className='p-4 m-4 bg-slate-700' onClick={fetchRepos}>
        Fetch Repos
      </button>
      <ul className='space-y-4'>
        {repos.length > 0 &&
          repos.map((repo) => (
            <li key={repo._id} className='border p-4 rounded'>
              <p className='font-semibold'>
                {repo.fullName}/{repo.htmlUrl}
              </p>

              {/* Optionally, if you want to let the user do a dependency scan on each repo */}
              <DependencyScanner repoId={repo._id} />
            </li>
          ))}
      </ul>
    </div>
  );
}

export default ReposList;
