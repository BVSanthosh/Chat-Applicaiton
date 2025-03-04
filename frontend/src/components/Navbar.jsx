import { LogOut, MessageSquare, Settings, User, Bell, Check, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import { useEffect } from "react";
import { useChatStore } from "../store/useChatStore";

const Navbar = () => {
    const { logout, authUser } = useAuthStore();
    const { subscribeToNotifs, unsubscribeToNotifs, receivedRequests, respondToFriendRequest, getNotifications} = useChatStore();
    
    useEffect(() => {
        if (authUser) {
            getNotifications();
            subscribeToNotifs();

            return () => unsubscribeToNotifs();
        }
    }, [authUser, subscribeToNotifs, unsubscribeToNotifs, getNotifications]);

    return (
        <header className="bg-base-100 border-b border-base-300 fixed w-full top-0 z-40 backdrop-blur-lg bg-base-100/80">
            <div className="container mx-auto px-4 h-16">
                <div className="flex items-center justify-between h-full">
                    <div className="flex items-center gap-8">
                        <Link to="/" className="flex items-center gap-2.5 hover:opacity-80 transition-all">
                            <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center">
                                <MessageSquare className="w-5 h-5 text-primary" />
                            </div>
                            <h1 className="text-lg font-bold">Chatty</h1>
                        </Link>
                    </div>
                    <div className="flex items-center gap-2 ">
                        {authUser && (
                            <div className="dropdown dropdown-bottom">
                                <div tabIndex={0} role="button" className="btn btn-sm">
                                    <Bell  className="size-5"/>
                                    <span className="hidden sm:inline">Notifications</span>
                                </div>
                                <ul tabIndex={0} className="menu dropdown-content bg-base-200 rounded-lg z-[1] w-52 mt-3 p-2 gap-2 shadow">
                                    {receivedRequests.length > 0 ? receivedRequests.map(req => (
                                        <div key={req.userId} className="flex items-center justify-end text-semibold">
                                            <span>{req.username + " sent a friend request"}</span>
                                            <div className="flex items-center gap-2">
                                                <button className="btn btn-sm" onClick={() => respondToFriendRequest(req.userId, true)}>
                                                    <Check className="size-3"/>
                                                </button>
                                                <button className="btn btn-sm" onClick={() => respondToFriendRequest(req.userId, false)}>
                                                    <X className="size-3"/>
                                                </button>
                                            </div>
                                        </div>
                                    )) : (
                                        <span className="text-semibold">No requests</span>
                                    )}
                                </ul>
                            </div>
                        )}
                        {authUser && (
                            <Link to={`/profile/${authUser._id}`} className="btn btn-sm gap-2">
                                <User className="size-5" />
                                <span className="hidden sm:inline">Profile</span>
                            </Link> 
                        )}
                        <Link to="/settings" className="btn btn-sm transition-colors">
                            <Settings className="w-4 h-4" />
                            <span className="hidden sm:inline">Settings</span>
                        </Link>
                        {authUser && (
                            <button className="flex gap-2 items-center" onClick={logout}>
                                <LogOut className="size-5" />
                                <span className="hidden sm:inline">Logout</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </header>
    )
}

export default Navbar;