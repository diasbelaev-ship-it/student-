#!/usr/bin/env python3
"""Create a Studia source ZIP with sensitive data excluded by default."""

from __future__ import annotations

import argparse
from datetime import datetime
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
ALWAYS_EXCLUDE = {
    '.git', '.agents', '.codex', '.aws', 'node_modules', 'dist', 'backups',
    '__pycache__', '.pytest_cache', '.venv', 'venv', 'output', '.playwright-cli', '.taste-skill',
}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--include-history', action='store_true', help='Включить CHAT_HISTORY.md')
    parser.add_argument('--include-data', action='store_true', help='Включить личную базу и файлы групп')
    parser.add_argument('--include-lab-work', action='store_true', help='Включить папку lab_work')
    parser.add_argument('--output', type=Path, help='Путь ZIP (по умолчанию — Studia-handoff-ДАТА.zip)')
    args = parser.parse_args()

    output = (args.output or ROOT / f"Studia-handoff-{datetime.now():%Y%m%d-%H%M}.zip").resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    print('Проверьте содержимое архива перед передачей: исходный код тоже может содержать личные данные.')
    if args.include_data:
        print('ВНИМАНИЕ: архив включает личные аккаунты, расписание и учебные записи из data/.')
        print('Передавайте его только доверенному получателю, не публикуйте публично.')

    entries = []
    for path in ROOT.rglob('*'):
        if path.is_symlink() or not path.is_file() or path.resolve() == output:
            continue
        relative = path.relative_to(ROOT)
        parts = relative.parts
        if any(part in ALWAYS_EXCLUDE for part in parts):
            continue
        name = path.name.lower()
        if name == '.env' or name.startswith('.env.') and name != '.env.example':
            continue
        if name.endswith(('.log', '.zip')) or name in {'thumbs.db', '.ds_store'}:
            continue
        if parts[0] == 'data' and not args.include_data:
            continue
        if parts[0] == 'lab_work' and not args.include_lab_work:
            continue
        if path.name == 'CHAT_HISTORY.md' and not args.include_history:
            continue
        entries.append((path, relative))

    with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=8) as archive:
        for path, relative in entries:
            archive.write(path, relative.as_posix())

    print(f'Архив создан: {output}')
    print(f'Файлов: {len(entries)}')
    print('История чата: ' + ('включена' if args.include_history else 'не включена'))
    print('Локальные данные: ' + ('включены' if args.include_data else 'не включены'))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
