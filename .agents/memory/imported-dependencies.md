---
name: Imported dependency integrity
description: Recognize incomplete installed packages after a repository import
---

Treat an imported installed-dependency folder as unverified, even when the dependency checker reports matching package versions.

**Why:** Multiple packages in this import lacked internal runtime files. Reinstalling an already-satisfied package was a no-op and did not restore them; a clean dependency installation resolved the missing-file failures.

**How to apply:** If unrelated libraries fail on missing internal files, check package integrity rather than patching application imports. Rebuild installed dependencies through the supported package manager, and resolve security-policy blocks using safe compatible versions rather than restoring blocked packages.
