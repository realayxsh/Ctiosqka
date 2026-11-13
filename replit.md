# Running the bot on Replit

The **Start application** workflow runs `node src/sharding.js`.

Install dependencies from `package-lock.json` when setting up a fresh copy. Keep `node_modules` out of saved source changes.

## Required setup

- Add the Discord bot token as a Replit Secret named `token`. Do not commit it to the repository.
- Configure reachable MongoDB connection strings and a Lavalink node in `config.json`.
- Spotify credentials in `config.json` are needed for Spotify features.

Use **Run** in Replit to start the bot and check its console output for Discord, database, and Lavalink connection status.

## Embed heading emojis

Headings with `|` read their emojis from `emoji.json`. Set a value to an animated Discord emoji such as `<a:EmojiName:123456789012345678>`; the emoji must be accessible to the bot. Existing static emojis can also be replaced with animated ones.

The `nowplaying` key already contains RedPlaying. Queue additions use `queue`, premium headings use `premium`, and settings headings use `settings`.

Optional playback keys are `search`, `pause`, `resume`, `stop`, `skip`, `previous`, `restart`, `loop`, `shuffle`, `volume`, `connect`, `disconnect`, `seek`, `remove`, `clearqueue`, `autoplay`, and `mode247`. Blank values use an existing music, queue, or settings emoji. Appearance headings use the existing `customize`, `customize_icon`, and `customize_banner` keys, falling back to the settings emoji when blank.

Restart the bot after editing `emoji.json`; new messages and subsequent button refreshes will use the updated emojis.

Run the heading checks with `node --test test/heading-emojis.test.js`.

## Audio filters

Text commands, `/filters`, and both filter dropdowns use the same presets. Selecting a preset replaces the previous preset; selecting it again disables it. Clear Filters restores unprocessed audio. Filter changes preserve pause and native volume, including mute, and do not seek or restart the track.

`8d` provides faster left/right rotation. The existing `dolby`, `atmos`, and `dolbyatmos` commands select **Dolby-style Spatial**, a slower stereo rotation with gentle EQ and gain headroom—not licensed Dolby Atmos, multichannel audio, or an HRTF renderer. Use stereo headphones with device mono audio disabled. Buffered audio can take a few seconds to reflect a change.

Concert and Slowed Reverb are style presets, not true hall/reverb processing; that requires a suitable server plugin. No filter can restore information missing from a low-quality source. For clean playback, clear filters and keep volume at or below 100%; preset gain reduction is intentional headroom rather than a second volume control.

Miami is retained. Filter capabilities are checked against the audio server; rejected changes report failure and do not mark a preset as enabled. Run focused audio and heading checks with `node --test test/audio-filters.test.js test/heading-emojis.test.js`.

## Slash commands and owner messages

All 49 non-owner source commands are available through 34 slash commands: regular commands have their own slash name, while the 16 filter commands are grouped under `/filter`.

- `/filter` opens the filter picker. `/filter effect:<choice>` selects directly, including Clear Filters.
- Public commands are server-only. Voice, vote, premium, administrator, and disabled-channel checks still apply.
- Owner commands are never registered as slash commands, and stale owner slash invocations are rejected.
- Configured owners/co-owners can DM the bot without a prefix, for example `genpremium 30d 2`, or mention it in a server: `@Bot genpremium 30d 2`. Each command retains its existing authorization checks.
- Bare no-prefix server commands are also accepted when Discord provides their text. Without Message Content permission, owners must use DMs or include a bot mention; bot ownership does not bypass Discord's restrictions.
- Add `--server <server-id>` to an owner DM if it needs a specific server. Channel announcements without server context show this instruction instead of guessing a server.

Startup checks the application's actual Message Content flags before requesting the privileged intent, then registers the public slash catalog using the logged-in bot's own application ID. Old project-owned guild registrations are removed so they cannot shadow the global catalog. Existing unrelated context-menu commands are retained. Global command visibility can take time to update in Discord.

For manual registration, run `node src/deploy.js` globally, or `node src/deploy.js <guild-id>` for a specific server. The `token` secret must be present. Run `node --test test/*.test.js` to check slash coverage, option mapping, owner exclusion, access rules, registration, and existing audio/emoji behavior.

## Separate webhook logs

Create incoming webhooks in the Discord channels you want, then store each full webhook URL in its own Replit Secret:

| Secret key | Events |
| --- | --- |
| `JOIN_LOG_WEBHOOK_URL` | The bot joining a server |
| `LEAVE_LOG_WEBHOOK_URL` | The bot leaving or being removed from a server |
| `COMMAND_LOG_WEBHOOK_URL` | Prefix, slash, owner DM/mention commands, and playback button/filter-menu invocations |
| `MUSIC_LOG_WEBHOOK_URL` | Audio node connections, track starts, playback ends, empty queues, player destruction, voice connection closes, confirmed preset updates, and playback failures |
| `ERROR_LOG_WEBHOOK_URL` | Command, playback, registration, startup, Discord client/shard, and unhandled runtime errors |
| `SYSTEM_LOG_WEBHOOK_URL` | Bot online, slash registration, and Discord reconnect/disconnect/resume events |

Restart the bot after adding or changing these secrets. Each category is independent: missing or invalid settings disable only that category, with an explicit console warning. There is no fallback to another category or to the legacy `logChannelId`, and the bot no longer fetches or creates webhooks automatically. Incoming webhook URLs do not require the bot itself to have Manage Webhooks permission.

Manage logging through `config.json` under `logging`. Set `logging.enabled` to `false` to disable all webhook logging, or set a category's `enabled` flag to `false` to disable just that category. Each `logging.webhooks.<category>.secret` value names the Secret that supplies its URL; it is a reference, not the URL itself. All six categories are enabled by default. Restart after changing these settings.

Join/leave means **bot server membership**, not members joining/leaving servers. No Server Members intent is required for these logs. Command logs record only command names, source, owner-command classification, and user/server/channel IDs. They describe invocations, not guaranteed command success. No arguments, premium codes, eval code, DM bodies, song queries, or arbitrary message contents are recorded. Error logs omit raw exception messages, stacks, and request bodies; they include a safe type and error code. Logs disable mentions and redact known environment secrets, webhook URLs, and database connection URLs.

Delivery errors do not stop command or playback handling. Invalid/revoked destinations are reported without printing URLs or tokens, terminal failures disable only that route until reconfigured/restarted, and pending deliveries are bounded. Logs are not persisted or replayed after downtime; a full delivery queue is reported and drops new events rather than growing without limit.

Use `node --test test/*.test.js` for all checks, or `node --test test/webhook-logging.test.js` for focused routing, redaction, event wiring, and delivery-failure checks.
