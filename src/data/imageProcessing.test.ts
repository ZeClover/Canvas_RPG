import { describe, expect, it } from "vitest";
import { normalizeExternalImageUrl } from "./imageProcessing";

describe("imagem externa", () => {
  it("aceita links HTTP e HTTPS", () => {
    expect(normalizeExternalImageUrl(" https://example.com/a.png ")).toBe("https://example.com/a.png");
    expect(normalizeExternalImageUrl("http://example.com/a.webp")).toBe("http://example.com/a.webp");
  });

  it("recusa caminhos e protocolos inseguros", () => {
    expect(normalizeExternalImageUrl("C:\\imagem.png")).toBeNull();
    expect(normalizeExternalImageUrl("javascript:alert(1)")).toBeNull();
  });
});
