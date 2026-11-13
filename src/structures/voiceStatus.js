const { Routes } = require('discord.js');

// Serialize writes for each channel so an old song cannot overwrite a newer one.
const pending = new Map();
const ownedChannels = new WeakMap();

function writeStatus(client, channelId, status) {
    const previous = pending.get(channelId) || Promise.resolve();
    const operation = previous.then(async () => {
        try {
            await client.rest.put(Routes.channelVoiceStatus(channelId), { body: { status } });
            return true;
        } catch (error) {
            // Missing permissions must not interrupt playback or expose API details.
            console.warn(`[Voice Status] Update failed (code ${Number(error.code) || 'unknown'}). Check Set Voice Channel Status and channel permissions.`);
            return false;
        }
    });
    pending.set(channelId, operation);
    operation.finally(() => {
        if (pending.get(channelId) === operation) pending.delete(channelId);
    });
    return operation;
}

async function updateVoiceStatus(client, player, track) {
    const channelId = player.voiceId;
    if (!channelId || !track) return;
    const previous = ownedChannels.get(player);
    ownedChannels.set(player, channelId);
    if (previous && previous !== channelId) await writeStatus(client, previous, null);
    const title = String(track.title || 'Unknown track').replace(/\s+/g, ' ').trim();
    const status = Array.from(`${client.emoji.music} | ${title}`).slice(0, 500).join('');
    await writeStatus(client, channelId, status);
}

async function clearVoiceStatus(client, player) {
    const channelId = ownedChannels.get(player);
    ownedChannels.delete(player);
    if (channelId) await writeStatus(client, channelId, null);
}

module.exports = { updateVoiceStatus, clearVoiceStatus };
