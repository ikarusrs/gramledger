import { useState } from 'react';
import type { FormEvent } from 'react';
import { useLocale } from '../../core/i18n/LocaleContext';

type Video = { id: string; title: string; description: string; thumbnail: string; channel: string };

export function VideosScreen() {
  const { t } = useLocale();
  const [query, setQuery] = useState('organic farming');
  const [videos, setVideos] = useState<Video[]>([]);
  const [selected, setSelected] = useState<Video | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function search(event?: FormEvent) {
    event?.preventDefault();
    if (!query.trim()) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/v1/videos?q=${encodeURIComponent(query)}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? 'Video search unavailable');
      setVideos(payload);
      setSelected(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Video search unavailable');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1 className="page__title">{t('farmSchool')}</h1>
          <p className="page__subtitle">{t('farmSchoolSubtitle')}</p>
        </div>
      </header>
      <section className="feature-hero feature-hero--gold">
        <span className="eyebrow">{t('learnByWatching')}</span>
        <h2>{t('farmSchoolHero')}</h2>
        <p>{t('farmSchoolDescription')}</p>
      </section>
      <form className="video-search" onSubmit={search}>
        <input
          className="search-box__input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('tutorialPlaceholder')}
        />
        <button className="primary-btn" disabled={busy}>
          {busy ? t('pleaseWait') : t('searchTutorials')}
        </button>
      </form>
      {error && <p className="form-error">{error}</p>}
      {selected && (
        <section className="card video-player">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${selected.id}`}
            title={selected.title}
            allowFullScreen
          />
        </section>
      )}
      <section className="video-grid">
        {videos.map((video) => (
          <button className="video-card" key={video.id} onClick={() => setSelected(video)}>
            <img src={video.thumbnail} alt="" />
            <span className="video-card__body">
              <strong>{video.title}</strong>
              <small>{video.channel}</small>
              <span>{video.description}</span>
            </span>
          </button>
        ))}
      </section>
      {videos.length === 0 && !busy && (
        <div className="card muted">
          Search for a crop, technique, livestock topic, or rural livelihood.
        </div>
      )}
    </div>
  );
}
