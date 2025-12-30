"""Natural language parsing for flow descriptions."""

import logging
import re
import json
from typing import Dict, List, Optional

from app.models.flow import FlowActionType
from app.config import settings

logger = logging.getLogger(__name__)


async def parse_natural_language_flow(text: str) -> Dict:
    """
    Parse a natural language description into a flow using Claude AI.

    Example: "play hasidi music between 8-10 am, then play 2 commercials, then play mizrahi music"
    """
    actions = []

    if not settings.anthropic_api_key:
        logger.warning("ANTHROPIC_API_KEY not set, falling back to regex parsing")
    else:
        actions = await _parse_with_claude(text)

    # Fallback to regex parsing if Claude failed or not configured
    if not actions:
        actions = _parse_with_regex(text)

    # Extract schedule from text
    schedule = _extract_schedule(text)

    return {
        "parsed": True,
        "actions": actions,
        "schedule": schedule,
        "original_text": text
    }


async def _parse_with_claude(text: str) -> List[Dict]:
    """Parse flow description using Claude AI."""
    try:
        import anthropic

        client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

        prompt = _build_claude_prompt(text)

        response = client.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}]
        )

        # Extract JSON from response
        response_text = response.content[0].text.strip()

        # Remove markdown code blocks if present
        if response_text.startswith("```"):
            lines = response_text.split("\n")
            response_text = "\n".join(lines[1:-1])
        if response_text.startswith("json"):
            response_text = response_text[4:].strip()

        actions = json.loads(response_text)
        logger.info(f"Claude parsed {len(actions)} actions from: {text}")
        return actions

    except Exception as e:
        logger.error(f"Failed to parse with Claude: {e}")
        return []


def _build_claude_prompt(text: str) -> str:
    """Build the prompt for Claude to parse flow descriptions."""
    return f"""Parse this radio flow description into structured actions. Return ONLY a JSON array of actions, no explanations.

Available action types:
- play_genre: Play music from a genre (hasidi, mizrahi, happy, israeli, pop, rock, mediterranean, classic, hebrew, all, mixed)
  * song_count: Exact number of songs to play (e.g., "play 1 song" -> song_count: 1, "play 5 songs" -> song_count: 5)
  * duration_minutes: Alternative to song_count - play songs for this duration (system calculates ~4 min/song)
  * If neither specified, defaults to 10 songs
- play_commercials: Play commercials. Support:
  * commercial_count: How many times to REPEAT the commercial set (default 1, max 10)
  * batch_number: (1, 2, 3, etc.) - refers to predefined commercial batches
  * To play ALL commercials once: set commercial_count to 1 or omit it (system fetches all active commercials)
  * If "Batch-1", "Batch-2" etc mentioned, set batch_number field
  * If "Play All Commercials" or "all commercial batches": generate MULTIPLE play_commercials actions, one for each batch (batch_number: 1, then batch_number: 2, then batch_number: 3)
- wait: Wait for a duration
- set_volume: Set volume level

Description: {text}

PARSING RULES:
1. If description mentions ALTERNATING patterns (e.g., "every 30 minutes", "on the hour do X, on the half-hour do Y"), create a sequence that can loop
2. For time-based patterns, create actions in the order they would execute in one cycle
3. Each commercial batch mention should be a SEPARATE action
4. IMPORTANT: After EVERY commercial action, add a music action to continue playing
5. If the last action is commercials, ALWAYS add a final music action so the loop is complete
6. If "repeat" or "loop" is mentioned, the flow should loop - still create the action sequence for one cycle

Examples:

Input: "Play 1 song, then all commercials, then continue playing music"
Output:
[
  {{"action_type": "play_genre", "genre": "mixed", "song_count": 1, "description": "Play 1 song"}},
  {{"action_type": "play_commercials", "commercial_count": 1, "description": "Play all commercials"}},
  {{"action_type": "play_genre", "genre": "mixed", "song_count": 10, "description": "Continue playing music"}}
]

Input: "Play 3 happy songs, then 2 commercials, then mizrahi for 20 minutes"
Output:
[
  {{"action_type": "play_genre", "genre": "happy", "song_count": 3, "description": "Play 3 happy songs"}},
  {{"action_type": "play_commercials", "commercial_count": 2, "description": "Play 2 commercials"}},
  {{"action_type": "play_genre", "genre": "mizrahi", "duration_minutes": 20, "description": "Play mizrahi for 20 minutes"}}
]

Input: "Play music, every 30 min check time: on the hour play Batch-1 commercials, on half-hour play Batch-2 commercials, then continue music"
Output:
[
  {{"action_type": "play_genre", "genre": "mixed", "duration_minutes": 30, "description": "Play music"}},
  {{"action_type": "play_commercials", "batch_number": 1, "description": "Play Batch-1 commercials (on the hour)"}},
  {{"action_type": "play_genre", "genre": "mixed", "duration_minutes": 30, "description": "Continue playing music"}},
  {{"action_type": "play_commercials", "batch_number": 2, "description": "Play Batch-2 commercials (on half-hour)"}},
  {{"action_type": "play_genre", "genre": "mixed", "duration_minutes": 30, "description": "Continue playing music"}}
]

Input: "Play 1 song, then play all commercial batches, then continue music"
Output:
[
  {{"action_type": "play_genre", "genre": "mixed", "song_count": 1, "description": "Play 1 song"}},
  {{"action_type": "play_commercials", "batch_number": 1, "description": "Play Batch-1 commercials"}},
  {{"action_type": "play_commercials", "batch_number": 2, "description": "Play Batch-2 commercials"}},
  {{"action_type": "play_commercials", "batch_number": 3, "description": "Play Batch-3 commercials"}},
  {{"action_type": "play_genre", "genre": "mixed", "song_count": 10, "description": "Continue playing music"}}
]

Now parse this description: {text}

Return the JSON array:"""


