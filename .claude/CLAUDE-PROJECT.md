# Israeli Radio Manager Project Configuration

**Project Type:** AI-Powered Radio Station Automation System
**Version:** 1.0.0
**Last Updated:** 2026-01-12

---

## Project Context

**Israeli Radio Manager** is an AI-powered management dashboard for an Israeli Hebrew-speaking radio station broadcasting in the Miami/Boca Raton/Florida Keys area, serving the Israeli diaspora community in South Florida.

### Tech Stack

**Backend:**
- Python 3.11+ with FastAPI
- MongoDB (Motor async driver)
- Poetry for dependency management
- Anthropic Claude API (claude-sonnet-4-5-20250929) for AI automation
- Google APIs: Drive, Gmail, Calendar, Cloud Storage
- Firebase Admin for authentication
- Twilio for SMS notifications
- PyWebPush for push notifications
- APScheduler for background tasks
- python-vlc for audio playback
- Chatterbox TTS (multilingual, CPU-based)

**Frontend:**
- Vite + React 18 + TypeScript
- Zustand for state management
- TanStack React Query v5 for data fetching
- React Router v6
- Tailwind CSS (glassmorphism design system)
- i18next (Hebrew RTL + English)
- Lucide React icons
- @dnd-kit for drag-and-drop
- Firebase client SDK for auth

### Languages Supported
- **Hebrew** (primary) - RTL support - he
- **English** - en

---

## Project-Specific Rules

### 1. UI/UX Standards

