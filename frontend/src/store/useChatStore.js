import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios.js";
import { getErrorMessage } from "../lib/errors.js";
import { realtime } from "../lib/realtime.js";
import { useAuthStore } from "./useAuthStore.js";

function appendUnique(messages, incoming) {
  // The server echoes each message to the sender's own sessions too, so the
  // optimistic copy and the broadcast copy can both arrive.
  if (messages.some((message) => message._id === incoming._id)) {
    return messages;
  }

  return [...messages, incoming];
}

export const useChatStore = create((set, get) => ({
  messages: [],
  users: [],
  selectedUser: null,
  isUsersLoading: false,
  isMessagesLoading: false,
  isSendingMessage: false,

  getUsers: async () => {
    set({ isUsersLoading: true });

    try {
      const { data } = await axiosInstance.get("/messages/users");

      set({ users: data });
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not load contacts"));
    } finally {
      set({ isUsersLoading: false });
    }
  },

  getMessages: async (userId) => {
    if (!userId) {
      return;
    }

    set({ isMessagesLoading: true });

    try {
      const { data } = await axiosInstance.get(`/messages/${userId}`);

      // Drop the response if the user switched conversations while it was in
      // flight, otherwise the old thread overwrites the new one.
      if (get().selectedUser?._id === userId) {
        set({ messages: data });
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not load messages"));
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  sendMessage: async (messageData) => {
    const { selectedUser } = get();

    if (!selectedUser) {
      return false;
    }

    set({ isSendingMessage: true });

    try {
      const { data } = await axiosInstance.post(`/messages/send/${selectedUser._id}`, messageData);

      set({ messages: appendUnique(get().messages, data) });

      return true;
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not send your message"));

      return false;
    } finally {
      set({ isSendingMessage: false });
    }
  },

  /**
   * Returns its own teardown so the caller cannot leak a handler. The previous
   * version called `socket.off("newMessage")`, which removed every listener
   * including ones it did not own, and crashed outright when the socket was
   * still null.
   */
  subscribeToMessages: () => {
    const unsubscribeMessage = realtime.on("newMessage", (message) => {
      const { selectedUser, messages } = get();
      const authUserId = useAuthStore.getState().authUser?._id;

      if (!selectedUser) {
        return;
      }

      const belongsToThread =
        (message.senderId === selectedUser._id && message.receiverId === authUserId) ||
        (message.senderId === authUserId && message.receiverId === selectedUser._id);

      if (!belongsToThread) {
        return;
      }

      set({ messages: appendUnique(messages, message) });
    });

    // Messages sent while the socket was down never arrived, so refetch the
    // open thread once it comes back.
    const unsubscribeReconnect = realtime.on("reconnected", () => {
      const { selectedUser } = get();

      if (selectedUser) {
        get().getMessages(selectedUser._id);
      }
    });

    return () => {
      unsubscribeMessage();
      unsubscribeReconnect();
    };
  },

  setSelectedUser: (user) => {
    set({ selectedUser: user, messages: [] });
  },

  reset: () => {
    set({ messages: [], users: [], selectedUser: null });
  },
}));
