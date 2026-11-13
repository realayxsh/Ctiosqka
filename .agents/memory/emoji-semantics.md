---
name: Warning emoji semantics
description: User expectations for warning messages, especially commands that make no change.
---

Add the configured warning emoji selectively for genuine caution notices, including “already enabled,” “already paused,” unchanged volume, and other already-active states. Do not broadly replace existing cross emojis. Invalid input, permission denials, unavailable commands, and execution failures should retain crosses.

**Why:** The user explicitly wanted a warning for “commands already enabled,” then corrected an overly broad change: “add warning only where required,” not replacement of all cross emojis.

**How to apply:** Preserve the distinction between caution notices, rejected commands, and completed actions across prefix, slash, owner, and playback responses. Classify each message individually rather than globally changing an icon.
