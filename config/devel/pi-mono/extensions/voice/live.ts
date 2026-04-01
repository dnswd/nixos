import { spawn, type ChildProcess } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { promises as fs } from "fs";
import { tmpdir } from "os";

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
  private stopSignalFile: string | null = null;

  async start(options: LiveTranscriptionOptions): Promise<string> {
    const { modelPath, onPartial, onFinal, signal } = options;

    // Handle abort
    if (signal) {
      signal.addEventListener("abort", () => this.stop(), { once: true });
    }

    // Create a signal file for IPC
    this.stopSignalFile = join(tmpdir(), `pi-voice-stop-${Date.now()}.signal`);

    return new Promise((resolve, reject) => {
      // Start Python script using nix-provided python with vosk
      console.error("[voice] Starting vosk-transcribe-live...");
      this.python = spawn("vosk-transcribe-live", [modelPath], {
        stdio: ["pipe", "pipe", "pipe"] // stdin, stdout, stderr
      });

      // Start sox recording to feed Python script
      console.error("[voice] Starting sox...");
      this.sox = spawn("sox", [
        "-q",                      // Quiet mode (no status output)
        "-d",                       // Default input device
        "-r", "16000",             // 16kHz (Vosk requirement)
        "-c", "1",                 // Mono
        "-e", "signed-integer",    // 16-bit PCM
        "-b", "16",
        "-t", "raw", "-"          // Output raw to stdout
      ], {
        stdio: ["ignore", "pipe", "ignore"] // Ignore stdin, pipe stdout, ignore stderr
      });

      // Pipe sox output to Python stdin
      if (this.sox.stdout) {
        this.sox.stdout.pipe(this.python!.stdin);
      }

      // Poll for stop signal file
      const checkInterval = setInterval(async () => {
        if (this.stopSignalFile) {
          try {
            await fs.access(this.stopSignalFile);
            // Signal file exists, stop recording
            console.error("[voice] Stop signal file detected");
            clearInterval(checkInterval);
            this.stop();
          } catch {
            // File doesn't exist yet, continue
          }
        }
      }, 100); // Check every 100ms

      // Handle Python stdout (JSON results)
      let buffer = "";
      let lineCount = 0;
      this.python!.stdout!.on("data", (chunk: Buffer) => {
        if (this.aborted) return;

        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue;
          lineCount++;
          if (lineCount <= 5) {
            console.error(`[voice] Received line ${lineCount}:`, line.slice(0, 100));
          }

          try {
            const result = JSON.parse(line);

            if (result.error) {
              reject(new Error(result.error));
              return;
            }

            if (result.text !== undefined) {
              // Final result for this utterance
              console.error(`[voice] Final result: ${result.text}`);
              if (result.text) {
                this.accumulatedText += (this.accumulatedText ? " " : "") + result.text;
                onFinal?.(result.text);
              }
              this.currentPartial = "";
            } else if (result.partial !== undefined) {
              // Partial result
              if (lineCount <= 5 || result.partial) {
                console.error(`[voice] Partial: ${result.partial}`);
              }
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
        console.error("[voice] Python stderr:", data.toString().slice(0, 200));
      });

      this.sox!.on("error", (err) => {
        console.error("[voice] Sox error:", err.message);
        reject(new Error(`Sox error: ${err.message}`));
      });

      this.python!.on("error", (err) => {
        console.error("[voice] Python error:", err.message);
        reject(new Error(`Python error: ${err.message}`));
      });

      // Handle Python exit
      this.python!.on("close", (code) => {
        console.error(`[voice] Python exited with code ${code}`);
        clearInterval(checkInterval);
        // Cleanup signal file
        if (this.stopSignalFile) {
          fs.unlink(this.stopSignalFile).catch(() => {});
        }
        // Kill sox when Python exits
        this.sox?.kill("SIGTERM");

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
      this.sox!.on("close", (code) => {
        console.error(`[voice] Sox closed with code ${code}, ending Python stdin`);
        // Close Python stdin to signal end of audio
        this.python?.stdin?.end();
      });
    });
  }

  async stop(): Promise<void> {
    console.error("[voice] Stopping recording...");
    this.aborted = true;
    
    // Create signal file to trigger stop
    if (this.stopSignalFile) {
      try {
        await fs.writeFile(this.stopSignalFile, "stop");
        console.error("[voice] Stop signal file created");
      } catch (e) {
        console.error("[voice] Failed to create stop signal:", e);
      }
    }
    
    // Kill sox first to stop audio flow
    if (this.sox) {
      this.sox.kill("SIGTERM");
      this.sox = null;
    }
    
    // Then close Python
    if (this.python) {
      this.python.stdin?.end();
      this.python.kill("SIGTERM");
      this.python = null;
    }
  }
}
