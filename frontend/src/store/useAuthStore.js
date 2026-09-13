import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios.js";
import { getErrorMessage, isUnauthorized } from "../lib/errors.js";
import { realtime } from "../lib/realtime.js";

let listenersBound = false;

// Bound once for the lifetime of the tab. Binding inside connectRealtime would
// add a duplicate handler on every reconnect.
function bindRealtimeListeners(set) {
  if (listenersBound) {
    return;
  }

  listenersBound = true;
  realtime.on("onlineUsers", (users) => set({ onlineUsers: users }));
  realtime.on("status", ({ connected }) => set({ isRealtimeConnected: connected }));
}

export const useAuthStore = create((set, get) => ({
  authUser: null,
  isSigningUp: false,
  isLoggingIn: false,
  isUpdatingProfile: false,
  isCheckingAuth: true,
  isRealtimeConnected: false,
  onlineUsers: [],

  checkAuth: async () => {
    try {
      const { data } = await axiosInstance.get("/auth/check");

      set({ authUser: data });
      get().connectRealtime();
    } catch (error) {
      // A 401 here just means "not signed in" — the normal first-visit path.
      if (!isUnauthorized(error)) {
        console.error("Failed to restore session", error);
      }

      set({ authUser: null });
    } finally {
      set({ isCheckingAuth: false });
    }
  },

  signup: async (data) => {
    set({ isSigningUp: true });

    try {
      const res = await axiosInstance.post("/auth/signup", data);

      set({ authUser: res.data });
      toast.success("Account created successfully");
      get().connectRealtime();

      return true;
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not create your account"));

      return false;
    } finally {
      set({ isSigningUp: false });
    }
  },

  login: async (data) => {
    set({ isLoggingIn: true });

    try {
      const res = await axiosInstance.post("/auth/login", data);

      set({ authUser: res.data });
      toast.success("Logged in successfully");
      get().connectRealtime();

      return true;
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not sign you in"));

      return false;
    } finally {
      set({ isLoggingIn: false });
    }
  },

  logout: async () => {
    try {
      await axiosInstance.post("/auth/logout");
      toast.success("Logged out successfully");
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not log out cleanly"));
    } finally {
      // The local session is dropped either way; leaving the user "signed in"
      // against a server that already rejected them is worse than a failed
      // network call.
      set({ authUser: null, onlineUsers: [] });
      get().disconnectRealtime();
    }
  },

  updateProfile: async (data) => {
    set({ isUpdatingProfile: true });

    try {
      const res = await axiosInstance.put("/auth/update-profile", data);

      // The API returns the user unwrapped; the previous `{ updatedUser }`
      // shape was stored verbatim and wiped _id/fullName off the session.
      set({ authUser: res.data });
      toast.success("Profile updated successfully");

      return true;
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not update your profile"));

      return false;
    } finally {
      set({ isUpdatingProfile: false });
    }
  },

  connectRealtime: () => {
    if (!get().authUser) {
      return;
    }

    bindRealtimeListeners(set);
    realtime.connect();
  },

  disconnectRealtime: () => {
    realtime.disconnect();
    set({ isRealtimeConnected: false, onlineUsers: [] });
  },
}));
