# Watch Party Web App
Made by It'z Sami

A serverless watch party application similar to 'Closer' that allows users to watch videos together in real-time with synchronized playback, chat, and video calling features.

## Features

- **Room System**: Create or join rooms with unique Room IDs
- **Video Synchronization**: Real-time synchronized video playback across all participants
- **Real-time Chat**: Text messaging with all room participants
- **Video/Audio Calling**: WebRTC-based video calls with camera and microphone controls
- **Firebase Integration**: Serverless backend using Firebase Realtime Database

## Tech Stack

- **Frontend**: Next.js (React) with TypeScript
- **Styling**: Tailwind CSS
- **Database**: Firebase Realtime Database
- **Video Player**: react-player
- **WebRTC**: Native WebRTC API for video/audio calls
- **Real-time Communication**: Firebase Realtime Database for signaling

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Enable Realtime Database
4. Get your Firebase configuration
5. Update `lib/firebase.ts` with your Firebase config:

```typescript
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project-default-rtdb.firebaseio.com/",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};
```

### 3. Firebase Database Rules

Set up your Firebase Realtime Database rules for development:

```json
{
  "rules": {
    "rooms": {
      "$roomId": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

**Note**: These rules are permissive for development. In production, implement proper authentication and security rules.

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## How It Works

### Room System
- Users can create a new room (generates unique Room ID) or join an existing room
- All room data is stored under `/rooms/{roomID}` in Firebase Realtime Database

### Video Synchronization
- Uses `react-player` for video playback
- Video state (play/pause, current time, URL) is stored in Firebase under `/rooms/{roomID}/videoState`
- All participants subscribe to video state changes and sync their players automatically
- Prevents sync loops by tracking who initiated the state change

### Real-time Chat
- Messages stored under `/rooms/{roomID}/messages`
- Real-time updates using Firebase's `onValue` listener
- Auto-scrolling to latest messages

### WebRTC Video Calling
- Uses Firebase Realtime Database as signaling server
- Exchanges WebRTC offers, answers, and ICE candidates through Firebase
- Supports multiple peer connections in a mesh topology
- Camera and microphone controls with mute/unmute functionality

## Project Structure

```
├── components/
│   ├── VideoPlayer.tsx    # Synchronized video player component
│   ├── Chat.tsx          # Real-time chat component
│   └── VideoCall.tsx     # WebRTC video calling component
├── hooks/
│   ├── useRoom.ts        # Room management and Firebase integration
│   └── useWebRTC.ts      # WebRTC functionality
├── lib/
│   └── firebase.ts       # Firebase configuration
├── pages/
│   ├── index.tsx         # Home page (create/join room)
│   └── room/[roomId].tsx # Room page
├── types/
│   └── index.ts          # TypeScript type definitions
└── styles/
    └── globals.css       # Global styles with Tailwind
```

## Key Components

### VideoPlayer Component
- Handles video URL input and playback
- Synchronizes play/pause/seek events across all participants
- Prevents infinite sync loops with local update tracking

### Chat Component
- Real-time messaging with timestamp display
- Auto-scrolling to new messages
- Message history persistence

### VideoCall Component
- WebRTC peer-to-peer video calling
- Camera and microphone controls
- Participant grid layout
- Firebase-based signaling

## Firebase Database Structure

```
rooms/
  {roomId}/
    videoState/
      isPlaying: boolean
      playedSeconds: number
      url: string
      lastUpdated: timestamp
      updatedBy: userId
    users/
      {userId}/
        id: string
        username: string
        joinedAt: timestamp
    messages/
      {messageId}/
        userId: string
        username: string
        message: string
        timestamp: number
    signaling/
      {signalId}/
        type: "offer" | "answer" | "ice-candidate"
        from: userId
        to: userId
        offer/answer/candidate: RTCSessionDescription | RTCIceCandidate
        timestamp: number
```

## Supported Video Sources

The app supports any video source compatible with `react-player`:
- YouTube
- Vimeo
- Twitch
- SoundCloud
- Streamable
- Wistia
- Mixcloud
- DailyMotion
- Kaltura
- Direct video files (MP4, WebM, etc.)

## Browser Compatibility

- Modern browsers with WebRTC support
- HTTPS required for camera/microphone access in production
- Tested on Chrome, Firefox, Safari, and Edge

## Deployment

### Vercel (Recommended)
1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add your Firebase environment variables
4. Deploy

### Other Platforms
The app can be deployed to any platform that supports Next.js applications.

## Security Considerations

- Implement Firebase Authentication for production use
- Set up proper Firebase Security Rules
- Use HTTPS for WebRTC functionality
- Consider rate limiting for chat messages
- Implement room access controls if needed

## Future Enhancements

- User authentication and profiles
- Room passwords/privacy settings
- Screen sharing capability
- File sharing in chat
- Video quality controls
- Mobile app version
- Recording functionality

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - feel free to use this project for your own applications.