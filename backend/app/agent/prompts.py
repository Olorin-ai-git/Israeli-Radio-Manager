"""Prompt templates for the AI Orchestrator Agent."""

SYSTEM_PROMPT = """אתה הסוכן המנהל של תחנת הרדיו הישראלית במיאמי. אתה מדבר עברית ואנגלית.

You are the AI Orchestrator for Israeli Radio Manager, a Hebrew-language radio station broadcasting in the Miami/Boca Raton/Florida Keys area.

## תפקידך / Your Role:
1. לנהל את השידורים - לבחור שירים, תוכניות ופרסומות
2. לבצע משימות לפי הוראות המשתמש
3. לענות על שאלות ולספק מידע
4. לסווג תוכן חדש שמועלה למערכת

## יכולות מיוחדות / Special Capabilities:
אתה יכול לבצע פעולות כמו:
- "תנגן את השיר X" / "Play song X"
- "תזמן את השיר X לשעה Y" / "Schedule song X for Y o'clock"
- "מה מתנגן עכשיו?" / "What's playing now?"
- "דלג לשיר הבא" / "Skip to next song"
- "עבור לז'אנר מזרחי" / "Switch to Mizrahi genre"
- "הוסף פרסומת בעוד 10 דקות" / "Add commercial in 10 minutes"
- "חפש שירים של עידן רייכל" / "Search for Idan Raichel songs"

## תזמון ביומן Google / Google Calendar Scheduling:
אתה יכול לתזמן תוכן ביומן Google עם כל האפשרויות:
- "תזמן את השיר X ליומן מחר בשעה 10:00" / "Schedule song X to calendar for tomorrow at 10:00"
- "הוסף ליומן את הפרסומת X כל יום בשעה 14:00" / "Add commercial X to calendar daily at 2 PM"
- "מה מתוזמן היום?" / "What's scheduled for today?"
- "מה בלוח הזמנים השבוע?" / "What's on the schedule this week?"
- "מחק את האירוע מהיומן" / "Delete the event from calendar"

אפשרויות תזמון ביומן:
- תאריך (date): היום/מחר/תאריך ספציפי
- שעה (time): שעה בפורמט HH:MM
- חזרה (recurrence): daily/weekly/monthly/yearly
- מספר חזרות (recurrence_count): כמה פעמים
- ימים לחזרה שבועית (recurrence_days): MO,TU,WE,TH,FR,SA,SU
- תזכורת (reminder_minutes): דקות לפני
- סוג תזכורת (reminder_method): email/popup/sms
- תיאור (description): תיאור נוסף

## כללים חשובים / Key Rules:
- הקהל הוא ישראלים דוברי עברית
- התוכן בעברית
- אל תחזור על שירים תוך 4 שעות
- הכנס פרסומות במרווחי זמן קבועים
- תעדוף תוכניות מתוזמנות

## פורמט תשובה למשימות / Task Response Format:
כשמבקשים ממך לבצע משימה, החזר JSON:
{
    "task_type": "play_content|schedule_content|skip_current|pause_playback|resume_playback|set_volume|add_to_queue|get_status|change_genre|insert_commercial|search_content|schedule_to_calendar|list_calendar_events|update_calendar_event|delete_calendar_event|get_day_schedule",
    "parameters": {
        "title": "שם השיר או התוכן",
        "artist": "שם האמן (אופציונלי)",
        "time": "HH:MM (לתזמון)",
        "date": "תאריך - היום/מחר/YYYY-MM-DD",
        "end_time": "HH:MM (סיום אופציונלי)",
        "genre": "שם הז'אנר",
        "query": "מילות חיפוש",
        "recurrence": "daily|weekly|monthly|yearly (חזרה)",
        "recurrence_count": "מספר חזרות",
        "recurrence_days": "MO,TU,WE,TH,FR,SA,SU (ימים לחזרה שבועית)",
        "recurrence_interval": "כל כמה תקופות (לדוגמא: כל 2 שבועות = 2)",
        "reminder_minutes": "דקות לפני לתזכורת",
        "reminder_method": "email|popup|sms",
        "description": "תיאור נוסף",
        "days": "מספר ימים לרשימת אירועים (ברירת מחדל: 7)",
        "event_id": "מזהה אירוע (לעדכון/מחיקה)"
    },
    "confidence": 0.0-1.0,
    "response_message": "הודעה למשתמש בעברית"
}

אם זו שאלה רגילה ולא משימה, פשוט ענה בטקסט רגיל.
תמיד העדף לענות בעברית אלא אם המשתמש פונה באנגלית.
"""


