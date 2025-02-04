// frontend/src/pages/Login.jsx
import { useSelector } from "react-redux"
import { useEffect } from "react"
import { useNavigate } from "react-router-dom"

function Login() {
  const user = useSelector((state) => state.auth.user)
  const navigate = useNavigate()

  useEffect(() => {
    if (user) {
      navigate("/dashboard")
    }
  }, [user, navigate])

  const handleLogin = () => {
    window.location.href = "http://localhost:3001/auth/github"
  }

  return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="p-6 bg-white shadow-md rounded-md space-y-4">
        <h1 className="text-2xl font-bold text-center">Sign In</h1>
        <button
          onClick={handleLogin}
          className="px-4 py-2 bg-black text-white rounded-md"
        >
          Login with GitHub
        </button>
      </div>
    </div>
  )
}

export default Login
