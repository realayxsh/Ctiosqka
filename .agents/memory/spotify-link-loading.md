---
name: Spotify loader interception
description: Distinguish Spotify API/plugin failures from invalid public links
---

Check Lavalink's native Spotify result separately before treating an empty Spotify-plugin result as an invalid or private link.

**Why:** A valid public playlist returned metadata without a track collection through the configured Spotify API access. The installed Spotify plugin assumed that collection existed, caught its own failure, and returned an empty search. The audio node could load the same public playlist successfully.

**How to apply:** Prefer the verified native Spotify loader for links, retain the API loader as a fallback, and preserve requester and playlist metadata. Test through the full plugin chain; calling the intercepted search alone cannot distinguish provider failure from an invalid link. Avoid promising that all public playlists are accessible through Spotify client credentials.

Kazagumo 3 checks a plugin's exact `constructor.name === 'KazagumoPlugin'`, not its base type. Custom plugin wrappers must preserve that class name.

**Why:** A correctly inherited wrapper passed loader tests but was rejected during bot startup because it used a different class name.

**How to apply:** Include plugin registration compatibility in wrapper tests, not just searches through a mocked manager.
