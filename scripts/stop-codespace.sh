#!/usr/bin/env bash
set -euo pipefail

port="${PORT:-3001}"
pid_file="${TMPDIR:-/tmp}/studia-codespace-${port}.pid"

if [[ ! -f "${pid_file}" ]]; then
  echo "Файл процесса Studia не найден. Остановите Codespace, чтобы выключить сервер."
  exit 0
fi

server_pid="$(cat "${pid_file}")"
if [[ "${server_pid}" =~ ^[0-9]+$ ]] && kill -0 "${server_pid}" 2>/dev/null; then
  kill -TERM "${server_pid}"
  echo "Studia остановлена. Codespace всё ещё работает; остановите его в меню GitHub, чтобы прекратить расход core-часов."
else
  echo "Процесс Studia уже остановлен."
fi
rm -f "${pid_file}"
