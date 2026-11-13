const AvonCommand = require("../../structures/filterCommand");

class ClearFilters extends AvonCommand {
    get name() { return 'clearfilters' }
    get aliases() { return ['cf', 'clearfilter'] }
    get inVoice() { return true; }
    get sameVoice() { return true; }
    get vote() { return true; }
    get cat() { return 'filters' }
    get player() { return true; }
    get premium() { return true; }
}
module.exports = ClearFilters;
