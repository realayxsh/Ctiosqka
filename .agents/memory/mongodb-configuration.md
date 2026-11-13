---
name: MongoDB configuration preference
description: Where the user wants this bot's MongoDB configuration to remain.
---

The user wants MongoDB connection settings kept in `config.json`, not moved into Secrets. They explicitly approved config-only MongoDB resolution, ignoring MongoDB environment-variable overrides.

**Why:** The user explicitly asked: “i dont want to put mongo in secret let it be on config.”

**How to apply:** Do not move this project's MongoDB configuration to Secrets without asking. Never repeat connection strings or credentials in chat, reports, or memory. Continue to explain the risks of committing credential-bearing configuration when relevant.
