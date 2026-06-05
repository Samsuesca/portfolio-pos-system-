const SYNONYM_MAP: Record<string, string[]> = {
  jardinera: ['falda', 'jumper', 'faldita'],
  chompa: ['saco', 'buzo', 'chaqueta'],
  sudadera: ['buzo', 'hoodie', 'saco deportivo'],
  camiseta: ['camisa', 'polo', 'playera', 't-shirt'],
  pantalon: ['jean', 'jogger', 'pantalones'],
  medias: ['calcetines', 'calcetas', 'media'],
  bermuda: ['pantaloneta', 'short', 'shorts'],
  corbata: ['corbatin'],
  blusa: ['camisa', 'top'],
  zapatos: ['calzado', 'tenis'],
};

export function expandQueryWithSynonyms(query: string): string[] {
  const lower = query.toLowerCase().trim();
  const terms = [lower];

  for (const [canonical, synonyms] of Object.entries(SYNONYM_MAP)) {
    if (canonical.includes(lower) || synonyms.some(s => s.includes(lower))) {
      terms.push(canonical, ...synonyms);
    }
  }

  return [...new Set(terms)];
}