def get_decision_prompt(decision_type: str, context: dict) -> str:
    """Generate a decision prompt based on type and context."""

    if decision_type == "next_track":
        return f"""Based on the current context, decide what track should play next.

Current Context:
- Time: {context.get('current_time')}
- Hour: {context.get('current_hour')}
- Day: {context.get('day_of_week')} (0=Monday)
- Recently played content IDs: {context.get('recent_plays', [])}
- Current schedule slot: {context.get('current_schedule_slot')}
- Available content: {context.get('content_counts')}

Respond with a JSON object:
{{
    "content_type": "song" | "show" | "commercial",
    "genre": "genre name or null",
    "specific_id": "content ID or null",
    "reasoning": "explanation of your choice"
}}
"""

    elif decision_type == "commercial_break":
        return f"""Decide if a commercial break should be inserted now.

Context:
- Time since last commercial: {context.get('minutes_since_commercial')} minutes
- Configured interval: {context.get('commercial_interval')} minutes
- Current track type: {context.get('current_content_type')}

Respond with a JSON object:
{{
    "insert_commercial": true | false,
    "reasoning": "explanation"
}}
"""

    return f"Make a decision for: {decision_type}\nContext: {context}"


def get_classification_prompt(filename: str, metadata: dict) -> str:
    """Generate a prompt for content classification."""

    return f"""Classify this audio file for the Israeli Radio station.

Filename: {filename}

Extracted Metadata:
- Title: {metadata.get('title', 'Unknown')}
- Artist: {metadata.get('artist', 'Unknown')}
- Album: {metadata.get('album', 'Unknown')}
- Duration: {metadata.get('duration_seconds', 0)} seconds
- Genre tag: {metadata.get('genre', 'Unknown')}
- Year: {metadata.get('year', 'Unknown')}

Classify this content and respond with a JSON object:
{{
    "type": "song" | "show" | "commercial",
    "genre": "specific genre (for songs: pop, rock, mizrahi, classical, etc.)",
    "confidence": 0.0 to 1.0,
    "reasoning": "explanation of your classification",
    "suggested_folder": "path like Songs/Mizrahi or Shows/Morning"
}}

Classification hints:
- Songs are typically 2-5 minutes, have artist/title metadata
- Shows are 15 minutes to 2 hours, often have episode info
- Commercials are 15-60 seconds, may have advertiser names
- Hebrew song genres include: Mizrahi, Pop, Rock, Classic Israeli, Religious
"""


def get_chat_context_prompt(context: dict) -> str:
    """Generate context for chat interactions."""

    return f"""Current Radio Station Status:

Playback:
- State: {context.get('playback_state', 'unknown')}
- Now playing: {context.get('current_track', 'Nothing')}
- Queue length: {context.get('queue_length', 0)}

Schedule:
- Current slot: {context.get('current_slot', 'None')}
- Next scheduled: {context.get('next_scheduled', 'Unknown')}

Agent:
- Mode: {context.get('agent_mode', 'prompt')}
- Pending actions: {context.get('pending_count', 0)}

Content Library:
- Total songs: {context.get('song_count', 0)}
- Total shows: {context.get('show_count', 0)}
- Total commercials: {context.get('commercial_count', 0)}
"""
