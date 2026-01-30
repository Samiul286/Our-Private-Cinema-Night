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
    <div className="fixed inset-0 lg:static lg:min-h-screen flex flex-col bg-couple-background font-love lg:pb-20 overflow-hidden lg:overflow-visible">
      <Head>
        <title>Our Cinema Night - {roomId}</title>
      </Head>

      {/* Love Nav Bar */}
      <header className="love-nav-bar shrink-0 ring-1 ring-white/20 h-14 sm:h-16 px-3 sm:px-6 z-20 relative">
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

      <main className="flex-1 max-w-7xl w-full mx-auto lg:px-6 lg:pt-10 lg:pb-10 overflow-hidden lg:overflow-visible">
        <div className="flex flex-col lg:grid lg:grid-cols-12 lg:gap-10 items-start h-full lg:h-auto pb-4 lg:pb-0">

          {/* 1. Video Player Section */}
          <div className="w-full lg:col-span-8 order-1 shrink-0 bg-couple-background lg:bg-transparent z-10 p-3 sm:p-0">
            <VideoPlayer
              videoState={videoState}
              onStateChange={updateVideoState}
              userId={userId}
            />
          </div>

          {/* 2. Chat & Sidebar Section */}
          <div className="w-full order-2 lg:order-2 lg:col-span-4 lg:row-span-2 lg:sticky lg:top-24 flex-1 lg:flex-none min-h-0 flex flex-col h-[40vh] lg:h-auto lg:max-h-[calc(100vh-150px)]">
            {/* Sweet Talk - Smaller Chat */}
            <div className="h-[40vh] lg:h-[350px] mb-4 lg:mb-6">
              <Chat
                messages={messages}
                onSendMessage={sendMessage}
                currentUserId={userId}
                className="h-full rounded-[24px] border border-couple-soft lg:border-none shadow-sm lg:shadow-love-lg mx-3 lg:mx-0"
              />
            </div>

            {/* Togetherness Card - Desktop Only - Reduced Height */}
            <div className="love-card p-4 hidden lg:block shrink-0">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-black text-[14px] text-couple-text">Our Private Space</h3>
                  <p className="text-[9px] font-black text-couple-pink uppercase tracking-widest">Always better with you</p>
                </div>
                <div className="bg-couple-soft text-couple-pink w-8 h-8 rounded-full flex items-center justify-center font-black text-sm">
                  {users.length}
                </div>
              </div>

              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {users.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-2 rounded-[16px] bg-couple-soft/30 border border-white/40">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-couple-pink to-couple-deep flex items-center justify-center text-white font-black text-xs shadow-md">
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <span className="font-bold text-[13px] block text-couple-text">
                          {user.username} {user.id === userId && "(Me)"}
                        </span>
                        <span className="text-[9px] font-black text-couple-secondary opacity-60 uppercase tracking-tighter">
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

          {/* 3. Video Call Section */}
          <div className="w-full lg:col-span-8 order-3 lg:order-3 shrink-0 p-3 lg:p-0 mt-2 lg:mt-0">
            <div className="lg:love-card lg:p-6">
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
