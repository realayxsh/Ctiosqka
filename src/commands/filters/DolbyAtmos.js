const AvonCommand = require("../../structures/filterCommand");

class DolbyAtmos extends AvonCommand {
    get name() { return 'dolbyatmos' }
    get aliases() { return ['dolby', 'atmos'] }
    get player() { return true }
    get vote() { return true; }
    get cat() { return 'filters' }
    get premium() { return true; }
    get inVoice() { return true }
    get sameVoice() { return true }
}
module.exports = DolbyAtmos;
