import { useRef, useState } from "react";
import { CARD_KINDS, kindConfig } from "../../domain/entityKindRegistry";
import { detectFormatFromFilename, searchTranscriptKeyword, stripTranscriptMarkup } from "../../domain/transcriptParser";
import { readTranscriptFields, TRANSCRIPT_FORMATS, type TranscriptFields } from "../../domain/transcriptFields";
import type { EntityKind } from "../../domain/types";
import { Icons } from "../Icons";

interface TranscriptSectionProps {
  fields: Record<string, unknown>;
  onUpdate: (fields: Record<string, unknown>) => void;
  onCreateFromSelection: (kind: EntityKind, title: string, summary: string) => void;
}

/** Transcript Engine: paste or import TXT/SRT/VTT (import only strips
 * caption markup, never rewrites dialogue), search by plain keyword, and
 * manually promote a selected passage into a real Canvas entity — the
 * only "conversion" this tool ever does, and it's always a deliberate
 * click, never automatic. */
export function TranscriptSection({ fields, onUpdate, onCreateFromSelection }: TranscriptSectionProps) {
  const transcript = readTranscriptFields(fields);
  const [keyword, setKeyword] = useState("");
  const [selection, setSelection] = useState("");
  const [selectedKind, setSelectedKind] = useState<EntityKind>("npc");
  const [selectionTitle, setSelectionTitle] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function patch(partial: Partial<TranscriptFields>) {
    onUpdate({ ...fields, ...partial });
  }

  function handleSelect() {
    const el = textareaRef.current;
    if (!el) return;
    const text = el.value.slice(el.selectionStart, el.selectionEnd);
    setSelection(text);
    if (text && !selectionTitle) setSelectionTitle(text.length > 60 ? `${text.slice(0, 57)}…` : text);
  }

  function importFile(file: File) {
    const format = detectFormatFromFilename(file.name);
    void file.text().then((raw) => patch({ content: stripTranscriptMarkup(raw, format), sourceFormat: format }));
  }

  const matches = keyword.trim() ? searchTranscriptKeyword(transcript.content, keyword) : [];

  return (
    <div className="kind-section transcript-section">
      <span className="eyebrow">TRANSCRIÇÃO</span>
      <div className="compact-grid">
        <label className="compact-field">
          Formato de origem
          <select value={transcript.sourceFormat} onChange={(e) => patch({ sourceFormat: e.target.value as TranscriptFields["sourceFormat"] })}>
            {TRANSCRIPT_FORMATS.map((format) => <option value={format} key={format}>{format.toUpperCase()}</option>)}
          </select>
        </label>
        <label className="compact-field">
          Importar arquivo
          <input type="file" accept=".txt,.srt,.vtt" onChange={(e) => { const file = e.target.files?.[0]; if (file) importFile(file); }} />
        </label>
      </div>

      <label>
        Conteúdo ({transcript.content.length} caracteres)
        <textarea
          ref={textareaRef}
          className="transcript-content"
          value={transcript.content}
          onChange={(e) => patch({ content: e.target.value })}
          onSelect={handleSelect}
          placeholder="Cole a transcrição aqui, ou importe um arquivo TXT/SRT/VTT acima…"
        />
      </label>

      <span className="eyebrow">BUSCAR PALAVRA-CHAVE</span>
      <input className="transcript-search" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Ex.: runa, Vivian, Dungeon…" />
      {keyword.trim() && (
        <>
          <div className="transcript-match-count">{matches.length} ocorrência(s)</div>
          <ul className="mini-list transcript-matches">
            {matches.slice(0, 20).map((match) => <li key={match.index}><span className="mini-list-text">{match.snippet}</span></li>)}
            {!matches.length && <li className="mini-list-empty">Nada encontrado.</li>}
          </ul>
        </>
      )}

      {selection && (
        <div className="transcript-selection-form">
          <span className="eyebrow">CRIAR ELEMENTO A PARTIR DA SELEÇÃO</span>
          <p className="transcript-selection-preview">"{selection.length > 140 ? `${selection.slice(0, 137)}…` : selection}"</p>
          <div className="compact-grid">
            <label className="compact-field">
              Tipo
              <select value={selectedKind} onChange={(e) => setSelectedKind(e.target.value as EntityKind)}>
                {CARD_KINDS.map((kind) => <option value={kind} key={kind}>{kindConfig(kind).icon} {kindConfig(kind).label}</option>)}
              </select>
            </label>
            <label className="compact-field">Título<input value={selectionTitle} onChange={(e) => setSelectionTitle(e.target.value)} /></label>
          </div>
          <button
            type="button"
            className="ghost-button transcript-create-button"
            disabled={!selectionTitle.trim()}
            onClick={() => {
              onCreateFromSelection(selectedKind, selectionTitle.trim(), selection.trim());
              setSelection("");
              setSelectionTitle("");
            }}
          >
            <Icons.plus /> Criar elemento no Canvas
          </button>
        </div>
      )}

      <div className="inspector-tip">Selecione um trecho no texto acima para transformá-lo em um elemento do Canvas — a conversão é sempre manual.</div>
    </div>
  );
}
