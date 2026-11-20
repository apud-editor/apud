// As normas que o Apud conhece. Uma norma nova (Vancouver, por exemplo)
// entra aqui com o seu esquema, e depois ganha um perfil na pasta perfis/.

import type { EsquemaNorma } from "./esquema";
import { ESQUEMA_ABNT } from "./esquema-abnt";
import { ESQUEMA_APA } from "./esquema-apa";
import { normalizar } from "./texto";

export const ESQUEMAS: ReadonlyMap<string, EsquemaNorma> = new Map(
  [ESQUEMA_ABNT, ESQUEMA_APA].map((e) => [normalizar(e.norma), e]),
);
