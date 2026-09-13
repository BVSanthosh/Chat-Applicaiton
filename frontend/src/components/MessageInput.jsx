import { useRef, useState } from "react";
import { X, Image, Send, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { useChatStore } from "../store/useChatStore.js";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const MessageInput = () => {
  const { sendMessage, isSendingMessage } = useChatStore();
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef = useRef(null);

  const clearFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];

    // Dismissing the file dialog fires change with an empty list; reading
    // `file.type` there threw a TypeError and killed the handler.
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      clearFileInput();
      return;
    }

    // Checked here as well as on the server so the user finds out before
    // spending time base64-encoding a large file.
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Image must be smaller than 5MB");
      clearFileInput();
      return;
    }

    const reader = new FileReader();

    reader.onload = () => setImagePreview(reader.result);
    reader.onerror = () => {
      toast.error("Could not read that image");
      clearFileInput();
    };

    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImagePreview(null);
    clearFileInput();
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();

    const trimmed = text.trim();

    if ((!trimmed && !imagePreview) || isSendingMessage) {
      return;
    }

    const sent = await sendMessage({ text: trimmed, image: imagePreview });

    // The draft is only cleared once the server accepted it, so a failed send
    // no longer silently discards what the user typed.
    if (sent) {
      setText("");
      setImagePreview(null);
      clearFileInput();
    }
  };

  const canSend = (text.trim() || imagePreview) && !isSendingMessage;

  return (
    <div className="p-4 w-full">
      {imagePreview && (
        <div className="mb-3 flex items-center gap-2">
          <div className="relative">
            <img
              src={imagePreview}
              alt="Attachment preview"
              className="w-20 h-20 object-cover rounded-lg border border-zinc-700"
            />
            <button
              onClick={removeImage}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-base-300 flex items-center justify-center"
              type="button"
              aria-label="Remove attachment"
            >
              <X className="size-3" />
            </button>
          </div>
        </div>
      )}
      <form onSubmit={handleSendMessage} className="flex items-center gap-2">
        <div className="flex-1 flex gap-2">
          <input
            type="text"
            className="w-full input input-bordered rounded-lg input-sm sm:input-md"
            placeholder="Type a message..."
            value={text}
            maxLength={4000}
            onChange={(e) => setText(e.target.value)}
            disabled={isSendingMessage}
          />
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            ref={fileInputRef}
            onChange={handleImageChange}
          />
          <button
            type="button"
            className={`hidden sm:flex btn btn-circle ${imagePreview ? "text-emerald-500" : "text-zinc-400"}`}
            onClick={() => fileInputRef.current?.click()}
            aria-label="Attach an image"
          >
            <Image size={20} />
          </button>
        </div>
        <button type="submit" className="btn btn-sm btn-circle" disabled={!canSend} aria-label="Send message">
          {isSendingMessage ? <Loader2 size={20} className="animate-spin" /> : <Send size={22} />}
        </button>
      </form>
    </div>
  );
};

export default MessageInput;
