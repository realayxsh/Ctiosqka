// One preset at a time, shared by every command and dropdown.
// Filters cannot restore detail lost in the source or provide real Dolby Atmos.
const eq = gains => gains.map((gain, band) => ({ band, gain }));
const PRESETS = {
    '8d': { label: '8D', key: '8d', filters: { rotation: { rotationHz: 0.25 } },
        note: 'Left/right headphone rotation. Allow a few seconds for buffered audio to update.' },
    bassboost: { label: 'Bass Boost', key: 'bass',
        filters: { volume: 0.85, equalizer: eq([0.10, 0.16, 0.18, 0.12, 0.06, 0, -0.03, 0, 0, 0, 0, 0, 0, 0, 0]) } },
    nightcore: { label: 'Nightcore', key: 'night', filters: { timescale: { speed: 1.15, pitch: 1.15, rate: 1 } } },
    vibrato: { label: 'Vibrato', key: 'vib', filters: { vibrato: { frequency: 4, depth: 0.4 } } },
    tremolo: { label: 'Tremolo', key: 'trem', filters: { tremolo: { frequency: 4, depth: 0.5 } } },
    treblebass: { label: 'Treble Bass', key: 'treble',
        filters: { volume: 0.8, equalizer: eq([0.12, 0.16, 0.12, 0.06, 0, -0.03, -0.04, 0, 0.02, 0.05, 0.08, 0.10, 0.10, 0.06, 0.03]) } },
    slowmode: { label: 'Slow Mode', key: 'slow', filters: { timescale: { speed: 0.75, pitch: 1, rate: 1 } } },
    chipmunk: { label: 'Chipmunk', key: 'chip', filters: { timescale: { speed: 1.08, pitch: 1.35, rate: 1 } } },
    china: { label: 'China', key: 'china', filters: { timescale: { speed: 0.9, pitch: 1.25, rate: 1 } } },
    vaporwave: { label: 'Vaporwave', key: 'vapor', filters: { timescale: { speed: 0.85, pitch: 0.8, rate: 1 } } },
    dolbyatmos: { label: 'Dolby-style Spatial', key: 'dolbyatmos',
        filters: { volume: 0.88, equalizer: eq([0, 0.02, 0.05, 0.06, 0.03, 0, -0.03, 0, 0.02, 0.04, 0.04, 0.03, 0.02, 0.01, 0]),
            rotation: { rotationHz: 0.16 } },
        note: 'Stereo headphone rotation, not true Dolby Atmos. Disable mono audio in your device settings to hear left/right movement.' },
    concert: { label: 'Concert-style', key: 'concert',
        filters: { volume: 0.9, equalizer: eq([0, 0.03, 0.08, 0.06, 0.03, 0, -0.03, 0, 0.03, 0.05, 0.05, 0.03, 0.02, 0, 0]) },
        note: 'Warm concert-style EQ; this server does not provide a true hall-reverb filter.' },
    lofi: { label: 'Lofi', key: 'lofi', filters: { volume: 0.9,
        timescale: { speed: 0.92, pitch: 0.97, rate: 1 }, lowPass: { smoothing: 15 } } },
    heaven: { label: 'Heaven', key: 'heaven', filters: { volume: 0.9,
        timescale: { speed: 1, pitch: 1.12, rate: 1 },
        equalizer: eq([0, 0, 0, 0, 0.02, 0.03, 0.04, 0.04, 0.05, 0.06, 0.05, 0.04, 0.02, 0.01, 0]) } },
    slowedreverb: { label: 'Slowed Reverb-style', key: 'slowedreverb',
        filters: { volume: 0.9, timescale: { speed: 0.8, pitch: 0.9, rate: 1 }, lowPass: { smoothing: 8 } },
        note: 'Slowed ambience; true reverb requires a server-side reverb plugin.' },
};

