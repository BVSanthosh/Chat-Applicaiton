import { Server } from "socket.io";
import http from "http";
import express from "express";
import User from "../models/user.model.js";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: ["http://localhost:5173"],
    },
});

io.on("connection", async (socket) => {
    console.log("A user connected: ", socket.id);

    const userId = socket.handshake.query.userId;

    if (!userId) {
        console.log("User ID not provided");
        return;
    }

    try {
        await User.updateOne({_id: userId}, {socketId: socket.id}).exec();

        io.emit("userOnline", userId);
    } catch(error) {
        console.error("Error updating socket ID: ", error);
    }

    socket.on("disconnect", () => {
        console.log("A user disconnected: ", socket.id);

        if (userId) {
            io.emit("userOffline", userId);
        } else {
            console.log("User ID not available on disconnect");
        }
    })
});

export { io, app, server};