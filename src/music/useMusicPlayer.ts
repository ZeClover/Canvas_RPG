import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useRef, useState } from "react";
import { createId } from "../domain/id";
import type { MusicTrack } from "../domain/types";

interface NativeTrack {
  id: string;
  title: string;
  path: string;
  category: string;
}

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function useMusicPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  if (!audioRef.current && typeof Audio !== "undefined") audioRef.current = new Audio();
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolumeState] = useState(0.72);
  const [muted, setMuted] = useState(false);
  const [loop, setLoop] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const currentTrack = currentIndex >= 0 ? tracks[currentIndex] : null;

  const next = useCallback(() => {
    if (!tracks.length) return;
    setCurrentIndex((current) => {
      if (shuffle && tracks.length > 1) {
        let candidate = current;
        while (candidate === current) candidate = Math.floor(Math.random() * tracks.length);
        return candidate;
      }
      return (current + 1 + tracks.length) % tracks.length;
    });
    setPlaying(true);
  }, [shuffle, tracks.length]);

  const previous = useCallback(() => {
    if (!tracks.length) return;
    setCurrentIndex((current) => (current - 1 + tracks.length) % tracks.length);
    setPlaying(true);
  }, [tracks.length]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const time = () => setCurrentTime(audio.currentTime || 0);
    const metadata = () => setDuration(audio.duration || 0);
    const ended = () => {
      if (loop) {
        audio.currentTime = 0;
        void audio.play();
      } else next();
    };
    audio.addEventListener("timeupdate", time);
    audio.addEventListener("loadedmetadata", metadata);
    audio.addEventListener("ended", ended);
    return () => {
      audio.removeEventListener("timeupdate", time);
      audio.removeEventListener("loadedmetadata", metadata);
      audio.removeEventListener("ended", ended);
    };
  }, [loop, next]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    const changed = audio.src !== currentTrack.url;
    if (changed) {
      audio.src = currentTrack.url;
      audio.load();
      setCurrentTime(0);
    }
    if (playing) void audio.play().catch(() => setPlaying(false));
    else audio.pause();
  }, [currentTrack, playing]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = volume;
    audioRef.current.muted = muted;
  }, [muted, volume]);

  function togglePlay() {
    if (!tracks.length) {
      setExpanded(true);
      return;
    }
    if (currentIndex < 0) setCurrentIndex(0);
    setPlaying((value) => !value);
  }

  function stop() {
    const audio = audioRef.current;
    if (audio) audio.currentTime = 0;
    setCurrentTime(0);
    setPlaying(false);
  }

  function seek(value: number) {
    if (!audioRef.current) return;
    audioRef.current.currentTime = value;
    setCurrentTime(value);
  }

  function setVolume(value: number) {
    setVolumeState(value);
    if (value > 0) setMuted(false);
  }

  function addBrowserFiles(fileList: FileList | null) {
    if (!fileList) return;
    const added = Array.from(fileList)
      .filter((file) => file.name.toLowerCase().endsWith(".mp3"))
      .map((file) => {
        const relative = file.webkitRelativePath || file.name;
        const parts = relative.split("/");
        const category = parts.length > 2 ? parts[parts.length - 2] : "Sem categoria";
        return {
          id: createId("track"),
          title: file.name.replace(/\.mp3$/i, ""),
          path: relative,
          url: URL.createObjectURL(file),
          category,
        } satisfies MusicTrack;
      });
    setTracks((current) => [...current, ...added]);
    if (currentIndex < 0 && added.length) setCurrentIndex(tracks.length);
  }

  async function chooseNativeFolder(): Promise<boolean> {
    if (!isTauri()) return false;
    const selected = await open({ directory: true, multiple: false, title: "Escolha sua pasta de músicas" });
    if (!selected || Array.isArray(selected)) return true;
    const found = await invoke<NativeTrack[]>("scan_music_folder", { path: selected });
    const converted = found.map((track) => ({ ...track, url: convertFileSrc(track.path) }));
    setTracks((current) => [...current, ...converted]);
    if (currentIndex < 0 && converted.length) setCurrentIndex(tracks.length);
    return true;
  }

  function playTrack(index: number) {
    setCurrentIndex(index);
    setPlaying(true);
  }

  return {
    tracks,
    currentTrack,
    currentIndex,
    playing,
    volume,
    muted,
    loop,
    shuffle,
    currentTime,
    duration,
    expanded,
    setExpanded,
    setMuted,
    setLoop,
    setShuffle,
    setVolume,
    togglePlay,
    stop,
    next,
    previous,
    seek,
    addBrowserFiles,
    chooseNativeFolder,
    playTrack,
  };
}

export type MusicPlayerController = ReturnType<typeof useMusicPlayer>;

