import User from "../models/user.model.js";
import { io } from "../lib/socket.js";

export const getUsers = async (req, res) => {
    try {
        const loggedInUserId = req.user._id;
        const user = await User.findById(loggedInUserId);

        res.status(200).json(user.friends);
    } catch (error) {
        console.log("Error in getUsers controller: " + error.message);

        res.status(500).json({
            error: "Internal server error"
        });
    }
}

export const getUser = async (req, res) => {
    try {
        const userId = req.params.id;
        const userProfile = await User.findById(userId).select("-password");

        res.status(200).json(userProfile);
    } catch (error) {
        console.log("Error in getUser controller: " + error.message);

        res.status(500).json({
            error: "Internal server error"
        });
    }
}

export const getUserSuggestions = async (req, res) => {
    try {
        const { username } = req.query;

        const suggestions = await User.find({fullName: {$regex: username, $options: "i"}});

        res.status(200).json(suggestions);
    } catch (error) {
        console.log("Error in getUserSuggestions controller: " + error.message);

        res.status(500).json({
            error: "Internal server error"
        });
    }
}

export const getNotifications = async (req, res) => {
    try {
        const userId = req.user._id;

        const userRequests = await User.findById(userId);

        res.status(200).json(userRequests);
    } catch (error) {
        console.log("Error in getNotifications controller: " + error.message);

        res.status(500).json({
            error: "Internal server error"
        });
    }
}

export const sendFriendRequest = async (req, res) => {
    try {
        const receiverId = req.params.id;
        const id = req.user._id;

        const sender = await User.findOneAndUpdate({_id: id}, {$push: {sentRequests: receiverId}}, {new: true});
        const receiver = await User.findOneAndUpdate({_id: receiverId}, {$addToSet: {receivedRequests: {userId: sender._id, username: sender.fullName}}}, {new: true});

        io.to(receiver.socketId).emit("request", sender);

        res.status(200).json(sender.sentRequests);
    } catch(error) {
        console.log("Error in sendFriendRequest: " + error.message);

        res.status(500).json({
            error: "Internal server error"
        });
    }
}

export const handleFriendRequest = async (req, res) => {
    try {
        const { accepted } = req.body;
        const senderId = req.params.id;
        const id = req.user._id;
        
        const receiver = await User.findOneAndUpdate({_id: id}, {$pull: {receivedRequests: {userId: senderId}}}, {new: true});
        const sender = await User.findOneAndUpdate({_id: senderId}, {$pull: {sentRequests: id}}, {new: true});

        if (accepted) {
            await User.findOneAndUpdate({_id: id}, {$push: {friends: {userId: sender._id, fullName: sender.fullName, profilePic: sender.profilePic}}}, {new: true});
            await User.findOneAndUpdate({_id: senderId}, {$push: {friends: {userId: receiver._id, fullName: receiver.fullName, profilePic: receiver.profilePic}}}, {new: true});
        }

        res.status(200).json({message: "Responded to friend request"});
    } catch(error) {
        console.log("Error in handleFriendRequest: " + error.message);

        res.status(500).json({
            error: "Internal server error"
        });
    }
}