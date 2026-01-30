import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
  const [roomId, setRoomId] = useState('');
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const generateRoomId = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const createRoom = () => {
    if (!username.trim()) return;
    setIsLoading(true);
    const newRoomId = generateRoomId();
    window.location.href = `/room/${newRoomId}?username=${encodeURIComponent(username.trim())}`;
  };

  const joinRoom = () => {
    if (!username.trim() || !roomId.trim()) return;
    setIsLoading(true);
    window.location.href = `/room/${roomId.trim()}?username=${encodeURIComponent(username.trim())}`;
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-couple-background relative overflow-hidden">
      <Head>
        <title>Watch Party - Together Forever</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
      </Head>

      {/* Decorative Hearts */}
      <div className="absolute top-[10%] left-[5%] animate-float opacity-20">
        <svg className="w-16 h-16 text-couple-pink" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
      </div>
      <div className="absolute bottom-[15%] right-[8%] animate-float opacity-10" style={{ animationDelay: '1s' }}>
        <svg className="w-24 h-24 text-couple-deep" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
      </div>

      <div className="w-full max-w-lg z-10 animate-fade-up">
        {/* Header Section */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-white/50 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/40 mb-6 animate-heartbeat">
            <span className="text-couple-pink">❤️</span>
            <span className="text-[12px] font-bold uppercase tracking-widest text-couple-secondary">Made for us</span>
          </div>
          <h1 className="text-[42px] leading-tight font-black text-couple-text mb-4">
            Our Private <br /><span className="text-couple-pink">Cinema</span> Night
          </h1>
          <p className="text-couple-secondary font-medium px-8 text-lg opacity-80">
            Stream your favorite movies together, because every second is better with you.
          </p>
        </div>

        {/* Auth Selection */}
        <div className="love-card p-10 relative">
          {/* Tabs */}
          <div className="flex bg-couple-soft/50 p-1.5 rounded-[20px] mb-8">
            <button
              onClick={() => setActiveTab('create')}
              className={`flex-1 py-3 rounded-[16px] font-bold text-sm transition-all duration-300 ${activeTab === 'create' ? 'bg-white text-couple-pink shadow-sm' : 'text-couple-secondary opacity-60'}`}
            >
              Start New Night
            </button>
            <button
              onClick={() => setActiveTab('join')}
              className={`flex-1 py-3 rounded-[16px] font-bold text-sm transition-all duration-300 ${activeTab === 'join' ? 'bg-white text-couple-pink shadow-sm' : 'text-couple-secondary opacity-60'}`}
            >
              Enter Room
            </button>
          </div>

          <div className="space-y-6">
            <div>
              <label className="love-label">Your Name</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="What is your name? ❤️"
                className="love-input"
              />
            </div>

            {activeTab === 'join' && (
              <div className="animate-fade-up">
                <label className="love-label">Secret Room Code</label>
                <input
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  placeholder="EX: LOVE-24"
                  className="love-input italic uppercase tracking-widest"
                />
              </div>
            )}

            <button
              onClick={activeTab === 'create' ? createRoom : joinRoom}
              disabled={isLoading || !username.trim() || (activeTab === 'join' && !roomId.trim())}
              className="love-button-primary w-full"
            >
              {isLoading ? (
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                activeTab === 'create' ? 'Create Our Sanctuary' : 'Join Our Sanctuary'
              )}
            </button>
          </div>

          {/* Special Decor */}
          <div className="absolute -top-4 -right-4 w-12 h-12 bg-couple-pink rounded-full flex items-center justify-center text-white shadow-lg -rotate-12 border-4 border-white">
            ✨
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center space-y-2">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-couple-secondary opacity-40">
            Encrypted & Private for couples only
          </p>
          <p className="text-[12px] font-bold text-couple-secondary opacity-60">
            Copyright © 2026 It'z Sami
          </p>
        </div>
      </div>
    </div>
  );
}