const LEGACY_KEYS = ['chipmunk', 'treblebass', 'tremolo', 'vibrato'];
const FILTER_KEYS = [...new Set([...Object.values(PRESETS).map(p => p.key), ...LEGACY_KEYS])];
const FILTER_OPTIONS = [
    { label: 'None (Clear Filters)', value: 'none', desc: 'Restore clean, unprocessed audio', key: 'filter_none' },
    ...Object.entries(PRESETS).map(([value, preset]) => ({
        label: preset.label, value, key: `filter_${value}`,
        desc: (preset.note || `${preset.label} audio preset`).slice(0, 100),
    })),
];
const pending = new WeakMap();
const capabilities = new WeakMap();

function cleanFilters() {
    return { volume: 1, equalizer: [], karaoke: null, timescale: null,
        tremolo: null, vibrato: null, rotation: null, distortion: null,
        channelMix: null, lowPass: null };
}

async function availableFilters(player) {
    const node = player.shoukaku.node;
    if (Array.isArray(node.info?.filters)) return node.info.filters;
    let cached = capabilities.get(node);
    if (!cached || cached.expires < Date.now()) {
        const info = await node.rest.getLavalinkInfo();
        if (!Array.isArray(info.filters)) throw new Error('Audio server did not report its supported filters');
        cached = { filters: info.filters, expires: Date.now() + 300000 };
        capabilities.set(node, cached);
    }
    return cached.filters;
}

function applyFilter(player, selection, { toggle = false, initialize = false } = {}) {
    const id = ['none', 'clearfilters'].includes(selection) ? null : selection;
    if (id !== null && !Object.hasOwn(PRESETS, id)) return Promise.reject(new Error('Unknown audio filter'));
    const previous = pending.get(player) || Promise.resolve();
    const operation = previous.catch(() => {}).then(async () => {
        // Lavalink retains filters across tracks. Do not reset them on every TrackStart.
        if (initialize && player.data.get('qualityInit')) return null;
        const disabled = Boolean(toggle && id && player.data.get('activeFilter') === id);
        const target = disabled ? null : id;
        const preset = target ? PRESETS[target] : null;
        const filters = { ...cleanFilters(), ...structuredClone(preset?.filters || {}) };
        const supported = await availableFilters(player);
        for (const [name, value] of Object.entries(filters)) {
            if (value !== null && !(Array.isArray(value) && !value.length) && !supported.includes(name)) {
                throw new Error(`Audio server does not support ${name}`);
            }
        }
        // A single acknowledged request resets old effects and applies the new preset.
        // Keep native player volume and pause state; do not seek or restart the track.
        await player.shoukaku.update({ filters, paused: Boolean(player.paused) });
        FILTER_KEYS.forEach(key => player.data.set(key, false));
        if (preset) player.data.set(preset.key, true);
        player.data.set('activeFilter', target);
        player.data.set('qualityInit', true);
        if (!initialize) require('../structures/webhook').music('Audio preset updated', player);
        return { id: target, disabled, previous: id, label: preset?.label, note: preset?.note };
    });
    pending.set(player, operation);
    // Avoid retaining settled work or producing unhandled rejections during cleanup.
    operation.then(() => { if (pending.get(player) === operation) pending.delete(player); },
        () => { if (pending.get(player) === operation) pending.delete(player); });
    return operation;
}

function filterMessage(result, emoji) {
    if (result.disabled) return `${emoji.cross} | Disabled **${PRESETS[result.previous].label}**. Clean audio restored.`;
    if (!result.id) return `${emoji.tick} | Cleared all filters. Clean audio restored.`;
    const icon = emoji[`filter_${result.id}`] || emoji.filters;
    return `${icon} | Enabled **${result.label}**.${result.note ? `\n${result.note}` : ''}`;
}

function filterFailure(error, emoji) {
    const unsupported = /^Audio server (?:does not support|did not report)/.test(error?.message || '');
    return `${emoji.cross} | ${unsupported ? error.message : 'Could not apply the filter. The audio server rejected or did not confirm the change.'} Please try again.`;
}

module.exports = { PRESETS, FILTER_KEYS, FILTER_OPTIONS, cleanFilters, applyFilter, filterMessage, filterFailure };
