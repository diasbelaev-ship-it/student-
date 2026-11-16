import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Download,
  ExternalLink,
  FileText,
  FolderOpen,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import { api } from './api';

export default function MaterialLibrary({ items, open, remove, navigate }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scope, setScope] = useState('all');
  const [query, setQuery] = useState('');
  const own = items.filter((item) => item.kind === 'material');
  const courses = items.filter((item) => item.kind === 'course');
  async function load() {
    try {
      setFiles(await api('/api/groups/materials'));
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  const entries = useMemo(() => {
    const personal = own.map((item) => ({
      key: `own-${item.id}`,
      kind: 'own',
      item,
      title: item.payload.title,
      group:
        courses.find((course) => course.id === Number(item.payload.courseId))?.payload.title ||
        item.payload.subject ||
        'Личный материал',
      detail: item.payload.notes || (item.payload.url ? 'Ссылка на материал' : 'Заметка'),
    }));
    const shared = files.map((file) => ({
      key: `group-${file.groupId}-${file.id}`,
      kind: 'group',
      file,
      title: file.name,
      group: file.groupName,
      detail: `${file.author} · ${Math.max(1, Math.round(file.size / 1024))} КБ`,
    }));
    const all = [...personal, ...shared];
    const filter = query.trim().toLocaleLowerCase();
    return all.filter(
      (entry) =>
        (scope === 'all' || (scope === 'own' ? entry.kind === 'own' : entry.kind === 'group')) &&
        (!filter ||
          `${entry.title} ${entry.group} ${entry.detail}`.toLocaleLowerCase().includes(filter)),
    );
  }, [own, files, courses, scope, query]);
  const collections = [
    {
      id: 'all',
      title: 'Все материалы',
      count: own.length + files.length,
      description: 'Ссылки и файлы в одном месте',
      preview: own[0]?.payload.title || files[0]?.name,
    },
    {
      id: 'own',
      title: 'Моя полка',
      count: own.length,
      description: 'Сохранённые вами материалы',
      preview: own[0]?.payload.title,
    },
    {
      id: 'group',
      title: 'Из учебных групп',
      count: files.length,
      description: 'Общие файлы с одногруппниками',
      preview: files[0]?.name,
    },
  ];
  return (
    <div className='library-workspace'>
      <section className='library-intro'>
        <div>
          <h2>Всё для занятий — в одном месте</h2>
          <p>Ваши ссылки и материалы учебных групп доступны здесь без повторного копирования.</p>
        </div>
        <div className='library-count'>
          <span>{own.length} личных</span>
          <span>{files.length} общих</span>
        </div>
      </section>
      <div className='library-collections' role='group' aria-label='Коллекции материалов'>
        {collections.map((collection) => (
          <button
            type='button'
            className={`library-folder${scope === collection.id ? ' active' : ''}`}
            key={collection.id}
            aria-pressed={scope === collection.id}
            onClick={() => setScope(collection.id)}
          >
            <span className='library-folder-tab' />
            <span className='library-folder-head'>
              <FolderOpen size={20} />
              <ArrowRight size={16} />
            </span>
            <strong>{collection.title}</strong>
            <small>{collection.description}</small>
            <span className='library-folder-bottom'>
              <span>
                {collection.count} {collection.count === 1 ? 'материал' : 'материалов'}
              </span>
              <span>{collection.preview || 'Пока пусто'}</span>
            </span>
          </button>
        ))}
      </div>
      <div className='library-controls'>
        <label className='library-search'>
          <Search size={16} />
          <span className='sr-only'>Поиск по материалам</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder='Название, предмет или группа'
          />
        </label>
        <button type='button' className='button primary' onClick={() => open({ kind: 'material' })}>
          <Plus size={16} />
          Добавить ссылку
        </button>
      </div>
      {error && (
        <div className='library-error' role='alert'>
          Общие файлы не загрузились.{' '}
          <button type='button' onClick={load}>
            Повторить
          </button>
        </div>
      )}
      <div className='library-list' aria-live='polite'>
        <div className='library-list-head'>
          <span>Материал</span>
          <span>Источник</span>
          <span>Действие</span>
        </div>
        {entries.length ? (
          entries.map((entry) => (
            <article className='library-row' key={entry.key}>
              <div className='library-row-main'>
                {entry.kind === 'group' ? <FileText size={19} /> : <BookOpen size={19} />}
                <div>
                  <strong>{entry.title}</strong>
                  <small>{entry.detail}</small>
                </div>
              </div>
              <div className='library-origin'>
                {entry.kind === 'group' ? <Users size={15} /> : <BookOpen size={15} />}
                <span>{entry.group}</span>
              </div>
              <div className='library-row-actions'>
                {entry.kind === 'group' ? (
                  <>
                    <a
                      href={`/api/groups/${entry.file.groupId}/files/${entry.file.id}`}
                      download
                      title='Скачать файл'
                    >
                      <Download size={17} />
                      <span>Скачать</span>
                    </a>
                    <button
                      type='button'
                      onClick={() => navigate('groups', entry.file.groupId)}
                      title='Открыть группу'
                    >
                      <ArrowRight size={17} />
                      <span>Группа</span>
                    </button>
                  </>
                ) : (
                  <>
                    {entry.item.payload.url && (
                      <a
                        href={entry.item.payload.url}
                        target='_blank'
                        rel='noopener noreferrer'
                        title='Открыть ссылку'
                      >
                        <ExternalLink size={17} />
                        <span>Открыть</span>
                      </a>
                    )}
                    <button
                      type='button'
                      onClick={() => open({ kind: 'material', item: entry.item })}
                      aria-label={`Редактировать ${entry.title}`}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type='button'
                      onClick={() => remove(entry.item)}
                      aria-label={`Удалить ${entry.title}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
                )}
              </div>
            </article>
          ))
        ) : (
          <div className='library-empty'>
            <FileText size={27} />
            <h3>
              {loading
                ? 'Загружаем материалы…'
                : query
                  ? 'По запросу ничего не найдено'
                  : scope === 'group'
                    ? 'В группах пока нет файлов'
                    : 'Библиотека пока пуста'}
            </h3>
            <p>
              {query
                ? 'Попробуйте другое название или предмет.'
                : 'Добавьте полезную ссылку или откройте учебную группу и загрузите файл.'}
            </p>
            {!query && (
              <button type='button' onClick={() => navigate('groups')}>
                Открыть группы <ArrowRight size={15} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
