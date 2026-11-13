const AvonCommand = require("../../structures/filterCommand");

class Vaporwave extends AvonCommand {
    get name() { return 'vaporwave' }
    get aliases() { return null; }
    get inVoice() { return true; }
    get sameVoice() { return true; }
    get cat() { return 'filters' }
    get vote() { return true; }
    get player() { return true; }
    get premium() { return true; }
}
module.exports = Vaporwave;
