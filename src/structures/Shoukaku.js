const { Kazagumo, Plugins } = require("kazagumo");
const Spotify = require(`kazagumo-spotify`);
const Deezer = require(`kazagumo-deezer`);
const config = require(`../../config.json`);
const { Connectors } = require(`shoukaku`);
class Shoukaku extends Kazagumo{
    constructor(client){
        super({
            send : (guildId,payload) => {
                const guild = client.guilds.cache.get(guildId);
                if(guild) guild.shard.send(payload);
            },
            plugins : [
                new Spotify({
                    clientId : config.spotifyId,
                    clientSecret : config.spotifySecret,
                    playlistPageLimit : 5,
                    albumPageLimit : 5,
                    searchLimit : 50,
                    searchMarket : "IN",
                    searchPlatform : "scsearch"
                }),
                new Deezer({
                    playlistLimit : 20
                }),
                new Plugins.PlayerMoved(client)
            ]
        },
        new Connectors.DiscordJS(client),
        config.nodes,
        {
            resumeByLibrary       : true,
            resumeTimeout         : 60,
            reconnectTries        : Infinity,
            reconnectInterval     : 5,
            restTimeout           : 15,
            moveOnDisconnect      : true,
            voiceConnectionTimeout: 15,
        }
        )
    }
}
module.exports = Shoukaku;
