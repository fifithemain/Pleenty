'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

export default function MusicPlayer() {
  const pathname = usePathname();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [tracks, setTracks] = useState<string[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [index, setIndex] = useState(0);
  const [needsTap, setNeedsTap] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

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

  const tryPlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !enabled || !tracks.length) return;
    try {
      audio.muted = false;
      await audio.play();
      setIsPlaying(true);
      setNeedsTap(false);
    } catch {
      // Audible autoplay is commonly blocked until a visitor interacts with the page.
      setNeedsTap(true);
      setIsPlaying(false);
    }
  }, [enabled, tracks.length, index]);

  useEffect(() => {
    if (enabled && tracks.length) {
      const id = window.setTimeout(() => { void tryPlay(); }, 250);
      return () => window.clearTimeout(id);
    }
  }, [enabled, tracks, index, tryPlay]);

  if (pathname.startsWith('/admin') || !enabled || !tracks.length) return null;
  const next = () => setIndex(current => (current + 1) % tracks.length);
  return <aside className="store-music-player" aria-label="FreshCart store music">
    <div className="music-player-heading"><span className="music-player-label">♫ FRESHCART RADIO</span><span className="music-track-label">Track {index + 1} of {tracks.length}</span></div>
    <audio ref={audioRef} key={tracks[index]} controls autoPlay preload="auto" src={tracks[index]} onPlay={() => { setIsPlaying(true); setNeedsTap(false); }} onPause={() => setIsPlaying(false)} onEnded={next} aria-label="FreshCart background music" />
    {needsTap && <button type="button" className="music-enable-button" onClick={() => void tryPlay()}>▶ Tap to play music</button>}
    {!needsTap && <button type="button" className="music-enable-button" onClick={() => { const audio = audioRef.current; if (!audio) return; if (audio.paused) void tryPlay(); else { audio.pause(); setIsPlaying(false); } }}>{isPlaying ? 'Pause music' : 'Play music'}</button>}
    {tracks.length > 1 && <button type="button" onClick={next} aria-label="Play next song">Next song →</button>}
  </aside>;
}
