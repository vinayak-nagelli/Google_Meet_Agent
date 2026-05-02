from openai import OpenAI
import os
import json
from typing import List, Dict, Optional

def get_groq_client():
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key:
        raise ValueError("GROQ_API_KEY is not set. Please add it to your .env file.")
    return OpenAI(
        api_key=api_key,
        base_url="https://api.groq.com/openai/v1"
    )

def format_messages_for_prompt(messages: List[Dict]) -> str:
    lines = []
    for msg in messages:
        sender = msg.get("sender", "Unknown")
        text = msg.get("message", "")
        ts = msg.get("timestamp", "")
        if sender in ("You via Bot", "Bot (Auto-reply)"):
            continue
        lines.append(f"[{ts}] {sender}: {text}")
    return "\n".join(lines) if lines else ""

# ── LLM Auto-Reply ────────────────────────────────────────────────────────────

AUTO_REPLY_PROMPT = """You are a smart assistant controlling a bot in a Google Meet chat on behalf of a user.

About the user (bot owner):
{user_context}

The user has given this auto-reply instruction:
"{instruction}"

Someone just sent this message in the meeting chat:
Sender: {sender}
Message: "{message}"

Decide:
1. Does this message match or relate to the user's instruction (directly or by paraphrase)?
2. If yes, craft an appropriate reply that fits both the instruction AND the user's context/role.

Return ONLY valid JSON, no explanation, no markdown:
{{"should_reply": true, "response": "the reply text"}}
or
{{"should_reply": false, "response": ""}}

Rules:
- If the message is completely unrelated to the instruction, return should_reply: false.
- If related, return should_reply: true with a response that matches the instruction's intent.
- Use the "About the user" section to make the reply sound natural and contextual.
- If no user context is given, still reply based on the instruction alone.
- Do NOT add extra commentary. Return ONLY the JSON."""


def check_auto_reply_with_llm(instruction: str, sender: str, message: str, user_context: str = "") -> Optional[str]:
    """
    Use Groq LLM (fast 8B model) to decide if a chat message should trigger auto-reply.
    Returns the reply text if it should reply, or None if not.
    """
    if not instruction.strip():
        return None

    context_text = user_context.strip() if user_context.strip() else "No additional context provided about the user."

    try:
        client = get_groq_client()
        prompt = AUTO_REPLY_PROMPT.format(
            user_context=context_text,
            instruction=instruction,
            sender=sender,
            message=message
        )
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": "You are a meeting bot assistant. Always respond with valid JSON only."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1,
            max_tokens=200
        )
        raw = response.choices[0].message.content.strip()

        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()

        data = json.loads(raw)
        if data.get("should_reply") and data.get("response", "").strip():
            return data["response"].strip()
        return None

    except Exception as e:
        print(f"[AutoReply LLM] Error: {e}")
        return None



# ── Meeting Summary ───────────────────────────────────────────────────────────

SUMMARY_PROMPT = """You are an AI meeting analyst. Analyze the following Google Meet chat messages and return ONLY a valid JSON object — no markdown, no explanation, no code blocks.

Chat messages:
{chat_text}

Return this exact JSON structure:
{{
  "meeting_summary": "2-3 sentence overall summary of the meeting discussion",
  "participant_summaries": [
    {{
      "participant": "Name",
      "message_count": 0,
      "main_points": ["point 1", "point 2"],
      "questions_asked": ["question 1"],
      "decisions_contributed": ["decision 1"],
      "action_items": ["action item 1"],
      "deadlines_mentioned": ["deadline 1"]
    }}
  ],
  "key_points": ["key point 1", "key point 2"],
  "decisions": ["decision 1"],
  "action_items": ["action item 1"],
  "deadlines": ["deadline 1"],
  "unanswered_questions": ["unanswered question 1"],
  "important_messages": [
    {{
      "sender": "Name",
      "message": "the message",
      "reason": "why it is important"
    }}
  ],
  "limitations": ["Summary is based only on chat messages captured after bot joined. Previous messages may not be available."]
}}

Rules:
- Use ONLY the provided chat messages. Do NOT hallucinate.
- If a field has no data, use an empty list [] or write "Not available in captured chat."
- Participant summaries must be grouped by sender name.
- Extract action items only if clearly mentioned.
- Extract deadlines only if clearly mentioned.
- Unanswered questions are questions that were not answered in the chat.
- Return ONLY the JSON object. No other text."""


