/** Specyfikacja w formularzu: jedna linia = `Klucz: wartość`. */

export function textToSpecs(text: string): Record<string, string> {
  return text
    .split('\n')
    .map((line) => line.split(':'))
    .filter((parts) => parts.length >= 2 && parts[0].trim())
    .reduce<Record<string, string>>((acc, parts) => {
      acc[parts[0].trim()] = parts.slice(1).join(':').trim();
      return acc;
    }, {});
}

export function specsToText(specs: Record<string, string>): string {
  return Object.entries(specs ?? {})
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
}
