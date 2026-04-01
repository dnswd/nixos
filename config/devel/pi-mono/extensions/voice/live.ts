import { spawn, type ChildProcess } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface LiveTranscriptionOptions {
  modelPath: string;
  onPartial: (text: string) => void;
  onFinal?: (text: string) => void;
  signal?: AbortSignal;
}

export class LiveTranscription {
  private python: ChildProcess | null = null;
  private accumulatedText: string = "";
  private currentPartial: string = "";
  private aborted: boolean = false;

  async start(options: LiveTranscriptionOptions): Promise<string> {
    const { modelPath, onPartial, onFinal, signal } = options;

    // Handle abort
    if (signal) {
      signal.addEventListener("abort", () => this.stop(), { once: true });
    }

    const scriptPath = join(__dirname, "live.py");

    return new Promise((resolve, reject) => {
      // Start Python script using nix-provided python with vosk
      // Use nix-shell shebang in live.py, so just run it directly
      this.python = spawn("vosk-transcribe-live", [modelPath], {
        stdio: ["pipe", "pipe", "pipe"] // stdin, stdout, stderr
      });

      // Start sox recording to feed Python script
      const sox = spawn("sox", [
        "-d",                       // Default input device
        "-r", "16000",             // 16kHz (Vosk requirement)
        "-c", "1",                 // Mono
        "-e", "signed-integer",    // 16-bit PCM
        "-b", "16",
        "-t", "raw", "-"          // Output raw to stdout
      ]);

      // Pipe sox output to Python stdin
      sox.stdout.pipe(this.python!.stdin);

      // Handle Python stdout (JSON results)
      let buffer = "";
      this.python!.stdout!.on("data", (chunk: Buffer) => {
        if (this.aborted) return;

        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const result = JSON.parse(line);

            if (result.error) {
              reject(new Error(result.error));
              return;
            }

            if (result.text !== undefined) {
              // Final result for this utterance
              if (result.text) {
                this.accumulatedText += (this.accumulatedText ? " " : "") + result.text;
                onFinal?.(result.text);
              }
              this.currentPartial = "";
            } else if (result.partial !== undefined) {
              // Partial result
              this.currentPartial = result.partial;
            }

            // Send combined text to UI
            const displayText = this.accumulatedText +
              (this.accumulatedText && this.currentPartial ? " " : "") +
              this.currentPartial;
            onPartial(displayText);

          } catch (e) {
            // Ignore invalid JSON lines
          }
        }
      });

      // Handle errors
      this.python!.stderr!.on("data", (data) => {
        console.error("Python stderr:", data.toString());
      });

      sox.on("error", (err) => {
        reject(new Error(`Sox error: ${err.message}`));
      });

      this.python!.on("error", (err) => {
        reject(new Error(`Python error: ${err.message}`));
      });

      // Handle Python exit
      this.python!.on("close", (code) => {
        // Kill sox when Python exits
        sox.kill("SIGTERM");

        if (this.aborted) {
          resolve(this.accumulatedText);
          return;
        }

        if (code === 0 || code === null) {
          resolve(this.accumulatedText);
        } else {
          reject(new Error(`Python exited with code ${code}`));
        }
      });

      // Handle sox exit (user stopped recording)
      sox.on("close", () => {
        // Close Python stdin to signal end of audio
        this.python?.stdin?.end();
      });
    });
  }

  stop(): void {
    this.aborted = true;
    if (this.python) {
      this.python.stdin?.end();
      this.python.kill("SIGTERM");
      this.python = null;
    }
  }
}