def generate_summary(messages: List[Dict]) -> Dict:
    chat_text = format_messages_for_prompt(messages)

    if not chat_text.strip():
        return {
            "error": "No captured chat messages available for summary.",
            "meeting_summary": "No chat messages were captured by the bot.",
            "participant_summaries": [],
            "key_points": [],
            "decisions": [],
            "action_items": [],
            "deadlines": [],
            "unanswered_questions": [],
            "important_messages": [],
            "limitations": ["No chat messages were captured after the bot joined."]
        }

    client = get_groq_client()
    prompt = SUMMARY_PROMPT.format(chat_text=chat_text)

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": "You are an AI meeting analyst. Always respond with valid JSON only."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.2,
        max_tokens=4096
    )

    raw = response.choices[0].message.content.strip()

    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {
            "error": "Groq returned invalid JSON. Raw response below.",
            "raw_response": raw,
            "meeting_summary": "Could not parse AI response.",
            "participant_summaries": [],
            "key_points": [],
            "decisions": [],
            "action_items": [],
            "deadlines": [],
            "unanswered_questions": [],
            "important_messages": [],
            "limitations": ["JSON parsing failed. See raw_response for debugging."]
        }


def format_messages_for_prompt(messages: List[Dict]) -> str:
    lines = []
    for msg in messages:
        sender = msg.get("sender", "Unknown")
        text = msg.get("message", "")
        ts = msg.get("timestamp", "")
        # Skip bot's own messages in the summary
        if sender in ("You via Bot", "Bot (Auto-reply)"):
            continue
        lines.append(f"[{ts}] {sender}: {text}")
    return "\n".join(lines) if lines else ""

SUMMARY_PROMPT = """You are an AI meeting analyst. Analyze the following Google Meet chat messages AND spoken audio transcript. Return ONLY a valid JSON object — no markdown, no explanation, no code blocks.

Chat messages:
{chat_text}

Audio Transcript:
{transcript_text}

Return this exact JSON structure:
{{
  "meeting_summary": "2-3 sentence overall summary of the meeting discussion",
  "participant_summaries": [
    {{
      "participant": "Name",
      "message_count": 0,
      "main_points": ["point 1", "point 2"],
      "questions_asked": ["question 1"],
      "decisions_contributed": ["decision 1"],
      "action_items": ["action item 1"],
      "deadlines_mentioned": ["deadline 1"]
    }}
  ],
  "key_points": ["key point 1", "key point 2"],
  "decisions": ["decision 1"],
  "action_items": ["action item 1"],
  "deadlines": ["deadline 1"],
  "unanswered_questions": ["unanswered question 1"],
  "important_messages": [
    {{
      "sender": "Name or Audio Spoken",
      "message": "the message",
      "reason": "why it is important"
    }}
  ],
  "limitations": ["Summary is based only on captured chat and transcribed audio after the bot joined. Previous messages may not be available."]
}}

Rules:
- Use ONLY the provided chat messages and transcript. Do NOT hallucinate.
- If a field has no data, use an empty list [] or write "Not available in captured data."
- Participant summaries must be grouped by sender name (for chat). If spoken in audio, try to infer the speaker or group as 'Spoken Audio'.
- Extract action items only if clearly mentioned.
- Extract deadlines only if clearly mentioned.
- Return ONLY the JSON object. No other text."""


def generate_summary(messages: List[Dict], transcript_segments: List[Dict] = None) -> Dict:
    chat_text = format_messages_for_prompt(messages)
    
    transcript_text = ""
    if transcript_segments:
        from app.services.transcription_service import format_timestamp
        transcript_lines = [f"{format_timestamp(seg['start'])}: {seg['text']}" for seg in transcript_segments]
        transcript_text = "\n".join(transcript_lines)

    if not chat_text.strip() and not transcript_text.strip():
        return {
            "error": "No captured chat messages available for summary.",
            "meeting_summary": "No chat messages were captured by the bot.",
            "participant_summaries": [],
            "key_points": [],
            "decisions": [],
            "action_items": [],
            "deadlines": [],
            "unanswered_questions": [],
            "important_messages": [],
            "limitations": ["No chat messages were captured after the bot joined."]
        }

    client = get_groq_client()

    prompt = SUMMARY_PROMPT.format(chat_text=chat_text, transcript_text=transcript_text)

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": "You are an AI meeting analyst. Always respond with valid JSON only."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.2,
        max_tokens=4096
    )

    raw = response.choices[0].message.content.strip()

    # Strip markdown code blocks if Groq wraps in them
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {
            "error": "Groq returned invalid JSON. Raw response below.",
            "raw_response": raw,
            "meeting_summary": "Could not parse AI response.",
            "participant_summaries": [],
            "key_points": [],
            "decisions": [],
            "action_items": [],
            "deadlines": [],
            "unanswered_questions": [],
            "important_messages": [],
            "limitations": ["JSON parsing failed. See raw_response for debugging."]
        }
