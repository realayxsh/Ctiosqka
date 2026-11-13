const { Routes, ApplicationCommandType } = require('discord.js');
const { createDefinitions, OWNER_COMMAND_NAMES, inventory } = require('./catalog');

function optionShape(option) {
    const shape = { name: option.name, type: option.type, description: option.description,
        required: Boolean(option.required), options: (option.options || []).map(optionShape) };
    for (const key of ['choices', 'channel_types', 'min_value', 'max_value', 'min_length', 'max_length']) {
        if (option[key] !== undefined) shape[key] = option[key];
    }
    if (shape.choices) shape.choices = shape.choices.map(({ name, value }) => ({ name, value }));
    return shape;
}
function commandShape(command) {
    return { name: command.name, type: command.type || 1, description: command.description,
        contexts: command.contexts || [], integration_types: command.integration_types || [0],
        options: (command.options || []).map(optionShape) };
}
function sameCommands(existing, desired) {
    const shape = commands => JSON.stringify(commands.map(commandShape).sort((a, b) => a.name.localeCompare(b.name)));
    return shape(existing) === shape(desired);
}

async function registerCommands(rest, applicationId, { guildId, guildIds = [] } = {}) {
    const desired = createDefinitions();
    const body = guildId ? desired.map(({ contexts, integration_types, ...command }) => command) : desired;
    const route = guildId ? Routes.applicationGuildCommands(applicationId, guildId) : Routes.applicationCommands(applicationId);
    const existing = await rest.get(route);
    const existingChat = existing.filter(command => !command.type || command.type === ApplicationCommandType.ChatInput);
    const contextCommands = existing.filter(command => command.type && command.type !== ApplicationCommandType.ChatInput).map(command => {
        const retained = {};
        for (const key of ['name', 'type', 'name_localizations', 'default_member_permissions', 'contexts', 'integration_types', 'nsfw']) {
            if (command[key] !== undefined) retained[key] = command[key];
        }
        return retained;
    });
    const changed = guildId || !sameCommands(existingChat, body);
    if (changed) await rest.put(route, { body: [...body, ...contextCommands] });
    let removed = 0;
    if (!guildId) {
        // Old guild registrations shadow global commands. Remove only this project's
        // managed chat commands; unrelated context-menu/app commands are untouched.
        const managed = new Set([...inventory.map(command => command.name), ...OWNER_COMMAND_NAMES, 'filter', 'filters']);
        for (const id of new Set(guildIds)) {
            const old = await rest.get(Routes.applicationGuildCommands(applicationId, id));
            for (const command of old) {
                if (command.type === ApplicationCommandType.ChatInput && managed.has(command.name)) {
                    await rest.delete(Routes.applicationGuildCommand(applicationId, id, command.id));
                    removed++;
                }
            }
        }
    }
    return { count: desired.length, changed: Boolean(changed), removed };
}

module.exports = { registerCommands, sameCommands };
