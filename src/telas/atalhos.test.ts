import { describe, expect, it } from "vitest";
import { painelDoAtalho, type Tecla } from "./atalhos";

const tecla = (code: string, extra: Partial<Tecla> = {}): Tecla => ({ code, altKey: true, ctrlKey: false, shiftKey: false, metaKey: false, ...extra });

describe("atalhos dos painéis", () => {
  it("Alt+R abre ou fecha as Referências; Alt+P, a Prévia", () => {
    expect(painelDoAtalho(tecla("KeyR"))).toBe("referencias");
    expect(painelDoAtalho(tecla("KeyP"))).toBe("previa");
  });

  it("sem Alt, ou com Ctrl (AltGr), Shift ou a tecla do Windows junto, não é atalho", () => {
    expect(painelDoAtalho(tecla("KeyR", { altKey: false }))).toBeNull();
    expect(painelDoAtalho(tecla("KeyR", { ctrlKey: true }))).toBeNull();
    expect(painelDoAtalho(tecla("KeyR", { shiftKey: true }))).toBeNull();
    expect(painelDoAtalho(tecla("KeyR", { metaKey: true }))).toBeNull();
  });

  it("tecla segurada não fica abrindo e fechando", () => {
    expect(painelDoAtalho(tecla("KeyR", { repeat: true }))).toBeNull();
  });

  it("outras letras com Alt não fazem nada", () => {
    expect(painelDoAtalho(tecla("KeyQ"))).toBeNull();
  });
});
