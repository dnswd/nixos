#!/usr/bin/env python3
"""Vosk transcription script - called via subprocess from Node.js extension.

Usage: python transcribe.py <audio_file> <model_path>
Output: JSON with {"text": "transcribed text", "partial": false}
"""

import sys
import json
import wave


def transcribe_file(audio_path: str, model_path: str) -> dict:
    """Transcribe audio file using Vosk."""
    try:
        from vosk import Model, Recognizer
    except ImportError:
        return {"error": "vosk not installed. Run: pip install vosk"}

    # Load model
    model = Model(model_path)
    recognizer = Recognizer(model, 16000)

    # Open audio file
    try:
        wf = wave.open(audio_path, "rb")
    except Exception as e:
        return {"error": f"Failed to open audio: {e}"}

    # Check format
    if wf.getnchannels() != 1 or wf.getsampwidth() != 2 or wf.getcomptype() != "NONE":
        return {"error": "Audio must be WAV mono 16-bit PCM"}

    # Process audio
    while True:
        data = wf.readframes(4000)
        if len(data) == 0:
            break
        recognizer.AcceptWaveform(data)

    # Get final result
    result = recognizer.FinalResult()
    return json.loads(result)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(json.dumps({"error": "Usage: transcribe.py <audio_file> <model_path>"}))
        sys.exit(1)

    audio_file = sys.argv[1]
    model_path = sys.argv[2]

    result = transcribe_file(audio_file, model_path)
    print(json.dumps(result))
