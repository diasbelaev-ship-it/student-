export const PROFILE_ACCENTS = [
  { id: 'emerald', label: 'Изумруд', color: '#126848', hover: '#0d583d', soft: '#e4f2e9' },
  { id: 'ocean', label: 'Морская волна', color: '#356d7b', hover: '#2b5b68', soft: '#e5f1f2' },
  { id: 'terracotta', label: 'Терракота', color: '#96563f', hover: '#7d4633', soft: '#f6eae4' },
  { id: 'plum', label: 'Слива', color: '#765d83', hover: '#624c6d', soft: '#f0eaf3' },
  { id: 'olive', label: 'Олива', color: '#62713e', hover: '#4f5d31', soft: '#eef1e3' },
];

export const STUDIA_THEMES = [
  {
    id: 'emerald',
    accent: '#126848',
    hover: '#0d583d',
    soft: '#e4f2e9',
    canvas: '#f2f6f2',
    wash: '#edf6ef',
    border: '#dce7dc',
  },
  {
    id: 'lagoon',
    accent: '#0e6870',
    hover: '#0a555c',
    soft: '#e1f0f0',
    canvas: '#f0f6f5',
    wash: '#eaf4f3',
    border: '#d5e5e3',
  },
  {
    id: 'sky',
    accent: '#315d83',
    hover: '#274b6b',
    soft: '#e6eef6',
    canvas: '#f1f5f8',
    wash: '#edf3f8',
    border: '#d8e3ed',
  },
  {
    id: 'plum',
    accent: '#704c79',
    hover: '#5c3e64',
    soft: '#f0eaf2',
    canvas: '#f6f2f7',
    wash: '#f1ecf3',
    border: '#e4dbe7',
  },
  {
    id: 'terracotta',
    accent: '#904c38',
    hover: '#783e2d',
    soft: '#f4e8e3',
    canvas: '#f8f3ef',
    wash: '#f5ece7',
    border: '#e7dbd4',
  },
  {
    id: 'ochre',
    accent: '#76520f',
    hover: '#62450b',
    soft: '#f4eedf',
    canvas: '#f8f6ef',
    wash: '#f3efdf',
    border: '#e8dfca',
  },
  {
    id: 'rose',
    accent: '#8a4352',
    hover: '#743746',
    soft: '#f4e8eb',
    canvas: '#f8f3f4',
    wash: '#f4ebed',
    border: '#e8dce0',
  },
  {
    id: 'olive',
    accent: '#536433',
    hover: '#435226',
    soft: '#edf0e4',
    canvas: '#f4f6ef',
    wash: '#eef2e7',
    border: '#dfe5d1',
  },
  {
    id: 'graphite',
    accent: '#4b5863',
    hover: '#39444d',
    soft: '#e9eef0',
    canvas: '#f2f5f5',
    wash: '#edf1f2',
    border: '#dae1e3',
  },
  {
    id: 'coral',
    accent: '#984f3d',
    hover: '#7f4031',
    soft: '#f5e9e4',
    canvas: '#fbf3ef',
    wash: '#f6ece7',
    border: '#eadbd5',
  },
];

export const PROFILE_FONTS = [
  { id: 'manrope', label: 'Manrope', value: "'Manrope', 'DM Sans', Arial, sans-serif" },
  { id: 'dm-sans', label: 'DM Sans', value: "'DM Sans', Manrope, Arial, sans-serif" },
  { id: 'system', label: 'Системный', value: 'system-ui, -apple-system, Segoe UI, sans-serif' },
];

export const DEFAULT_PROFILE_PREFERENCES = {
  accent: 'theme',
  font: 'dm-sans',
  theme: 'emerald',
  tagline: '',
  avatar: '',
  avatarColor: '#d8eee1',
};

const AVATAR_LIMIT = 320_000;
const AVATAR_PATTERN = /^data:image\/(?:webp|png|jpeg);base64,[a-z\d+/]+=*$/i;

export function normalizeProfilePreferences(value = {}) {
  const accent =
    value.accent === 'theme' || PROFILE_ACCENTS.some((entry) => entry.id === value.accent)
      ? value.accent
      : DEFAULT_PROFILE_PREFERENCES.accent;
  const theme = STUDIA_THEMES.some((entry) => entry.id === value.theme)
    ? value.theme
    : DEFAULT_PROFILE_PREFERENCES.theme;
  const font = PROFILE_FONTS.some((entry) => entry.id === value.font)
    ? value.font
    : DEFAULT_PROFILE_PREFERENCES.font;
  const avatar =
    typeof value.avatar === 'string' &&
    value.avatar.length <= AVATAR_LIMIT &&
    AVATAR_PATTERN.test(value.avatar)
      ? value.avatar
      : '';
  const avatarColor =
    typeof value.avatarColor === 'string' && /^#[\da-f]{6}$/i.test(value.avatarColor)
      ? value.avatarColor
      : DEFAULT_PROFILE_PREFERENCES.avatarColor;
  return {
    accent,
    font,
    theme,
    avatar,
    avatarColor,
    tagline: typeof value.tagline === 'string' ? value.tagline.slice(0, 100) : '',
  };
}

export function readProfilePreferences(userId) {
  try {
    const saved = window.localStorage.getItem(`studia-profile-style:${userId}`);
    return normalizeProfilePreferences(saved ? JSON.parse(saved) : {});
  } catch {
    return { ...DEFAULT_PROFILE_PREFERENCES };
  }
}

export function writeProfilePreferences(userId, value) {
  const normalized = normalizeProfilePreferences(value);
  window.localStorage.setItem(`studia-profile-style:${userId}`, JSON.stringify(normalized));
  return normalized;
}
