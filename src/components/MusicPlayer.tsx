import { useMemo, useRef } from "react";
import type { MusicPlayerController } from "../music/useMusicPlayer";
import { Icons } from "./Icons";

interface MusicPlayerProps {
  player: MusicPlayerController;
}

function formatTime(value: number) {
  if (!Number.isFinite(value)) return "0:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function MusicPlayer({ player }: MusicPlayerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const categories = useMemo(() => {
    const map = new Map<string, { track: typeof player.tracks[number]; index: number }[]>();
    player.tracks.forEach((track, index) => map.set(track.category, [...(map.get(track.category) ?? []), { track, index }]));
    return map;
  }, [player.tracks]);

  async function addFolder() {
    const handled = await player.chooseNativeFolder();
    if (!handled) inputRef.current?.click();
  }

  return (
    <>
      {player.expanded && (
        <aside className="music-library">
          <div className="library-heading">
            <div><span className="eyebrow">MÚSICAS LOCAIS</span><h2>Biblioteca</h2></div>
            <button className="icon-button" onClick={() => player.setExpanded(false)}><Icons.close /></button>
          </div>
          <button className="add-folder-button" onClick={addFolder}><Icons.folder /><span><strong>Adicionar pasta de músicas</strong><small>Procura arquivos .mp3 também nas subpastas</small></span></button>
          <input
            ref={inputRef}
            className="hidden-input"
            type="file"
            accept="audio/mpeg,.mp3"
            multiple
            onChange={(event) => player.addBrowserFiles(event.target.files)}
            {...({ webkitdirectory: "" } as React.InputHTMLAttributes<HTMLInputElement>)}
          />
          <div className="track-list">
            {!player.tracks.length && <div className="empty-library"><Icons.music /><strong>Nenhuma música adicionada</strong><p>Escolha sua pasta. As subpastas viram categorias como Boss, Cidade e Dungeon.</p></div>}
            {[...categories.entries()].map(([category, entries]) => (
              <section key={category}>
                <h3>{category}<span>{entries.length}</span></h3>
                {entries.map(({ track, index }) => (
                  <button key={track.id} className={index === player.currentIndex ? "track-row is-current" : "track-row"} onClick={() => player.playTrack(index)}>
                    <span>{index === player.currentIndex && player.playing ? <Icons.pause /> : <Icons.play />}</span>
                    <strong>{track.title}</strong>
                    <small>MP3</small>
                  </button>
                ))}
              </section>
            ))}
          </div>
        </aside>
      )}

      <footer className="music-player">
        <button className="now-playing" onClick={() => player.setExpanded(!player.expanded)}>
          <span className="album-placeholder"><Icons.music /></span>
          <span><strong>{player.currentTrack?.title ?? "Adicionar músicas locais"}</strong><small>{player.currentTrack?.category ?? "Sua trilha continua enquanto você navega"}</small></span>
          <Icons.chevronUp className={player.expanded ? "rotated" : ""} />
        </button>

        <div className="transport">
          <div className="transport-buttons">
            <button className={player.shuffle ? "is-on" : ""} onClick={() => player.setShuffle(!player.shuffle)} title="Aleatório"><Icons.shuffle /></button>
            <button onClick={player.previous} title="Anterior"><Icons.previous /></button>
            <button className="main-play" onClick={player.togglePlay}>{player.playing ? <Icons.pause /> : <Icons.play />}</button>
            <button onClick={player.next} title="Próxima"><Icons.next /></button>
            <button className={player.loop ? "is-on" : ""} onClick={() => player.setLoop(!player.loop)} title="Repetir"><Icons.repeat /></button>
          </div>
          <div className="progress-row">
            <span>{formatTime(player.currentTime)}</span>
            <input type="range" min="0" max={player.duration || 1} step="0.1" value={Math.min(player.currentTime, player.duration || 1)} onChange={(event) => player.seek(Number(event.target.value))} />
            <span>{formatTime(player.duration)}</span>
          </div>
        </div>

        <div className="volume-control">
          <button onClick={() => player.setMuted(!player.muted)}>{player.muted || player.volume === 0 ? <Icons.mute /> : <Icons.volume />}</button>
          <input type="range" min="0" max="1" step="0.01" value={player.volume} onChange={(event) => player.setVolume(Number(event.target.value))} />
          <button className="stop-button" onClick={player.stop}><Icons.stop /></button>
        </div>
      </footer>
    </>
  );
}

