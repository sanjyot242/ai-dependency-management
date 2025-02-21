// frontend/src/pages/Dashboard.jsx
import { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { loginUser, logoutUser } from '../features/auth/authSlice';
import ReposList from '../pages/ReposList'; // Adjust path if needed
import axios from 'axios';

function Dashboard() {
  const user = useSelector((state) => state.auth.user);
  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // This function calls the server to sync repos from GitHub to our DB
  const syncRepos = async () => {
    try {
      setLoading(true);
      setError(null);

      // POST request to your Node service to fetch user repos from GitHub
      await axios.post('http://localhost:3001/repos/sync', {
        userId: user._id, // Adjust if your endpoint uses a different param
      });

      // After syncing, we let the ReposList component re-fetch repos from the server
      // or we can handle it ourselves here. We'll show an approach that triggers
      // a re-render in <ReposList> by updating a "syncSignal" or you can reload data here.
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  // On mount or when 'user' changes, confirm we have a valid user
  useEffect(() => {
    if (user) {
      // Already have user in Redux => done
      setLoading(false);
      return;
    }

    // If no user in Redux, parse ?userId from the URL (like your original code)
    const params = new URLSearchParams(location.search);
    const userIdFromUrl = params.get('userId');

    if (!userIdFromUrl) {
      // Not logged in => go to login
      navigate('/');
      return;
    }

    // Fetch user data from Node
    fetch(`http://localhost:3001/user/${userIdFromUrl}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`User fetch failed: ${res.status}`);
        }
        return res.json();
      })
      .then((userData) => {
        dispatch(loginUser(userData));
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      });
  }, [user, location, navigate, dispatch]);

  // Standard logout (like your existing code)
  const handleLogout = () => {
    dispatch(logoutUser());
    navigate('/');
  };

  if (loading) {
    return <p className='p-4'>Loading...</p>;
  }

  if (error) {
    return <p className='p-4 text-red-500'>Error: {error}</p>;
  }

  // If we get here, we have a user in Redux
  return (
    <div className='p-4'>
      <h1 className='text-xl font-bold mb-2'>
        Welcome, {user.username || 'Unknown'}!
      </h1>
      <p>User ID: {user._id}</p>

      <div className='flex gap-4 mt-4'>
        <button
          onClick={handleLogout}
          className='px-4 py-2 bg-red-500 text-white rounded-md'>
          Logout
        </button>

        {/* Sync Repos button triggers the POST /repos/sync in Node */}
        <button
          onClick={syncRepos}
          className='px-4 py-2 bg-blue-500 text-white rounded-md'
          disabled={loading}>
          {loading ? 'Syncing...' : 'Sync Repos'}
        </button>
      </div>

      {/* Show the user's repos below in ReposList */}
      <ReposList userId={user._id} />
    </div>
  );
}

export default Dashboard;
