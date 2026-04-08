import { describe, it, expect, afterEach, vi } from 'vitest';
import { browser_find } from '../../src/core/tools-find.js';
import { closePersistentConnection } from '../../src/core/cdp-client.js';

describe('P3-07: find by role and name returns elements with coordinates', () => {
  const targetId = 'find-test-target';
  let mockClient: {
    send: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  };

  afterEach(() => {
    closePersistentConnection(targetId);
    vi.restoreAllMocks();
  });

  async function setupMockClient(axTree: unknown, boxModel: unknown = null) {
    mockClient = {
      send: vi.fn().mockImplementation(async (method: string) => {
        if (method === 'Accessibility.enable') return {};
        if (method === 'DOM.enable') return {};
        if (method === 'Accessibility.getFullAXTree') return { nodes: axTree };
        if (method === 'DOM.pushNodesByBackendIdsToFrontend') return { nodeId: 1 };
        if (method === 'DOM.getBoxModel') {
          return boxModel || {
            model: {
              content: [100, 200, 220, 200, 220, 240, 100, 240], // x1,y1,x2,y2,x3,y3,x4,y4
            },
          };
        }
        if (method === 'DOM.describeNode') {
          return {
            node: {
              nodeName: 'BUTTON',
              attributes: ['id', 'submit-btn', 'class', 'btn primary'],
            },
          };
        }
        return {};
      }),
      close: vi.fn(),
    };

    const cdpModule = await import('../../src/core/cdp-client.js');
    vi.spyOn(cdpModule, 'getCDPClient').mockResolvedValue(mockClient as any);

    return { mockClient };
  }

  it('finds elements by role', async () => {
    const axNodes = [
      {
        nodeId: '1',
        role: { value: 'button' },
        name: { value: 'Submit' },
        backendDOMNodeId: 101,
      },
      {
        nodeId: '2',
        role: { value: 'button' },
        name: { value: 'Cancel' },
        backendDOMNodeId: 102,
      },
    ];

    await setupMockClient(axNodes);

    const result = await browser_find({
      target: targetId,
      role: 'button',
    });

    expect(result.found).toBe(true);
    expect(result.elements.length).toBe(2);
    result.elements.forEach((el) => {
      expect(el.role).toBe('button');
    });
  });

  it('finds elements by name (substring match)', async () => {
    const axNodes = [
      {
        nodeId: '1',
        role: { value: 'button' },
        name: { value: 'Submit Order' },
        backendDOMNodeId: 101,
      },
      {
        nodeId: '2',
        role: { value: 'button' },
        name: { value: 'Cancel Order' },
        backendDOMNodeId: 102,
      },
      {
        nodeId: '3',
        role: { value: 'link' },
        name: { value: 'About' },
        backendDOMNodeId: 103,
      },
    ];

    await setupMockClient(axNodes);

    const result = await browser_find({
      target: targetId,
      name: 'Order',
    });

    expect(result.found).toBe(true);
    expect(result.elements.length).toBe(2);
    result.elements.forEach((el) => {
      expect(el.name.toLowerCase()).toContain('order');
    });
  });

  it('finds elements by both role and name', async () => {
    const axNodes = [
      {
        nodeId: '1',
        role: { value: 'button' },
        name: { value: 'Submit' },
        backendDOMNodeId: 101,
      },
      {
        nodeId: '2',
        role: { value: 'link' },
        name: { value: 'Submit' },
        backendDOMNodeId: 102,
      },
    ];

    await setupMockClient(axNodes);

    const result = await browser_find({
      target: targetId,
      role: 'button',
      name: 'Submit',
    });

    expect(result.found).toBe(true);
    expect(result.elements.length).toBe(1);
    expect(result.elements[0].role).toBe('button');
    expect(result.elements[0].name).toBe('Submit');
  });

  it('returns coordinates (x, y, width, height)', async () => {
    const axNodes = [
      {
        nodeId: '1',
        role: { value: 'button' },
        name: { value: 'Submit' },
        backendDOMNodeId: 101,
      },
    ];

    // Box model: content quad [x1,y1,x2,y2,x3,y3,x4,y4]
    // x=100, y=200, width=120, height=40
    const boxModel = {
      model: {
        content: [100, 200, 220, 200, 220, 240, 100, 240],
      },
    };

    await setupMockClient(axNodes, boxModel);

    const result = await browser_find({
      target: targetId,
      role: 'button',
    });

    expect(result.found).toBe(true);
    expect(result.elements.length).toBe(1);

    const element = result.elements[0];
    expect(element.x).toBe(100);
    expect(element.y).toBe(200);
    expect(element.width).toBe(120);
    expect(element.height).toBe(40);
  });

  it('returns generated selector', async () => {
    const axNodes = [
      {
        nodeId: '1',
        role: { value: 'button' },
        name: { value: 'Submit' },
        backendDOMNodeId: 101,
      },
    ];

    await setupMockClient(axNodes);

    const result = await browser_find({
      target: targetId,
      role: 'button',
    });

    expect(result.elements[0].selector).toBeDefined();
    expect(typeof result.elements[0].selector).toBe('string');
  });

  it('returns found=false when no matches', async () => {
    const axNodes = [
      {
        nodeId: '1',
        role: { value: 'link' },
        name: { value: 'About' },
        backendDOMNodeId: 101,
      },
    ];

    await setupMockClient(axNodes);

    const result = await browser_find({
      target: targetId,
      role: 'button', // No buttons in the tree
    });

    expect(result.found).toBe(false);
    expect(result.elements.length).toBe(0);
  });

  it('filters by heading level when role=heading', async () => {
    const axNodes = [
      {
        nodeId: '1',
        role: { value: 'heading' },
        name: { value: 'Main Title' },
        backendDOMNodeId: 101,
        properties: [{ name: 'level', value: { type: 'number', value: 1 } }],
      },
      {
        nodeId: '2',
        role: { value: 'heading' },
        name: { value: 'Subtitle' },
        backendDOMNodeId: 102,
        properties: [{ name: 'level', value: { type: 'number', value: 2 } }],
      },
    ];

    await setupMockClient(axNodes);

    const result = await browser_find({
      target: targetId,
      role: 'heading',
      level: 1,
    });

    expect(result.found).toBe(true);
    expect(result.elements.length).toBe(1);
    expect(result.elements[0].name).toBe('Main Title');
  });
});
