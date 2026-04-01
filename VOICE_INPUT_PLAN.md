# Voice Input Implementation Plan for pi-mono

**Status:** Phases 1-4 Complete ✓ | Phase 5 Planned

## Overview
Implement lightweight local speech-to-text (STT) voice input for pi-mono using Vosk with the small English model (~40MB). Native Node.js bindings preferred over WASM for CLI performance.

**Phases:**
| Phase | Feature | Status |
|-------|---------|--------|
| 1 | Extension with 5 languages (en/zh/ar/ja/ko) | ✅ Complete |
| 2 | NixOS module with sox dependency | ✅ Complete |
| 3 | Model management + keybindings | ✅ Complete |
| 4 | Live preview (words as you speak) | ✅ Complete |
| 5 | VAD auto-stop (no Enter needed) | 📝 Future |
| 6 | Voice commands | 📝 Future |

## Quick Start

```bash
# 1. Enable in your home config
# programs.pi-mono.voiceInput.enable = true;

# 2. Rebuild
home-manager switch

# 3. Use in pi
/voice              # Record, then transcribe (batch mode)
/voice-live         # Live transcription (words appear as you speak)
/voice zh           # Record in specific language
/voice-lang         # Select language interactively
/voice-redownload   # Fix corrupted model

# Keyboard shortcuts
Ctrl+Shift+V        # Quick voice input
Ctrl+Shift+L        # Quick language selection
```

## Architecture Decision

| Approach | Size | Speed | Pros | Cons |
|----------|------|-------|------|------|
| **Vosk (native)** | 40MB model | Fast | Simple API, streaming, no build step | Requires native module |
| Vosklet (WASM) | <1MB runtime + model | Slower | Browser-compatible | Web Audio API only, not for CLI |
| whisper.cpp | 75MB+ model | Medium | Better accuracy | Heavier, more complex |

**Selected:** Vosk with native Node.js bindings for optimal CLI experience.

## Implementation Structure

```
config/devel/pi-mono/
└── extensions/
    └── voice/
        ├── index.ts          # Main extension entry with commands
        ├── keybindings.ts    # Keyboard shortcuts (Ctrl+Shift+V, Ctrl+Shift+L)
        ├── live.py           # Python live transcription script
        ├── live.ts           # Live transcription TypeScript wrapper
        ├── model.ts          # Multi-language model management
        ├── package.json      # Extension metadata (no npm deps)
        └── transcribe.py     # Python batch transcription script

pkgs/pi-mono/
└── default.nix         # NixOS module with voiceInput.enable option
```

**Note:** Uses Python `vosk` package via subprocess instead of npm `vosk` package to avoid Node 22 native binding issues with `ffi-napi`.

## Phase 1: Extension Development

### 1.1 Create Extension

**File:** `config/devel/pi-mono/extensions/voice/index.ts`

