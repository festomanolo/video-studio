export type Theme = {
  name: string;
  bg: string;
  bg2: string;
  surface: string;
  surface2: string;
  line: string;
  ink: string;
  muted: string;
  accent: string;
  accent2: string;
  good: string;
  bad: string;
  /** prism-react-renderer token colours */
  code: { plain: string; keyword: string; string: string; number: string; comment: string; fn: string; type: string; punct: string; op: string };
};

const darkCode = {
  plain: '#E6E8EE',
  keyword: '#C792EA',
  string: '#A5E88B',
  number: '#F9B26C',
  comment: '#6B7489',
  fn: '#82AAFF',
  type: '#FFCB6B',
  punct: '#8F98AE',
  op: '#89DDFF',
};

export const THEMES: Record<string, Theme> = {
  midnight: {
    name: 'midnight',
    bg: '#0A0C12',
    bg2: '#151A2A',
    surface: '#121622',
    surface2: '#1A2030',
    line: 'rgba(255,255,255,0.08)',
    ink: '#F3F5FA',
    muted: '#8D96AB',
    accent: '#8B6CFF',
    accent2: '#2DD4BF',
    good: '#4ADE80',
    bad: '#FB7185',
    code: darkCode,
  },
  paper: {
    name: 'paper',
    bg: '#F4F1EA',
    bg2: '#E9E3D6',
    surface: '#FFFFFF',
    surface2: '#F7F5F0',
    line: 'rgba(0,0,0,0.08)',
    ink: '#16161A',
    muted: '#6E6A62',
    accent: '#FF5A36',
    accent2: '#2563EB',
    good: '#16A34A',
    bad: '#DC2626',
    code: { ...darkCode },
  },
  neon: {
    name: 'neon',
    bg: '#06060A',
    bg2: '#1B0B2E',
    surface: '#12101C',
    surface2: '#1C1830',
    line: 'rgba(255,255,255,0.1)',
    ink: '#FFFFFF',
    muted: '#A49FB8',
    accent: '#C6FF3D',
    accent2: '#FF3DCB',
    good: '#C6FF3D',
    bad: '#FF4D6D',
    code: darkCode,
  },
  sunset: {
    name: 'sunset',
    bg: '#1A0E14',
    bg2: '#3B1530',
    surface: '#24121C',
    surface2: '#331A28',
    line: 'rgba(255,255,255,0.1)',
    ink: '#FFF4EC',
    muted: '#C9A9A6',
    accent: '#FFB23F',
    accent2: '#FF5E7E',
    good: '#7CF29A',
    bad: '#FF5E7E',
    code: darkCode,
  },
};

export const getTheme = (name?: string | null): Theme => THEMES[name ?? ''] ?? THEMES.midnight;
