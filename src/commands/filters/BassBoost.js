const AvonCommand = require("../../structures/filterCommand");

class BassBoost extends AvonCommand {
    get name() { return 'bassboost' }
    get aliases() { return ['bass']; }
    get inVoice() { return true; }
    get sameVoice() { return true; }
    get vote() { return true; }
    get cat() { return 'filters' }
    get player() { return true; }
}
module.exports = BassBoost;
