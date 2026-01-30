import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useRoom } from '@/hooks/useRoom';
import VideoPlayer from '@/components/VideoPlayer';
import Chat from '@/components/Chat';
import VideoCall from '@/components/VideoCall';

export default function Room() {
  const router = useRouter();
  const { roomId } = router.query;
  const [userId] = useState(() => {
    if (typeof window !== 'undefined') {
      let storedUserId = sessionStorage.getItem('watchPartyUserId');
      if (!storedUserId) {
        storedUserId = Math.random().toString(36).substring(2, 15);
        sessionStorage.setItem('watchPartyUserId', storedUserId);
      }
      return storedUserId;
    }
    return Math.random().toString(36).substring(2, 15);
  });
  const [username, setUsername] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (router.query.username) {
      setUsername(router.query.username as string);
    }
  }, [router.query.username]);

  const {
    videoState,
    messages,
    users,
    joinRoom,
    leaveRoom,
    updateVideoState,
    sendMessage
  } = useRoom(roomId as string, userId, username);

  useEffect(() => {
    if (roomId && username && !isJoined) {
      try {
        joinRoom();
        setIsJoined(true);
        setError(null);
      } catch (err) {
        setError('Failed to join room. Please try again.');
        console.error('Error joining room:', err);
      }
    }
  }, [roomId, username, joinRoom, isJoined]);

  useEffect(() => {
    if (router.isReady && !router.query.username) {
      router.push('/');
    }
  }, [router]);

  if (!roomId || !username) {
    return (
      <div className="min-h-screen bg-couple-background flex flex-col items-center justify-center">
        <div className="w-16 h-16 bg-couple-pink rounded-full flex items-center justify-center animate-beat text-white shadow-love">
          ❤️
        </div>
        <p className="mt-6 font-bold text-couple-text tracking-widest uppercase text-sm animate-pulse">Entering our world...</p>
      </div>
    );
  }

  const copyRoomId = async () => {
    const textToCopy = roomId as string;
    let success = false;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(textToCopy);
        success = true;
      } else {
        // Fallback for non-HTTPS or unsupported browsers
        const textArea = document.createElement("textarea");
        textArea.value = textToCopy;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          success = document.execCommand('copy');
        } catch (err) {
          console.error('Fallback copy failed', err);
        }
        document.body.removeChild(textArea);
      }
    } catch (err) {
      console.error('Failed to copy', err);
    }

    if (success) {
      const notification = document.createElement('div');
      notification.className = 'fixed top-12 left-1/2 transform -translate-x-1/2 px-8 py-3 bg-white/90 backdrop-blur-xl rounded-full shadow-love-lg z-[100] font-bold text-[15px] animate-fade-up border border-couple-soft flex items-center gap-2';
      notification.innerHTML = `<span class="text-couple-pink">💋</span> Invite link copied!`;
      document.body.appendChild(notification);
      setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translate(-50%, -20px)';
        setTimeout(() => notification.remove(), 400);
      }, 2000);
    }
  };

  return (
    <div className="min-h-screen bg-couple-background font-love pb-20">
      <Head>
        <title>Our Cinema Night - {roomId}</title>
      </Head>

      {/* Love Nav Bar */}
      <header className="love-nav-bar ring-1 ring-white/20 h-14 sm:h-16 px-3 sm:px-6">
        <button
          onClick={() => { leaveRoom(); router.push('/'); }}
          className="flex items-center gap-1 sm:gap-2 text-couple-text font-bold hover:text-couple-pink transition-colors"
        >
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
          <span className="hidden xs:inline text-sm sm:text-base">Home</span>
        </button>

        <div className="flex flex-col items-center">
          <h2 className="font-extrabold text-[15px] sm:text-[18px] text-couple-text leading-tight uppercase tracking-tight">Our Secret Night</h2>
          <span className="text-[8px] sm:text-[10px] uppercase font-black tracking-[0.15em] text-couple-pink bg-couple-soft px-2 rounded-full">Private Room</span>
        </div>

        <button
          onClick={copyRoomId}
          className="love-button-primary h-9 sm:h-10 px-3 sm:px-6 rounded-full text-[10px] sm:text-xs tracking-tight sm:tracking-normal"
        >
          Invite <span className="hidden xs:inline">My Love</span>
        </button>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10 animate-fade-up pb-10">
        <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 lg:gap-10 items-start">

          {/* 1. Video Player (Col 8) */}
          <div className="w-full lg:col-span-8 lg:order-1">
            <div className="space-y-6">
              <VideoPlayer
                videoState={videoState}
                onStateChange={updateVideoState}
                userId={userId}
              />
            </div>
          </div>

          {/* 2. Chat & Sidebar (Col 4) */}
          <div className="w-full lg:col-span-4 lg:order-2 lg:sticky lg:top-24 space-y-6 lg:space-y-10">
            <div className="h-[250px] sm:h-[550px] lg:h-[calc(100vh-250px)]">
              <Chat
                messages={messages}
                onSendMessage={sendMessage}
                currentUserId={userId}
              />
            </div>

            {/* Togetherness Card */}
            <div className="love-card p-5 sm:p-6 hidden sm:block">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-black text-[16px] sm:text-[18px] text-couple-text">Together Now</h3>
                  <p className="text-[10px] font-black text-couple-pink uppercase tracking-widest">Always better with you</p>
                </div>
                <div className="bg-couple-soft text-couple-pink w-10 h-10 rounded-full flex items-center justify-center font-black">
                  {users.length}
                </div>
              </div>

              <div className="space-y-3">
                {users.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-3 rounded-[20px] bg-couple-soft/30 border border-white/40">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-couple-pink to-couple-deep flex items-center justify-center text-white font-black text-xs shadow-md">
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <span className="font-bold text-[14px] block text-couple-text">
                          {user.username} {user.id === userId && "(Me)"}
                        </span>
                        <span className="text-[10px] font-black text-couple-secondary opacity-60 uppercase tracking-tighter">
                          {user.id === userId ? 'Directing' : 'Enjoying'}
                        </span>
                      </div>
                    </div>
                    {user.id === userId && (
                      <div className="w-2 h-2 bg-couple-pink rounded-full animate-pulse shadow-[0_0_10px_#FF2D55]"></div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 3. Video Call (Col 8) - Wraps to next row on desktop */}
          <div className="w-full lg:col-span-8 lg:order-3">
            <div className="love-card p-4 sm:p-6">
              <VideoCall
                roomId={roomId as string}
                userId={userId}
                users={users}
                onLeave={() => {
                  leaveRoom();
                  router.push('/');
                }}
              />
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
