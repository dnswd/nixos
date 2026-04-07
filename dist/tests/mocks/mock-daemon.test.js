import { MockDaemon } from './mock-daemon';
import * as fs from 'fs';
async function runTests() {
    const socketPath = process.platform === 'win32'
        ? '\\\\.\\pipe\\test-mock-daemon'
        : '/tmp/test-mock-daemon.sock';
    console.log('Starting MockDaemon tests...\n');
    const mock = new MockDaemon(socketPath);
    // Test 1: Start server
    console.log('Test 1: Starting server...');
    await mock.start();
    console.log('  ✓ Server started\n');
    // Test 2: Basic command (nav - create tab)
    console.log('Test 2: Creating tab with nav command...');
    const navResponse = await mock.send({ id: 1, cmd: 'nav', args: ['https://example.com'] });
    console.assert(navResponse.ok === true, 'nav should succeed');
    console.assert(navResponse.result?.tabId, 'nav should return tabId');
    console.log('  ✓ Tab created:', navResponse.result?.tabId, '\n');
    const tabId = navResponse.result?.tabId;
    // Test 3: List tabs
    console.log('Test 3: Listing tabs...');
    const listResponse = await mock.send({ id: 2, cmd: 'list', args: [] });
    console.assert(listResponse.ok === true, 'list should succeed');
    console.assert(Array.isArray(listResponse.result), 'list should return array');
    console.assert(listResponse.result.length === 1, 'should have 1 tab');
    console.log('  ✓ Found', listResponse.result.length, 'tab(s)\n');
    // Test 4: Take snapshot
    console.log('Test 4: Taking accessibility snapshot...');
    const snapResponse = await mock.send({ id: 3, cmd: 'snap', args: [tabId] });
    console.assert(snapResponse.ok === true, 'snap should succeed');
    console.assert(snapResponse.result?.tree, 'snap should return tree');
    console.log('  ✓ Snapshot taken\n');
    // Test 5: Evaluate JavaScript
    console.log('Test 5: Evaluating JavaScript...');
    const evalResponse = await mock.send({ id: 4, cmd: 'eval', args: [tabId, 'document.title'] });
    console.assert(evalResponse.ok === true, 'eval should succeed');
    console.log('  ✓ JavaScript evaluated\n');
    // Test 6: Test latency simulation (500ms)
    console.log('Test 6: Testing latency simulation (500ms)...');
    mock.setLatency(500);
    const start = Date.now();
    await mock.send({ id: 5, cmd: 'list', args: [] });
    const elapsed = Date.now() - start;
    console.assert(elapsed >= 500, `latency should be >= 500ms, got ${elapsed}ms`);
    console.log('  ✓ Latency simulated:', elapsed, 'ms\n');
    // Reset latency
    mock.setLatency(0);
    // Test 7: Test error injection
    console.log('Test 7: Testing error injection...');
    mock.injectError('TabNotFound', 'Tab ABC123 not found');
    const errResponse = await mock.send({ id: 6, cmd: 'snap', args: ['ABC123'] });
    console.assert(errResponse.ok === false, 'should return error');
    console.assert(errResponse.error?.includes('ABC123'), 'error should mention tab ID');
    console.log('  ✓ Error injected:', errResponse.error, '\n');
    // Test 8: Other commands
    console.log('Test 8: Testing other commands...');
    // click
    const clickResponse = await mock.send({ id: 7, cmd: 'click', args: [tabId, 'node-1'] });
    console.assert(clickResponse.ok === true, 'click should succeed');
    // clickxy
    const clickxyResponse = await mock.send({ id: 8, cmd: 'clickxy', args: [tabId, 100, 200] });
    console.assert(clickxyResponse.ok === true, 'clickxy should succeed');
    // type
    const typeResponse = await mock.send({ id: 9, cmd: 'type', args: [tabId, 'input-1', 'hello'] });
    console.assert(typeResponse.ok === true, 'type should succeed');
    // shot
    const shotResponse = await mock.send({ id: 10, cmd: 'shot', args: [tabId] });
    console.assert(shotResponse.ok === true, 'shot should succeed');
    // net
    const netResponse = await mock.send({ id: 11, cmd: 'net', args: [tabId, true] });
    console.assert(netResponse.ok === true, 'net should succeed');
    // loadall
    const loadallResponse = await mock.send({ id: 12, cmd: 'loadall', args: [tabId] });
    console.assert(loadallResponse.ok === true, 'loadall should succeed');
    // evalraw
    const evalrawResponse = await mock.send({ id: 13, cmd: 'evalraw', args: [tabId, 'console.log(1)'] });
    console.assert(evalrawResponse.ok === true, 'evalraw should succeed');
    console.log('  ✓ All commands working\n');
    // Test 9: Stop tab
    console.log('Test 9: Stopping tab...');
    const stopResponse = await mock.send({ id: 14, cmd: 'stop', args: [tabId] });
    console.assert(stopResponse.ok === true, 'stop should succeed');
    console.log('  ✓ Tab stopped\n');
    // Test 10: Stop server and cleanup
    console.log('Test 10: Stopping server and cleanup...');
    await mock.stop();
    if (process.platform !== 'win32') {
        console.assert(!fs.existsSync(socketPath), 'socket file should be removed');
    }
    console.log('  ✓ Server stopped and socket cleaned up\n');
    console.log('All tests passed! ✓');
}
runTests().catch((err) => {
    console.error('Test failed:', err);
    process.exit(1);
});
