const AvonCommand = require("../../structures/filterCommand");

class Rotation extends AvonCommand {
    get name() { return '8d' }
    get aliases() { return [] }
    get player() { return true }
    get vote() { return true; }
    get cat() { return 'filters' }
    get inVoice() { return true }
    get sameVoice() { return true }
}
module.exports = Rotation;
