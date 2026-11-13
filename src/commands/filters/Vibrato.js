const AvonCommand = require("../../structures/filterCommand");

class Vibrato extends AvonCommand {
    get name() { return 'vibrato' }
    get aliases() { return null; }
    get inVoice() { return true; }
    get sameVoice() { return true; }
    get cat() { return 'filters' }
    get vote() { return true; }
    get player() { return true; }
    get premium() { return true; }
}
module.exports = Vibrato;