**MANDATORY: Glassmorphism Dark Theme**
- Dark-first design with red accent (#ef4444 - brand color)
- Glass effects with backdrop blur
- All styling via Tailwind CSS only (no custom CSS files)
- Components defined in `frontend/src/theme/tokens.ts`

**Design Tokens:**
```typescript
// From frontend/src/theme/tokens.ts
colors: {
  primary: '#ef4444',      // Red accent
  dark: {
    900: '#0f172a',       // Darkest background
    800: '#1e293b',       // Card background
    700: '#334155',       // Borders
  }
}
```

**Glass Component Classes:**
- `.glass-card` - Semi-transparent cards with blur
- `.glass-sidebar` - Sidebar navigation
- `.glass-input` - Form inputs
- `.glass-button` - Button variants (primary, secondary, ghost)

**Typography:**
- **English:** Inter (Google Fonts)
- **Hebrew:** Heebo (proper RTL support)
- **Type Scale:** xs (12px) → xl (20px)

### 2. Backend Development

**MANDATORY: Poetry Only**
- All Python dependencies via Poetry (`poetry add`, `poetry install`)
- NEVER use pip directly
- All dependencies in `pyproject.toml`
- Commit `poetry.lock` to version control

**FastAPI Patterns:**
- Use dependency injection for MongoDB connection
- WebSocket support for real-time updates
- Background tasks with APScheduler
- Error handling with proper HTTP status codes

**Database:**
- MongoDB with Motor (async driver)
- Collections: content, commercial_campaigns, flows, users, settings, etc.
- No ODM (direct Motor queries)

**AI Agent Integration:**
- Claude Sonnet 4.5 for autonomous radio management
- Two modes: Full Automation vs. Prompt Mode
- Natural language chat (Hebrew + English)
- Decision logging in `agent_decisions` collection

### 3. Localization Requirements

**Hebrew + English Support:**

**UI Localization:**
- i18next for UI strings
- RTL detection and layout flipping for Hebrew
- Language toggle in UI (top-right)

**Database Content:**
- Most content is Hebrew-primary (station serves Israeli community)
- English translations not required for content metadata
- UI must support both Hebrew and English interface

**TTS Localization:**
- Chatterbox TTS supports Hebrew and English
- Voice presets can be language-specific
- Time checks and announcements in both languages

### 4. Authentication & Authorization

**Firebase Authentication:**
- Firebase Admin SDK on backend
- Firebase client SDK on frontend
- JWT token validation

**Role-Based Permissions:**
```python
Role.ADMIN      # Full access
Role.DJ         # Content and playback management
Role.VIEWER     # Read-only access
```

**Backend Usage:**
```python
@router.get("/admin/stats")
async def get_stats(current_user: User = Depends(require_role(Role.ADMIN))):
    # Implementation
```

### 5. AI Agent Operating Modes

**Full Automation Mode** (24/7 autonomous):
- Agent makes all decisions independently
- Automatic content selection and scheduling
- Smart commercial insertion
- Emergency playlist management
- No human confirmation required

**Prompt Mode** (user confirmation):
- Agent suggests actions
- Requires user approval for key decisions
- Actions stored in `pending_actions` collection
- Timeout after 5 minutes → fallback behavior

**Mode Switching:**
```python
# Set via environment variable
AGENT_MODE=full_automation  # or "prompt"

# Runtime toggle via API
POST /api/agent/set-mode {"mode": "full_automation"}
```

---

## Active Features

### 1. Content Management
- **Library:** Songs, Shows, Commercials, Jingles, Samples, Newsflashes
- **Batch Upload:** Multi-file upload with metadata extraction
- **Google Drive Sync:** Automatic syncing from Drive folders
- **Gmail Integration:** Auto-import audio attachments
- **AI Classification:** Claude-powered genre and content type detection

### 2. AI Radio Orchestration
- **Autonomous Operation:** 24/7 AI-powered content selection
- **Natural Language Chat:** Hebrew/English conversation
- **Decision Logging:** Complete audit trail of AI decisions
- **Smart Mixing:** Genre balancing, commercial insertion, jingle placement
- **Emergency Management:** Fallback playlist to prevent dead air

### 3. Playback System
- **VLC-Based Player:** Audio playback with queue management
- **Live Streaming:** Multiple endpoints (GCS, signed URLs, emergency)
- **Volume Control:** Automated fading and normalization
- **Queue Management:** Real-time queue viewing and manipulation
- **WebSocket Updates:** Real-time playback status broadcast

### 4. Commercial Campaign Manager
- **Grid Scheduler:** 48 time slots/day (30-min intervals)
- **Multi-Campaign Support:** Priority-based scheduling
- **Financial Tracking:** Budget, contract value, price per slot (ILS)
- **Google Calendar Sync:** Automatic calendar integration
- **Jingle Integration:** Station ID jingles between commercials
- **Conflict Detection:** Prevents overlapping campaigns

### 5. Auto Flows (Workflow Automation)
- **Action Types:**
  - Play genre/content/show
  - Wait (duration)
  - Volume control (fade in/out, set level)
  - Announcements (TTS)
  - Time checks (TTS current time)
  - TTS jingles (custom voice messages)
- **Scheduling:** Time-based, recurring (daily/weekly/monthly/yearly), manual
- **TTS Integration:** Voice presets, language selection, exaggeration control
- **Flow Monitor:** Real-time execution tracking

### 6. Google Calendar Integration
- **Event Management:** CRUD operations via Google Calendar API
- **Calendar Watcher:** Background service (15-second polling)
- **Week View:** Visual calendar UI
- **Auto-Playback:** Triggers content at scheduled times
- **Sync Status:** Real-time sync indicator

### 7. TTS & Voice Management
- **Chatterbox TTS:** Local, multilingual, CPU-based
- **ElevenLabs Fallback:** Optional cloud TTS
- **Voice Cloning:** Create custom voice presets
- **Preview System:** Test TTS with different settings
- **Default Voice:** Station-wide voice configuration
- **Voice Presets:** Save and reuse voice configurations

### 8. User Management
- **Firebase Auth:** Secure user accounts
- **Role System:** Admin, DJ, Viewer roles
- **User Preferences:** Notification settings, language
- **Admin Panel:** User CRUD, statistics

### 9. Notification System
- **Email:** SMTP via admin contact email
- **SMS:** Twilio integration for critical alerts
- **Web Push:** Browser notifications (VAPID)
- **WebSocket:** Real-time in-app updates

---

## Critical Files

### Backend
- `backend/app/main.py` - FastAPI application entry point
- `backend/app/config.py` - Configuration with environment variables
- `backend/app/database.py` - MongoDB connection
- `backend/app/models/` - Database model definitions (dict-based, no ODM)
- `backend/app/routers/` - API endpoints
  - `content.py` - Content management
  - `playback.py` - Playback control and streaming
  - `campaigns.py` - Commercial campaign management
  - `flows.py` - Auto flow management
  - `calendar.py` - Google Calendar integration
  - `agent.py` - AI agent control and chat
  - `upload.py` - File upload handling
  - `users.py` - User management
  - `voices.py` - TTS voice management
  - `websocket.py` - WebSocket connections
- `backend/app/services/` - Business logic
  - `ai_agent.py` - Claude AI orchestration
  - `playback_service.py` - VLC playback control
  - `calendar_watcher.py` - Background calendar monitoring
  - `tts_service.py` - Text-to-speech synthesis
  - `google_services.py` - Google API integrations
  - `notification_service.py` - Email/SMS/Push notifications
- `backend/app/agents/` - AI agent system
  - `radio_agent.py` - Main radio orchestration agent
  - `tools/` - Agent tool implementations

### Frontend
- `frontend/src/main.tsx` - App entry point
- `frontend/src/App.tsx` - Root component with routing
- `frontend/src/pages/` - Page components
  - `Library.tsx` - Content library management
  - `PlaybackControl.tsx` - Player and queue
  - `Campaigns.tsx` - Campaign grid editor
  - `AutoFlows.tsx` - Flow management
  - `Calendar.tsx` - Calendar week view
  - `AgentChat.tsx` - AI agent interface
  - `Upload.tsx` - Batch upload
  - `Users.tsx` - User management (admin)
  - `Voices.tsx` - TTS voice presets
  - `Settings.tsx` - App settings
- `frontend/src/components/` - Reusable components
  - `Form/` - Form component library (Input, Select, etc.)
  - `CampaignGrid.tsx` - 48-slot schedule grid
  - `FlowBuilder.tsx` - Drag-and-drop flow editor
  - `AudioPlayer.tsx` - VLC player UI
  - `VoicePreview.tsx` - TTS preview player
- `frontend/src/stores/` - Zustand stores
  - `authStore.ts` - Authentication state
  - `playbackStore.ts` - Playback state
  - `settingsStore.ts` - App settings
- `frontend/src/services/` - API client
  - `api.ts` - Axios instance with auth interceptors
- `frontend/src/theme/` - Design system
  - `tokens.ts` - Design tokens (colors, spacing, etc.)

### Documentation
- `README.md` - Project overview and setup
- `DESIGN_SYSTEM.md` - Complete design system documentation
- `docs/ARCHITECTURE.md` - System architecture

### Configuration
- `.env` - Environment variables (not in repo)
- `.env.example` - Environment variable template
- `pyproject.toml` - Python dependencies (Poetry)
- `frontend/package.json` - Frontend dependencies
- `docker-compose.yml` - Local development stack
- `firebase.json` - Firebase hosting configuration
- `apphosting.yaml` - Google Cloud Run deployment

---

## Development Workflows

### Starting Local Development

**Backend:**
```bash
cd backend
poetry install
poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
Backend runs at: `http://localhost:8000`

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```
Frontend runs at: `http://localhost:5173`

**MongoDB:**
```bash
docker-compose up -d mongodb
```
MongoDB runs at: `mongodb://localhost:27017`

### Running Tests

**Backend:**
```bash
cd backend
poetry run pytest
poetry run pytest --cov=app --cov-report=html
```

**Frontend:**
```bash
cd frontend
npm test
npm run test:watch
```

### Code Quality

**Backend:**
```bash
poetry run black .
poetry run isort .
poetry run mypy app
```

**Frontend:**
```bash
npm run lint
npm run format
npm run type-check
```

---

## AI Agent System

The AI Agent is the core orchestration system for autonomous radio management.

### Agent Capabilities

1. **Content Selection** - Choose next song/show based on:
   - Time of day and day of week
   - Genre balance and variety
   - Recent play history (avoid repetition)
   - Emergency playlist fallback

2. **Commercial Scheduling** - Insert commercials:
   - Check campaign grid for scheduled slots
   - Honor campaign priorities
   - Insert jingles between commercials
   - Respect campaign budgets

3. **Flow Execution** - Execute automated workflows:
   - Monitor active flows and schedules
   - Execute actions at specified times
   - Handle TTS announcements and time checks
   - Manage volume levels

4. **Decision Making** - Natural language reasoning:
   - Chat with users in Hebrew or English
   - Explain decisions and actions
   - Request confirmation in Prompt Mode
   - Log all decisions for audit trail

### Agent Tools

Available tools for the AI agent:

```python
# Content Tools
get_content_library()
get_content_by_id(content_id)
search_content(query, filters)

# Playback Tools
play_content(content_id)
pause_playback()
resume_playback()
skip_current()
get_queue()
set_volume(level)

# Campaign Tools
get_active_campaigns()
get_scheduled_commercials(time_slot)
log_commercial_play(campaign_id, content_id)

# Flow Tools
get_active_flows()
execute_flow_action(flow_id, action)

# TTS Tools
synthesize_speech(text, voice_preset, language)
preview_voice(text, settings)

# Calendar Tools
get_upcoming_events()
create_calendar_event(title, start_time, end_time, content_id)
```

### Agent Configuration

**Environment Variables:**
```bash
AGENT_MODE=full_automation              # or "prompt"
ANTHROPIC_API_KEY=sk-ant-...
AGENT_TIMEZONE=America/New_York         # Miami timezone
AGENT_DEFAULT_LANGUAGE=he               # Hebrew primary
```

**Custom LLM Config:**
- Users can override API key and model in database
- Collection: `llm_config`
- Fields: `api_key`, `model`, `max_tokens`, `temperature`

---

## Commercial Campaign System

### Grid-Based Scheduling

**48 Time Slots per Day:**
- 30-minute intervals (00:00-00:30, 00:30-01:00, ..., 23:30-24:00)
- Each slot can have assigned campaign
- Visual grid editor in frontend
- Color-coded by campaign

**Campaign Properties:**
```python
{
  "name": "Campaign Name",
  "start_date": "2026-01-01",
  "end_date": "2026-01-31",
  "content_ids": ["content1", "content2"],  # Commercials to play
  "schedule_grid": {                         # 48 slots
    "0": false,   # 00:00-00:30
    "1": false,   # 00:30-01:00
    ...
    "18": true,   # 09:00-09:30 (assigned)
    ...
    "47": false   # 23:30-24:00
  },
  "priority": 1,
  "budget": 50000,              # ILS
  "contract_value": 75000,      # ILS
  "price_per_slot": 250,        # ILS
  "is_active": true
}
```

### Campaign Execution

1. **Slot Detection** - AI agent checks current 30-min slot
2. **Campaign Lookup** - Find active campaigns for this slot
3. **Priority Sorting** - Higher priority campaigns play first
4. **Content Selection** - Rotate through campaign content_ids
5. **Jingle Insertion** - Play station ID jingle before/after
6. **Logging** - Record play in `commercial_play_logs`
7. **Calendar Sync** - Optional Google Calendar event creation

---

## TTS System

### Chatterbox TTS (Primary)

**Features:**
- **CPU-Based:** No GPU required
- **Multilingual:** Hebrew, English, and 20+ languages
- **Voice Cloning:** Create custom voice presets
- **Offline:** Works without internet
- **Fast:** ~2-3 seconds per sentence

**Usage:**
```python
from app.services.tts_service import synthesize_speech

audio_path = await synthesize_speech(
    text="שלום ורדיו ישראל",
    voice_preset="default",
    language="he",
    exaggeration=1.0
)
```

### ElevenLabs (Fallback)

**Features:**
- **Cloud-Based:** Requires API key
- **High Quality:** Premium voice quality
- **More Voices:** Larger voice library

**Configuration:**
```bash
ELEVENLABS_API_KEY=your_key     # Optional
USE_ELEVENLABS=false            # Fallback toggle
```

### Voice Presets

**Database Collection:** `voice_presets`

**Preset Structure:**
```python
{
  "name": "Station Voice",
  "voice_id": "chatterbox_default",
  "language": "he",
  "speed": 1.0,
  "pitch": 1.0,
  "exaggeration": 1.0,
  "is_default": true
}
```

---

## Google Integrations

### Google Drive

**Purpose:** Content storage and automatic syncing

**Watched Folders:**
- Songs folder → Import as "song" type
- Shows folder → Import as "show" type
- Commercials folder → Import as "commercial" type

**Sync Process:**
1. Background task runs every 5 minutes
2. Scans watched Drive folders for new files
3. Downloads audio files to local cache
4. Extracts metadata (mutagen)
5. Creates content documents in MongoDB
6. Logs sync in `sync_logs` collection

### Gmail

**Purpose:** Import audio attachments automatically

**Configuration:**
- Monitor specific Gmail inbox
- Filter by sender or subject
- Auto-download attachments
- Classification: User confirms content type

### Google Calendar

**Purpose:** Schedule content playback

**Features:**
- Create events via UI
- Sync campaigns to calendar
- Calendar watcher monitors events
- Auto-playback at event time

**Watcher Service:**
```python
# Runs every 15 seconds
calendar_watcher.start()
# Checks: current_time >= event.start_time
# Triggers: play_content(event.content_id)
```

---

## Emergency System

**Purpose:** Prevent dead air (silence on air)

**Emergency Playlist:**
- Collection: `settings.emergency_playlist`
- Contains backup content IDs
- Auto-plays if:
  - Queue is empty
  - AI agent fails to select content
  - Network issues prevent content loading
  - VLC player encounters errors

**Fallback Behavior:**
1. Detect playback stopped unexpectedly
2. Check if queue has items → play next
3. If queue empty → select from emergency playlist
4. If emergency playlist empty → play most recent content
5. Send alert notification to admins

---

## Testing Requirements

### Backend
- pytest with async support
- Test coverage (no minimum requirement)
- Integration tests with test MongoDB database
- Mock external APIs (Google, Twilio, Anthropic)

### Frontend
- Vitest for unit tests
- React Testing Library for component tests
- E2E tests with Playwright (optional)
- Test Hebrew RTL rendering

---

## Deployment

### Development
```bash
docker-compose up
```
Runs: MongoDB, Backend, Frontend locally

### Production

**Backend (Google Cloud Run):**
```bash
gcloud run deploy israeli-radio-backend \
  --source ./backend \
  --region us-central1
```

**Frontend (Firebase Hosting):**
```bash
cd frontend
npm run build
firebase deploy --only hosting:prod
```

**MongoDB Atlas:**
- Production cluster: `cluster0.ydrvaft.mongodb.net`
- Database: `israeli_radio`

### Environment Variables

**Backend `.env`:**
```bash
MONGODB_URI=mongodb+srv://...
DATABASE_NAME=israeli_radio
AGENT_MODE=full_automation
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_DRIVE_CREDENTIALS=...
GOOGLE_GMAIL_CREDENTIALS=...
GOOGLE_CALENDAR_CREDENTIALS=...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
ADMIN_EMAIL=...
ADMIN_PHONE=...
CACHE_DIR=./cache
CACHE_MAX_SIZE_GB=10
AGENT_TIMEZONE=America/New_York
FIREBASE_CREDENTIALS=...
```

**Frontend `.env`:**
```bash
VITE_API_URL=https://api.israeliradio.com
VITE_FIREBASE_CONFIG=...
```

---

## Common Pitfalls

### ❌ Don't:
- Use inline styles instead of Tailwind
- Use pip instead of Poetry
- Hardcode values (use environment variables)
- Create mocks/stubs in production code
- Duplicate code across files
- Ignore Hebrew RTL rendering
- Mix Python's Motor async patterns with sync code
- Forget to handle WebSocket disconnections

### ✅ Do:
- Use Tailwind classes for all styling
- Use Poetry for all Python dependencies
- Use environment variables for configuration
- Test with Hebrew text for RTL layouts
- Handle WebSocket reconnection logic
- Use async/await consistently in backend
- Log AI agent decisions for debugging
- Test emergency playlist fallback
- Monitor cache directory size (10GB limit)
- Handle Google API rate limits gracefully

---

## Version History

- **1.0.0** (2026-01-12) - Initial project configuration
  - Defined tech stack and architecture
  - Established glassmorphism design system
  - Documented AI agent system
  - Created custom agent definitions

---

**Status:** ✅ Production Deployment
**Maintainer:** Israeli Radio Station Team
**Location:** Miami/Boca Raton/Florida Keys
**Community:** Israeli Diaspora in South Florida