```typescript
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
  SUPPORTED_LANGUAGES, 
  type LanguageCode,
  listDownloadedLanguages
} from "./model.js";

const DEFAULT_LANGUAGE: LanguageCode = "en";

function getLanguageLabel(code: LanguageCode): string {
  const info = SUPPORTED_LANGUAGES[code];
  return `${info.name} (${code}) - ${info.size}`;
}

export default function (pi: ExtensionAPI) {
  // Main voice command with language selection
  pi.registerCommand("voice", {
    description: "Record voice and transcribe to text",
    handler: async (args, ctx) => {
      // Get language from args or settings
      const langArg = args[0] as LanguageCode | undefined;
      const settingsLang = ctx.settings.get("voiceLanguage") as LanguageCode | undefined;
      let lang: LanguageCode = langArg || settingsLang || DEFAULT_LANGUAGE;
      
      // Validate language
      if (!SUPPORTED_LANGUAGES[lang]) {
        ctx.ui.notify(`Unsupported language: ${lang}. Use: en, zh, ar, ja, id`, "error");
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
          render: (w) => [theme.fg("dim", `Checking ${SUPPORTED_LANGUAGES[lang].name} model...`)],
          invalidate: () => {},
          handleInput: () => {}
        };
      });
      
      if (!modelPath) return;
      
      // Recording phase
      const recorded = await ctx.ui.custom<boolean>((tui, theme, _kb, done) => {
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
          const { Model, Recognizer } = await import("vosk");
          const model = new Model(modelPath);
          const recognizer = new Recognizer({ model, sampleRate: 16000 });
          
          const buffer = await fs.readFile(audioFile);
          recognizer.acceptWaveform(buffer);
          const result = recognizer.finalResult().text;
          
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
        const current = ctx.ui.getEditorText?.() || "";
        ctx.ui.setEditorText(current + (current ? " " : "") + text);
      }
    }
  });

  // Language selection command
  pi.registerCommand("voice-lang", {
    description: "Select voice input language",
    handler: async (_args, ctx) => {
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
      
      const selected = await ctx.ui.custom<LanguageCode | null>((tui, theme, _kb, done) => {
        const container = new Container();
        container.addChild(new Text(theme.fg("accent", "Select voice language:"), 1, 0));
        
        const list = new SelectList(items, items.length, {
          selectedPrefix: (t) => theme.fg("accent", t),
          selectedText: (t) => theme.fg("accent", t),
          description: (t) => theme.fg("muted", t),
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
        await ctx.settings.set("voiceLanguage", selected);
        ctx.ui.notify(`Voice language set to ${SUPPORTED_LANGUAGES[selected].name}`, "success");
      }
    }
  });

  // Redownload command with language selection
  pi.registerCommand("voice-redownload", {
    description: "Redownload Vosk speech model",
    handler: async (_args, ctx) => {
      const downloaded = await listDownloadedLanguages();
      
      if (downloaded.length === 0) {
        ctx.ui.notify("No models downloaded yet", "warning");
        return;
      }
      
      const items: SelectItem[] = downloaded.map(code => ({
        value: code,
        label: SUPPORTED_LANGUAGES[code].name,
        description: "Will delete and re-download"
      }));
      
      const lang = await ctx.ui.custom<LanguageCode | null>((tui, theme, _kb, done) => {
        const container = new Container();
        container.addChild(new Text(theme.fg("warning", "Select model to redownload:"), 1, 0));
        
        const list = new SelectList(items, items.length);
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
          ctx.ui.notify(`${SUPPORTED_LANGUAGES[lang].name} model redownloaded`, "success");
        } catch (err) {
          ctx.ui.notify(`Redownload failed: ${err}`, "error");
        }
        done(undefined);
        
        return {
          render: (w) => [theme.fg("dim", "Redownloading...")],
          invalidate: () => {},
          handleInput: () => {}
        };
      });
    }
  });
}
```

**Usage:**
- `/voice` - Use default language (en) or previously selected language
- `/voice zh` - Use Chinese directly
- `/voice-lang` - Interactive language selection (saves to settings)
- `/voice-redownload` - Redownload a specific language model

### 1.2 package.json

**File:** `config/devel/pi-mono/extensions/voice/package.json`

```json
{
  "name": "voice",
  "type": "module",
  "dependencies": {
    "vosk": "^0.3.39"
  }
}
```

## Phase 2: NixOS Integration (Complete)

### 2.1 Module Updates

**File:** `pkgs/pi-mono/default.nix`

Added voice input enable option with sox and Python vosk dependencies:

```nix
let
  # Python environment with vosk for voice extension
  pythonWithVosk = pkgs.python3.withPackages (ps: with ps; [ vosk ]);
in

options.programs.pi-mono.voiceInput = {
  enable = mkEnableOption "voice input functionality (requires sox + python3 with vosk)";

  device = mkOption {
    type = types.nullOr types.str;
    default = null;
    description = "Audio input device for voice recording. Auto-detected if null.";
  };
};

config = mkIf cfg.enable {
  home.packages = [ piMono ] ++ lib.optionals cfg.voiceInput.enable [
    pkgs.sox
    pythonWithVosk  # Provides python3 with vosk package
  ];

  home.sessionVariables = mkIf (cfg.voiceInput.enable && cfg.voiceInput.device != null) {
    PULSE_INPUT_DEVICE = cfg.voiceInput.device;
  };
}
```

**Why Python subprocess?** The npm `vosk` package depends on `ffi-napi` which is incompatible with Node.js 18+ due to N-API changes. Using Python subprocess avoids native Node.js binding issues.

