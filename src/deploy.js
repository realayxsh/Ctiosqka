require('dotenv').config();
const { REST, Routes } = require('discord.js');
const { registerCommands } = require('./slash/register');

async function deploy(guildId) {
    if (!process.env.token) throw new Error('The token Replit Secret is required');
    if (guildId && !/^\d{17,20}$/.test(guildId)) throw new Error('Provide a valid guild ID');
    const rest = new REST({ version: '10' }).setToken(process.env.token);
    // The token identifies the application; a copied config.clientId may be wrong.
    const application = await rest.get(Routes.oauth2CurrentApplication());
    const result = await registerCommands(rest, application.id, { guildId });
    console.log('[Slash Commands] Registered ' + result.count + ' public commands. Owner commands are excluded.');
    return result;
}
if (require.main === module) {
    deploy(process.argv[2]).catch(error => {
        console.error('[Slash Commands] Registration failed (' + (error.code || error.name) + ')');
        process.exitCode = 1;
    });
}
module.exports = { deploy };
