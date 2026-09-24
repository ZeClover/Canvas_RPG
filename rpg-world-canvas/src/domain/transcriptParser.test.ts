import { describe, expect, it } from "vitest";
import { detectFormatFromFilename, searchTranscriptKeyword, stripTranscriptMarkup } from "./transcriptParser";

describe("transcriptParser: detecção de formato", () => {
  it("detecta srt/vtt/txt pela extensão do arquivo", () => {
    expect(detectFormatFromFilename("sessao02.srt")).toBe("srt");
    expect(detectFormatFromFilename("sessao02.VTT")).toBe("vtt");
    expect(detectFormatFromFilename("sessao02.txt")).toBe("txt");
    expect(detectFormatFromFilename("sessao02.pdf")).toBe("outro");
  });
});

describe("transcriptParser: stripTranscriptMarkup", () => {
  it("remove índice numérico e timestamps de um SRT, mantendo só a fala", () => {
    const srt = [
      "1",
      "00:00:01,000 --> 00:00:04,000",
      "Olá, isso é um teste.",
      "",
      "2",
      "00:00:05,000 --> 00:00:07,500",
      "Segunda linha de fala.",
    ].join("\n");
    expect(stripTranscriptMarkup(srt, "srt")).toBe("Olá, isso é um teste.\nSegunda linha de fala.");
  });

  it("remove o cabeçalho WEBVTT e timestamps de um VTT", () => {
    const vtt = [
      "WEBVTT",
      "",
      "00:00:01.000 --> 00:00:04.000",
      "Primeira fala.",
      "",
      "00:00:05.000 --> 00:00:07.000",
      "Segunda fala.",
    ].join("\n");
    expect(stripTranscriptMarkup(vtt, "vtt")).toBe("Primeira fala.\nSegunda fala.");
  });

  it("não mexe em texto puro (txt) — nada para remover", () => {
    const raw = "Linha 1\n\nLinha 2 com espaço extra   ";
    expect(stripTranscriptMarkup(raw, "txt")).toBe(raw);
  });

  it("nunca reescreve o conteúdo das falas, só remove a marcação de legenda", () => {
    const srt = "1\n00:00:01,000 --> 00:00:02,000\nA runa está quebrada e ninguém sabe por quê.";
    expect(stripTranscriptMarkup(srt, "srt")).toContain("A runa está quebrada e ninguém sabe por quê.");
  });
});

describe("transcriptParser: busca por palavra-chave", () => {
  const content = "A runa quebrada abre um caminho. Vivian conhece a runa. Ninguém mais sabe sobre a runa.";

  it("encontra todas as ocorrências, sem diferenciar maiúsculas/minúsculas", () => {
    const matches = searchTranscriptKeyword(content, "RUNA");
    expect(matches).toHaveLength(3);
  });

  it("retorna lista vazia para palavra-chave vazia ou sem ocorrências", () => {
    expect(searchTranscriptKeyword(content, "")).toEqual([]);
    expect(searchTranscriptKeyword(content, "dragão")).toEqual([]);
  });

  it("cada ocorrência inclui um trecho de contexto ao redor", () => {
    const matches = searchTranscriptKeyword("xxxxxxxxxx palavra yyyyyyyyyy", "palavra", 5);
    expect(matches[0].snippet).toContain("palavra");
    expect(matches[0].snippet.length).toBeLessThan(content.length);
  });
});
