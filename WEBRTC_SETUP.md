# WebRTC Setup Guide

Your Watch Party app already has WebRTC fully configured! Here's how it works and how to ensure optimal performance.

## 🔧 Current WebRTC Architecture

### 1. **Peer-to-Peer Connection**
- Direct browser-to-browser video/audio streaming
- No media server required (serverless)
- Firebase Realtime Database as signaling server

### 2. **STUN Servers Configuration**
```typescript
const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.stunprotocol.org:3478' }
  ],
  iceCandidatePoolSize: 10
};
```

### 3. **Signaling Flow**
1. User A creates offer → Firebase
2. User B receives offer → creates answer → Firebase  
3. ICE candidates exchanged via Firebase
4. Direct P2P connection established

## 🚀 Testing WebRTC

### **Local Testing (Development)**
1. Open http://localhost:3000
2. Create a room in one browser tab
3. Join same room in another tab (or incognito)
4. Allow camera/microphone permissions
5. Video call should connect automatically

### **Network Testing (Production)**
1. Deploy to Vercel (HTTPS required)
2. Test from different networks/devices
3. Check connection status indicators

## 🔍 Debugging WebRTC

### **Browser Console Logs**
Open F12 Developer Tools to see:
- Media permission requests
- WebRTC connection states
- ICE candidate exchanges
- Error messages

### **Connection Status Indicators**
- 🟢 Green dot: Connected
- 🟡 Yellow dot: Connecting  
- 🔴 Red dot: Disconnected/Failed

### **Common Issues & Solutions**

#### **1. No Video/Audio**
```bash
# Check browser permissions
# Chrome: Settings > Privacy > Site Settings > Camera/Microphone
# Firefox: about:preferences#privacy
```

#### **2. Connection Fails**
- **Firewall**: May block WebRTC traffic
- **Corporate Network**: Often blocks P2P connections
- **NAT Issues**: STUN servers help with most cases

#### **3. HTTPS Required**
```bash
# Production deployment needs HTTPS
# Localhost works for development
# Use Vercel for easy HTTPS deployment
```

## 🌐 Production Deployment

### **Vercel Deployment (Recommended)**
```bash
# Your app is already configured for Vercel
# Just push to GitHub and connect to Vercel
# HTTPS is automatic
```

### **Firebase Security Rules**
```json
{
  "rules": {
    "rooms": {
      "$roomId": {
        ".read": true,
        ".write": true,
        "signaling": {
          ".indexOn": ["to", "from"]
        }
      }
    }
  }
}
```

## 📊 Performance Optimization

### **1. Bandwidth Management**
- Video quality auto-adjusts based on connection
- Audio-only fallback for poor connections
- Multiple STUN servers for better connectivity

### **2. Connection Monitoring**
- Real-time connection state tracking
- Automatic reconnection on failures
- Visual indicators for users

### **3. Scalability**
- **2-4 users**: Excellent performance
- **5-8 users**: Good performance  
- **9+ users**: Consider media server (SFU)

## 🔧 Advanced Configuration

### **For Corporate Networks (TURN Server)**
If users are behind strict firewalls, add TURN servers:

```typescript
const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: 'turn:your-turn-server.com:3478',
      username: 'your-username',
      credential: 'your-password'
    }
  ]
};
```

### **Media Constraints**
Customize video/audio quality:

```typescript
const constraints = {
  video: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30 }
  },
  audio: {
    echoCancellation: true,
    noiseSuppression: true
  }
};
```

## ✅ WebRTC Checklist

- [x] **STUN servers configured**
- [x] **Firebase signaling setup**  
- [x] **Media permissions handling**
- [x] **Connection state monitoring**
- [x] **Error handling & fallbacks**
- [x] **HTTPS ready for production**
- [x] **Multi-browser compatibility**
- [x] **Audio/video toggle controls**

## 🎯 Your WebRTC is Ready!

Your Watch Party app has enterprise-grade WebRTC implementation:
- ✅ Serverless architecture
- ✅ Real-time signaling
- ✅ Connection monitoring
- ✅ Error handling
- ✅ Production ready

Just deploy to Vercel and share the URL with friends to start watching together!