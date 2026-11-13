// Check the server entitlement, never the invoking user's owner/vote status.
// Read fresh so redemption, revocation, and expiry affect every entry point.
async function isPremium(client, guildId) {
    if (!guildId) return false;
    const data = await client.data3.get(`premium_${guildId}`);
    if (!data || data.active === false) return false;
    return data.expiresAt === null ||
        (Number.isFinite(data.expiresAt) && Date.now() < data.expiresAt);
}

// Retained for existing redeem/revoke callers; entitlement reads are uncached.
function invalidatePremCache() {}

module.exports = { isPremium, invalidatePremCache };
