import { useEffect, useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { Camera, Mail, User } from "lucide-react";
import { useParams } from "react-router-dom";

const ProfilePage = () => {
    const { authUser, isUpadtingProfile, updateProfile } = useAuthStore();
    const { getUserProfile, sentRequests, friends, sendFriendRequest, requestSent } = useChatStore();  
    const [selectedImg, setSelectedImg] = useState(null);
    const [profile, setProfile] = useState({});
    const { id } = useParams();

    const isFriend = friends.some(user => user.userId === id);
    const followRequest = sentRequests.includes(id);

    useEffect(() => {
        const fetchProfile = async () => {
            const profileData = await getUserProfile(id);
            setProfile(profileData);
        };

        fetchProfile();
    }, [getUserProfile]);

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];

        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);

        reader.onload = async () => {
            const base64Image = reader.result;
            setSelectedImg(base64Image);
            await updateProfile({ profilePic: base64Image })
        };
    }

    const sendRequest = () => {
        sendFriendRequest(id);
    }

    return (
        <div className="mt-16 100vh">
            <div className="max-w-2xl mx-auto p-4 py-8">
                <div className="bg-base-300 rounded-xl p-6 space-y-8">
                    <div className="text-center">
                        <h1 className="text-2xl font-semibold">Profile</h1>
                        <p className="mt-2">Your profile information</p>
                    </div>
                    {authUser._id == id ? (
                            <div className="flex flex-col items-center gap-4">
                                <div className="relative">
                                    <img src={selectedImg || profile.profilePic || "/avatar.png"} alt="Profile" className="size-32 rounded-full object-cover border-4"/>
                                    <label 
                                        htmlFor="avatar-upload"
                                        className={`absolute bottom-0 right-0 bg-base-content hover:scale-105 p-2 rounded-full cursor-pointer transition-all duration-200 ${isUpadtingProfile ? "animate-pulse pointer-events-none" : ""}`}
                                    >
                                        <Camera className="w-5 h-5 text-base-200" />
                                        <input 
                                            type="file"
                                            id="avatar-upload"
                                            className="hidden"
                                            accept="image/*"
                                            onChange={handleImageUpload}
                                            disabled={isUpadtingProfile}
                                        />
                                    </label>
                                </div>
                                <p className="text-sm text-sinc-400">
                                    {isUpadtingProfile ? "Uploading..." : "Click the camera icon to update your photo"}
                                </p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-8">
                                <img src={selectedImg || profile.profilePic || "/avatar.png"} alt="Profile" className="size-32 rounded-full object-cover border-4"/>
                                {isFriend ? 
                                    (<button className="btn btn-sm transition-colors" type="button">
                                        Unfollow
                                    </button>) :
                                    (<button className="btn btn-sm transition-colors" type="button" disabled={followRequest || requestSent} onClick={sendRequest}>
                                        {requestSent ? "Request Sent" : "Follow"}
                                    </button>)
                                }       
                            </div>
                        )
                    }
                    <div className="space-y-6 p-6">
                        <div className="space-y-1.5">
                            <div className="text-sm text-zinc-400 flex items-center gap-2">
                                <User className="w-4 h-4" />
                                Full Name
                            </div>
                            <p className="px-4 py-2.5 bg-base-200 rounded-lg border">{profile?.fullName}</p>
                        </div>
                        <div className="space-y-1.5">
                            <div className="text-sm text-zinc-400 flex items-center gap-2">
                                <Mail className="w-4 h-4" />
                                Email
                            </div>
                            <p className="px-4 py-2.5 bg-base-200 rounded-lg border">{profile?.email}</p>
                        </div>
                    </div>
                    <div className="mt-6 bg-base-300 rounded-xl p-6">
                        <h2 className="text-lg font-medium mb-4">Account Information</h2>
                        <div className="space-y-3 text-sm">
                            <div className="flex items-center justify-between py-2 border-b border-zinc-700">
                                <span>Member Since</span>
                                <span>{profile.createdAt?.split("T")[0]}</span>
                            </div>
                            <div className="flex items-center justify-between py-2">
                                <span>Account Status</span>
                                <span className="text-green-500">Active</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ProfilePage;