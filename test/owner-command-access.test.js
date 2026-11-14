const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { isOwner } = require('../src/structures/ownerMessages');

const ownerDirectory = path.join(__dirname, '../src/commands/owner');

test('configured co-owners pass the shared owner authorization check', () => {
    const client = { config: { owners: ['primary'], coowners: ['coowner'] } };
    assert.equal(isOwner(client, 'primary'), true);
    assert.equal(isOwner(client, 'coowner'), true);
    assert.equal(isOwner(client, 'other-user'), false);
});

test('every owner command uses the shared owner authorization check', () => {
    const files = fs.readdirSync(ownerDirectory).filter(file => file.endsWith('.js'));
    assert.equal(files.length, 13);

    for (const file of files) {
        const source = fs.readFileSync(path.join(ownerDirectory, file), 'utf8');
        assert.match(source, /require\(['"]\.\.\/\.\.\/structures\/ownerMessages['"]\)/, `${file} must use shared owner authorization`);
        assert.match(source, /isOwner\(client,\s*message\.author\.id\)/, `${file} must allow configured co-owners`);
    }
});
