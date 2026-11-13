const AvonCommand = require("../../structures/filterCommand");

class Nightcore extends AvonCommand {
    get name() { return 'nightcore' }
    get aliases() { return null; }
    get inVoice() { return true; }
    get sameVoice() { return true; }
    get cat() { return 'filters' }
    get vote() { return true; }
    get player() { return true; }
}
module.exports = Nightcore;
