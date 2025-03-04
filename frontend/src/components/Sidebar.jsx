import { useEffect, useState } from "react";
import { useChatStore } from "../store/useChatStore.js";
import SidebarSkeleton from "./skeletons/SidebarSkeleton.jsx";
import AddContact from "./AddContact.jsx";
import CreateGroup from "./CreateGroup.jsx";
import { Users, UserRoundPlus, UsersRound  } from "lucide-react";

const Sidebar = () => {
    const { friends, selectedUser, getFriends, setSelectedUser, isUsersLoading, onlineUsers, openOnlineCheck, closeOnlineCheck } = useChatStore();
    const [showOnlineOnly, setShowOnlineOnly] = useState(false); 
    const [showContactModal, setShowContactModal] = useState(false); 
    const [showGrouptModal, setShowGrouptModal] = useState(false);
    
    useEffect(() => {
        getFriends();
    }, [getFriends]);

    useEffect(() => {
        openOnlineCheck();
        return () => closeOnlineCheck();
    }, [openOnlineCheck, closeOnlineCheck]);

    const filteredUsers = showOnlineOnly ? friends.filter(user => onlineUsers.includes(user.userId)) : friends;

    if (isUsersLoading) {
        return <SidebarSkeleton />
    }

    return (
        <aside className="h-full w-20 lg:w-72 border-r border-base-300 flex flex-col transition-all duration-200">
            <div className="border-b border-base-300 w-full p-5">
                <div className="flex items-center gap-2">
                    <Users className="w-6 h-6"/>
                    <span className="font-medium hidden lg:block">Contacts</span>
                </div>
                <div className="mt-3 hidden lg:flex items-center gap-2">
                    <label className="cursor-pointer flex items-center gap-2">
                        <input 
                            type="checkbox" 
                            checked={showOnlineOnly}
                            onChange={(e) => setShowOnlineOnly(e.target.checked)} 
                            className="checkbox checkbox-sm"
                        />
                        <span className="text-sm">Show online users</span>
                    </label>
                    <span className="text-xs text-zinc-500">({onlineUsers.length == 0 ? 0 : onlineUsers.length - 1} online)</span>
                </div>
            </div>
            <div className="overflow-y-auto w-full py-3">
                {filteredUsers.map((user) => (
                    <button
                        key={user.userId}
                        onClick={() => setSelectedUser(user)}
                        className={`w-full p-3 flex items-center gap-3 hover:bg-base-300 transition-colors ${selectedUser?.userId == user.userId ? "bg-base-300 ring-1 ring-base-300" : ""}`}
                    >
                        <div className="relative mx-auto lg:mx-0">
                            <img 
                                src={user.profilePic || "/avatar.png"}
                                alt={user.fullName} 
                                className="size-12 object-cover rounded-full"
                            />
                            {onlineUsers.includes(user.userId) && (
                                <span className="absolute bottom-0 right-0 size-3 bg-green-500 rounded-full ring-2 ring-zinc-900" />
                            )}
                        </div>
                        <div className="hidden lg:block text-left min-w-0">
                            <div className="font-medium truncate">{user.fullName}</div>
                            <div className="text-sm text-zinc-400">
                                {onlineUsers.includes(user.userId) ? "Online" : "Offline"}
                            </div>
                        </div>
                    </button>
                ))}

                {filteredUsers.length === 0 && (
                    <div className="text-center text-zinc-500 py-4">No online users</div>
                )}
            </div>
            <div className="border-t border-base-300 p-4">
                <div className="flex flex-col lg:flex-row items-center justify-center gap-4">
                    <button 
                        className="btn btn-sm transition-colors"
                        onClick={() => setShowContactModal(true)}
                    >
                        <UserRoundPlus className="size-4"/>
                        <span className="hidden lg:block text-xs">Add Contact</span>
                    </button>
                    <button 
                        className="btn btn-sm transition-colors" 
                        onClick={() => setShowGrouptModal(true)}
                    >
                        <UsersRound className="size-4"/>
                        <span className="hidden lg:block text-xs">Create Group</span>
                    </button>
                </div>
            </div>

            {showContactModal && <AddContact isOpen={showContactModal} setIsOpen={setShowContactModal} />}
            {showGrouptModal && <CreateGroup isOpen={showGrouptModal} setIsOpen={setShowGrouptModal} />}
        </aside>
    );
};

export default Sidebar;