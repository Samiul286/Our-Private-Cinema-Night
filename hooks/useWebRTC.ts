import { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from './useSocket';

interface PeerConnection {
  id: string;
  connection: RTCPeerConnection;
  stream?: MediaStream;
}

export const useWebRTC = (roomId: string, userId: string) => {
  const socket = useSocket();
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<{ [peerId: string]: MediaStream }>({});
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [connectionStates, setConnectionStates] = useState<{ [peerId: string]: string }>({});

  const peerConnections = useRef<{ [peerId: string]: RTCPeerConnection }>({});
  const localStreamRef = useRef<MediaStream | null>(null);
  const reconnectTimeouts = useRef<{ [peerId: string]: NodeJS.Timeout }>({});
  const isPageVisible = useRef(true);

  const configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun.stunprotocol.org:3478' }
    ],
    iceCandidatePoolSize: 10
  };

  const cleanupPeerConnection = useCallback((peerId: string) => {
    const pc = peerConnections.current[peerId];
    if (pc) {
      pc.close();
      delete peerConnections.current[peerId];
      setRemoteStreams(prev => {
        const newStreams = { ...prev };
        delete newStreams[peerId];
        return newStreams;
      });
      setConnectionStates(prev => {
        const newStates = { ...prev };
        delete newStates[peerId];
        return newStates;
      });
    }
  }, []);

  const initializeMedia = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error('getUserMedia is not supported');
      return null;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true
        }
      });

      localStreamRef.current = stream;
      setLocalStream(stream);

      // Initial track states
      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];
      if (videoTrack) setIsVideoEnabled(videoTrack.enabled);
      if (audioTrack) setIsAudioEnabled(audioTrack.enabled);

      return stream;
    } catch (error) {
      console.error('Error accessing media:', error);
      return null;
    }
  }, []);

  const createPeerConnection = useCallback((peerId: string) => {
    // Check if we have an existing connection that works
    const existingPc = peerConnections.current[peerId];
    if (existingPc && existingPc.connectionState !== 'closed' && existingPc.connectionState !== 'failed') {
      return existingPc;
    }

    // If existing but bad, clean it up
    if (existingPc) {
      cleanupPeerConnection(peerId);
    }

    const peerConnection = new RTCPeerConnection(configuration);

    // Add local tracks
    const stream = localStreamRef.current;
    if (stream) {
      stream.getTracks().forEach(track => {
        peerConnection.addTrack(track, stream);
      });
    }

    // Handle remote tracks
    peerConnection.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteStream) {
        setRemoteStreams(prev => ({
          ...prev,
          [peerId]: remoteStream
        }));
      }
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('signal', {
          roomId,
          to: peerId,
          signal: {
            type: 'ice-candidate',
            from: userId,
            data: event.candidate
          }
        });
      }
    };

    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;
      setConnectionStates(prev => ({
        ...prev,
        [peerId]: state
      }));
      if (state === 'failed' || state === 'closed') {
        cleanupPeerConnection(peerId);
      }
    };

    peerConnections.current[peerId] = peerConnection;
    return peerConnection;
  }, [roomId, userId, socket, cleanupPeerConnection]);

  // Handle incoming signals
  useEffect(() => {
    if (!socket || !roomId || !userId) return;

    const handleSignal = async (payload: { from: string, type: string, data: any }) => {
      const { from: peerId, type, data } = payload;
      if (peerId === userId) return;

      console.log(`Received ${type} from ${peerId}`);

      try {
        if (type === 'offer') {
          // If we receive an offer, we should accept it.
          // If we have an existing connection, it might be a glare or Renegotiation.
          // Since we have a strict "who initiates" logic in VideoCall.tsx, if we receive an offer, 
          // we are likely the "receiver" side (or glare causing reset).
          // Safest strategy for this app: Always accept new offer by resetting/using appropriate PC.

          // Simplify: always use createPeerConnection which ensures valid state
          let peerConnection = createPeerConnection(peerId);

          if (!peerConnection) return;

          // Avoid "OperationError: Failed to set remote offer sdp: Called in wrong state: kStable"
          // If we are already stable, we can accept offer. 
          // If we have local offer (glare), we need to decide. 
          // But our strict initiator logic should prevent most glares unless network race.

          // Re-create PC if we are in a bad state
          if (peerConnection.signalingState !== 'stable' && peerConnection.signalingState !== 'have-remote-offer') {
            // Hard reset if checking state is too complex for this snippet
            // Ideally we just setRemoteDescription.
            // If it fails, catch block catches it.
          }

          await peerConnection.setRemoteDescription(new RTCSessionDescription(data));
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);

          socket.emit('signal', {
            roomId,
            to: peerId,
            signal: {
              type: 'answer',
              from: userId,
              data: answer
            }
          });

        } else if (type === 'answer') {
          const peerConnection = peerConnections.current[peerId];
          if (peerConnection) {
            if (peerConnection.signalingState === 'have-local-offer') {
              await peerConnection.setRemoteDescription(new RTCSessionDescription(data));
            } else {
              console.warn(`Received answer in ${peerConnection.signalingState} state - ignoring`);
            }
          }
        } else if (type === 'ice-candidate') {
          const peerConnection = peerConnections.current[peerId];
          if (peerConnection) {
            try {
              await peerConnection.addIceCandidate(new RTCIceCandidate(data));
            } catch (e) {
              console.warn("Error adding ICE candidate:", e);
            }
          }
        }
      } catch (error) {
        console.error(`Error handling signal ${type}:`, error);
      }
    };

    socket.on('signal', handleSignal);

    // Also listen for user disconnected to cleanup
    const handleUserDisconnected = (disconnectedUserId: string) => {
      cleanupPeerConnection(disconnectedUserId);
    };
    socket.on('user-disconnected', handleUserDisconnected);

    // If a new user connects, we might want to initiate a call? 
    // In the old code, `startCall` was manual?
    // Let's check `startCall` usage.
    // The old code had `startCall` which created an offer.

    return () => {
      socket.off('signal', handleSignal);
      socket.off('user-disconnected', handleUserDisconnected);
    };
  }, [socket, roomId, userId, createPeerConnection, cleanupPeerConnection]);


  const startCall = useCallback(async (peerId: string) => {
    if (!localStreamRef.current) {
      console.warn('No local stream');
      return;
    }

    try {
      const peerConnection = createPeerConnection(peerId);
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      socket.emit('signal', {
        roomId,
        to: peerId,
        signal: {
          type: 'offer',
          from: userId,
          data: offer
        }
      });
    } catch (e) {
      console.error('Error starting call:', e);
    }
  }, [socket, roomId, userId, createPeerConnection]);

  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const track = localStreamRef.current.getVideoTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        setIsVideoEnabled(track.enabled);
      }
    }
  }, []);

  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      const track = localStreamRef.current.getAudioTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        setIsAudioEnabled(track.enabled);
      }
    }
  }, []);

  // Reconnect a specific peer connection
  const reconnectPeer = useCallback(async (peerId: string) => {
    console.log(`Attempting to reconnect to peer: ${peerId}`);
    
    // Clear any existing reconnect timeout
    if (reconnectTimeouts.current[peerId]) {
      clearTimeout(reconnectTimeouts.current[peerId]);
      delete reconnectTimeouts.current[peerId];
    }

    // Clean up old connection
    cleanupPeerConnection(peerId);

    // Wait a bit before reconnecting
    await new Promise(resolve => setTimeout(resolve, 500));

    // Reinitiate the call if we're the initiator
    if (userId < peerId) {
      console.log(`Reinitiating call to ${peerId}`);
      startCall(peerId);
    }
  }, [userId, cleanupPeerConnection, startCall]);

  // Monitor connection health and reconnect if needed
  useEffect(() => {
    const checkInterval = setInterval(() => {
      if (!isPageVisible.current) return;

      Object.entries(peerConnections.current).forEach(([peerId, pc]) => {
        const state = pc.connectionState;
        
        if (state === 'failed' || state === 'disconnected') {
          console.log(`Connection ${state} for peer ${peerId}, scheduling reconnect`);
          
          // Avoid multiple reconnect attempts
          if (!reconnectTimeouts.current[peerId]) {
            reconnectTimeouts.current[peerId] = setTimeout(() => {
              reconnectPeer(peerId);
            }, 2000);
          }
        }
      });
    }, 3000);

    return () => clearInterval(checkInterval);
  }, [reconnectPeer]);

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = async () => {
      const isVisible = !document.hidden;
      isPageVisible.current = isVisible;

      if (isVisible) {
        console.log('Page became visible, checking connections...');
        
        // Wait a moment for browser to restore resources
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Check if local stream tracks are still active
        if (localStreamRef.current) {
          const videoTrack = localStreamRef.current.getVideoTracks()[0];
          const audioTrack = localStreamRef.current.getAudioTracks()[0];

          // Restart tracks if they're ended
          if ((videoTrack && videoTrack.readyState === 'ended') || 
              (audioTrack && audioTrack.readyState === 'ended')) {
            console.log('Local stream tracks ended, reinitializing media...');
            const newStream = await initializeMedia();
            
            if (newStream) {
              // Replace tracks in all peer connections
              Object.values(peerConnections.current).forEach(pc => {
                const senders = pc.getSenders();
                newStream.getTracks().forEach(track => {
                  const sender = senders.find(s => s.track?.kind === track.kind);
                  if (sender) {
                    sender.replaceTrack(track).catch(err => 
                      console.error('Error replacing track:', err)
                    );
                  }
                });
              });
            }
          }
        }

        // Check all peer connections and reconnect if needed
        Object.entries(peerConnections.current).forEach(([peerId, pc]) => {
          const state = pc.connectionState;
          console.log(`Peer ${peerId} connection state: ${state}`);
          
          if (state === 'failed' || state === 'disconnected' || state === 'closed') {
            reconnectPeer(peerId);
          } else if (state === 'connected') {
            // Verify we're still receiving data
            const receivers = pc.getReceivers();
            const hasActiveTrack = receivers.some(r => r.track && r.track.readyState === 'live');
            
            if (!hasActiveTrack && !remoteStreams[peerId]) {
              console.log(`No active tracks for peer ${peerId}, reconnecting...`);
              reconnectPeer(peerId);
            }
          }
        });
      } else {
        console.log('Page hidden');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      // Clear all reconnect timeouts
      Object.values(reconnectTimeouts.current).forEach(timeout => clearTimeout(timeout));
    };
  }, [initializeMedia, reconnectPeer, remoteStreams]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Stop all tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      
      // Close all peer connections
      Object.keys(peerConnections.current).forEach(peerId => {
        cleanupPeerConnection(peerId);
      });
    };
  }, [cleanupPeerConnection]);

  return {
    localStream,
    remoteStreams,
    isVideoEnabled,
    isAudioEnabled,
    connectionStates,
    initializeMedia,
    startCall,
    toggleVideo,
    toggleAudio
  };
};