import { describe, expect, it } from "vitest";
import { ehAtalhoDosAjustes, painelDoAtalho, type Tecla } from "./atalhos";

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

describe("atalho dos ajustes do bloco", () => {
  it("Alt+F abre os ajustes", () => {
    expect(ehAtalhoDosAjustes(tecla("KeyF"))).toBe(true);
  });

  it("sem Alt, com Ctrl (AltGr), Shift ou a tecla do Windows junto, ou segurada, não vale", () => {
    expect(ehAtalhoDosAjustes(tecla("KeyF", { altKey: false }))).toBe(false);
    expect(ehAtalhoDosAjustes(tecla("KeyF", { ctrlKey: true }))).toBe(false);
    expect(ehAtalhoDosAjustes(tecla("KeyF", { shiftKey: true }))).toBe(false);
    expect(ehAtalhoDosAjustes(tecla("KeyF", { metaKey: true }))).toBe(false);
    expect(ehAtalhoDosAjustes(tecla("KeyF", { repeat: true }))).toBe(false);
  });

  it("não briga com Alt+R nem Alt+P", () => {
    expect(ehAtalhoDosAjustes(tecla("KeyR"))).toBe(false);
    expect(ehAtalhoDosAjustes(tecla("KeyP"))).toBe(false);
    expect(painelDoAtalho(tecla("KeyF"))).toBeNull();
  });
});
