import { getCDPClient } from './cdp-client.js';

/**
 * Result type for a found element
 */
export interface FoundElement {
  role: string;
  name: string;
  selector?: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Result type for browser_find
 */
export interface FindResult {
  found: boolean;
  elements: FoundElement[];
}

/**
 * Accessibility tree node from CDP
 */
interface AXNode {
  nodeId: string;
  role?: {
    type: string;
    value?: string;
  };
  name?: {
    type: string;
    value?: string;
    sources?: Array<{
      type: string;
      value?: string;
    }>;
  };
  properties?: Array<{
    name: string;
    value?: {
      type: string;
      value?: unknown;
    };
  }>;
  backendDOMNodeId?: number;
  childIds?: string[];
}

/**
 * Box model from CDP
 */
interface BoxModel {
  content: number[];
}

// Track which targets have Accessibility enabled
const accessibilityEnabledTargets = new Set<string>();

/**
 * Semantic element finder using accessibility tree.
 * @param target - The target tab ID
 * @param role - ARIA role to filter by (e.g., 'button', 'link', 'textbox', 'heading')
 * @param name - Accessible name to filter by (substring match, case-insensitive)
 * @param level - Heading level 1-6 when role='heading'
 * @returns Find result with matching elements and their coordinates
 */
export async function browser_find({
  target,
  role,
  name,
  level,
}: {
  target: string;
  role?: string;
  name?: string;
  level?: number;
}): Promise<FindResult> {
  const cdp = await getCDPClient(target);

  // Enable Accessibility domain (one-time per tab)
  if (!accessibilityEnabledTargets.has(target)) {
    await cdp.send('Accessibility.enable');
    accessibilityEnabledTargets.add(target);
  }

  // Enable DOM domain for getting box model
  await cdp.send('DOM.enable');

  // Get full accessibility tree
  const { nodes } = await cdp.send('Accessibility.getFullAXTree') as { nodes: AXNode[] };

  // Create a map for quick node lookup
  const nodeMap = new Map<string, AXNode>();
  for (const node of nodes) {
    nodeMap.set(node.nodeId, node);
  }

  // Filter matching nodes
  const matches: AXNode[] = [];
  for (const node of nodes) {
    if (matchesFilter(node, role, name, level)) {
      matches.push(node);
    }
  }

  // Get coordinates and generate selectors for each match
  const elements: FoundElement[] = [];
  for (const node of matches) {
    const element = await getElementInfo(cdp, node, nodeMap);
    if (element) {
      elements.push(element);
    }
  }

  return {
    found: elements.length > 0,
    elements,
  };
}

/**
 * Check if a node matches the filter criteria.
 */
function matchesFilter(
  node: AXNode,
  role?: string,
  name?: string,
  level?: number
): boolean {
  // Get role value
  const nodeRole = node.role?.value?.toLowerCase() || '';

  // Get name value from various sources
  let nodeName = '';
  if (node.name?.value) {
    nodeName = node.name.value;
  } else if (node.name?.sources) {
    // Try to get name from sources
    for (const source of node.name.sources) {
      if (source.value) {
        nodeName = source.value;
        break;
      }
    }
  }

  // Check role filter (case-insensitive)
  if (role && nodeRole !== role.toLowerCase()) {
    return false;
  }

  // Check name filter (case-insensitive substring)
  if (name && !nodeName.toLowerCase().includes(name.toLowerCase())) {
    return false;
  }

  // Check level filter for headings
  if (level !== undefined && nodeRole === 'heading') {
    const nodeLevel = getHeadingLevel(node);
    if (nodeLevel !== level) {
      return false;
    }
  }

  // Must have either a role or name to be considered
  return nodeRole !== '' || nodeName !== '';
}

/**
 * Get heading level from node properties.
 */
function getHeadingLevel(node: AXNode): number | undefined {
  if (!node.properties) return undefined;

  const levelProp = node.properties.find(p => p.name === 'level');
  if (levelProp?.value?.value !== undefined) {
    const level = Number(levelProp.value.value);
    return isNaN(level) ? undefined : level;
  }

  return undefined;
}

/**
 * Get element info including coordinates and selector.
 */
async function getElementInfo(
  cdp: Awaited<ReturnType<typeof getCDPClient>>,
  node: AXNode,
  nodeMap: Map<string, AXNode>
): Promise<FoundElement | null> {
  const role = node.role?.value || '';
  const name = node.name?.value || '';

  // Try to get coordinates via backend DOM node ID
  if (node.backendDOMNodeId) {
    try {
      // Get node ID from backend node ID
      const { nodeId } = await cdp.send('DOM.pushNodesByBackendIdsToFrontend', {
        backendNodeIds: [node.backendDOMNodeId],
      }) as { nodeId: number };

      if (nodeId && nodeId !== 0) {
        // Get box model for coordinates
        let boxModel: BoxModel | undefined;
        try {
          const result = await cdp.send('DOM.getBoxModel', { nodeId }) as { model: BoxModel };
          boxModel = result.model;
        } catch {
          // Element might not have a box model (not visible)
        }

        if (boxModel) {
          // Calculate coordinates from content quad
          const content = boxModel.content;
          const x = content[0];
          const y = content[1];
          const width = content[2] - content[0];
          const height = content[5] - content[1];

          // Generate selector
          const selector = await generateSelector(cdp, nodeId);

          return {
            role,
            name,
            selector,
            x: Math.round(x),
            y: Math.round(y),
            width: Math.round(width),
            height: Math.round(height),
          };
        }
      }
    } catch {
      // Fall through to return element without coordinates
    }
  }

  // Return element without coordinates if we can't get DOM info
  // This matches browser_snap behavior which shows all interactive elements
  if (role || name) {
    return {
      role,
      name,
      selector: undefined,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    };
  }

  return null;
}

/**
 * Generate a CSS selector for a node.
 */
async function generateSelector(
  cdp: Awaited<ReturnType<typeof getCDPClient>>,
  nodeId: number
): Promise<string | undefined> {
  try {
    // Try to describe the node to get attributes
    const { node } = await cdp.send('DOM.describeNode', {
      nodeId,
      depth: 0,
    }) as {
      node: {
        nodeName: string;
        attributes?: string[];
      }
    };

    const tag = node.nodeName.toLowerCase();

    // Extract id and class from attributes
    let id: string | undefined;
    const classes: string[] = [];

    if (node.attributes) {
      for (let i = 0; i < node.attributes.length; i += 2) {
        const attrName = node.attributes[i];
        const attrValue = node.attributes[i + 1];
        if (attrName === 'id' && attrValue) {
          id = attrValue;
        } else if (attrName === 'class' && attrValue) {
          classes.push(...attrValue.split(' ').filter(c => c));
        }
      }
    }

    // Build selector
    if (id) {
      return `#${id}`;
    }

    if (classes.length > 0) {
      return `${tag}.${classes[0]}`;
    }

    return tag;
  } catch {
    return undefined;
  }
}

/**
 * Unregister a target from accessibility tracking.
 * Call when tab closes or navigates to clean up.
 */
export function unregisterAccessibilityTarget(target: string): void {
  accessibilityEnabledTargets.delete(target);
}
