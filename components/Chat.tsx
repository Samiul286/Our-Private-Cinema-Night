import { useState, useEffect, useRef } from 'react';
import { ChatMessage } from '@/types';

interface ChatProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  currentUserId: string;
}

export default function Chat({ messages, onSendMessage, currentUserId }: ChatProps) {
  const [newMessage, setNewMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollRef.current;
    if (container) {
      const isNearBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 100;
      const lastMessage = messages[messages.length - 1];
      const isMe = lastMessage?.userId === currentUserId;

      if (isNearBottom || isMe) {
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
      }
    }
  }, [messages, currentUserId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim()) {
      onSendMessage(newMessage);
      setNewMessage('');
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full min-h-0 love-card bg-white shadow-love-lg">
      {/* Chat Header */}
      <div className="px-4 py-2 border-b border-couple-soft flex items-center justify-between bg-gradient-to-r from-white to-couple-soft/30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-couple-pink/10 flex items-center justify-center text-couple-pink">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
          </div>
          <div>
            <h3 className="font-bold text-[16px] text-couple-text">Sweet Talk</h3>
            <p className="text-[10px] font-black text-couple-pink uppercase tracking-widest">Only for us</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 smooth-scroll bg-[#FFF9FB]">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="w-16 h-16 bg-couple-soft rounded-full flex items-center justify-center mb-4 animate-float">
              💖
            </div>
            <h4 className="font-bold text-couple-text">A quiet moment...</h4>
            <p className="text-sm text-couple-secondary opacity-60">Start our sweet talk whenever you're ready.</p>
          </div>
        ) : (
          messages.map((message, idx) => {
            const isMe = message.userId === currentUserId;
            const prevMsg = idx > 0 ? messages[idx - 1] : null;
            const sameAuthor = prevMsg?.userId === message.userId;

            return (
              <div
                key={message.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} ${sameAuthor ? 'mt-1' : 'mt-4'}`}
              >
                {!sameAuthor && (
                  <span className="text-[10px] font-black text-couple-secondary opacity-40 uppercase tracking-widest mb-1.5 px-2">
                    {isMe ? 'My Heart' : message.username}
                  </span>
                )}
                <div
                  className={`max-w-[85%] px-4 py-2 rounded-[18px] text-[15px] leading-snug shadow-sm relative group transition-all duration-300 ${isMe
                    ? 'bg-couple-pink text-white rounded-tr-[4px]'
                    : 'bg-white text-couple-text rounded-tl-[4px] border border-couple-soft'
                    }`}
                >
                  {message.message}

                  {/* Heart Reaction Glow */}
                  <div className="absolute -right-2 -bottom-2 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">
                    💌
                  </div>
                </div>
                {idx === messages.length - 1 && (
                  <span className="text-[9px] text-couple-secondary opacity-40 mt-1 px-2 font-black uppercase">
                    {formatTime(message.timestamp)}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Message Input */}
      <form onSubmit={handleSubmit} className="p-2 bg-white border-t border-couple-soft">
        <div className="flex items-center gap-2 bg-couple-soft/50 rounded-[18px] p-1 pl-3 focus-within:bg-white focus-within:ring-2 focus-within:ring-couple-pink/10 transition-all">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your heart out..."
            className="flex-1 bg-transparent py-1.5 text-[14px] outline-none"
            maxLength={500}
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="w-8 h-8 flex items-center justify-center bg-couple-pink text-white rounded-[14px] disabled:opacity-20 transition-all active:scale-90 shadow-md"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}
