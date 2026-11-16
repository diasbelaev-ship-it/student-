function resolveBindAddress(env = process.env) {
  const explicitHost = typeof env.HOST === 'string' ? env.HOST.trim() : '';
  if (explicitHost) return explicitHost;
  return env.CODESPACES === 'true' ? '0.0.0.0' : '127.0.0.1';
}

module.exports = { resolveBindAddress };
