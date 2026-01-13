# Generate Voice Preset Command

Create a custom TTS voice preset using voice cloning or ElevenLabs.

## Usage

```bash
/generate-voice [name] [--clone-from=audio_file] [--language=he]
```

## Arguments

- **name** - Voice preset name
- **--clone-from** - Path to audio file for voice cloning (optional)
- **--language** - Language code: `he` (Hebrew) or `en` (English) (default: he)

## Examples

### Create Default Voice
```bash
/generate-voice "Station Voice" --language=he
```

### Clone Voice from Audio
```bash
/generate-voice "DJ Voice" --clone-from=/path/to/sample.wav --language=he
```

### English Voice
```bash
/generate-voice "English Announcer" --language=en
```

## Workflow

### Using Chatterbox (Voice Cloning)
1. **Load Audio Sample** - Read provided audio file
2. **Extract Voice Features** - Analyze voice characteristics
3. **Create Preset** - Generate voice model
4. **Test Synthesis** - Preview with sample text
5. **Save Preset** - Store in `voice_presets` collection

### Using ElevenLabs
1. **Upload Audio Sample** - Send to ElevenLabs API
2. **Clone Voice** - Create voice on ElevenLabs
3. **Get Voice ID** - Retrieve voice identifier
4. **Save Preset** - Store with ElevenLabs voice_id
5. **Test Synthesis** - Preview with sample text

## Voice Preset Structure
```python
{
  "name": "Station Voice",
  "voice_id": "chatterbox_custom_001",  # or ElevenLabs ID
  "language": "he",
  "speed": 1.0,
  "pitch": 1.0,
  "exaggeration": 1.0,
  "is_default": false,
  "source": "chatterbox",  # or "elevenlabs"
  "created_at": "2026-01-12T10:00:00Z"
}
```

## API Endpoint
```bash
POST /api/voices/presets
{
  "name": "Station Voice",
  "audio_sample_path": "/path/to/sample.wav",
  "language": "he"
}
```

## Testing the Voice
```bash
curl -X POST http://localhost:8000/api/voices/preview \
  -H "Content-Type: application/json" \
  -d '{
    "text": "שלום וברוכים הבאים לרדיו ישראל",
    "voice_preset": "Station Voice",
    "language": "he"
  }' \
  --output preview.wav
```

## Prerequisites

- Chatterbox TTS installed (`poetry add chatterbox-tts`)
- For cloning: High-quality audio sample (10-30 seconds)
- For ElevenLabs: API key configured

## Related Files

- `backend/app/services/tts_service.py` - TTS synthesis
- `backend/app/routers/voices.py` - Voice management API
- `frontend/src/pages/Voices.tsx` - Voice management UI