### 2.2 Extension Symlink

The extension is automatically available via existing `cfg.extensions` option. In your home configuration:

```nix
programs.pi-mono = {
  enable = true;
  extensions = ./config/devel/pi-mono/extensions;  # Contains voice/ subdirectory
  voiceInput = {
    enable = true;
    # device = "alsa_input.usb-XXX";  # Optional: specify input device
  };
};
```

### 2.3 Apply Configuration

```bash
# Rebuild home-manager to apply
home-manager switch

# Or if using nix-darwin
darwin-rebuild switch
```

### 2.3 Model Management (On-Demand Download)

The extension handles model download on first use, not during home-manager activation:

```typescript
// config/devel/pi-mono/extensions/voice/model.ts
import { spawn } from "child_process";
import { promises as fs } from "fs";
import { join } from "path";

const MODEL_DIR = join(process.env.HOME!, ".pi/models");
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

/** Supported languages with their Vosk models */
export const SUPPORTED_LANGUAGES = {
  en: { name: "English", model: "vosk-model-small-en-us-0.15", size: "40MB" },
  zh: { name: "Chinese", model: "vosk-model-small-cn-0.22", size: "40MB" },
  ar: { name: "Arabic (Tunisian)", model: "vosk-model-small-ar-tn-0.1-linto", size: "40MB" },
  ja: { name: "Japanese", model: "vosk-model-small-ja-0.22", size: "40MB" },
  ko: { name: "Korean", model: "vosk-model-small-ko-0.22", size: "40MB" },
} as const;

export type LanguageCode = keyof typeof SUPPORTED_LANGUAGES;

export function getModelUrl(lang: LanguageCode): string {
  const modelName = SUPPORTED_LANGUAGES[lang].model;
  return `https://alphacephei.com/vosk/models/${modelName}.zip`;
}

export function getModelPath(lang: LanguageCode): string {
  const modelName = SUPPORTED_LANGUAGES[lang].model;
  return join(MODEL_DIR, modelName);
}

export async function ensureModel(
  lang: LanguageCode,
  onProgress?: (msg: string) => void
): Promise<string> {
  const modelPath = getModelPath(lang);
  const modelName = SUPPORTED_LANGUAGES[lang].model;
  
  // Check if already exists
  try {
    await fs.access(modelPath);
    return modelPath;
  } catch {
    // Model doesn't exist, proceed with download
  }
  
  await fs.mkdir(MODEL_DIR, { recursive: true });
  const zipPath = join(MODEL_DIR, `${modelName}.zip`);
  const url = getModelUrl(lang);
  
  // Download with retry
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { name, size } = SUPPORTED_LANGUAGES[lang];
      onProgress?.(`Downloading ${name} model (${size}) - attempt ${attempt}/${MAX_RETRIES}...`);
      await downloadFile(url, zipPath);
      break;
    } catch (err) {
      if (attempt === MAX_RETRIES) {
        throw new Error(`Failed to download model after ${MAX_RETRIES} attempts: ${err}`);
      }
      onProgress?.(`Download failed, retrying in ${RETRY_DELAY_MS}ms...`);
      await sleep(RETRY_DELAY_MS);
    }
  }
  
  // Extract
  onProgress?.("Extracting model...");
  await extractZip(zipPath, MODEL_DIR);
  
  // Cleanup
  await fs.unlink(zipPath);
  
  return modelPath;
}

/** Trigger manual re-download for a specific language */
export async function redownloadModel(
  lang: LanguageCode,
  onProgress?: (msg: string) => void
): Promise<string> {
  const modelPath = getModelPath(lang);
  const zipPath = join(MODEL_DIR, `${SUPPORTED_LANGUAGES[lang].model}.zip`);
  
  onProgress?.("Removing existing model...");
  await fs.rm(modelPath, { recursive: true, force: true });
  await fs.unlink(zipPath).catch(() => {});
  
  return ensureModel(lang, onProgress);
}