def _parse_with_regex(text: str) -> List[Dict]:
    """Parse flow description using regex patterns."""
    parts = re.split(r',\s*then\s*|,\s*אז\s*|,\s*ואז\s*', text, flags=re.IGNORECASE)

    # Genre mappings (Hebrew to English)
    genre_map = {
        "חסידי": "hasidi",
        "חסידית": "hasidi",
        "מזרחי": "mizrahi",
        "מזרחית": "mizrahi",
        "פופ": "pop",
        "רוק": "rock",
        "ים תיכוני": "mediterranean",
        "קלאסי": "classic",
        "עברי": "hebrew",
    }

    actions = []

    for part in parts:
        part = part.strip().lower()

        # Parse genre playback
        genre_match = re.search(
            r'(?:play|נגן|השמע)\s+(\w+)\s+(?:music|מוזיקה)?(?:\s+(?:between|from|בין|מ-?)\s*(\d{1,2})(?::(\d{2}))?\s*(?:-|to|עד)\s*(\d{1,2})(?::(\d{2}))?\s*(?:am|pm|בבוקר|בערב)?)?(?:\s+for\s+(\d+)\s*(?:minutes?|min|דקות?))?',
            part
        )
        if genre_match:
            genre = genre_match.group(1)
            genre = genre_map.get(genre, genre)

            start_hour = genre_match.group(2)
            end_hour = genre_match.group(4)
            duration = genre_match.group(6)

            action = {
                "action_type": FlowActionType.PLAY_GENRE.value,
                "genre": genre,
                "description": f"Play {genre} music"
            }

            if duration:
                action["duration_minutes"] = int(duration)
            elif start_hour and end_hour:
                action["duration_minutes"] = (int(end_hour) - int(start_hour)) * 60

            actions.append(action)
            continue

        # Parse commercial playback
        commercial_match = re.search(
            r'(?:play|נגן|השמע)\s+(\d+)\s+(?:commercials?|פרסומות?|פרסומים?)',
            part
        )
        if commercial_match:
            count = int(commercial_match.group(1))
            actions.append({
                "action_type": FlowActionType.PLAY_COMMERCIALS.value,
                "commercial_count": count,
                "description": f"Play {count} commercial(s)"
            })
            continue

        # Parse wait
        wait_match = re.search(
            r'(?:wait|חכה|המתן)\s+(\d+)\s*(?:minutes?|min|דקות?)',
            part
        )
        if wait_match:
            minutes = int(wait_match.group(1))
            actions.append({
                "action_type": FlowActionType.WAIT.value,
                "duration_minutes": minutes,
                "description": f"Wait {minutes} minutes"
            })
            continue

        # Parse volume
        volume_match = re.search(
            r'(?:set\s+)?volume\s+(?:to\s+)?(\d+)|עוצמה\s+(\d+)',
            part
        )
        if volume_match:
            volume = int(volume_match.group(1) or volume_match.group(2))
            actions.append({
                "action_type": FlowActionType.SET_VOLUME.value,
                "volume_level": volume,
                "description": f"Set volume to {volume}"
            })

    return actions


def _extract_schedule(text: str) -> Optional[Dict]:
    """Extract schedule information from text."""
    time_match = re.search(
        r'(?:between|from|at|בין|מ-?|ב-?)\s*(\d{1,2})(?::(\d{2}))?\s*(?:am|בבוקר)?(?:\s*(?:-|to|עד)\s*(\d{1,2})(?::(\d{2}))?\s*(?:am|pm|בבוקר|בערב)?)?',
        text, re.IGNORECASE
    )

    if not time_match:
        return None

    start_hour = int(time_match.group(1))
    start_min = int(time_match.group(2) or 0)
    schedule = {
        "start_time": f"{start_hour:02d}:{start_min:02d}",
        "days_of_week": [0, 1, 2, 3, 4, 5, 6]
    }

    if time_match.group(3):
        end_hour = int(time_match.group(3))
        end_min = int(time_match.group(4) or 0)
        schedule["end_time"] = f"{end_hour:02d}:{end_min:02d}"

    return schedule
