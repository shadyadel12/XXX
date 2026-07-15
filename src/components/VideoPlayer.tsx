import { useEffect, useState } from 'react';
import { getVideoUrl } from '../api/storage';

/** Renders a coach/player video: external link (embed or anchor) or stored file. */
export default function VideoPlayer({
  url,
  isExternal,
}: {
  url: string | null;
  isExternal: boolean;
}) {
  const [signed, setSigned] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (url && !isExternal) {
      getVideoUrl(url)
        .then((u) => active && setSigned(u))
        .catch((e) => active && setErr(e instanceof Error ? e.message : 'Load failed'));
    }
    return () => {
      active = false;
    };
  }, [url, isExternal]);

  if (!url) return null;

  if (isExternal) {
    const embed = toYouTubeEmbed(url);
    if (embed) {
      return (
        <iframe
          src={embed}
          title="video"
          style={{ width: '100%', aspectRatio: '16 / 9', border: 0, borderRadius: 8 }}
          allowFullScreen
        />
      );
    }
    return (
      <a href={url} target="_blank" rel="noreferrer">
        Open video ↗
      </a>
    );
  }

  if (err) return <span className="error">{err}</span>;
  if (!signed) return <span className="muted">Loading video…</span>;
  return (
    <video src={signed} controls style={{ width: '100%', borderRadius: 8 }} />
  );
}

function toYouTubeEmbed(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/
  );
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}
