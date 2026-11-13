---
name: Lavalink connectivity
description: Avoid unsupported assumptions about reachable Lavalink nodes and ports
---

Verify the configured Lavalink node before replacing providers. Do not assume only secure WebSockets on port 443 can work.

**Why:** Earlier notes claimed only one provider was reachable, but a later startup successfully completed a Lavalink v4 WebSocket handshake over a different, non-443 endpoint. Network reachability is endpoint-specific and changes over time.

**How to apply:** Use the client's handshake and ready logs to confirm connectivity. A successful HTTP request alone does not confirm the WebSocket connection, and Discord being online does not confirm audio service readiness.
