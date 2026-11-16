import { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Camera,
  Check,
  CircleUserRound,
  LockKeyhole,
  Palette,
  RotateCcw,
  ShieldCheck,
  Type,
  UserRound,
  X,
} from 'lucide-react';
import { send } from '../api';
import { UserAvatar } from '../components/UserAvatar.jsx';
import { translate } from '../i18n.js';
import {
  DEFAULT_PROFILE_PREFERENCES,
  PROFILE_ACCENTS,
  PROFILE_FONTS,
  STUDIA_THEMES,
  normalizeProfilePreferences,
} from '../profilePreferences.js';

const avatarColors = [
  { value: '#d8eee1', label: 'mint' },
  { value: '#e1eafa', label: 'sky' },
  { value: '#f5e4d8', label: 'peach' },
  { value: '#eee4f4', label: 'lilac' },
  { value: '#edf0d9', label: 'olive' },
  { value: '#e9e8e1', label: 'linen' },
];

function imageDataUrl(file, t) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(t('imageReadError')));
    reader.readAsDataURL(file);
  });
}

async function prepareAvatar(file, t) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error(t('photoFormatError'));
  }
  if (file.size > 8 * 1024 * 1024) throw new Error(t('photoSizeError'));

  const source = await imageDataUrl(file, t);
  const image = new Image();
  image.src = source;
  await image.decode();

  const side = Math.min(image.naturalWidth, image.naturalHeight);
  const left = (image.naturalWidth - side) / 2;
  const top = (image.naturalHeight - side) / 2;
  for (const size of [256, 192, 128]) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context) throw new Error(t('imageProcessError'));
    context.drawImage(image, left, top, side, side, 0, 0, size, size);
    for (const quality of [0.78, 0.64, 0.5]) {
      const result = canvas.toDataURL('image/webp', quality);
      if (result.length <= 280_000) return result;
    }
  }
  throw new Error(t('imageReduceError'));
}

function SectionHeader({ icon: Glyph, title, subtitle }) {
  return (
    <div className='profile-section-heading'>
      <span className='profile-section-icon'>
        <Glyph size={18} />
      </span>
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
    </div>
  );
}

