"""Export user-visible Codex messages from a local rollout JSONL.

Usage: python scripts/export_chat_history.py SOURCE.jsonl CHAT_HISTORY.md
Only user messages and assistant commentary/final messages are exported.
"""

import argparse
import json
import re
from pathlib import Path


KEY_PATTERNS = [
    re.compile(r"AQ\.[A-Za-z0-9_-]{20,}"),
    re.compile(r"AIza[A-Za-z0-9_-]{20,}"),
    re.compile(r"(?im)^(GEMINI_API_KEY\s*=\s*)\S+"),
]


def clean(text):
    text = re.sub(r"<in-app-browser-context\b[^>]*>.*?</in-app-browser-context>", "", text, flags=re.S)
    text = re.sub(r"<environment_context>.*?</environment_context>", "", text, flags=re.S)
    text = re.sub(r"<external_codex_apps_open_page>.*?</external_codex_apps_open_page>", "", text, flags=re.S)
    text = re.sub(r"(?m)^# Files mentioned by the user:.*?(?=^## My request:)", "", text, flags=re.S)
    if "## My request:" in text:
        text = text.rsplit("## My request:", 1)[-1]
    for pattern in KEY_PATTERNS:
        text = pattern.sub(lambda m: m.group(1) + "[КЛЮЧ УДАЛЁН]" if m.lastindex else "[КЛЮЧ УДАЛЁН]", text)
    return text.strip()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    prior_excerpt = ""
    with args.source.open(encoding="utf-8") as handle:
        for line in handle:
            item = json.loads(line)
            payload = item.get("payload", {})
            if item.get("type") != "response_item" or payload.get("role") != "user":
                continue
            raw = "\n".join(part.get("text", "") for part in payload.get("content", []))
            for candidate in raw.splitlines():
                if not candidate.startswith('{"conversationId"'):
                    continue
                try:
                    reference = json.loads(candidate)
                    messages = reference.get("priorConversation", {}).get("conversation", [])
                    prior_excerpt = "\n".join(
                        block.get("text", "")
                        for message in messages
                        for block in message.get("content", [])
                        if block.get("content_type") == "text"
                    )
                except (ValueError, TypeError, AttributeError):
                    pass
                break
            if prior_excerpt:
                break
    out = [
        "# История обсуждения Studia",
        "",
        "Экспорт пользовательских сообщений и видимых ответов Codex из локального журнала текущего чата. ",
        "Служебные вызовы инструментов и внутренние рассуждения не включены. Вложения-изображения ",
        "не перенесены; их места отмечены в переписке. Известные форматы ключей API удалены. ",
        "Часть ранних сообщений в локальном журнале уже содержит повреждённую кодировку; восстановить их дословно из него невозможно.",
        "",
        "Предыдущий ChatGPT-чат «Разработка платформы студентов» (`6acfc2b3-5f04-83ed-89a7-dc4666d6546e`) ",
        "был доступен только как ограниченный фрагмент, встроенный в первое сообщение этого чата. ",
        "Его полный дословный текст здесь отсутствует. Главные требования и развитие идеи собраны в `PROJECT_VISION.md` и `README.md`.",
        "",
    ]
    if prior_excerpt:
        out.extend(["## Доступный фрагмент предыдущего ChatGPT-чата", "", clean(prior_excerpt), "", "---", ""])
    count = 0
    with args.source.open(encoding="utf-8") as handle:
        for line in handle:
            item = json.loads(line)
            payload = item.get("payload", {})
            if item.get("type") != "response_item" or payload.get("type") != "message":
                continue
            role = payload.get("role")
            if role not in ("user", "assistant"):
                continue
            if role == "assistant" and payload.get("phase") not in ("commentary", "final_answer"):
                continue
            contents = payload.get("content", [])
            raw = "\n".join(
                part.get("text", "")
                for part in contents
                if part.get("type") in ("input_text", "output_text")
            )
            message = clean(raw)
            images = sum(part.get("type") == "input_image" for part in contents)
            if images:
                message += f"\n\n[Приложено изображений: {images}; в архиве отсутствуют]"
            if not message or message.startswith("<external_codex_apps_"):
                continue
            label = "Пользователь" if role == "user" else "Codex"
            stamp = item.get("timestamp", "")[:19].replace("T", " ") + " UTC"
            out.extend([f"## {stamp} · {label}", "", message, "", "---", ""])
            count += 1
    args.output.write_text("\n".join(out), encoding="utf-8")
    print(f"Exported {count} messages to {args.output} ({args.output.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
