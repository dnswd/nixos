import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  // Quick voice input shortcut
  pi.registerShortcut("ctrl+shift+v", {
    description: "Start voice recording",
    handler: async (ctx) => {
      // Dispatch to voice command
      await pi.executeCommand("voice", [], ctx);
    }
  });

  // Quick language selection
  pi.registerShortcut("ctrl+shift+l", {
    description: "Select voice language",
    handler: async (ctx) => {
      await pi.executeCommand("voice-lang", [], ctx);
    }
  });
}