function Profile({
  user,
  setUser,
  toast,
  locale = 'ru',
  profilePreferences,
  saveProfilePreferences,
}) {
  const t = (key) => translate(locale, `profile.${key}`);
  const [name, setName] = useState(user.name);
  const [sessionDate, setSessionDate] = useState(user.sessionDate || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [preferences, setPreferences] = useState(() =>
    normalizeProfilePreferences(profilePreferences || DEFAULT_PROFILE_PREFERENCES),
  );
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileInput = useRef(null);
  const selectedTheme =
    STUDIA_THEMES.find((entry) => entry.id === preferences.theme) || STUDIA_THEMES[0];
  const selectedAccent =
    PROFILE_ACCENTS.find((entry) => entry.id === preferences.accent) || selectedTheme;
  const selectedFont =
    PROFILE_FONTS.find((entry) => entry.id === preferences.font) || PROFILE_FONTS[0];

  useEffect(() => {
    setPreferences(normalizeProfilePreferences(profilePreferences || DEFAULT_PROFILE_PREFERENCES));
  }, [profilePreferences]);

  function updatePreferences(patch) {
    setPreferences((current) => normalizeProfilePreferences({ ...current, ...patch }));
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await send('/api/me', 'PATCH', {
        name: name.trim(),
        sessionDate: sessionDate || null,
      });
      setUser(r.user);
      toast(t('profileSaved'));
    } catch (err) {
      toast(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const result = await send('/api/me/password', 'PATCH', { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      toast(result.message);
    } catch (err) {
      toast(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function selectPhoto(event) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    setPhotoBusy(true);
    try {
      const avatar = await prepareAvatar(file, t);
      updatePreferences({ avatar });
    } catch (err) {
      toast(err.message);
    } finally {
      setPhotoBusy(false);
    }
  }

  function saveAppearance() {
    try {
      saveProfilePreferences(preferences);
      toast(t('saved'));
    } catch {
      toast(t('appearanceSaveError'));
    }
  }

  function resetAppearance() {
    setPreferences({ ...DEFAULT_PROFILE_PREFERENCES });
  }

  return (
    <section
      className='profile-studio'
      style={{
        '--profile-preview-accent': selectedAccent.color,
        '--profile-preview-soft': selectedAccent.soft,
        '--profile-preview-font': selectedFont.value,
      }}
    >
      <header className='profile-showcase'>
        <div className='profile-showcase-orbit profile-showcase-orbit-one' />
        <div className='profile-showcase-orbit profile-showcase-orbit-two' />
        <div className='profile-showcase-main'>
          <div className='profile-showcase-avatar-wrap'>
            <UserAvatar
              name={name || user.name}
              preferences={preferences}
              className='profile-showcase-avatar'
            />
            <span className='profile-online-dot' aria-label={t('active')} />
          </div>
          <div className='profile-showcase-copy' style={{ fontFamily: selectedFont.value }}>
            <span className='profile-showcase-kicker'>{t('workspace')}</span>
            <h2>{name.trim() || user.name}</h2>
            <p>{preferences.tagline || t('defaultTagline')}</p>
            <span className='profile-showcase-email'>{user.email}</span>
          </div>
          <span className='profile-preview-chip'>
            <SparklesIcon /> {t('style')}
          </span>
        </div>
        <div className='profile-showcase-footer'>
          <span>
            <span className='profile-showcase-dot' /> {t('personal')}
          </span>
          <span>{t('tailored')}</span>
        </div>
      </header>

      <div className='profile-columns'>
        <div className='profile-main-column'>
          <section className='profile-card profile-identity-card'>
            <SectionHeader icon={UserRound} title={t('identity')} subtitle={t('identityInfo')} />
            <form onSubmit={submit} className='profile-form-grid'>
              <label>
                {t('name')}
                <input
                  required
                  maxLength={60}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete='name'
                />
              </label>
              <label>
                {t('sessionDate')}
                <input
                  type='date'
                  value={sessionDate}
                  onChange={(event) => setSessionDate(event.target.value)}
                />
              </label>
              <p className='profile-help'>{t('sessionHint')}</p>
              <button className='button primary' disabled={busy}>
                <Check size={16} /> {t('saveDetails')}
              </button>
            </form>
          </section>

          <section className='profile-card profile-appearance-card'>
            <SectionHeader icon={Palette} title={t('appearance')} subtitle={t('appearanceInfo')} />

            <div className='profile-avatar-editor'>
              <div className='profile-avatar-editor-preview'>
                <UserAvatar name={name || user.name} preferences={preferences} />
                <span>
                  <b>{t('photo')}</b>
                  <small>{t('photoTypes')}</small>
                </span>
              </div>
              <div className='profile-avatar-actions'>
                <input
                  ref={fileInput}
                  className='profile-file-input'
                  type='file'
                  accept='image/jpeg,image/png,image/webp'
                  onChange={selectPhoto}
                  aria-label={t('photo')}
                />
                <button
                  type='button'
                  className='button secondary'
                  disabled={photoBusy}
                  onClick={() => fileInput.current?.click()}
                >
                  <Camera size={16} /> {photoBusy ? t('preparing') : t('uploadPhoto')}
                </button>
                {preferences.avatar && (
                  <button
                    type='button'
                    className='button profile-remove-photo'
                    onClick={() => updatePreferences({ avatar: '' })}
                  >
                    <X size={15} /> {t('removePhoto')}
                  </button>
                )}
              </div>
            </div>

            <fieldset className='profile-choice-group'>
              <legend>{t('avatarColor')}</legend>
              <div className='profile-avatar-swatches'>
                {avatarColors.map((color) => (
                  <button
                    key={color.value}
                    type='button'
                    className={`profile-avatar-swatch ${preferences.avatarColor === color.value ? 'selected' : ''}`}
                    style={{ '--swatch-color': color.value }}
                    aria-label={t(`color.${color.label}`)}
                    aria-pressed={preferences.avatarColor === color.value}
                    onClick={() => updatePreferences({ avatarColor: color.value })}
                  >
                    {preferences.avatarColor === color.value && <Check size={14} />}
                  </button>
                ))}
              </div>
            </fieldset>

            <label className='profile-tagline-label'>
              {t('tagline')}
              <input
                maxLength={100}
                value={preferences.tagline}
                onChange={(event) => updatePreferences({ tagline: event.target.value })}
                placeholder={t('taglinePlaceholder')}
              />
            </label>

            <fieldset className='profile-choice-group profile-theme-group'>
              <legend>{t('theme')}</legend>
              <p className='profile-theme-help'>{t('themeInfo')}</p>
              <div className='profile-theme-options'>
                {STUDIA_THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    type='button'
                    className={`profile-theme-option ${preferences.theme === theme.id ? 'selected' : ''}`}
                    style={{
                      '--theme-swatch': theme.accent,
                      '--theme-swatch-soft': theme.soft,
                      '--theme-swatch-canvas': theme.canvas,
                    }}
                    aria-label={t(`themeName.${theme.id}`)}
                    aria-pressed={preferences.theme === theme.id}
                    onClick={() => updatePreferences({ theme: theme.id, accent: 'theme' })}
                  >
                    <span className='profile-theme-preview' aria-hidden='true'>
                      <i />
                      <i />
                      <i />
                    </span>
                    <b>{t(`themeName.${theme.id}`)}</b>
                    {preferences.theme === theme.id && <Check size={14} />}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className='profile-preference-grid'>
              <label>
                {t('font')}
                <select
                  value={preferences.font}
                  onChange={(event) => updatePreferences({ font: event.target.value })}
                >
                  {PROFILE_FONTS.map((font) => (
                    <option key={font.id} value={font.id}>
                      {font.id === 'system' ? t('fontSystem') : font.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className='profile-font-sample' style={{ fontFamily: selectedFont.value }}>
                <Type size={16} />
                <span>{t('fontSample')}</span>
              </div>
            </div>

            <fieldset className='profile-choice-group profile-accent-group'>
              <legend>{t('accent')}</legend>
              <div className='profile-accent-options'>
                {[{ id: 'theme', color: selectedTheme.accent }, ...PROFILE_ACCENTS].map(
                  (accent) => (
                    <button
                      key={accent.id}
                      type='button'
                      className={`profile-accent-option ${preferences.accent === accent.id ? 'selected' : ''}`}
                      onClick={() => updatePreferences({ accent: accent.id })}
                      aria-pressed={preferences.accent === accent.id}
                    >
                      <span style={{ background: accent.color }} />
                      {accent.id === 'theme' ? t('accentName.theme') : t(`accentName.${accent.id}`)}
                      {preferences.accent === accent.id && <Check size={14} />}
                    </button>
                  ),
                )}
              </div>
            </fieldset>

            <div className='profile-appearance-footer'>
              <p>{t('appearanceStorage')}</p>
              <div>
                <button
                  type='button'
                  className='button profile-reset-button'
                  onClick={resetAppearance}
                >
                  <RotateCcw size={15} /> {t('reset')}
                </button>
                <button type='button' className='button primary' onClick={saveAppearance}>
                  <Check size={16} /> {t('saveAppearance')}
                </button>
              </div>
            </div>
          </section>
        </div>

        <aside className='profile-side-column'>
          <div className='profile-note-card'>
            <span className='profile-note-icon'>
              <ArrowUpRight size={18} />
            </span>
            <b>{t('profileIdea')}</b>
            <p>{t('profileIdeaText')}</p>
            <div className='profile-note-stats'>
              <span>
                <strong>01</strong> {t('profileCount')}
              </span>
              <span>
                <strong>05</strong> {t('accentsCount')}
              </span>
              <span>
                <strong>03</strong> {t('fontsCount')}
              </span>
            </div>
          </div>
          <section className='profile-card profile-security-card'>
            <SectionHeader icon={ShieldCheck} title={t('security')} subtitle={t('securityInfo')} />
            <form onSubmit={changePassword} className='profile-security-form'>
              <label>
                {t('currentPassword')}
                <input
                  type='password'
                  autoComplete='current-password'
                  minLength={8}
                  required
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                />
              </label>
              <label>
                {t('newPassword')}
                <input
                  type='password'
                  autoComplete='new-password'
                  minLength={8}
                  required
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                />
              </label>
              <p className='profile-help'>{t('securityHint')}</p>
              <button className='button secondary' disabled={busy}>
                <LockKeyhole size={16} /> {t('updatePassword')}
              </button>
            </form>
          </section>
          <div className='profile-local-note'>
            <CircleUserRound size={17} />
            <span>{t('localPrivacy')}</span>
          </div>
        </aside>
      </div>
    </section>
  );
}

function SparklesIcon() {
  return (
    <span className='profile-sparkle' aria-hidden='true'>
      ✳
    </span>
  );
}

export { Profile };
