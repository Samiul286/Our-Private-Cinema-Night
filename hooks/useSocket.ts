import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

let socket: Socket | null = null;

export const getSocket = () => {
    if (!socket) {
        socket = io(SOCKET_URL, {
            transports: ['websocket'],
            autoConnect: true
        });
        console.log('Initializing socket connection...');
    }
    return socket;
};

export const useSocket = () => {
    const socketRef = useRef<Socket | null>(null);

    if (!socketRef.current) {
        socketRef.current = getSocket();
    }

    useEffect(() => {
        // Any specific cleanup when component unmounts?
        // Usually we keep the socket open for the session.
        // If we want to disconnect on unmount of the *app*, we can do it in _app.tsx
    }, []);

    return socketRef.current;
};
