export type ColorThemeId = 'sapphire' | 'lime' | 'emerald' | 'indigo' | 'amber' | 'rose';

export interface ColorThemeConfig {
  id: ColorThemeId;
  label: string;
  swatchHex: string;
  accent: string;
  accentHover: string;
  accentFg: string;
  accentGlow: string;
  forcesBlackMode?: boolean;
}

export const COLOR_THEMES: ColorThemeConfig[] = [
  {
    id: 'sapphire',
    label: 'Sapphire',
    swatchHex: '#0A84FF',
    accent: '#0A84FF',
    accentHover: '#0071E3',
    accentFg: '#FFFFFF',
    accentGlow: 'rgba(10, 132, 255, 0.36)',
  },
  {
    id: 'lime',
    label: 'Lime & Black',
    swatchHex: '#A3E635',
    accent: '#A3E635',
    accentHover: '#84CC16',
    accentFg: '#050802',
    accentGlow: 'rgba(163, 230, 53, 0.36)',
    forcesBlackMode: true,
  },
  {
    id: 'emerald',
    label: 'Emerald',
    swatchHex: '#30D158',
    accent: '#28CD41',
    accentHover: '#22B839',
    accentFg: '#041208',
    accentGlow: 'rgba(48, 209, 88, 0.36)',
  },
  {
    id: 'indigo',
    label: 'Indigo',
    swatchHex: '#5E5CE6',
    accent: '#5E5CE6',
    accentHover: '#4D4AD8',
    accentFg: '#FFFFFF',
    accentGlow: 'rgba(94, 92, 230, 0.36)',
  },
  {
    id: 'amber',
    label: 'Amber',
    swatchHex: '#FF9F0A',
    accent: '#FF9F0A',
    accentHover: '#E58D00',
    accentFg: '#140B00',
    accentGlow: 'rgba(255, 159, 10, 0.36)',
  },
  {
    id: 'rose',
    label: 'Rose',
    swatchHex: '#FF375F',
    accent: '#FF375F',
    accentHover: '#E62B52',
    accentFg: '#FFFFFF',
    accentGlow: 'rgba(255, 55, 95, 0.36)',
  },
];

export function getColorTheme(id?: ColorThemeId): ColorThemeConfig {
  return COLOR_THEMES.find((t) => t.id === id) || COLOR_THEMES[0];
}
