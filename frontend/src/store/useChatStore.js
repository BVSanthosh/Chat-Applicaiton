import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore.js";

export const useChatStore = create((set, get) => ({
    messages: [],
    friends: [],
    onlineUsers: [],
    suggestedUsers: [],
    sentRequests: [],
    receivedRequests: [],
    selectedUser: null,
    isUsersLoading: false,
    isMessagesLoading: false,
    requestSent: false,
    getFriends: async () => {
        set({ isUsersLoading: true });

        try {
            const res = await axiosInstance.get("/users");
            set({ friends: res.data });
        } catch (error) {
            console.log("Error in setUsers: " + error);
            toast.error(error.response.data.message);
        } finally {
            set({ isUsersLoading: false });
        }
    },
    getMessages: async (userId) => {
        set({ isMessagesLoading: true });
 
        try {
            const res = await axiosInstance.get(`/messages/${userId}`);
            set({ messages: res.data });
        } catch (error) {
            console.log("Error in getMessages: " + error);
            toast.error(error.response.data.message);
        } finally {
            set({ isMessagesLoading: false });
        }
    },
    sendMessage: async (messasgeData) => {
        const { selectedUser, messages} = get();
        
        try {
            const res = await axiosInstance.post(`/messages/send/${selectedUser._id}`, messasgeData);
            set({ messages: [...messages, res.data] });
        } catch (error) {
            console.log("Error in sendMessage: " + error);
            toast.error(error.response.data.message);
        }
    },
    subscribeToMessages: () => {
        const { selectedUser } = get();

        if (!selectedUser) {
            return;
        }

        const socket = useAuthStore.getState().socket;

        socket.on("newMessage", (newMessage) => {
            if (newMessage.senderId !== selectedUser._id) {
                return;
            }

            set({ messages: [...get().messages, newMessage] });
        });
    },
    unsubscribeToMessages: () => {
        const socket = useAuthStore.getState().socket;

        socket.off("newMessage");
    },
    setSelectedUser: (user) => {
        set({ selectedUser: user });
    },
    getUserProfile: async (userId) => {
        try {
            const res = await axiosInstance.get(`/users/profile/${userId}`);
            return res.data;
        } catch (error) {
            console.log("Error in getUserProfile: " + error);
            toast.error(error.response.data.message);
        }
    },
    sendFriendRequest: async (userId) => {
        set({ requestSent: true });
        try {
            const res = await axiosInstance.post(`/users/friend-request/${userId}`);
            console.log(res.data);
            set({ sentRequests: res.data });
        } catch(error) {
            console.log("Error in sendFriendRequest: " + error);
            toast.error(error.response.data.message);
        } finally {
            set({ requestSent: false });
        }
    },
    respondToFriendRequest: async (userId, accepted) => {
        try {
            await axiosInstance.put(`/users/friend-response/${userId}`, {accepted: accepted});
        } catch(error) {
            console.log("Error in respondToFriendRequest: " + error);
            toast.error(error.response.data.message);
        }
    },
    getNotifications: async () => {
        try {
            const res = await axiosInstance.get("/users/notifications");
            console.log(res.data.receivedRequests);
            set({ receivedRequests: res.data.receivedRequests });
        } catch(error) {
            console.log("Error in getNotifications: " + error);
            toast.error(error.response.data.message);
        }
    },
    subscribeToNotifs: () => {
        const { receivedRequests } = get();
        const socket = useAuthStore.getState().socket;

        socket.on("request", (req) => {
            set({ receivedRequests: [...receivedRequests, req] });
        });
    },
    unsubscribeToNotifs: () => {
        const socket = useAuthStore.getState().socket;

        socket.off("request");
    },
    openOnlineCheck: () => {
        const { friends, onlineUsers } = get();
        const socket = useAuthStore.getState().socket;

        socket.on("userOnline", (id) => {

            const isFriend = friends.some(user => user.userId === id);

            if (isFriend) {
                set({ onlineUsers: [...onlineUsers, id] });
            }
        });

        socket.on("userOffline", (id) => {

            const isFriend = friends.some(user => user.userId === id);

            if (isFriend) {
                set({ onlineUsers: onlineUsers.filter(userId => userId != id) });
            }
        });
    },
    closeOnlineCheck: () => {
        const socket = useAuthStore.getState().socket;

        socket.off("userOnline");
        socket.off("userOffline");
    }
}));