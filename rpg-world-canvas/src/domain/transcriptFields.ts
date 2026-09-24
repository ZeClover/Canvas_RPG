// Transcript Engine data — the raw text of a session recording/log,
// pasted or imported (TXT/SRT/VTT). Search is plain keyword occurrence
// (see transcriptParser.ts); converting a passage into a canon entity is
// always a manual GM action. Nothing here is summarized or interpreted
// automatically — that's the whole "sem IA" point of this tool.

export const TRANSCRIPT_FORMATS = ["txt", "srt", "vtt", "outro"] as const;
export type TranscriptFormat = typeof TRANSCRIPT_FORMATS[number];

export interface TranscriptFields {
  content: string;
  sourceFormat: TranscriptFormat;
}

export function defaultTranscriptFields(): TranscriptFields {
  return { content: "", sourceFormat: "txt" };
}

export function readTranscriptFields(fields: Record<string, unknown>): TranscriptFields {
  const defaults = defaultTranscriptFields();
  const source = fields as Partial<TranscriptFields>;
  return {
    content: typeof source.content === "string" ? source.content : defaults.content,
    sourceFormat: typeof source.sourceFormat === "string" && (TRANSCRIPT_FORMATS as readonly string[]).includes(source.sourceFormat) ? source.sourceFormat as TranscriptFormat : defaults.sourceFormat,
  };
}
