const AvonClientEvent = require("../../structures/Eventhandler");
const wh = require('../../structures/webhook');
const { clearVoiceStatus } = require('../../structures/voiceStatus');

class TrackEnd extends AvonClientEvent{
    get name(){
        return 'playerEnd';
    }
    async run(player){
        wh.music('Playback ended', player);
        await clearVoiceStatus(this.client, player);
        try{
            player.data.get('music').delete()
        } catch(e)
        {
            
        }
    }
}
module.exports = TrackEnd;