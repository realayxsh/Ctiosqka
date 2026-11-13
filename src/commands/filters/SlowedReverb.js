const AvonCommand = require("../../structures/filterCommand");

class SlowedReverb extends AvonCommand {
    get name() { return 'slowedreverb' }
    get aliases() { return ['slowed'] }
    get inVoice() { return true; }
    get sameVoice() { return true; }
    get cat() { return 'filters' }
    get vote() { return true; }
    get player() { return true; }
    get premium() { return true; }
}
module.exports = SlowedReverb;
