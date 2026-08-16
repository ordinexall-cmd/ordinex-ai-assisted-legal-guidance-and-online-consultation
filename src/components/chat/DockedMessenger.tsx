import React, { useState, useRef, useEffect, useCallback } from 'react';
import { retainAppSocket, releaseAppSocket } from '../../services/appSocket';
import type { Socket } from 'socket.io-client';

/* ─── Types ─── */
interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
  isOwn?: boolean;
}

interface ChatThread {
  id: string;
  peerName: string;
  peerAvatar?: string | null;
  lastMessage?: string;
  lastMessageAt?: string;
  unread: number;
}

export interface DockedMessengerProps {
  readonly userId: string;
  readonly userName: string;
  readonly threads?: ChatThread[];
}

/* ─── Component ─── */
export const DockedMessenger: React.FC<DockedMessengerProps> = ({
  userId,
  userName,
  threads: initialThreads = [],
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeThread, setActiveThread] = useState<ChatThread | null>(null);
  const [threads, setThreads] = useState<ChatThread[]>(initialThreads);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [totalUnread, setTotalUnread] = useState(0);
  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Compute total unread
  useEffect(() => {
    setTotalUnread(threads.reduce((sum, t) => sum + t.unread, 0));
  }, [threads]);

  // Connect socket
  useEffect(() => {
    const s = retainAppSocket();
    socketRef.current = s;

    if (s) {
      // Listen for incoming chat messages
      s.on('dm:message', (msg: ChatMessage) => {
        if (activeThread && msg.senderId !== userId) {
          setMessages((prev) => [...prev, { ...msg, isOwn: false }]);
        }
        // Update thread list
        setThreads((prev) =>
          prev.map((t) =>
            t.id === msg.senderId || t.id === activeThread?.id
              ? { ...t, lastMessage: msg.text, lastMessageAt: msg.timestamp, unread: activeThread?.id === t.id ? 0 : t.unread + 1 }
              : t
          )
        );
      });

      // Listen for thread list updates
      s.on('dm:threads', (list: ChatThread[]) => {
        setThreads(list);
      });
    }

    return () => {
      if (s) {
        s.off('dm:message');
        s.off('dm:threads');
      }
      releaseAppSocket();
    };
  }, [userId, activeThread]);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opening a thread
  useEffect(() => {
    if (activeThread) inputRef.current?.focus();
  }, [activeThread]);

  const openThread = useCallback((thread: ChatThread) => {
    setActiveThread(thread);
    // Mark as read
    setThreads((prev) =>
      prev.map((t) => (t.id === thread.id ? { ...t, unread: 0 } : t))
    );
    // Load message history (placeholder — real app would fetch from API)
    setMessages([]);
    socketRef.current?.emit('dm:join', { peerId: thread.id });
  }, []);

  const sendMessage = useCallback(() => {
    if (!draft.trim() || !activeThread) return;
    const msg: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      senderId: userId,
      senderName: userName,
      text: draft.trim(),
      timestamp: new Date().toISOString(),
      isOwn: true,
    };
    setMessages((prev) => [...prev, msg]);
    setDraft('');
    socketRef.current?.emit('dm:message', {
      peerId: activeThread.id,
      text: msg.text,
    });
  }, [draft, activeThread, userId, userName]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const goBack = () => {
    setActiveThread(null);
    setMessages([]);
  };

  return (
    <>
      {/* ─── Floating FAB ─── */}
      {!isOpen && (
        <button
          type="button"
          className="docked-messenger__fab"
          onClick={() => setIsOpen(true)}
          aria-label="Open messages"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 24 }}>chat</span>
          {totalUnread > 0 && (
            <span className="docked-messenger__badge">{totalUnread > 9 ? '9+' : totalUnread}</span>
          )}
        </button>
      )}

      {/* ─── Messenger Panel ─── */}
      {isOpen && (
        <div className="docked-messenger">
          {/* Header */}
          <div className="docked-messenger__header">
            {activeThread ? (
              <>
                <button type="button" className="docked-messenger__back" onClick={goBack} aria-label="Back to threads">
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
                </button>
                <div className="docked-messenger__peer-info">
                  <div className="docked-messenger__peer-avatar">
                    {activeThread.peerAvatar ? (
                      <img src={activeThread.peerAvatar} alt="" />
                    ) : (
                      <span>{activeThread.peerName.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <strong>{activeThread.peerName}</strong>
                </div>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>forum</span>
                <strong>Messaging</strong>
              </>
            )}
            <button
              type="button"
              className="docked-messenger__close"
              onClick={() => { setIsOpen(false); setActiveThread(null); }}
              aria-label="Close messenger"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
            </button>
          </div>

          {/* Body */}
          <div className="docked-messenger__body">
            {!activeThread ? (
              /* Thread List */
              threads.length === 0 ? (
                <div className="docked-messenger__empty">
                  <span className="material-symbols-outlined" style={{ fontSize: 40, color: 'rgba(13,59,46,0.2)' }}>
                    chat_bubble_outline
                  </span>
                  <p>No conversations yet</p>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    Messages from your consultations will appear here.
                  </p>
                </div>
              ) : (
                <div className="docked-messenger__thread-list">
                  {threads.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className="docked-messenger__thread-row"
                      onClick={() => openThread(t)}
                    >
                      <div className="docked-messenger__thread-avatar">
                        {t.peerAvatar ? (
                          <img src={t.peerAvatar} alt="" />
                        ) : (
                          <span>{t.peerName.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="docked-messenger__thread-info">
                        <div className="docked-messenger__thread-name">
                          <strong>{t.peerName}</strong>
                          {t.lastMessageAt && (
                            <span className="docked-messenger__thread-time">
                              {new Date(t.lastMessageAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                        </div>
                        {t.lastMessage && (
                          <p className="docked-messenger__thread-preview">{t.lastMessage}</p>
                        )}
                      </div>
                      {t.unread > 0 && (
                        <span className="docked-messenger__unread-dot">{t.unread}</span>
                      )}
                    </button>
                  ))}
                </div>
              )
            ) : (
              /* Chat View */
              <div className="docked-messenger__chat">
                <div className="docked-messenger__messages">
                  {messages.length === 0 && (
                    <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem', padding: '2rem 1rem' }}>
                      Start the conversation…
                    </p>
                  )}
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`docked-messenger__msg ${m.isOwn ? 'docked-messenger__msg--own' : ''}`}
                    >
                      <div className="docked-messenger__msg-bubble">
                        <p>{m.text}</p>
                        <span className="docked-messenger__msg-time">
                          {new Date(m.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>
              </div>
            )}
          </div>

          {/* Input (only in chat view) */}
          {activeThread && (
            <div className="docked-messenger__input-bar">
              <input
                ref={inputRef}
                className="docked-messenger__input"
                placeholder="Write a message…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                aria-label="Type a message"
              />
              <button
                type="button"
                className="docked-messenger__send"
                onClick={sendMessage}
                disabled={!draft.trim()}
                aria-label="Send message"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>send</span>
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default DockedMessenger;
