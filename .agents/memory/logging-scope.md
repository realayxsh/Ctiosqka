---
name: Bot logging scope
description: User intent for separate bot event webhooks and the meaning of join/leave logs
---

Join and leave logs refer to the bot joining or leaving servers, not members joining or leaving those servers. Keep separately configurable webhook destinations for different bot activity categories.

The user wants logging settings accessible in `config.json`; category controls and references can live there while credential values remain in Secrets.

**Why:** The user asked to supply separate webhooks and explicitly selected bot server joins/leaves when asked to distinguish them from member events.

**How to apply:** Do not add member surveillance, require the Server Members intent, or merge unrelated logging categories as part of bot logging changes. Keep webhook credentials in Secrets rather than source configuration.
