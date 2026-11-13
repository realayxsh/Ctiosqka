---
name: Public slash and owner message scope
description: User requirements for slash commands, filter selection, and owner-only invocation
---

Keep both prefix and slash commands for public use, including `+play` and `+help`. Filters should be grouped under `/filter` with a selectable list for slash use. Owner commands must not be registered as slash commands.

**Why:** The user explicitly chose to keep prefix and slash commands together when changing bot accounts, and asked to keep owner commands such as `genpremium` as no-prefix commands.

**How to apply:** Preserve owner-specific authorization checks. Support owner no-prefix DMs and bot mentions in servers. Keep bare no-prefix guild invocation when message text is available, but never promise that bot-owner status bypasses Discord's Message Content restriction.
