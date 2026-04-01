import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { DynamicBorder } from "@mariozechner/pi-coding-agent";
import { Container, SelectList, Text, type SelectItem } from "@mariozechner/pi-tui";
import { spawn } from "child_process";
import { promises as fs } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  ensureModel,
  redownloadModel,
  transcribeWithPython,
  SUPPORTED_LANGUAGES,
  type LanguageCode,
  listDownloadedLanguages
} from "./model.js";
import registerKeybindings from "./keybindings.js";
import { LiveTranscription } from "./live.js";

const DEFAULT_LANGUAGE: LanguageCode = "en";

// Simple in-memory storage for current session
let currentLanguage: LanguageCode = DEFAULT_LANGUAGE;

function getLanguageLabel(code: LanguageCode): string {
  const info = SUPPORTED_LANGUAGES[code];
  return `${info.name} (${code}) - ${info.size}`;
}

export default function (pi: ExtensionAPI) {
  // Main voice command with language selection
  pi.registerCommand("voice", {
    description: "Record voice and transcribe to text",
    handler: async (args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("Voice command requires interactive mode", "error");
        return;
      }

      // Get language from args or current session
      const langArg = args[0] as LanguageCode | undefined;
      const lang: LanguageCode = langArg || currentLanguage;

      // Validate language
      if (!SUPPORTED_LANGUAGES[lang]) {
        ctx.ui.notify(`Unsupported language: ${lang}. Use: en, zh, ar, ja, ko`, "error");
        return;
      }

      const audioFile = join(tmpdir(), `pi-voice-${Date.now()}.wav`);

      // Ensure model exists (downloads on first use)
      const modelPath = await ctx.ui.custom<string | null>(async (_tui, theme, _kb, done) => {
        try {
          const path = await ensureModel(lang, (msg) => {
            // Could update UI with download progress here
          });
          done(path);
        } catch (err) {
          ctx.ui.notify(`Failed to download model: ${err}`, "error");
          done(null);
        }
        return {
          render: (_w) => [theme.fg("dim", `Checking ${SUPPORTED_LANGUAGES[lang].name} model...`)],
          invalidate: () => {},
          handleInput: () => {}
        };
      });

      if (!modelPath) return;

      // Recording phase
      const recorded = await ctx.ui.custom<boolean>((_tui, theme, _kb, done) => {
        const container = new Container();
        container.addChild(new DynamicBorder((s) => theme.fg("accent", s)));
        container.addChild(new Text(theme.fg("accent", `🎙️ Recording (${SUPPORTED_LANGUAGES[lang].name})...`), 1, 0));
        container.addChild(new Text(theme.fg("dim", "Press Enter to stop"), 1, 0));

        const recorder = spawn("sox", [
          "-d", "-r", "16000", "-c", "1", "-e", "signed-integer", "-b", "16",
          audioFile
        ]);

        recorder.on("close", () => done(true));

        return {
          render: (w) => container.render(w),
          invalidate: () => {},
          handleInput: (data) => {
            if (data === "\r" || data === "\n") {
              recorder.kill("SIGTERM");
            }
          }
        };
      });

      if (!recorded) {
        await fs.unlink(audioFile).catch(() => {});
        return;
      }

      // Transcription phase
      const text = await ctx.ui.custom<string | null>(async (_tui, theme, _kb, done) => {
        const container = new Container();
        container.addChild(new Text(theme.fg("dim", "Transcribing..."), 1, 0));

        try {
          const result = await transcribeWithPython(audioFile, modelPath);
          done(result);
        } catch (err) {
          ctx.ui.notify(`Transcription failed: ${err}`, "error");
          done(null);
        } finally {
          await fs.unlink(audioFile).catch(() => {});
        }

        return {
          render: (w) => container.render(w),
          invalidate: () => {},
          handleInput: () => {}
        };
      });

      if (text) {
        const currentText = ctx.ui.getEditorText?.() || "";
        ctx.ui.setEditorText(currentText + (currentText ? " " : "") + text);
      }
    }
  });

  // Language selection command
  pi.registerCommand("voice-lang", {
    description: "Select voice input language",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("Language selection requires interactive mode", "error");
        return;
      }

      const downloaded = await listDownloadedLanguages();

      const items: SelectItem[] = (Object.keys(SUPPORTED_LANGUAGES) as LanguageCode[]).map(code => {
        const info = SUPPORTED_LANGUAGES[code];
        const isDownloaded = downloaded.includes(code);
        return {
          value: code,
          label: `${info.name} (${code})`,
          description: isDownloaded ? "✓ Downloaded" : `${info.size} - will download on use`
        };
      });

      const selected = await ctx.ui.custom<LanguageCode | null>((_tui, theme, _kb, done) => {
        const container = new Container();
        container.addChild(new Text(theme.fg("accent", "Select voice language:"), 1, 0));

        const list = new SelectList(items, items.length, {
          selectedPrefix: (t: string) => theme.fg("accent", t),
          selectedText: (t: string) => theme.fg("accent", t),
          description: (t: string) => theme.fg("muted", t),
          scrollInfo: (t: string) => theme.fg("dim", t),
          noMatch: (t: string) => theme.fg("warning", t),
        });

        list.onSelect = (item) => done(item.value as LanguageCode);
        list.onCancel = () => done(null);

        container.addChild(list);

        return {
          render: (w) => container.render(w),
          invalidate: () => container.invalidate(),
          handleInput: (data) => list.handleInput?.(data)
        };
      });

      if (selected) {
        currentLanguage = selected;
        ctx.ui.notify(`Voice language set to ${SUPPORTED_LANGUAGES[selected].name}`, "info");
      }
    }
  });

  // Redownload command with language selection
  pi.registerCommand("voice-redownload", {
    description: "Redownload Vosk speech model",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("Redownload requires interactive mode", "error");
        return;
      }

      const downloaded = await listDownloadedLanguages();

      if (downloaded.length === 0) {
        ctx.ui.notify("No models downloaded yet", "error");
        return;
      }

      const items: SelectItem[] = downloaded.map(code => ({
        value: code,
        label: SUPPORTED_LANGUAGES[code].name,
        description: "Will delete and re-download"
      }));

      const lang = await ctx.ui.custom<LanguageCode | null>((_tui, theme, _kb, done) => {
        const container = new Container();
        container.addChild(new Text(theme.fg("warning", "Select model to redownload:"), 1, 0));

        const list = new SelectList(items, items.length, {
          selectedPrefix: (t: string) => theme.fg("accent", t),
          selectedText: (t: string) => theme.fg("accent", t),
          description: (t: string) => theme.fg("muted", t),
          scrollInfo: (t: string) => theme.fg("dim", t),
          noMatch: (t: string) => theme.fg("warning", t),
        });
        list.onSelect = (item) => done(item.value as LanguageCode);
        list.onCancel = () => done(null);

        container.addChild(list);

        return {
          render: (w) => container.render(w),
          invalidate: () => container.invalidate(),
          handleInput: (data) => list.handleInput?.(data)
        };
      });

      if (!lang) return;

      await ctx.ui.custom<void>(async (_tui, theme, _kb, done) => {
        try {
          await redownloadModel(lang, (msg) => {
            // Could show progress in UI
          });
          ctx.ui.notify(`${SUPPORTED_LANGUAGES[lang].name} model redownloaded`, "info");
        } catch (err) {
          ctx.ui.notify(`Redownload failed: ${err}`, "error");
        }
        done(undefined);

        return {
          render: (_w) => [theme.fg("dim", "Redownloading...")],
          invalidate: () => {},
          handleInput: () => {}
        };
      });
    }
  });

  // Live transcription command
  pi.registerCommand("voice-live", {
    description: "Live voice transcription (words appear as you speak)",
    handler: async (args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("Live voice requires interactive mode", "error");
        return;
      }

      // Get language
      const langArg = args[0] as LanguageCode | undefined;
      const lang: LanguageCode = langArg || currentLanguage;

      if (!SUPPORTED_LANGUAGES[lang]) {
        ctx.ui.notify(`Unsupported language: ${lang}. Use: en, zh, ar, ja, ko`, "error");
        return;
      }

      // Ensure model
      const modelPath = await ctx.ui.custom<string | null>(async (_tui, theme, _kb, done) => {
        try {
          const path = await ensureModel(lang);
          done(path);
        } catch (err) {
          ctx.ui.notify(`Failed to download model: ${err}`, "error");
          done(null);
        }
        return {
          render: (_w) => [theme.fg("dim", `Loading ${SUPPORTED_LANGUAGES[lang].name} model...`)],
          invalidate: () => {},
          handleInput: () => {}
        };
      });

      if (!modelPath) return;

      // Live transcription with preview
      const finalText = await ctx.ui.custom<string | null>((_tui, theme, _kb, done) => {
        const abortController = new AbortController();
        const live = new LiveTranscription();

        // Show recording UI
        const container = new Container();
        container.addChild(new DynamicBorder((s) => theme.fg("accent", s)));
        container.addChild(new Text(theme.fg("accent", `🎙️ Live (${SUPPORTED_LANGUAGES[lang].name}) - Speak now...`), 1, 0));
        container.addChild(new Text(theme.fg("dim", "Press Enter to confirm, Esc to cancel"), 1, 0));

        // Start live transcription
        let lastText = "";
        live.start({
          modelPath,
          onPartial: (text) => {
            if (text !== lastText) {
              lastText = text;
              ctx.ui.setEditorText(text);
            }
          },
          signal: abortController.signal
        }).then((result) => {
          done(result);
        }).catch((err) => {
          ctx.ui.notify(`Live transcription error: ${err}`, "error");
          done(null);
        });

        return {
          render: (w) => container.render(w),
          invalidate: () => {},
          handleInput: (data) => {
            if (data === "\r" || data === "\n") {
              // Enter = confirm
              live.stop();
            } else if (data === "\x1b") {
              // Escape = cancel
              abortController.abort();
              live.stop();
              done(null);
            }
          }
        };
      });

      if (finalText) {
        ctx.ui.notify(`Transcribed: ${finalText.slice(0, 50)}${finalText.length > 50 ? "..." : ""}`, "info");
      }
    }
  });

  // Register keyboard shortcuts
  registerKeybindings(pi);
}