/** List downloaded languages */
export async function listDownloadedLanguages(): Promise<LanguageCode[]> {
  const downloaded: LanguageCode[] = [];
  
  for (const [code, info] of Object.entries(SUPPORTED_LANGUAGES)) {
    const path = join(MODEL_DIR, info.model);
    try {
      await fs.access(path);
      downloaded.push(code as LanguageCode);
    } catch {
      // Not downloaded
    }
  }
  
  return downloaded;
}

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const curl = spawn("curl", [
      "-L",                    // Follow redirects
      "--fail",              // Fail on HTTP error
      "--retry", "2",        // Curl internal retry
      "--connect-timeout", "10",
      "--max-time", "300",   // 5 minute max
      "-o", dest,
      url
    ]);
    
    let stderr = "";
    curl.stderr.on("data", (data) => stderr += data);
    
    curl.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`curl exited ${code}: ${stderr}`));
    });
    
    curl.on("error", (err) => reject(err));
  });
}

function extractZip(zipPath: string, destDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const unzip = spawn("unzip", ["-q", "-o", zipPath, "-d", destDir]);
    unzip.on("close", (code) => code === 0 ? resolve() : reject(new Error(`unzip failed: ${code}`)));
    unzip.on("error", (err) => reject(err));
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}
```

Benefits of on-demand download:
- No delay during `home-manager switch`
- Only downloads if user actually uses voice feature
- No network dependency during system activation
- Model stored in user directory (not Nix store) - mutable, can be updated independently

## Phase 3: Model Management (Complete)

**Status:** ✅ Implemented

**Files:**
- `model.ts` - Multi-language model download/management
- `keybindings.ts` - Keyboard shortcuts
- Updated `index.ts` - Integrated keybindings

### 3.1 How to Trigger Download

**Automatic (recommended):**
- First `/voice` → downloads English model (or language from settings)
- First `/voice zh` → downloads Chinese model (if not already present)
- UI shows "Checking English model..." → "Downloading English model (40MB) - attempt 1/3..."
- ~40MB per language, takes 10-30 seconds depending on connection

**Manual (for pre-downloading specific language):**
```typescript
// Pre-download Chinese model
import { ensureModel } from "./model.js";
await ensureModel("zh", (msg) => console.log(msg));
// Output: "Downloading Chinese model (40MB) - attempt 1/3..."
```

**Check downloaded languages:**
```typescript
import { listDownloadedLanguages } from "./model.js";
const downloaded = await listDownloadedLanguages();
console.log(downloaded); // ["en", "zh"]
```

### 3.2 Redownload / Fix Corrupted Model

If a specific language model is corrupted:

```bash
# Remove specific language model
rm -rf ~/.pi/models/vosk-model-small-zh-0.22
# Next /voice zh will re-download automatically

# Or remove all models
rm -rf ~/.pi/models/
```

**Programmatic redownload:**
```typescript
import { redownloadModel } from "./model.js";

// Redownload just the Chinese model
await redownloadModel("zh", (msg) => console.log(msg));
```

**Via command (included in extension):**
- `/voice-redownload` - Interactive selection of which language to redownload

### 3.3 Keybinding

**File:** `config/devel/pi-mono/extensions/voice/keybindings.ts`

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  // Quick voice input shortcut
  pi.registerShortcut("ctrl+shift+v", {
    description: "Start voice recording",
    handler: async (ctx) => {
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
```

**Shortcuts:**
| Key | Action |
|-----|--------|
| `Ctrl+Shift+V` | Start voice recording |
| `Ctrl+Shift+L` | Open language selector |

### 3.4 Language Selection

Language is stored per-session (not persisted to settings):

```typescript
// Current session language (defaults to "en")
let currentLanguage: LanguageCode = "en";

// Change language for this session
/voice-lang

// Use specific language for one command
/voice zh
```

**Supported languages:**
| Code | Language | Model Size |
|------|----------|------------|
| `en` | English | 40MB |
| `zh` | Chinese | 40MB |
| `ar` | Arabic (Tunisian) | 40MB |
| `ja` | Japanese | 40MB |
| `ko` | Korean | 40MB |

**Note:** Unlike settings-based storage, the selected language resets when you restart pi. To persist language preference, add `export VOICE_LANG=zh` to your shell profile.

### 3.5 Real-time Streaming (Future)

For live transcription without pressing Enter:

```typescript
// Uses partial results while recording
recognizer.on("partialResult", (result) => {
  ctx.ui.setWidget("voice-preview", [result.partial]);
});
```

## Dependencies Summary

| Package | Purpose | Size | Install |
|---------|---------|------|---------|
| `python3` with `vosk` | Speech recognition | ~50MB | nix system package |
| `vosk-model-small-*` | Speech models | ~40MB each | On-demand via curl |
| `sox` | Audio recording | ~2MB | nix system package |
| `curl` | Model download | - | assumed available |
| `unzip` | Model extraction | - | assumed available |

**Total per language:** ~90MB (50MB Python+vosk + 40MB model + 2MB sox)

**Why Python?** The npm `vosk` package uses `ffi-napi` which is incompatible with Node.js 18+. Using Python subprocess avoids native binding issues.

**Nix packages required:**
```nix
python3.withPackages (ps: [ ps.vosk ])  # Provides python3 + vosk
sox                                      # Audio recording
```

**Multi-language storage:** Each language model is stored separately in `~/.pi/models/`:
- `~/.pi/models/vosk-model-small-en-us-0.15/` (English)
- `~/.pi/models/vosk-model-small-cn-0.22/` (Chinese)
- `~/.pi/models/vosk-model-small-ar-tn-0.1-linto/` (Arabic Tunisian)
- `~/.pi/models/vosk-model-small-ja-0.22/` (Japanese)
- `~/.pi/models/vosk-model-small-ko-0.22/` (Korean)

Only download languages you use. Models are stored in user directory (not Nix store) and can be removed anytime.

## Phase 4: Live Preview (Words Appear as You Speak)

**Status:** ✅ Complete

Real-time transcription that updates the TUI editor as you speak, using Vosk's partial result feature.

### 4.1 Architecture Change

Current: Record → Stop → Transcribe (batch)
```
/voice → [Recording...] → Enter → [Transcribing...] → Text appears
```

Live: Stream audio chunks → Real-time partial results
```
/voice-live → "Hello" → "Hello world" → "Hello world this" → [Enter to confirm]
```

### 4.2 Implementation Sketch

**File:** `config/devel/pi-mono/extensions/voice/live.ts`

```typescript
import { Recognizer, Model } from "vosk";
import { spawn } from "child_process";

export async function* liveTranscribe(
  modelPath: string,
  onPartial: (text: string) => void
): AsyncGenerator<string, void, void> {
  const model = new Model(modelPath);
  const recognizer = new Recognizer({ model, sampleRate: 16000 });
  
  // Use sox to stream raw audio to stdout
  const recorder = spawn("sox", [
    "-d", "-r", "16000", "-c", "1", "-e", "signed-integer", "-b", "16",
    "-t", "raw", "-"  // Output raw to stdout
  ]);
  
  // Process chunks as they arrive
  recorder.stdout.on("data", (chunk: Buffer) => {
    const hasSpeech = recognizer.acceptWaveform(chunk);
    
    if (hasSpeech) {
      // Final result for this utterance
      const result = recognizer.result().text;
      onPartial(result);
    } else {
      // Partial result while still listening
      const partial = recognizer.partialResult().partial;
      onPartial(partial);
    }
  });
  
  // Return final result when stopped
  return recognizer.finalResult().text;
}
```

### 4.3 TUI Integration

**New command:** `/voice-live`

```typescript
pi.registerCommand("voice-live", {
  description: "Live voice transcription (words appear as you speak)",
  handler: async (_args, ctx) => {
    let accumulatedText = "";
    let currentPartial = "";
    
    await ctx.ui.custom<void>(async (_tui, theme, _kb, done) => {
      // Show recording indicator
      const container = new Container();
      container.addChild(new Text(theme.fg("accent", "🎙️ Live recording..."), 1, 0));
      container.addChild(new Text(theme.fg("dim", "Press Enter to confirm, Esc to cancel"), 1, 0));
      
      // Update editor in real-time with partial results
      const updatePreview = (text: string) => {
        currentPartial = text;
        const displayText = accumulatedText + (accumulatedText ? " " : "") + currentPartial;
        ctx.ui.setEditorText(displayText);
      };
      
      // Start live transcription
      for await (const result of liveTranscribe(modelPath, updatePreview)) {
        // Final result for this utterance, add to accumulated
        accumulatedText += (accumulatedText ? " " : "") + result;
      }
      
      done();
    });
  }
});
```

