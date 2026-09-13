import { useEffect, useRef } from "react";
import { useChatStore } from "../store/useChatStore.js";
import { useAuthStore } from "../store/useAuthStore.js";
import ChatHeader from "./ChatHeader.jsx";
import MessageInput from "./MessageInput.jsx";
import MessageSkeleton from "./skeletons/MessageSkeleton.jsx";
import { formatMessageTime } from "../lib/utils.js";

const ChatContainer = () => {
  const { messages, getMessages, isMessagesLoading, selectedUser, subscribeToMessages } = useChatStore();
  const { authUser } = useAuthStore();
  const messageEndRef = useRef(null);

  const selectedUserId = selectedUser?._id;

  useEffect(() => {
    if (!selectedUserId) {
      return;
    }

    getMessages(selectedUserId);

    // subscribeToMessages hands back its own teardown, so StrictMode's
    // double-invoke cannot leave a second live listener behind.
    return subscribeToMessages();
  }, [getMessages, subscribeToMessages, selectedUserId]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!selectedUser) {
    return null;
  }

  if (isMessagesLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-auto">
        <ChatHeader />
        <MessageSkeleton />
        <MessageInput />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <ChatHeader />
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <p className="text-center text-sm text-base-content/50 py-8">
            No messages yet. Say hello to {selectedUser.fullName}.
          </p>
        )}
        {messages.map((message) => {
          const isOwn = message.senderId === authUser?._id;

          return (
            <div key={message._id} className={`chat ${isOwn ? "chat-end" : "chat-start"}`}>
              <div className="chat-image avatar">
                <div className="size-10 rounded-full border">
                  <img
                    src={(isOwn ? authUser?.profilePic : selectedUser.profilePic) || "/avatar.png"}
                    alt={isOwn ? "Your profile picture" : `${selectedUser.fullName}'s profile picture`}
                  />
                </div>
              </div>
              <div className="chat-header mb-1">
                <time className="text-xs opacity-50 ml-1" dateTime={message.createdAt}>
                  {formatMessageTime(message.createdAt)}
                </time>
              </div>
              <div className="chat-bubble flex-col">
                {message.image && (
                  <img src={message.image} alt="Attachment" className="sm:max-w-[200px] rounded-md mb-2" />
                )}
                {message.text && <p className="whitespace-pre-wrap break-words">{message.text}</p>}
              </div>
            </div>
          );
        })}
        {/* A dedicated anchor. The ref used to be attached to every message in
            the list, so it only pointed at the last one by accident. */}
        <div ref={messageEndRef} />
      </div>
      <MessageInput />
    </div>
  );
};

export default ChatContainer;
