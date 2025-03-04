import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
    },
    fullName: {
        type: String,
        required: true,
    },
    password: {
        type: String,
        required: true,
        minlength: 8,
    },
    profilePic: {
        type: String,
        default: "",
    },
    socketId: {
        type: String,
        default: null,
    },
    friends: [{
        userId: { 
            type: mongoose.Schema.Types.ObjectId, 
            required: true 
        },
        fullName: { 
            type: String, 
            required: true
        },
        profilePic: { 
            type: String, 
            required: true 
        }
    }],
    sentRequests: {
        type: [String],
        default: []
    },
    receivedRequests: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        username: {
            type: String,
            required: true,
        }
    }]
}, { timestamps: true });

const User = mongoose.model("User", userSchema);

export default User;