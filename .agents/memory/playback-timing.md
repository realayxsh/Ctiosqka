---
name: Playback timing
description: The user's expected timing for queued-track Now Playing cards
---

Send each queued track's Now Playing card immediately when the audio server reports that track has started. Do not add an arbitrary UI delay to compensate for perceived voice-buffer timing.

**Why:** The user explicitly requested that the next queued track card appear immediately and objected to an unrequested 3.5-second delay.

**How to apply:** Keep track transitions tied to the playback events. Diagnose audio-buffer differences separately; do not delay the card unless the user asks for that behavior.
