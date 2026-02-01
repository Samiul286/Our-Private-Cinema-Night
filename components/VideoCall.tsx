import { useEffect, useRef, useState, useCallback } from 'react';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useSocket } from '@/hooks/useSocket';
import { User } from '@/types';

interface VideoCallProps {
    roomId: string;
    userId: string;
    users: User[];
    onLeave?: () => void;
}

export default function VideoCall({ roomId, userId, users, onLeave }: VideoCallProps) {
    const socket = useSocket();
    const {
        localStream,
        remoteStreams,
        isVideoEnabled,
        isAudioEnabled,
        initializeMedia,
        startCall,
        toggleVideo,
        toggleAudio
    } = useWebRTC(roomId, userId);

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const [permissionError, setPermissionError] = useState(false);
    const callInitiatedFor = useRef<Set<string>>(new Set());

    useEffect(() => {
        const init = async () => {
            const stream = await initializeMedia();
            if (!stream) {
                setPermissionError(true);
            }
        };
        init();
    }, [initializeMedia]);

    useEffect(() => {
        if (localStream && localVideoRef.current) {
            localVideoRef.current.srcObject = localStream;
            
            // Ensure local video plays
            localVideoRef.current.play().catch(err => {
                console.error('Error playing local video:', err);
            });
        }
    }, [localStream]);

    // Handle page visibility to restart video playback
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (!document.hidden && localVideoRef.current && localStream) {
                // Resume video playback when page becomes visible
                localVideoRef.current.play().catch(err => {
                    console.error('Error resuming local video:', err);
                });
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [localStream]);

    useEffect(() => {
        // Only proceed if we have local stream ready
        if (!localStream) {
            console.log('Waiting for local stream before initiating calls');
            return;
        }

        // Get current user IDs
        const currentUserIds = new Set(users.map(u => u.id));
        
        // Clean up tracking for users who are no longer in the room
        const trackedUserIds = Array.from(callInitiatedFor.current);
        trackedUserIds.forEach(trackedId => {
            if (!currentUserIds.has(trackedId) && trackedId !== userId) {
                console.log(`Removing tracking for disconnected user: ${trackedId}`);
                callInitiatedFor.current.delete(trackedId);
            }
        });

        // Start calls with other users
        // Use ID comparison to determine who initiates the call to avoid glare (collision)
        // consistently: the user with the lower string ID initiates.
        users.forEach(user => {
            if (user.id !== userId && !callInitiatedFor.current.has(user.id)) {
                // Determine initiator
                const shouldInitiate = userId < user.id;
                
                if (shouldInitiate) {
                    console.log(`I should initiate call to ${user.id} (I am ${userId})`);
                    callInitiatedFor.current.add(user.id);
                    // Add a small delay to ensure both sides are ready
                    setTimeout(() => {
                        startCall(user.id);
                    }, 500);
                } else {
                    console.log(`Waiting for call from ${user.id} (I am ${userId})`);
                }
            }
        });
    }, [users, userId, startCall, localStream]);

    // Listen for user-connected events to initiate calls immediately
    useEffect(() => {
        if (!localStream || !socket) return;

        const handleUserConnected = (connectedUserId: string) => {
            console.log(`User connected event: ${connectedUserId}`);
            
            if (connectedUserId !== userId && userId < connectedUserId && !callInitiatedFor.current.has(connectedUserId)) {
                console.log(`Initiating call to newly connected user ${connectedUserId}`);
                callInitiatedFor.current.add(connectedUserId);
                setTimeout(() => {
                    startCall(connectedUserId);
                }, 1000);
            }
        };

        const handleUserDisconnected = (disconnectedUserId: string) => {
            console.log(`User disconnected event in VideoCall: ${disconnectedUserId}`);
            // Clean up the call tracking for this user
            callInitiatedFor.current.delete(disconnectedUserId);
        };

        socket.on('user-connected', handleUserConnected);
        socket.on('user-disconnected', handleUserDisconnected);
        return () => {
            socket.off('user-connected', handleUserConnected);
            socket.off('user-disconnected', handleUserDisconnected);
        };
    }, [localStream, userId, startCall, socket]);

    const handleEndNight = () => {
        if (onLeave) {
            onLeave();
        } else {
            window.location.href = '/';
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                    <span className="text-xl">👩‍❤️‍👨</span>
                    <h3 className="font-extrabold text-[18px] text-couple-text">Our Private Space</h3>
                </div>
                <div className="love-glass-pill py-1">
                    <span className="text-[10px] font-black uppercase text-couple-pink animate-pulse">Live Now</span>
                </div>
            </div>

            {permissionError ? (
                <div className="love-card p-8 text-center bg-couple-soft/30 border-dashed border-2 border-couple-pink/20">
                    <p className="text-couple-text font-bold mb-4">I can't see your beautiful face!</p>
                    <button onClick={() => window.location.reload()} className="love-button-primary px-6 h-10 inline-flex">Allow Access</button>
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-4">
                    {/* Local Video */}
                    <div className="flex flex-col gap-2">
                        <div className="relative aspect-video rounded-2xl overflow-hidden bg-black shadow-love group border-2 border-white">
                            <video
                                ref={localVideoRef}
                                autoPlay
                                playsInline
                                muted
                                className="w-full h-full object-cover mirror transform transition-transform group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>

                            {!isVideoEnabled && (
                                <div className="absolute inset-0 flex items-center justify-center bg-couple-text/80 backdrop-blur-sm">
                                    <span className="text-4xl animate-heartbeat text-couple-pink">❤️</span>
                                </div>
                            )}
                        </div>
                        <div className="flex justify-center">
                            <span className="text-[12px] font-black uppercase text-couple-pink shadow-sm">You (My Love)</span>
                        </div>
                    </div>

                    {/* Remote Videos */}
                    {Object.entries(remoteStreams).map(([peerId, stream]) => {
                        const remoteUser = users.find(u => u.id === peerId);
                        return (
                            <div key={peerId} className="flex flex-col gap-2">
                                <div className="relative aspect-video rounded-2xl overflow-hidden bg-black shadow-love group border-2 border-white">
                                    <RemoteVideo stream={stream} />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                </div>
                                <div className="flex justify-center">
                                    <span className="text-[12px] font-black uppercase text-couple-pink shadow-sm">{remoteUser?.username || 'Soulmate'}</span>
                                </div>
                            </div>
                        );
                    })}

                    {/* Placeholder for waiting */}
                    {Object.keys(remoteStreams).length === 0 && users.length > 1 && (
                        <div className="relative aspect-video rounded-[32px] overflow-hidden bg-couple-soft flex flex-col items-center justify-center border-4 border-white border-dashed">
                            <div className="w-12 h-12 rounded-full border-2 border-couple-pink border-t-transparent animate-spin mb-3"></div>
                            <span className="text-[10px] font-black uppercase text-couple-pink">Waiting for your love...</span>
                        </div>
                    )}
                </div>
            )}

            {/* Control Strip */}
            <div className="flex justify-center pt-2">
                <div className="bg-white/80 backdrop-blur-xl p-2 sm:p-2.5 rounded-[20px] sm:rounded-[24px] border border-couple-soft flex items-center gap-3 sm:gap-4 px-4 sm:px-8 shadow-love-lg">
                    <button
                        onClick={toggleAudio}
                        className={`w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-[14px] sm:rounded-[18px] transition-all ${isAudioEnabled ? 'bg-couple-soft text-couple-text' : 'bg-couple-pink text-white shadow-lg shadow-couple-pink/40'}`}
                    >
                        {isAudioEnabled ? (
                            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                        ) : (
                            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
                        )}
                    </button>
                    <button
                        onClick={toggleVideo}
                        className={`w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-[14px] sm:rounded-[18px] transition-all ${isVideoEnabled ? 'bg-couple-soft text-couple-text' : 'bg-couple-pink text-white shadow-lg shadow-couple-pink/40'}`}
                    >
                        {isVideoEnabled ? (
                            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        ) : (
                            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                        )}
                    </button>
                    <div className="w-[1px] h-6 sm:h-8 bg-couple-soft"></div>
                    <button
                        onClick={handleEndNight}
                        className="love-button-primary h-9 sm:h-11 px-4 sm:px-6 rounded-[14px] sm:rounded-[16px] text-[10px] sm:text-xs uppercase tracking-widest font-black"
                    >
                        End Night
                    </button>
                </div>
            </div>
        </div>
    );
}

function RemoteVideo({ stream }: { stream: MediaStream }) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
            
            // Ensure video plays after stream is set
            const playVideo = async () => {
                try {
                    await videoRef.current?.play();
                    setIsPlaying(true);
                } catch (err) {
                    console.error('Error playing remote video:', err);
                    setIsPlaying(false);
                }
            };
            
            playVideo();

            // Monitor track status
            const handleTrackEnded = () => {
                console.log('Remote track ended');
                setIsPlaying(false);
            };

            stream.getTracks().forEach(track => {
                track.addEventListener('ended', handleTrackEnded);
            });

            return () => {
                stream.getTracks().forEach(track => {
                    track.removeEventListener('ended', handleTrackEnded);
                });
            };
        }
    }, [stream]);

    return (
        <>
            <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover transform transition-transform group-hover:scale-105"
            />
            {!isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center bg-couple-text/80 backdrop-blur-sm">
                    <div className="text-center">
                        <div className="w-12 h-12 rounded-full border-2 border-couple-pink border-t-transparent animate-spin mb-2 mx-auto"></div>
                        <span className="text-xs text-white font-bold">Reconnecting...</span>
                    </div>
                </div>
            )}
        </>
    );
}
