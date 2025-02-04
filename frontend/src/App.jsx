
export default function App() {

  const onCLickHandle = () => {
    console.log("clicked");
    window.location.href = "http://localhost:3001/auth/github";
  }

  return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
    <div className="p-6 bg-white shadow-md rounded-md space-y-4">
      <button className="p-4 rounded-sm bg-slate-500" onClick={onCLickHandle}>Sign In</button>
    </div>
  </div>
  )
}