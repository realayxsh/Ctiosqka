const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../src/structures/avonClient.js'), 'utf8');
const initialization = source.slice(source.indexOf('        this.data = new Database('),
    source.indexOf('        this.data6.connect();') + '        this.data6.connect();'.length);

function initialize(config) {
    const client = {};
    class Database {
        constructor(uri, options) { this.uri = uri; this.options = options; this.connected = false; }
        connect() { this.connected = true; return Promise.resolve(); }
    }
    vm.runInNewContext(`(function() { ${initialization} }).call(client)`, {
        config, client, Database,
        process: new Proxy({}, { get() { throw new Error('MongoDB must not read environment secrets'); } }),
    });
    return client;
}

test('all six database clients use config.json and ignore environment settings', () => {
    const config = Object.fromEntries(Array.from({ length: 6 }, (_, index) => {
        const slot = index + 1;
        return [`mongourl${slot === 1 ? '' : slot}`, `configured-connection-${slot}`];
    }));
    const client = initialize(config);
    for (let index = 1; index <= 6; index++) {
        const database = client[`data${index === 1 ? '' : index}`];
        assert.equal(database.uri, `configured-connection-${index}`);
        assert.equal(database.connected, true);
        assert.equal(database.options.writeConcern.w, 'majority');
    }
});

test('optional connections preserve their main-config fallback without changing the no-prefix connection', () => {
    const client = initialize({ mongourl: 'main-config', mongourl2: 'noprefix-config' });
    assert.equal(client.data.uri, 'main-config');
    assert.equal(client.data2.uri, 'noprefix-config');
    for (const index of [3, 4, 5, 6]) assert.equal(client[`data${index}`].uri, 'main-config');
});