### 4.4 UI Mockup

```
┌─────────────────────────────────────────┐
│ 🎙️ Live recording... (English)           │
│ Press Enter to confirm, Esc to cancel   │
├─────────────────────────────────────────┤
│ > Hello world this is a test...         │  ← Updates in real-time
│                                         │
└─────────────────────────────────────────┘
```

### 4.5 Challenges

| Challenge | Solution |
|-----------|----------|
| Editor focus conflict | Use `ctx.ui.setEditorText()` while recording widget has focus |
| Latency | Vosk partial results are fast (~100-300ms) |
| False starts | Accumulate partials, only commit on final results or Enter |
| Noise/accents | Vosk small models are less accurate - may need larger models |
| Cancellation | Need AbortController to stop recorder cleanly |

### 4.6 Future: Voice Activity Detection (VAD)

Auto-stop when silence detected (no Enter needed):

```typescript
let silenceFrames = 0;
const VAD_THRESHOLD = 30; // ~2 seconds of silence

recognizer.on("partialResult", () => {
  if (isSilence(chunk)) {
    silenceFrames++;
    if (silenceFrames > VAD_THRESHOLD) {
      stopRecording();
    }
  } else {
    silenceFrames = 0;
  }
});
```

---

## Testing Plan

### Basic Test
1. Install extension and dependencies
2. Run `/voice` - should auto-download English model on first use
3. Speak test phrase
4. Verify transcription appears in editor
5. Test with different audio devices

### Language Tests
1. `/voice-lang` - Select different language
2. `/voice zh` - Test Chinese
3. `/voice ar` - Test Arabic (Tunisian)
4. `/voice ja` - Test Japanese
5. `/voice ko` - Test Korean
6. Verify each downloads its own model (~40MB each)

### Model Management Tests
1. Check `~/.pi/models/` has separate folders for each language
2. `/voice-redownload` - Select and redownload a model
3. Manually delete a model folder, verify `/voice` re-downloads

### Phase 4 Tests (Future)
1. `/voice-live` - Words appear as you speak
2. Verify partial results update smoothly
3. Press Enter to confirm final text
4. Test interruption (Esc to cancel)
5. Test with different ambient noise levels

## Future Enhancements

- [x] Phase 1: Basic voice input with 5 languages
- [x] Phase 2: NixOS integration with sox
- [x] Phase 3: Model management (on-demand download)
- [ ] Phase 4: Live preview (words as you speak)
- [ ] Phase 5: VAD auto-stop (no Enter needed)
- [ ] Phase 6: Voice commands ("stop", "cancel", "send")
- [ ] Phase 7: Full voice-only mode (no keyboard)

---

## Model Verification Notes

**Verified 2025-03-30** by checking https://alphacephei.com/vosk/models:

| Code | Language | Model Name | Status |
|------|----------|------------|--------|
| `en` | English US | `vosk-model-small-en-us-0.15` | ✓ Verified (200 OK) |
| `zh` | Chinese | `vosk-model-small-cn-0.22` | ✓ Verified (200 OK) |
| `ar` | Arabic (Tunisian) | `vosk-model-small-ar-tn-0.1-linto` | ✓ Verified (200 OK) |
| `ja` | Japanese | `vosk-model-small-ja-0.22` | ✓ Verified (200 OK) |
| `ko` | Korean | `vosk-model-small-ko-0.22` | ✓ Verified (200 OK) |

**Not available:**
- `id` Indonesian - No Vosk small model exists (confirmed via website search)
- `fil` Filipino - Only medium model available, no small version

**Alternative languages available (not implemented):**
- `es` Spanish (`vosk-model-small-es-0.42`)
- `fr` French (`vosk-model-small-fr-0.22`)
- `hi` Hindi (`vosk-model-small-hi-0.22`)
- `de` German (`vosk-model-small-de-0.15`)
- `ru` Russian (`vosk-model-small-ru-0.22`)
- See full list: https://alphacephei.com/vosk/models
