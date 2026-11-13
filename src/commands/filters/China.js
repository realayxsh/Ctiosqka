const AvonCommand = require("../../structures/filterCommand");

class China extends AvonCommand {
    get name() { return 'china' }
    get aliases() { return null; }
    get vote() { return true; }
    get inVoice() { return true; }
    get sameVoice() { return true; }
    get cat() { return 'filters' }
    get player() { return true; }
    get premium() { return true; }
}
module.exports = China;
