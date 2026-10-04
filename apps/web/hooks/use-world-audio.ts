'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AvatarAction } from '@/components/AvatarToken';

type EffectName = 'level' | 'reward' | 'wizard';
type WorldTracks = {
  music: HTMLAudioElement;
  footsteps: HTMLAudioElement;
  combat: HTMLAudioElement;
  level: HTMLAudioElement;
  reward: HTMLAudioElement;
  wizard: HTMLAudioElement;
};

const audioSources = {
  music: '/audio/woodland-fantasy.mp3',
  footsteps: '/audio/knight-footsteps.mp3',
  combat: '/audio/knight-combat.flac',
  level: '/audio/level-click.mp3',
  reward: '/audio/reward-spell.mp3',
  wizard: '/audio/wizard-accept.mp3',
} as const;

function play(audio?: HTMLAudioElement) {
  if (!audio) return;
  void audio.play().catch(() => {
    // Browsers can block playback until the first user interaction.
  });
}

function stop(audio?: HTMLAudioElement, rewind = true) {
  if (!audio) return;
  audio.pause();
  if (rewind) audio.currentTime = 0;
}

export function useWorldAudio(avatarAction: AvatarAction) {
  const tracksRef = useRef<WorldTracks | null>(null);
  const mutedRef = useRef(true);
  const actionRef = useRef(avatarAction);
  const [muted, setMuted] = useState(true);

  const syncActionAudio = useCallback(() => {
    const tracks = tracksRef.current;
    if (!tracks || mutedRef.current) return;

    const action = actionRef.current;
    const moving = action === 'walking' || action === 'running';
    const fighting = action === 'runAttacking' || action === 'attacking' || action === 'attack2';

    if (moving) {
      stop(tracks.combat);
      tracks.footsteps.loop = true;
      play(tracks.footsteps);
    } else if (fighting) {
      stop(tracks.footsteps);
      tracks.combat.loop = true;
      play(tracks.combat);
    } else {
      stop(tracks.footsteps);
      stop(tracks.combat);
    }
  }, []);

  useEffect(() => {
    const tracks: WorldTracks = {
      music: new Audio(audioSources.music),
      footsteps: new Audio(audioSources.footsteps),
      combat: new Audio(audioSources.combat),
      level: new Audio(audioSources.level),
      reward: new Audio(audioSources.reward),
      wizard: new Audio(audioSources.wizard),
    };
    tracks.music.loop = true;
    tracks.music.volume = 0.24;
    tracks.footsteps.volume = 0.42;
    tracks.combat.volume = 0.45;
    tracks.level.volume = 0.55;
    tracks.reward.volume = 0.55;
    tracks.wizard.volume = 0.5;
    tracksRef.current = tracks;

    const savedMuted = localStorage.getItem('questify_world_muted') === 'true';
    mutedRef.current = savedMuted;
    setMuted(savedMuted);

    const unlockAudio = () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      if (!mutedRef.current) {
        play(tracks.music);
        syncActionAudio();
      }
    };

    if (!savedMuted) play(tracks.music);
    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });

    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      Object.values(tracks).forEach((track) => stop(track));
      tracksRef.current = null;
    };
  }, [syncActionAudio]);

  useEffect(() => {
    actionRef.current = avatarAction;
    syncActionAudio();
  }, [avatarAction, syncActionAudio]);

  const playEffect = useCallback((name: EffectName) => {
    const track = tracksRef.current?.[name];
    if (!track || mutedRef.current) return;
    track.currentTime = 0;
    play(track);
  }, []);

  const toggleMuted = useCallback(() => {
    const tracks = tracksRef.current;
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    localStorage.setItem('questify_world_muted', String(next));

    if (!tracks) return;
    Object.values(tracks).forEach((track) => {
      track.muted = next;
    });
    if (next) {
      Object.values(tracks).forEach((track) => stop(track));
    } else {
      play(tracks.music);
      syncActionAudio();
    }
  }, [syncActionAudio]);

  return { muted, playEffect, toggleMuted };
}
