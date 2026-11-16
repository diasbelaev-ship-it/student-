#!/usr/bin/env bash
set -euo pipefail

if [[ "${CODESPACES:-}" != "true" ]]; then
  echo "Эта команда предназначена для GitHub Codespaces."
  exit 1
fi

port="${PORT:-3001}"
log_file="${TMPDIR:-/tmp}/studia-codespace.log"
pid_file="${TMPDIR:-/tmp}/studia-codespace-${port}.pid"

if curl --silent --show-error --fail "http://127.0.0.1:${port}/" --output /dev/null 2>/dev/null; then
  echo "Studia уже запущена."
  exit 0
fi

if [[ -n "${CODESPACE_NAME:-}" && -n "${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-}" ]]; then
  export CLIENT_ORIGIN="https://${CODESPACE_NAME}-${port}.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
fi

nohup node server/index.js >"${log_file}" 2>&1 </dev/null &
server_pid=$!
printf '%s\n' "${server_pid}" >"${pid_file}"

for _ in {1..30}; do
  if curl --silent --show-error --fail "http://127.0.0.1:${port}/" --output /dev/null 2>/dev/null; then
    if [[ -n "${CLIENT_ORIGIN:-}" ]]; then
      echo "Studia запущена: ${CLIENT_ORIGIN}"
    else
      echo "Studia запущена на порту ${port}."
    fi
    echo "Логи сервера: ${log_file}"
    exit 0
  fi
  if ! kill -0 "${server_pid}" 2>/dev/null; then
    break
  fi
  sleep 1
done

echo "Не удалось запустить Studia. Последние строки лога:"
tail -n 80 "${log_file}" || true
kill "${server_pid}" 2>/dev/null || true
rm -f "${pid_file}"
exit 1
