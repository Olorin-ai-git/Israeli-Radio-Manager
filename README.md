# 🎙️ Israeli Radio Manager

**An AI-orchestrated control room for a Hebrew-language radio station.**
A Claude-powered agent plans the programming (songs, shows and commercials), pulls new content from Google Drive and Gmail, and runs the station 24/7 or asks for confirmation before anything important.

Built for a real Hebrew-speaking station broadcasting in South Florida (Miami · Boca Raton · Florida Keys).

## Highlights
- **AI orchestration**: a Claude agent handles scheduling and day-to-day operations
- **Two operating modes**: *Full Automation* (24/7 autonomous) or *Prompt Mode* (human confirmation for important actions)
- **Bilingual UI**: full Hebrew (RTL) and English
- **Content pipeline**: syncs media from Google Drive and auto-imports Gmail attachments
- **Notifications**: email, web push and SMS (Twilio)
- **Playback**: server-side audio via python-vlc

## Architecture
| Layer | Tech |
|---|---|
| Frontend | Vite · React · TypeScript · Tailwind CSS |
| Backend | Python 3.11+ · FastAPI |
| Data | MongoDB |
| AI | Claude API (Anthropic) |
| Integrations | Google Drive API · Gmail API · Google Cloud Storage · Twilio · Web Push |
| Hosting | Firebase App Hosting |

## Getting started
```bash
# backend (terminal 1)
cd backend
cp .env.example .env   # fill in your own keys
pip install -r requirements.txt
uvicorn app.main:app --reload

# frontend (terminal 2)
cd frontend
npm install
npm run dev
```
Prerequisites: Python 3.11+, Node 18+, MongoDB, VLC.

Full setup (Google Drive/Gmail credentials, folder structure, environment variables): [docs/SETUP.md](docs/SETUP.md).
Design system: [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) · Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · Past deployment and change notes: [docs/archive/](docs/archive/)

## License
MIT

---
Built by [Gil Klainert](https://github.com/gilco1973) · [klainert.com](https://klainert.com) · part of the [Olorin](https://github.com/Olorin-ai-git) ecosystem
