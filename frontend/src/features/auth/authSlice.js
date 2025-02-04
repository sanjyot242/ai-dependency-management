// frontend/src/features/auth/authSlice.js
import { createSlice } from "@reduxjs/toolkit"

// Attempt to load user from localStorage
const storedUser = localStorage.getItem("user")
const initialUser = storedUser ? JSON.parse(storedUser) : null

const authSlice = createSlice({
  name: "auth",
  initialState: {
    user: initialUser,
  },
  reducers: {
    loginUser: (state, action) => {
      state.user = action.payload
      localStorage.setItem("user", JSON.stringify(action.payload))
    },
    logoutUser: (state) => {
      state.user = null
      localStorage.removeItem("user")
    },
  },
})

export const { loginUser, logoutUser } = authSlice.actions
export default authSlice.reducer
