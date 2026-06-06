/* ============================================================
   Memoir — Icon set (stroke line icons, 16px grid)
   Usage: <Icon name="folder" size={16} />
   ============================================================ */

const ICON_PATHS = {
  search:     '<circle cx="7.5" cy="7.5" r="5"/><path d="M15 15l-3.7-3.7"/>',
  plus:       '<path d="M8 3v10M3 8h10"/>',
  settings:   '<circle cx="8" cy="8" r="2.2"/><path d="M8 1.2v1.6M8 13.2v1.6M1.2 8h1.6M13.2 8h1.6M3.2 3.2l1.1 1.1M11.7 11.7l1.1 1.1M12.8 3.2l-1.1 1.1M4.3 11.7l-1.1 1.1"/>',
  folder:     '<path d="M2 4.2c0-.66.54-1.2 1.2-1.2h2.5l1.3 1.5h4.8c.66 0 1.2.54 1.2 1.2v6.1c0 .66-.54 1.2-1.2 1.2H3.2c-.66 0-1.2-.54-1.2-1.2V4.2z"/>',
  folderOpen: '<path d="M2 5.2c0-.66.54-1.2 1.2-1.2h2.3l1.3 1.4h4.9c.66 0 1.2.54 1.2 1.2M2 5.2v6.1c0 .66.54 1.2 1.2 1.2h8.4l2.2-5.2c.2-.46-.14-.98-.64-.98H4.1c-.46 0-.87.27-1.05.7L2 11.3"/>',
  file:       '<path d="M4 2h4.5L12 5.5V13a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z"/><path d="M8.3 2v3.4H12"/>',
  fileCode:   '<path d="M4 2h4.5L12 5.5V13a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z"/><path d="M8.3 2v3.4H12"/><path d="M6.4 8.6L5 10l1.4 1.4M9.2 8.6L10.6 10 9.2 11.4"/>',
  gitBranch:  '<circle cx="4.5" cy="3.5" r="1.6"/><circle cx="4.5" cy="12.5" r="1.6"/><circle cx="11.5" cy="5" r="1.6"/><path d="M4.5 5.1v5.8M11.5 6.6c0 2.4-1.6 3-4 3.2"/>',
  gitCommit:  '<circle cx="8" cy="8" r="2.4"/><path d="M2 8h3.6M10.4 8H14"/>',
  archive:    '<rect x="2.2" y="3" width="11.6" height="3" rx=".8"/><path d="M3.3 6v6c0 .6.45 1 1 1h7.4c.55 0 1-.4 1-1V6M6.4 8.8h3.2"/>',
  clock:      '<circle cx="8" cy="8" r="6"/><path d="M8 4.6V8l2.3 1.4"/>',
  check:      '<path d="M3 8.4l3.2 3.1L13 4.8"/>',
  checkCircle:'<circle cx="8" cy="8" r="6"/><path d="M5.4 8.1l1.8 1.8 3.4-3.6"/>',
  chevronR:   '<path d="M6 3.5L10.5 8 6 12.5"/>',
  chevronD:   '<path d="M3.5 6L8 10.5 12.5 6"/>',
  external:   '<path d="M9 2.5h4.5V7M13 3l-6 6M11 9v3.3c0 .4-.3.7-.7.7H3.7c-.4 0-.7-.3-.7-.7V5.7c0-.4.3-.7.7-.7H7"/>',
  terminal:   '<rect x="2" y="3" width="12" height="10" rx="1.4"/><path d="M5 6.6L7 8.4 5 10.2M8.4 10.4h2.6"/>',
  sparkles:   '<path d="M8 2.2l1.1 3.1 3.1 1.1-3.1 1.1L8 10.7 6.9 7.6 3.8 6.4l3.1-1.1L8 2.2z"/><path d="M12.5 9.6l.5 1.4 1.4.5-1.4.5-.5 1.4-.5-1.4-1.4-.5 1.4-.5.5-1.4z"/>',
  x:          '<path d="M4 4l8 8M12 4l-8 8"/>',
  edit:       '<path d="M9.5 2.8l3.2 3.2M11 1.8l2.4 2.4-7.7 7.7-3 .8.8-3 7.5-7.7z"/>',
  link:       '<path d="M6.6 9.4l2.8-2.8M7 4.2l.9-.9a2.6 2.6 0 013.7 3.7l-.9.9M9 11.8l-.9.9a2.6 2.6 0 01-3.7-3.7l.9-.9"/>',
  code:       '<path d="M5.6 5L2.6 8l3 3M10.4 5l3 3-3 3M9 3.4l-2 9.2"/>',
  layers:     '<path d="M8 2l6 3-6 3-6-3 6-3z"/><path d="M2 8l6 3 6-3M2 11l6 3 6-3"/>',
  alert:      '<path d="M8 2.4l6 10.2H2L8 2.4z"/><path d="M8 6.6v3M8 11.2v.05"/>',
  arrowUp:    '<path d="M8 13V3M4 6.5L8 3l4 3.5"/>',
  arrowDown:  '<path d="M8 3v10M4 9.5L8 13l4-3.5"/>',
  tag:        '<path d="M2.6 7.4V3.6c0-.55.45-1 1-1h3.8c.27 0 .52.1.7.3l5.2 5.2c.4.4.4 1.02 0 1.42l-3.78 3.78c-.4.4-1.02.4-1.42 0L2.9 8.1a1 1 0 01-.3-.7z"/><circle cx="5.4" cy="5.4" r=".9"/>',
  refresh:    '<path d="M13 7a5 5 0 10-.5 3.5M13 4v3h-3"/>',
  grid:       '<rect x="2.4" y="2.4" width="4.4" height="4.4" rx="1"/><rect x="9.2" y="2.4" width="4.4" height="4.4" rx="1"/><rect x="2.4" y="9.2" width="4.4" height="4.4" rx="1"/><rect x="9.2" y="9.2" width="4.4" height="4.4" rx="1"/>',
  list:       '<path d="M5.4 4h8.2M5.4 8h8.2M5.4 12h8.2M2.4 4h.05M2.4 8h.05M2.4 12h.05"/>',
  sort:       '<path d="M4 3v10M4 13l-2-2M4 13l2-2M9 4h5M9 7.5h3.5M9 11h2"/>',
  package:    '<path d="M8 2l5.2 2.8v6.4L8 14l-5.2-2.8V4.8L8 2z"/><path d="M2.8 4.8L8 7.6l5.2-2.8M8 7.6V14"/>',
  database:   '<ellipse cx="8" cy="4" rx="5" ry="2"/><path d="M3 4v8c0 1.1 2.24 2 5 2s5-.9 5-2V4M3 8c0 1.1 2.24 2 5 2s5-.9 5-2"/>',
  globe:      '<circle cx="8" cy="8" r="6"/><path d="M2 8h12M8 2c1.8 1.6 2.8 3.8 2.8 6S9.8 12.4 8 14c-1.8-1.6-2.8-3.8-2.8-6S6.2 3.6 8 2z"/>',
  cpu:        '<rect x="4" y="4" width="8" height="8" rx="1.2"/><path d="M6.5 4V2M9.5 4V2M6.5 14v-2M9.5 14v-2M4 6.5H2M4 9.5H2M14 6.5h-2M14 9.5h-2"/>',
  bookOpen:   '<path d="M8 4.2C6.8 3.4 5.4 3 3.8 3 3.3 3 2.8 3.1 2.4 3.2v8.6c.4-.1.9-.2 1.4-.2 1.6 0 3 .4 4.2 1.2M8 4.2c1.2-.8 2.6-1.2 4.2-1.2.5 0 1 .1 1.4.2v8.6c-.4-.1-.9-.2-1.4-.2-1.6 0-3 .4-4.2 1.2M8 4.2v9"/>',
  dotGrid:    '<circle cx="4" cy="4" r="1"/><circle cx="8" cy="4" r="1"/><circle cx="12" cy="4" r="1"/><circle cx="4" cy="8" r="1"/><circle cx="8" cy="8" r="1"/><circle cx="12" cy="8" r="1"/>',
  command:    '<path d="M5.5 3.5a1.5 1.5 0 100 3h5a1.5 1.5 0 100-3 1.5 1.5 0 00-1.5 1.5v6a1.5 1.5 0 11-1.5-1.5h5a1.5 1.5 0 111.5 1.5"/>',
  play:       '<path d="M4.5 3.2l8 4.8-8 4.8V3.2z"/>',
  copy:       '<rect x="5.5" y="5.5" width="8" height="8" rx="1.2"/><path d="M3 10.5h-.3A1.2 1.2 0 011.5 9.3V3.7A1.2 1.2 0 012.7 2.5h5.6a1.2 1.2 0 011.2 1.2V4"/>',
  filter:     '<path d="M2.5 3.5h11l-4.2 5v4l-2.6 1.3v-5.3L2.5 3.5z"/>',
  pin:        '<path d="M6 2h4l-.6 3.2 2.1 2.1-2.6.5L8 13 6.7 7.8l-2.6-.5 2.1-2.1L6 2z"/>',
  inbox:      '<path d="M2.5 9.5L4 3.4c.13-.5.58-.9 1.1-.9h5.8c.52 0 .97.4 1.1.9l1.5 6.1M2.5 9.5V12c0 .55.45 1 1 1h9c.55 0 1-.45 1-1V9.5M2.5 9.5H6l.8 1.4h2.4l.8-1.4h3.5"/>',
};

function Icon({ name, size = 16, color = 'currentColor', strokeWidth = 1.5, style = {}, className = '' }) {
  const path = ICON_PATHS[name] || ICON_PATHS.dotGrid;
  return (
    <svg
      width={size} height={size} viewBox="0 0 16 16" fill="none"
      stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, ...style }} className={className}
      dangerouslySetInnerHTML={{ __html: path }}
    />
  );
}

Object.assign(window, { Icon, ICON_PATHS });
