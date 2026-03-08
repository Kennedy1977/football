import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface AuthState {
  clerkUserId: string | null;
  isAuthenticated: boolean;
}

const initialState: AuthState = {
  clerkUserId: null,
  isAuthenticated: false,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setAuth(state, action: PayloadAction<{ clerkUserId: string }>) {
      state.clerkUserId = action.payload.clerkUserId;
      state.isAuthenticated = true;
    },
    clearAuth(state) {
      state.clerkUserId = null;
      state.isAuthenticated = false;
    },
  },
});

export const { setAuth, clearAuth } = authSlice.actions;
export const authReducer = authSlice.reducer;
