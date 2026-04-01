import { spawn } from "child_process";
import { promises as fs } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const MODEL_DIR = join(process.env.HOME!, ".pi/models");
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

// Get directory of current module
const __dirname = dirname(fileURLToPath(import.meta.url));

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

export function getTranscribeScriptPath(): string {
  return join(__dirname, "transcribe.py");
}

function getPythonPath(): string {
  const path = process.env.PI_PYTHON_VOSK || "python3";
  console.error(`[voice] Python path: ${path}`);
  console.error(`[voice] PI_PYTHON_VOSK env: ${process.env.PI_PYTHON_VOSK || "not set"}`);
  return path;
}

export async function transcribeWithPython(
  audioFile: string,
  modelPath: string
): Promise<string> {
  const scriptPath = getTranscribeScriptPath();

  return new Promise((resolve, reject) => {
    const python = spawn(getPythonPath(), [scriptPath, audioFile, modelPath]);
    let output = "";
    let stderr = "";

    python.stdout.on("data", (data) => output += data);
    python.stderr.on("data", (data) => stderr += data);

    python.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Python script failed: ${stderr || output}`));
        return;
      }

      try {
        const result = JSON.parse(output);
        if (result.error) {
          reject(new Error(result.error));
        } else {
          resolve(result.text || "");
        }
      } catch (e) {
        reject(new Error(`Invalid JSON output: ${output}`));
      }
    });

    python.on("error", (err) => reject(err));
  });
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
      "-L",
      "--fail",
      "--retry", "2",
      "--connect-timeout", "10",
      "--max-time", "300",
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
