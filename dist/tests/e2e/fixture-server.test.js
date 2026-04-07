/**
 * Acceptance test for fixture-server.ts
 */
import { startFixtureServer, findFreePort } from './fixture-server';
import assert from 'assert';
async function runTests() {
    console.log('Running fixture-server acceptance tests...\n');
    // Test 1: findFreePort returns a valid port
    const freePort = await findFreePort();
    assert(freePort > 0 && freePort < 65536, 'Port should be in valid range');
    console.log('✓ findFreePort returns valid port:', freePort);
    // Test 2: startFixtureServer with dynamic port
    const server = await startFixtureServer({
        fixtureDir: 'tests/fixtures',
        cors: true,
        logRequests: true,
    });
    assert(server.port > 0, 'Server should have a valid port');
    assert(server.url.startsWith('http://localhost:'), 'URL should start with http://localhost:');
    console.log('✓ Server started on', server.url);
    // Test 3: Fetch a fixture
    const response = await fetch(`${server.url}/a11y-page.html`);
    assert(response.status === 200, 'Response status should be 200');
    const html = await response.text();
    assert(html.includes('<h1>Main Heading</h1>'), 'HTML should contain expected content');
    console.log('✓ Fixture served correctly');
    // Test 4: Check CORS headers
    assert(response.headers.get('access-control-allow-origin') === '*', 'CORS header should be set');
    console.log('✓ CORS headers present');
    // Test 5: 404 for missing file
    const notFound = await fetch(`${server.url}/nonexistent.html`);
    assert(notFound.status === 404, 'Should return 404 for missing files');
    console.log('✓ 404 for missing files');
    // Stop server
    await server.stop();
    console.log('\n✓ All tests passed!');
}
runTests().catch((err) => {
    console.error('Test failed:', err);
    process.exit(1);
});
