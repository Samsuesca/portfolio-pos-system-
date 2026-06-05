"use client";

import { useEffect, useState } from "react";

/**
 * Devuelve `false` en el primer render (server y primer paint del cliente),
 * `true` despues de mount. Util para gatear UI que depende de stores
 * persistidos en localStorage (cart, auth) y asi evitar mismatches de
 * hydration entre el HTML del server y el estado real del cliente.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
