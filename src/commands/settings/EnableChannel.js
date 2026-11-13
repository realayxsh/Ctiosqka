const DisableChannel = require('./DisableChannel');

class EnableChannel extends DisableChannel {
    get name() { return 'enablechannel'; }
    get aliases() { return ['enable']; }
}

module.exports = EnableChannel;
