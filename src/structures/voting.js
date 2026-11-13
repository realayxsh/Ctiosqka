const config = require('../../config.json');

// One reversible switch controls vote promotion, commands, checks, and badges.
function isVotingEnabled(client) {
    return (client?.config?.voting ?? config.voting)?.enabled !== false;
}

module.exports = { isVotingEnabled };
