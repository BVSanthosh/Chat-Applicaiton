import express from "express"
import { getUsers, getUser, getUserSuggestions, sendFriendRequest, handleFriendRequest, getNotifications } from "../controllers/user.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/", protectRoute, getUsers);
router.get("/profile/:id", protectRoute, getUser);
router.get("/suggested-users", protectRoute, getUserSuggestions);
router.post("/friend-request/:id", protectRoute, sendFriendRequest);
router.put("/friend-response/:id", protectRoute, handleFriendRequest);
router.get("/notifications", protectRoute, getNotifications);

export default router;