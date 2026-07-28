/**
 * Cienkie ikony liniowe — placeholdery zdjęć produktów i kategorii.
 * Jeden styl: viewBox 48, stroke currentColor, grubość 1.1, brak wypełnień.
 * Podmieniając na prawdziwe zdjęcia, zastąp wywołania icon() elementem <img>.
 */
const ICON_PATHS = {
  headphones:
    '<path d="M8 30v-6a16 16 0 0 1 32 0v6"/><rect x="6" y="28" width="9" height="14" rx="4.5"/><rect x="33" y="28" width="9" height="14" rx="4.5"/>',
  laptop:
    '<rect x="10" y="11" width="28" height="19" rx="1.5"/><path d="M4 35h40l-2.5 4h-35z"/>',
  camera:
    '<rect x="5" y="14" width="38" height="25" rx="2.5"/><circle cx="24" cy="26.5" r="7.5"/><path d="M17 14l2.6-4h8.8l2.6 4"/><circle cx="36" cy="20" r="1"/>',
  speaker:
    '<rect x="14" y="5" width="20" height="38" rx="3"/><circle cx="24" cy="31" r="6.5"/><circle cx="24" cy="14" r="2.6"/>',
  monitor:
    '<rect x="4" y="9" width="40" height="26" rx="2"/><path d="M24 35v5m-7 0h14"/>',
  bulb:
    '<path d="M24 7a11 11 0 0 0-6.4 19.9c1 .8 1.6 1.9 1.6 3.1v2h9.6v-2c0-1.2.6-2.3 1.6-3.1A11 11 0 0 0 24 7z"/><path d="M19.6 36h8.8M21 40h6"/>',
  lens:
    '<circle cx="24" cy="24" r="17"/><circle cx="24" cy="24" r="9"/><path d="M24 7v4M41 24h-4"/>',
  lock:
    '<rect x="10" y="21" width="28" height="20" rx="3"/><path d="M17 21v-6a7 7 0 0 1 14 0v6"/><circle cx="24" cy="30" r="2"/>',
  search:
    '<circle cx="21" cy="21" r="13"/><path d="M31 31l11 11"/>',
  grid:
    '<rect x="6" y="6" width="15" height="15" rx="1.5"/><rect x="27" y="6" width="15" height="15" rx="1.5"/><rect x="6" y="27" width="15" height="15" rx="1.5"/><rect x="27" y="27" width="15" height="15" rx="1.5"/>',
  user:
    '<circle cx="24" cy="17" r="8"/><path d="M9 42c1.6-8.4 7.9-13 15-13s13.4 4.6 15 13"/>',
  box:
    '<path d="M24 6l17 9v18l-17 9-17-9V15z"/><path d="M7 15l17 9 17-9M24 24v18"/>',
  heart:
    '<path d="M24 40S7 30 7 19.5A9.5 9.5 0 0 1 24 14a9.5 9.5 0 0 1 17 5.5C41 30 24 40 24 40z"/>',
  pin:
    '<path d="M24 42s13-12.4 13-22a13 13 0 1 0-26 0c0 9.6 13 22 13 22z"/><circle cx="24" cy="20" r="5"/>',
  logout:
    '<path d="M19 7H9v34h10"/><path d="M30 16l8 8-8 8M38 24H18"/>',
  check:
    '<path d="M9 25l10 10 20-22"/>',
  info:
    '<circle cx="24" cy="24" r="18"/><path d="M24 22v11M24 15.5v.5"/>',
  shield:
    '<path d="M24 6l15 6v13c0 9.5-6.4 15.9-15 18-8.6-2.1-15-8.5-15-18V12z"/><path d="M17 24l5 5 10-10"/>',
  close:
    '<path d="M12 12l24 24M36 12L12 36"/>',
  eye:
    '<path d="M4 24s7-12 20-12 20 12 20 12-7 12-20 12S4 24 4 24z"/><circle cx="24" cy="24" r="6"/>',
  cart:
    '<path d="M6 8h6l5 22h20l4-15H15"/><circle cx="20" cy="39" r="2.5"/><circle cx="36" cy="39" r="2.5"/>',
};

function icon(name, size) {
  const body = ICON_PATHS[name] ?? ICON_PATHS.grid;
  const dim = size ? ` width="${size}" height="${size}"` : '';
  return `<svg${dim} viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.1"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}
