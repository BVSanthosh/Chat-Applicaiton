import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import cloudinary from "../lib/cloudinary.js";
import { io } from "../lib/socket.js";

export const getMessages = async (req, res) => {
    try {
        const {id: chatUserId} = req.params;
        const userId = req.user._id;

        const messages = await Message.find({
            $or: [
                {senderId: userId, receiverId: chatUserId},
                {senderId: chatUserId, receiverId: userId}
            ]
        });

        res.status(200).json(messages);
    } catch (error) {
        console.log("Error in getMessages controller: " + error.message);

        res.status(500).json({
            error: "Internal server error"
        });
    }
}

export const sendMessage = async (req, res) => {
    try {
        const { text, image } = req.body;
        const {id: receiverId} = req.params;
        const senderId = req.user._id;

        let imageUrl;

        if (image) {
            const uploadRes = await cloudinary.uploader.upload(image);
            imageUrl = uploadRes.secure_url;
        }

        const newMessage = new Message({
            senderId,
            receiverId,
            text,
            image: imageUrl,
        });

        await newMessage.save();

        const reciever = await User.findOne({_id: receiverId}, {socketId: 1});
        const receiverSocketId = reciever ? receiver.socketId : null;

        if (receiverSocketId) {
            io.to(receiverSocketId).emit("newMessage", newMessage);
        }

        res.status(201).json(newMessage);
    } catch (error) {
        console.log("Error in sendMessage controller: " + error.message);

        res.status(500).json({
            error: "Internal server error"
        });
    }
}