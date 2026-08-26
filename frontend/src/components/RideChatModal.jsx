import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Send,
  Loader2,
  MessageSquare,
  ShieldCheck,
  User,
  Pencil,
  Trash2,
  Check,
  CornerDownLeft,
} from "lucide-react";
import {
  getRideMessages,
  sendRideMessage,
  editRideMessage,
  deleteRideMessage,
} from "../api/chatApi";
import { formatTime12Hour } from "../utils/rideStatusConstants";

const formatMessageTime = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const time24 = `${String(hours).padStart(2, "0")}:${minutes}`;
  return formatTime12Hour(time24);
};

export default function RideChatModal({ rideId, otherUser, onClose }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [editingMessage, setEditingMessage] = useState(null); // { id, text }
  const [error, setError] = useState("");
  const [busyActionId, setBusyActionId] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const isMountedRef = useRef(true);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadMessages = async (isInitial = false) => {
    if (!rideId) return;
    try {
      const res = await getRideMessages(rideId, otherUser?._id);
      if (isMountedRef.current) {
        setMessages(res.data?.data || []);
        if (isInitial) {
          setTimeout(scrollToBottom, 100);
        }
      }
    } catch (err) {
      if (isMountedRef.current && isInitial) {
        setError(err.response?.data?.message || "Could not load messages.");
      }
    } finally {
      if (isMountedRef.current && isInitial) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    loadMessages(true);

    const interval = setInterval(() => {
      loadMessages(false);
    }, 4000);

    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
    };
  }, [rideId, otherUser?._id]);

  useEffect(() => {
    if (!editingMessage) {
      scrollToBottom();
    }
  }, [messages.length]);

  const handleStartEdit = (msg) => {
    setEditingMessage({ id: msg._id, text: msg.text });
    setText(msg.text);
    setError("");
    inputRef.current?.focus();
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setText("");
    setError("");
  };

  const handleDelete = async (msgId) => {
    if (busyActionId) return;
    setBusyActionId(msgId);
    setError("");
    try {
      const res = await deleteRideMessage(rideId, msgId);
      if (res.data?.data) {
        setMessages((prev) =>
          prev.map((m) => (m._id === msgId ? res.data.data : m))
        );
      }
      if (editingMessage?.id === msgId) {
        handleCancelEdit();
      }
    } catch (err) {
      setError(err.response?.data?.message || "Could not delete message.");
    } finally {
      setBusyActionId(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim() || sending) return;

    const messageText = text.trim();
    setSending(true);
    setError("");

    try {
      if (editingMessage) {
        // Edit mode
        const res = await editRideMessage(rideId, editingMessage.id, messageText);
        if (res.data?.data) {
          setMessages((prev) =>
            prev.map((m) => (m._id === editingMessage.id ? res.data.data : m))
          );
        }
        setEditingMessage(null);
        setText("");
      } else {
        // Send mode
        setText("");
        const res = await sendRideMessage(rideId, messageText, otherUser?._id);
        if (res.data?.data) {
          setMessages((prev) => [...prev, res.data.data]);
          setTimeout(scrollToBottom, 50);
        }
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          (editingMessage ? "Could not edit message." : "Could not send message. Please try again.")
      );
      if (!editingMessage) setText(messageText);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <div className="flex h-[580px] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-5 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-600 font-bold text-white shadow-xs">
              {otherUser?.profilePhoto ? (
                <img src={otherUser.profilePhoto} alt={otherUser.name} className="h-full w-full object-cover" />
              ) : (
                <span>{(otherUser?.name || "U").charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-bold text-slate-900">{otherUser?.name || "Ride Partner"}</h3>
                <ShieldCheck size={14} className="text-blue-600" />
              </div>
              <p className="text-[11px] font-medium text-slate-500">In-Ride Coordination Chat</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/40">
          {loading ? (
            <div className="flex h-full flex-col items-center justify-center gap-2">
              <Loader2 className="animate-spin text-blue-600" size={24} />
              <p className="text-xs font-medium text-slate-400">Loading conversation...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center px-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <MessageSquare size={22} />
              </div>
              <p className="text-sm font-bold text-slate-700">No messages yet</p>
              <p className="max-w-xs text-xs text-slate-500">
                Send a quick message to coordinate your exact pickup spot, travel timing, or landmarks.
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMine = String(msg.sender?._id || msg.sender) !== String(otherUser?._id);
              const isDeleted = Boolean(msg.isDeleted);
              const isEdited = Boolean(msg.isEdited) && !isDeleted;
              const isActionBusy = busyActionId === msg._id;

              return (
                <div
                  key={msg._id}
                  className={`group relative flex flex-col ${isMine ? "items-end" : "items-start"}`}
                >
                  <div className={`relative flex items-center gap-1.5 max-w-[85%] ${isMine ? "justify-end" : "justify-start"}`}>
                    {/* Actions Menu (for author's own non-deleted messages) */}
                    {isMine && !isDeleted && (
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 shadow-xs shrink-0">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(msg)}
                          className="rounded p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition"
                          title="Edit message"
                        >
                          <Pencil size={11} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(msg._id)}
                          disabled={isActionBusy}
                          className="rounded p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                          title="Delete message"
                        >
                          {isActionBusy ? (
                            <Loader2 size={11} className="animate-spin text-rose-500" />
                          ) : (
                            <Trash2 size={11} />
                          )}
                        </button>
                      </div>
                    )}

                    {/* Speech Bubble */}
                    <div
                      className={`inline-block max-w-full rounded-2xl px-4 py-2.5 text-xs font-medium shadow-xs transition ${
                        isDeleted
                          ? "bg-slate-100/80 text-slate-400 italic border border-dashed border-slate-200"
                          : isMine
                          ? "bg-blue-600 text-white rounded-br-xs"
                          : "bg-white text-slate-800 border border-slate-200/80 rounded-bl-xs"
                      }`}
                    >
                      <p className="whitespace-pre-wrap leading-relaxed select-text [word-break:normal] [overflow-wrap:anywhere]">{msg.text}</p>
                    </div>
                  </div>

                  {/* Timestamp & Edited Indicator */}
                  <div className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-slate-400 px-1">
                    <span>{formatMessageTime(msg.createdAt)}</span>
                    {isEdited && (
                      <span className="text-[9px] text-slate-400 italic">(edited)</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Error Notification */}
        {error && (
          <div className="border-t border-rose-100 bg-rose-50 px-4 py-2 text-xs font-medium text-rose-700 flex items-center justify-between">
            <span>{error}</span>
            <button type="button" onClick={() => setError("")} className="text-rose-500 hover:text-rose-700">
              <X size={13} />
            </button>
          </div>
        )}

        {/* Editing Banner */}
        {editingMessage && (
          <div className="flex items-center justify-between border-t border-blue-100 bg-blue-50/70 px-4 py-2 text-xs font-semibold text-blue-800">
            <div className="flex items-center gap-1.5 truncate">
              <Pencil size={12} className="text-blue-600 shrink-0" />
              <span className="truncate">Editing message...</span>
            </div>
            <button
              type="button"
              onClick={handleCancelEdit}
              className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] text-blue-700 hover:bg-blue-100 transition shrink-0"
            >
              <X size={12} />
              Cancel
            </button>
          </div>
        )}

        {/* Message Input Footer */}
        <form onSubmit={handleSubmit} className="border-t border-slate-100 bg-white p-3">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              maxLength={500}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={editingMessage ? "Update your message..." : "Type your message..."}
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-medium text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
              autoFocus
            />
            <button
              type="submit"
              disabled={!text.trim() || sending}
              className={`flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-md transition disabled:opacity-40 disabled:shadow-none ${
                editingMessage
                  ? "bg-emerald-600 shadow-emerald-500/20 hover:bg-emerald-700"
                  : "bg-blue-600 shadow-blue-500/20 hover:bg-blue-700"
              }`}
              title={editingMessage ? "Save edit" : "Send message"}
            >
              {sending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : editingMessage ? (
                <Check size={16} />
              ) : (
                <Send size={16} />
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
