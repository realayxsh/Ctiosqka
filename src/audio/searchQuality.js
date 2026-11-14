const PREFERRED_AUDIO_ENGINES = ['youtube_music', 'youtube'];

async function searchBestAvailableAudio(search, query, options = {}) {
    if (options.engine) return search(query, options);

    let emptyResult;
    let lastError;
    for (const engine of PREFERRED_AUDIO_ENGINES) {
        try {
            const result = await search(query, { ...options, engine });
            if (result?.tracks?.length) return result;
            emptyResult = result;
        } catch (error) {
            lastError = error;
        }
    }

    if (emptyResult) return emptyResult;
    if (lastError) throw lastError;
    return { tracks: [] };
}

module.exports = { PREFERRED_AUDIO_ENGINES, searchBestAvailableAudio };
