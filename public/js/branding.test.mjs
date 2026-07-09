import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const files = [
    'public/views/index.html',
    'public/views/startup.html',
    'public/js/auth.js',
    'public/js/player.js',
];

for(const file of files) {
    const content = await readFile(file, 'utf8');
    assert.equal(content.includes('Hördel'), false, `${file} should not use Hördel`);
    assert.equal(content.includes('Hordel'), false, `${file} should not use Hordel`);
    assert.equal(content.includes('HÃ'), false, `${file} should not contain mojibake`);
}

const indexHtml = await readFile('public/views/index.html', 'utf8');
const startupHtml = await readFile('public/views/startup.html', 'utf8');

assert.ok(indexHtml.includes('<title>Heardle</title>'));
assert.ok(indexHtml.includes('<h1>Heardle</h1>'));
assert.ok(startupHtml.includes('<title>Heardle</title>'));
assert.ok(startupHtml.includes('<h1>Heardle</h1>'));
