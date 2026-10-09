'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

export default function MusicPlayer() {
  const pathname = usePathname();
  const [tracks, setTracks] = useState<string[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [index, setIndex] = useState(0);
  useEffect(() => {
    let active = true;
    fetch('/api/music', { cache: 'no-store' }).then(response => response.json()).then(data => {
      if (!active) return;
      const list = Array.isArray(data.tracks) ? data.tracks.filter((track: unknown): track is string => typeof track === 'string') : [];
      setTracks(list);
      setEnabled(Boolean(data.enabled) && list.length > 0);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  if (pathname.startsWith('/admin') || !enabled || !tracks.length) return null;
  const next = () => setIndex(current => (current + 1) % tracks.length);
  return <aside className="store-music-player" aria-label="FreshCart store music">
    <span className="music-player-label">♫ FRESHCART RADIO</span>
    <span className="music-track-label">Track {index + 1} of {tracks.length}</span>
    <audio key={tracks[index]} controls autoPlay preload="none" src={tracks[index]} onEnded={next} aria-label="FreshCart background music" />
    {tracks.length > 1 && <button type="button" onClick={next} aria-label="Play next song">Next song →</button>}
  </aside>;
}
