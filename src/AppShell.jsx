import * as shared from './app-shared.jsx';
const { React, Icon, sections, forms, by, subtitle } = shared;
import { Logo } from './components/SharedComponents.jsx';
import { Page } from './sections/Page.jsx';
import { SearchDialog } from './components/GlobalSearch.jsx';
import { Editor } from './components/RecordEditor.jsx';
import { localeTags, sectionLabel, sectionSubtitle, translate } from './i18n.js';
import { UserAvatar } from './components/UserAvatar.jsx';
import { PROFILE_ACCENTS, PROFILE_FONTS, STUDIA_THEMES } from './profilePreferences.js';

function AppShell({
  user,
  locale = 'ru',
  profilePreferences,
  saveProfilePreferences,
  setLocale = () => {},
  setUser,
  items,
  setItems,
  page,
  setPage,
  selectedCourseId,
  setSelectedCourseId,
  selectedGroupId,
  editor,
  setEditor,
  toast,
  setToast,
  reminderAlert,
  setReminderAlert,
  menu,
  setMenu,
  more,
  setMore,
  searchOpen,
  setSearchOpen,
  logout,
  navigate,
  save,
  remove,
  update,
  refresh,
}) {
  const section = sections.find((s) => s.id === page);
  const theme = STUDIA_THEMES.find((entry) => entry.id === profilePreferences?.theme);
  const accent = PROFILE_ACCENTS.find((entry) => entry.id === profilePreferences?.accent);
  const font = PROFILE_FONTS.find((entry) => entry.id === profilePreferences?.font);
  const t = (key) => translate(locale, `shell.${key}`);
  const count = (kind) => items.filter((x) => x.kind === kind).length;
  const secondary = sections.filter((s) => s.extra);
  const navGroups = [
    ['daily', ['dashboard', 'schedule', 'task']],
    ['subjects', ['course', 'note', 'material', 'journal', 'grade']],
    ['together', ['groups', 'chat', 'assistant']],
  ];
  const renderNav = (s) => {
    const Glyph = Icon[s.icon] || Icon.Circle;
    return (
      <button
        key={s.id}
        className={`nav-link ${page === s.id ? 'active' : ''}`}
        onClick={() => navigate(s.id)}
      >
        <Glyph size={18} strokeWidth={1.9} />
        <span>{sectionLabel(locale, s.id, s.label)}</span>
        {s.id === 'task' && count('task') > 0 && <small>{count('task')}</small>}
      </button>
    );
  };
  return (
    <div
      className='app-shell'
      data-theme={theme?.id || 'emerald'}
      lang={localeTags[locale]?.slice(0, 2) || 'ru'}
      style={{
        '--app-accent': accent?.color || theme?.accent || '#126848',
        '--app-accent-hover': accent?.hover || theme?.hover || '#0d583d',
        '--app-accent-soft': accent?.soft || theme?.soft || '#e4f2e9',
        '--app-canvas': theme?.canvas || '#f2f6f2',
        '--app-wash': theme?.wash || '#edf6ef',
        '--app-border': theme?.border || '#dce7dc',
        '--profile-accent': accent?.color || theme?.accent || '#126848',
        '--profile-accent-soft': accent?.soft || theme?.soft || '#e4f2e9',
        '--profile-font': font?.value || "'DM Sans', Manrope, Arial, sans-serif",
      }}
    >
      <aside className={`sidebar ${menu ? 'open' : ''}`}>
        <div className='sidebar-top'>
          <Logo />
          <button
            className='icon-button close-menu'
            onClick={() => setMenu(false)}
            aria-label={t('closeMenu')}
          >
            <Icon.X size={20} />
          </button>
        </div>
        <nav aria-label={t('navLabel')}>
          {navGroups.map(([group, ids]) => (
            <div className='nav-group' key={group}>
              <div className='sidebar-label'>{t(group)}</div>
              {ids.map((id) => renderNav(sections.find((s) => s.id === id)))}
            </div>
          ))}
          <div className='nav-divider' />
          <button
            className={`nav-link more-toggle ${secondary.some((s) => s.id === page) ? 'active' : ''}`}
            onClick={() => setMore((value) => !value)}
            aria-expanded={more || secondary.some((s) => s.id === page)}
          >
            <Icon.Layers3 size={18} />
            <span>{t('more')}</span>
            <Icon.ArrowRight size={15} />
          </button>
          {(more || secondary.some((s) => s.id === page)) && (
            <div className='nav-extra'>{secondary.map(renderNav)}</div>
          )}
        </nav>
        <div className='sidebar-user'>
          <UserAvatar name={user.name} preferences={profilePreferences} className='avatar' />
          <div>
            <b>{user.name}</b>
            <small>{user.email}</small>
          </div>
          <button
            className='icon-button'
            onClick={logout}
            title={t('signOut')}
            aria-label={t('signOut')}
          >
            <Icon.LogOut size={17} />
          </button>
        </div>
      </aside>
      {menu && (
        <button className='scrim' onClick={() => setMenu(false)} aria-label='Закрыть меню' />
      )}
      <main className='main-area'>
        <div className='topbar'>
          <button
            className='icon-button menu-button'
            onClick={() => setMenu(true)}
            aria-label={t('openMenu')}
          >
            <Icon.Menu size={22} />
          </button>
          <span>{t('topTitle')}</span>
          <div className='topbar-right'>
            <button
              className='top-search'
              onClick={() => setSearchOpen(true)}
              title={t('searchTitle')}
              aria-label={t('searchLabel')}
            >
              <Icon.Search size={17} />
              <span>{t('search')}</span>
              <kbd>Ctrl K</kbd>
            </button>
            <span className='today-date'>
              {new Date().toLocaleDateString(localeTags[locale] || 'ru-RU', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
            <label className='language-switcher'>
              <span className='sr-only'>{translate(locale, 'language')}</span>
              <select
                value={locale}
                onChange={(event) => setLocale(event.target.value)}
                aria-label={translate(locale, 'language')}
              >
                <option value='ru'>RU</option>
                <option value='kk'>KZ</option>
                <option value='en'>EN</option>
              </select>
            </label>
            <button
              className='top-avatar'
              onClick={() => navigate('profile')}
              aria-label={sectionLabel(locale, 'profile', 'Профиль')}
            >
              <UserAvatar
                name={user.name}
                preferences={profilePreferences}
                className='avatar-image'
              />
            </button>
          </div>
        </div>
        <div className='page-wrap'>
          <div
            className={`page-heading ${['dashboard', 'journal', 'grade'].includes(page) ? 'surface-quiet' : 'surface-primary'}`}
          >
            <div>
              <div className='eyebrow'>
                STUDIA / {sectionLabel(locale, page, section?.label).toUpperCase()}
              </div>
              <h1>
                {page === 'dashboard'
                  ? t('todayTitle').replace('{name}', user.name.split(' ')[0])
                  : sectionLabel(locale, page, section?.label)}
              </h1>
              <p>
                {page === 'dashboard'
                  ? t('todaySubtitle')
                  : sectionSubtitle(locale, page, subtitle[page])}
              </p>
            </div>
            {forms[page] && page !== 'material' && (
              <button className='button primary' onClick={() => setEditor({ kind: page })}>
                <Icon.Plus size={17} />
                {t('add')}
              </button>
            )}
          </div>
          <Page
            page={page}
            user={user}
            profilePreferences={profilePreferences}
            saveProfilePreferences={saveProfilePreferences}
            setUser={setUser}
            items={items}
            setItems={setItems}
            open={setEditor}
            save={save}
            remove={remove}
            update={update}
            refresh={refresh}
            toast={setToast}
            onTestReminder={() =>
              setReminderAlert({
                title: 'Проверка Studia',
                time: new Date().toLocaleTimeString('ru-RU', {
                  hour: '2-digit',
                  minute: '2-digit',
                }),
              })
            }
            navigate={navigate}
            selectedCourseId={selectedCourseId}
            setSelectedCourseId={setSelectedCourseId}
            selectedGroupId={selectedGroupId}
            locale={locale}
          />
        </div>
      </main>
      <nav className='mobile-bottom-nav' aria-label={t('daily')}>
        {['dashboard', 'schedule', 'task', 'chat'].map((id) => {
          const s = sections.find((x) => x.id === id),
            Glyph = Icon[s.icon];
          return (
            <button key={id} className={page === id ? 'active' : ''} onClick={() => navigate(id)}>
              <Glyph size={19} />
              <span>{sectionLabel(locale, s.id, s.label)}</span>
            </button>
          );
        })}
        <button onClick={() => setMenu(true)} aria-label={t('allSections')}>
          <Icon.Menu size={19} />
          <span>{t('moreSections')}</span>
        </button>
      </nav>
      {searchOpen && (
        <SearchDialog
          items={items}
          close={() => setSearchOpen(false)}
          choose={(item) => {
            setSearchOpen(false);
            navigate(item.kind);
            setEditor({ kind: item.kind, item });
          }}
        />
      )}
      {editor && (
        <Editor
          key={`${editor.kind}-${editor.item?.id || 'new'}`}
          editor={editor}
          close={() => setEditor(null)}
          save={save}
          courses={by(items, 'course')}
        />
      )}
      {reminderAlert && (
        <div className='reminder-alert' role='alert'>
          <Icon.BellRing size={20} />
          <div>
            <strong>{reminderAlert.title}</strong>
            <span>{t('eventAt').replace('{time}', reminderAlert.time)}</span>
          </div>
          <button onClick={() => setReminderAlert(null)} aria-label={t('close')}>
            <Icon.X size={18} />
          </button>
        </div>
      )}
      {toast && (
        <div className='toast' role='status'>
          <Icon.CheckCircle2 size={18} />
          {toast}
          <button onClick={() => setToast('')} aria-label={t('close')}>
            <Icon.X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}

export default AppShell;
