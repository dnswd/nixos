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
  private sox: ChildProcess | null = null;
  private accumulatedText: string = "";
  private currentPartial: string = "";
  private aborted: boolean = false;

  async start(options: LiveTranscriptionOptions): Promise<string> {
    const { modelPath, onPartial, onFinal, signal } = options;

    if (signal) {
      signal.addEventListener("abort", () => this.stop(), { once: true });
    }

    return new Promise((resolve, reject) => {
      // Start Python script - stderr ignored to prevent TUI pollution
      this.python = spawn("vosk-transcribe-live", [modelPath], {
        stdio: ["pipe", "pipe", "ignore"]
      });

      // Start sox recording
      this.sox = spawn("sox", [
        "-q",
        "-d",
        "-r", "16000",
        "-c", "1",
        "-e", "signed-integer",
        "-b", "16",
        "-t", "raw", "-"
      ], {
        stdio: ["ignore", "pipe", "ignore"]
      });

      if (this.sox.stdout) {
        this.sox.stdout.pipe(this.python.stdin!);
      }

      // Handle stdout
      let buffer = "";
      this.python.stdout!.on("data", (chunk: Buffer) => {
        if (this.aborted) return;

        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const result = JSON.parse(line);

            if (result.error) {
              reject(new Error(result.error));
              return;
            }

            if (result.text !== undefined) {
              if (result.text) {
                this.accumulatedText += (this.accumulatedText ? " " : "") + result.text;
                onFinal?.(result.text);
              }
              this.currentPartial = "";
            } else if (result.partial !== undefined) {
              this.currentPartial = result.partial;
            }

            const displayText = this.accumulatedText +
              (this.accumulatedText && this.currentPartial ? " " : "") +
              this.currentPartial;
            onPartial(displayText);

          } catch {
            // Ignore invalid JSON
          }
        }
      });

      this.sox.on("error", (err) => reject(new Error(`Sox: ${err.message}`)));
      this.python.on("error", (err) => reject(new Error(`Python: ${err.message}`)));

      this.python.on("close", (code) => {
        this.sox?.kill("SIGTERM");

        if (this.aborted) {
          resolve(this.accumulatedText);
          return;
        }

        if (code === 0 || code === null) {
          resolve(this.accumulatedText);
        } else {
          reject(new Error(`Exit ${code}`));
        }
      });

      this.sox.on("close", () => {
        this.python?.stdin?.end();
      });
    });
  }

  stop(): void {
    this.aborted = true;
    this.sox?.kill("SIGTERM");
    this.python?.stdin?.end();
    this.python?.kill("SIGTERM");
  }
}
