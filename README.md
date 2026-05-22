# DirectDrop

Serverless peer-to-peer file transfer. No servers. No storage. Just you.

DirectDrop is a LAN-hosted WebRTC file transfer app. The Node server serves the static web app and provides temporary in-memory room signaling only. Files transfer browser-to-browser over a WebRTC DataChannel.

## Run

```powershell
node server.js 8088
```

Open on the host PC:

```text
http://127.0.0.1:8088
```

Open on another PC on the same network:

```text
http://HOST-PC-IP:8088
```

## Files

- `index.html` - UI structure
- `styles.css` - layout and styling
- `app.js` - WebRTC, room flow, QR visual, file queue, and ZIP download
- `server.js` - static file server and temporary room signaling
