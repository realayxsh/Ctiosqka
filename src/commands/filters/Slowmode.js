const AvonCommand = require("../../structures/filterCommand");

class Slowmode extends AvonCommand {
    get name() { return 'slowmode' }
    get aliases() { return null; }
    get inVoice() { return true; }
    get sameVoice() { return true; }
    get cat() { return 'filters' }
    get vote() { return true; }
    get player() { return true; }
    get premium() { return true; }
}
module.exports = Slowmode;
