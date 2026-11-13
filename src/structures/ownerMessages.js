const wh = require('./webhook');

function isOwner(client, userId) {
    return [...(client.config.owners || []), ...(client.config.coowners || [])].includes(userId);
}

function parseOwnerMessage(client, content) {
    let text = content.trim().replace(new RegExp(`^<@!?${client.user.id}>\\s*`), '');
    if (client.config.prefix && text.startsWith(client.config.prefix)) text = text.slice(client.config.prefix.length).trim();
    const [name = '', ...args] = text.split(/\s+/);
    const commands = client.AvonCommands.commands;
    const command = commands.get(name.toLowerCase()) || commands.find(item => item.ownerOnly &&
        (Array.isArray(item.aliases) ? item.aliases.includes(name.toLowerCase()) : item.aliases === name.toLowerCase()));
    return command?.ownerOnly ? { command, name: name.toLowerCase(), args } : null;
}

async function runOwnerMessage(client, message) {
    if (!isOwner(client, message.author.id) || !message.content) return false;
    const parsed = parseOwnerMessage(client, message.content);
    if (!parsed) return false;
    const { command, name } = parsed;
    const args = [...parsed.args];
    let guild = message.guild;
    const serverOption = args.indexOf('--server');
    if (serverOption >= 0) {
        const serverId = args[serverOption + 1];
        if (!/^\d{17,20}$/.test(serverId || '')) {
            await message.reply({ content: 'Use `--server <server-id>` to choose a server.' });
            return true;
        }
        args.splice(serverOption, 2);
        try {
            guild = client.guilds.cache.get(serverId) || await client.guilds.fetch(serverId);
        } catch {
            await message.reply({ content: 'I could not access that server. Choose a server this bot has joined.' });
            return true;
        }
    }
    if (!guild && command.name === 'say' && args[0]?.toLowerCase() !== 'dm') {
        await message.reply({ content: 'For a server-channel announcement, mention me in that server or add `--server <server-id>` in this DM.' });
        return true;
    }
    // Keep alias parsing independent of whether a mention/default prefix was used.
    const normalized = new Proxy(message, {
        get(target, property) {
            if (property === 'guild') return guild;
            if (property === 'content') return `${name} ${args.join(' ')}`;
            const value = Reflect.get(target, property, target);
            return typeof value === 'function' ? value.bind(target) : value;
        },
    });
    wh.command(command.name, {
        userId: message.author.id, guildId: guild?.id, channelId: message.channel?.id,
        source: message.guild ? 'owner server message' : 'owner DM', owner: true,
    });
    try {
        await command.run(client, normalized, args, '', guild ? client.poru.players.get(guild.id) : undefined);
    } catch (error) {
        wh.error('Owner command failed', error);
        console.warn(`[Owner Commands] ${command.name} failed (${error?.name || 'Error'})`);
        await message.reply({ content: 'Could not complete this owner command. Check its arguments and try again.' });
    }
    return true;
}

module.exports = { isOwner, parseOwnerMessage, runOwnerMessage };
