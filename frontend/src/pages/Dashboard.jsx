// frontend/src/pages/Dashboard.jsx
import { useEffect, useState } from "react"
import { useSelector, useDispatch } from "react-redux"
import { useLocation, useNavigate } from "react-router-dom"
import { loginUser, logoutUser } from "../features/auth/authSlice"

function Dashboard() {
  const user = useSelector((state) => state.auth.user)
  const dispatch = useDispatch()
  const location = useLocation()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (user) {
      // Already have user in Redux => no need to fetch again
      setLoading(false)
      return
    }

    // Parse query param to see if ?userId=XYZ
    const params = new URLSearchParams(location.search)
    const userIdFromUrl = params.get("userId")

    if (!userIdFromUrl) {
      // No userId => not logged in => go to login
      navigate("/")
      return
    }
    

    // Fetch user data from Node
    fetch(`http://localhost:3001/user/${userIdFromUrl}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`User fetch failed: ${res.status}`)
        }
        return res.json()
      })
      .then((userData) => {
        // dispatch the loginUser action
        dispatch(loginUser(userData))
        setLoading(false)
      })
      .catch((err) => {
        console.error(err)
        setError(err.message)
        setLoading(false)
      })
  }, [user, location, navigate, dispatch])

  const handleLogout = () => {
    dispatch(logoutUser())
    navigate("/")
  }

  if (loading) {
    return <p>Loading...</p>
  }

  if (error) {
    return <p className="text-red-500">Error: {error}</p>
  }

  // If we get here, we have a user in Redux
  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-2">
        Welcome, {user.username || "Unknown"}!
      </h1>
      <p>User ID: {user._id}</p>
      <button
        onClick={handleLogout}
        className="mt-4 px-4 py-2 bg-red-500 text-white rounded-md"
      >
        Logout
      </button>
    </div>
  )
}

export default Dashboard
