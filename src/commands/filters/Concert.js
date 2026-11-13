const AvonCommand = require("../../structures/filterCommand");

class Concert extends AvonCommand {
    get name() { return 'concert' }
    get aliases() { return null; }
    get inVoice() { return true; }
    get sameVoice() { return true; }
    get cat() { return 'filters' }
    get vote() { return true; }
    get player() { return true; }
    get premium() { return true; }
}
module.exports = Concert;
