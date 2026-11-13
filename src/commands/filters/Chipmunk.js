const AvonCommand = require("../../structures/filterCommand");

class Chipmunk extends AvonCommand {
    get name() { return 'chipmunk'; }
    get vote() { return true; }
    get inVoice() { return true; }
    get sameVoice() { return true; }
    get cat() { return 'filters'; }
    get player() { return true; }
    get premium() { return true; }
}
module.exports = Chipmunk;
