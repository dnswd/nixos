#!/usr/bin/env python3
"""Vosk live transcription script - streams partial results.

Usage: python live.py <model_path>
Input: Raw PCM 16-bit 16kHz mono audio from stdin
Output: JSON lines with {"partial": "..."} or {"text": "..."}
"""

import sys
import json


def transcribe_live(model_path: str):
    """Transcribe live audio from stdin using Vosk."""
    try:
        from vosk import Model, KaldiRecognizer
    except ImportError as e:
        print(json.dumps({"error": f"vosk import failed: {e}"}), flush=True)
        sys.exit(1)

    # Load model
    model = Model(model_path)
    recognizer = KaldiRecognizer(model, 16000)

    # Process audio in chunks from stdin
    CHUNK_SIZE = 4096  # ~256ms at 16kHz

    while True:
        try:
            data = sys.stdin.buffer.read(CHUNK_SIZE)
            if not data:
                break

            # Feed to recognizer
            has_speech_ended = recognizer.AcceptWaveform(data)

            if has_speech_ended:
                # Final result for this utterance
                result = recognizer.Result()
                print(result, flush=True)
            else:
                # Partial result
                partial = recognizer.PartialResult()
                print(partial, flush=True)

        except KeyboardInterrupt:
            break

    # Final result
    final = recognizer.FinalResult()
    print(final, flush=True)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(json.dumps({"error": "Usage: live.py <model_path>"}), flush=True)
        sys.exit(1)

    model_path = sys.argv[1]
    transcribe_live(model_path)
