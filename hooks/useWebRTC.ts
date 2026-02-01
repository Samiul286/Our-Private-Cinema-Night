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
  const initiatedCalls = useRef<Set<string>>(new Set());

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
    // Clear initiated call tracking
    initiatedCalls.current.delete(peerId);
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
    console.log(`Creating peer connection for ${peerId}`);
    
    // Check if we have an existing connection that works
    const existingPc = peerConnections.current[peerId];
    if (existingPc) {
      const state = existingPc.connectionState;
      console.log(`Existing connection state for ${peerId}: ${state}`);
      
      if (state === 'connected' || state === 'connecting') {
        console.log(`Reusing existing connection for ${peerId}`);
        return existingPc;
      }
      
      // If existing but bad, clean it up
      console.log(`Cleaning up bad connection for ${peerId}`);
      cleanupPeerConnection(peerId);
    }

    console.log(`Creating new RTCPeerConnection for ${peerId}`);
    const peerConnection = new RTCPeerConnection(configuration);

    // Add local tracks
    const stream = localStreamRef.current;
    if (stream) {
      console.log(`Adding ${stream.getTracks().length} local tracks to peer connection`);
      stream.getTracks().forEach(track => {
        console.log(`Adding ${track.kind} track to peer ${peerId}`);
        peerConnection.addTrack(track, stream);
      });
    } else {
      console.warn(`No local stream available when creating peer connection for ${peerId}`);
    }

    // Handle remote tracks
    peerConnection.ontrack = (event) => {
      console.log(`Received ${event.track.kind} track from ${peerId}`);
      const [remoteStream] = event.streams;
      if (remoteStream) {
        console.log(`Setting remote stream for ${peerId}`);
        setRemoteStreams(prev => ({
          ...prev,
          [peerId]: remoteStream
        }));
      }
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`Sending ICE candidate to ${peerId}`);
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

    peerConnection.oniceconnectionstatechange = () => {
      console.log(`ICE connection state for ${peerId}: ${peerConnection.iceConnectionState}`);
    };

    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;
      console.log(`Connection state for ${peerId}: ${state}`);
      setConnectionStates(prev => ({
        ...prev,
        [peerId]: state
      }));
      if (state === 'failed' || state === 'closed') {
        console.log(`Connection ${state} for ${peerId}, cleaning up`);
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
          console.log(`Processing offer from ${peerId}`);
          
          // Create or get peer connection
          let peerConnection = createPeerConnection(peerId);

          if (!peerConnection) {
            console.error('Failed to create peer connection');
            return;
          }

          // Check signaling state before setting remote description
          console.log(`Current signaling state: ${peerConnection.signalingState}`);
          
          if (peerConnection.signalingState !== 'stable') {
            console.log(`Resetting peer connection due to signaling state: ${peerConnection.signalingState}`);
            cleanupPeerConnection(peerId);
            peerConnection = createPeerConnection(peerId);
          }

          await peerConnection.setRemoteDescription(new RTCSessionDescription(data));
          console.log(`Set remote description for ${peerId}`);
          
          const answer = await peerConnection.createAnswer();
          console.log(`Created answer for ${peerId}`);
          
          await peerConnection.setLocalDescription(answer);
          console.log(`Set local description for ${peerId}`);

          socket.emit('signal', {
            roomId,
            to: peerId,
            signal: {
              type: 'answer',
              from: userId,
              data: answer
            }
          });
          console.log(`Sent answer to ${peerId}`);

        } else if (type === 'answer') {
          console.log(`Processing answer from ${peerId}`);
          const peerConnection = peerConnections.current[peerId];
          
          if (!peerConnection) {
            console.warn(`No peer connection found for ${peerId}`);
            return;
          }

          console.log(`Current signaling state: ${peerConnection.signalingState}`);
          
          if (peerConnection.signalingState === 'have-local-offer') {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data));
            console.log(`Set remote description (answer) for ${peerId}`);
          } else {
            console.warn(`Received answer in ${peerConnection.signalingState} state - ignoring`);
          }
          
        } else if (type === 'ice-candidate') {
          const peerConnection = peerConnections.current[peerId];
          if (peerConnection) {
            try {
              await peerConnection.addIceCandidate(new RTCIceCandidate(data));
              console.log(`Added ICE candidate from ${peerId}`);
            } catch (e) {
              console.warn("Error adding ICE candidate:", e);
            }
          } else {
            console.warn(`No peer connection found for ICE candidate from ${peerId}`);
          }
        }
      } catch (error) {
        console.error(`Error handling signal ${type} from ${peerId}:`, error);
      }
    };

    socket.on('signal', handleSignal);

    // Also listen for user disconnected to cleanup
    const handleUserDisconnected = (disconnectedUserId: string) => {
      console.log(`Cleaning up connection for disconnected user: ${disconnectedUserId}`);
      cleanupPeerConnection(disconnectedUserId);
    };
    socket.on('user-disconnected', handleUserDisconnected);

    return () => {
      socket.off('signal', handleSignal);
      socket.off('user-disconnected', handleUserDisconnected);
    };
  }, [socket, roomId, userId, createPeerConnection, cleanupPeerConnection]);


  const startCall = useCallback(async (peerId: string) => {
    if (!localStreamRef.current) {
      console.warn('No local stream available to start call');
      return;
    }

    // Prevent duplicate call initiations
    if (initiatedCalls.current.has(peerId)) {
      console.log(`Call already initiated to ${peerId}, skipping`);
      return;
    }

    try {
      console.log(`Starting call to ${peerId}`);
      initiatedCalls.current.add(peerId);
      
      const peerConnection = createPeerConnection(peerId);
      
      if (!peerConnection) {
        console.error('Failed to create peer connection');
        initiatedCalls.current.delete(peerId);
        return;
      }
      
      console.log(`Creating offer for ${peerId}`);
      const offer = await peerConnection.createOffer();
      
      console.log(`Setting local description for ${peerId}`);
      await peerConnection.setLocalDescription(offer);

      console.log(`Sending offer to ${peerId}`);
      socket.emit('signal', {
        roomId,
        to: peerId,
        signal: {
          type: 'offer',
          from: userId,
          data: offer
        }
      });
      
      console.log(`Offer sent successfully to ${peerId}`);
    } catch (e) {
      console.error('Error starting call:', e);
      initiatedCalls.current.delete(peerId);
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
    toggleAudio,
    reconnectPeer
  };
};