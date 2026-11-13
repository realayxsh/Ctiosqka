const { Client, GatewayIntentBits, Collection, Partials, EmbedBuilder, Routes } = require(`discord.js`);
const { MessageContent } = GatewayIntentBits;
const { User, Channel, Reaction, Message, GuildMember } = Partials;
const { Database } = require("quickmongo");
const { ClusterClient, getInfo } = require(`discord-hybrid-sharding`);
const AvonEvents = require("./avonEvents");
const AvonCommands = require("./CommandHandler");
const config = require(`../../config.json`);
const Shoukaku = require("./Shoukaku");
const Lavasfy = require("./Lavasfy");
const wh = require("./webhook");
const { gatewayIntents } = require('./gatewayIntents');

class Avon extends Client {
    constructor(){
        super({
            intents: gatewayIntents(),
            shardCount: getInfo().TOTAL_SHARDS,
            shards: getInfo().SHARD_LIST,
            partials: [Channel, User, Reaction, Message, GuildMember],
            allowedMentions: { repliedUser: true, parse: ['everyone', 'roles', 'users'] }
        });
        this.cluster = new ClusterClient(this);
        wh.initWebhook();
        this.on('error', error => wh.error('Discord client error', error));
        this.on('shardError', error => wh.error('Discord shard error', error));
        this.on('shardReconnecting', shardId => wh.info('Discord reconnecting', `Shard ${shardId} is reconnecting.`));
        this.on('shardResume', shardId => wh.info('Discord connection resumed', `Shard ${shardId} resumed.`));
        this.on('shardDisconnect', (event, shardId) =>
            wh.info('Discord disconnected', `Shard ${shardId} disconnected. Code: ${event.code}`, 0xFF8800));
        this.data = new Database(process.env.mongourl || config.mongourl, { writeConcern: { w: 'majority' } });
        this.data.connect();
        this.data2 = new Database(process.env.mongourl2 || config.mongourl2, { writeConcern: { w: 'majority' } });
        this.data2.connect();
        this.data3 = new Database(process.env.mongourl3 || process.env.mongourl || config.mongourl, { writeConcern: { w: 'majority' } });
        this.data3.connect();
        this.data4 = new Database(process.env.mongourl4 || process.env.mongourl || config.mongourl, { writeConcern: { w: 'majority' } });
        this.data4.connect();
        this.data5 = new Database(process.env.mongourl5 || config.mongourl5 || process.env.mongourl || config.mongourl, { writeConcern: { w: 'majority' } });
        this.data5.connect();
        this.data6 = new Database(process.env.mongourl6 || config.mongourl6 || process.env.mongourl || config.mongourl, { writeConcern: { w: 'majority' } });
        this.data6.connect();
        this.poru = new Shoukaku(this);
        this.lavasfy = new Lavasfy(this);

        this.poru.shoukaku.on('ready', (name) => {
            console.log(`[SHOUKAKU] => Node ${name} is connected`);
            wh.info(`Lavalink Connected — ${name}`, `Node **${name}** is ready.`, 0x00FF7F, 'music');
        });
        this.poru.shoukaku.on('error', (name, error) => {
            console.error(`[SHOUKAKU] => Node ${name} error: ${error?.message || error}`);
            wh.error(`Lavalink Error — ${name}`, error);
        });
        this.poru.shoukaku.on('close', (name, code, reason) => {
            console.warn(`[SHOUKAKU] => Node ${name} closed | Code: ${code} | Reason: ${reason}`);
            wh.info(`Lavalink Closed — ${name}`, `**Code:** \`${code}\``, 0xFF8800, 'music');
        });
        this.poru.shoukaku.on('disconnect', (name, players, moved) => {
            if(moved) return;
            console.warn(`[SHOUKAKU] => Node ${name}: Disconnected`);
            wh.info(`Lavalink Disconnected — ${name}`, `**Players affected:** \`${players?.length ?? 0}\``, 0xFF0000, 'music');
        });
        this.poru.shoukaku.on('debug', (name, info) => { console.log(`[SHOUKAKU] => Node ${name} Debug: ${info}`); });
        this.poru.on("playerClosed", (player, data) => {
            console.warn(`[PORU] playerClosed => Guild: ${player?.guildId} | Code: ${data?.code}`);
            wh.music('Voice connection closed', player);
        });

        this.emoji = require(`${process.cwd()}/emoji.json`);
        this.config = require(`${process.cwd()}/config.json`);
        this.AvonCommands = new AvonCommands(this).loadCommands();
        this.events = new AvonEvents(this).loadEvents();
        this.startBot().catch(async error => {
            await wh.error('Discord startup failed', error);
            console.error(`[Discord] Startup failed (${error?.code || error?.name || 'Error'})`);
            process.exit(1);
        });

        process.on('unhandledRejection', async (er) => {
            console.error(er);
            wh.error('unhandledRejection', er);
        });
        process.on('uncaughtException', async (err) => {
            console.error(err);
            wh.error('uncaughtException', err);
        });
    }
    async startBot() {
        this.rest.setToken(process.env.token);
        const application = await this.rest.get(Routes.oauth2CurrentApplication());
        this.options.intents = gatewayIntents(application.flags);
        console.log(`[Discord] Message Content access: ${this.options.intents.has(MessageContent) ? 'available' : 'unavailable; use slash commands, owner DMs, or mentions'}`);
        await this.login(process.env.token);
    }
}
module.exports = Avon;
