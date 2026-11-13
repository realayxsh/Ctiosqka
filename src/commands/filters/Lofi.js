const AvonCommand = require("../../structures/filterCommand");

class Lofi extends AvonCommand {
    get name() { return 'lofi' }
    get aliases() { return ['lo-fi'] }
    get inVoice() { return true; }
    get sameVoice() { return true; }
    get cat() { return 'filters' }
    get vote() { return true; }
    get player() { return true; }
    get premium() { return true; }
}
module.exports = Lofi;
