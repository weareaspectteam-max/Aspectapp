export interface Theme {
  id: string;
  name: string;
  bg: string;       // CSS gradient
  accent: string;   // accent renk
}

export const THEMES: Theme[] = [
  { id: 'mor-gece',     name: 'Mor Gece',     bg: 'linear-gradient(135deg, #0a051e 0%, #1a0a3c 50%, #0d0a2e 100%)', accent: '#a855f7' },
  { id: 'okyanus',      name: 'Okyanus',      bg: 'linear-gradient(135deg, #0c1e2e 0%, #143348 50%, #0e2538 100%)', accent: '#38bdf8' },
  { id: 'orman',        name: 'Orman',        bg: 'linear-gradient(135deg, #0c2018 0%, #143828 50%, #0e2a1c 100%)', accent: '#34d399' },
  { id: 'gece-mavisi',  name: 'Gece Mavisi',  bg: 'linear-gradient(135deg, #0e1225 0%, #1a2545 50%, #121a35 100%)', accent: '#6366f1' },
  { id: 'karbon',       name: 'Karbon',       bg: 'linear-gradient(135deg, #121212 0%, #222222 50%, #181818 100%)', accent: '#f59e0b' },
  { id: 'gun-batimi',   name: 'Gün Batımı',   bg: 'linear-gradient(135deg, #1e1012 0%, #301820 50%, #241418 100%)', accent: '#fb923c' },
  { id: 'lavanta',      name: 'Lavanta',      bg: 'linear-gradient(135deg, #1e1530 0%, #2e2248 50%, #241a38 100%)', accent: '#c084fc' },
  { id: 'deniz-kiyisi', name: 'Deniz Kıyısı', bg: 'linear-gradient(135deg, #0e2025 0%, #163035 50%, #10252a 100%)', accent: '#2dd4bf' },
  { id: 'gul-kurusu',   name: 'Gül Kurusu',   bg: 'linear-gradient(135deg, #201018 0%, #351a28 50%, #281420 100%)', accent: '#f472b6' },
  { id: 'altin-saat',   name: 'Altın Saat',   bg: 'linear-gradient(135deg, #1e1a10 0%, #302815 50%, #252010 100%)', accent: '#fbbf24' },
];

export const DEFAULT_THEME_ID = 'mor-gece';

export function getThemeById(id: string): Theme {
  return THEMES.find(t => t.id === id) || THEMES[0];
}

export function applyTheme(themeId: string) {
  const theme = getThemeById(themeId);
  document.documentElement.style.setProperty('--app-bg', theme.bg);
  document.documentElement.style.setProperty('--app-accent', theme.accent);
  localStorage.setItem('aspect_theme', themeId);
}
