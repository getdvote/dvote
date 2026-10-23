/**
 * Native equivalents of the dashboard's coffee palette (brand v2.0) and Inter typography: froth canvas,
 * white surfaces, espresso type and header, orange only for the main action.
 */
export const theme = {
  background: '#F8F4F1', // froth
  surface: '#FFFFFF',
  text: '#18100F', // espresso
  muted: '#6B5E57',
  placeholder: '#8C7B6E',
  primary: '#18100F',
  onPrimary: '#F8F4F1',
  brand: '#FF5500', // orange: fills with espresso on top (5.9:1)
  onBrand: '#18100F',
  border: '#EADFD0',
  subtle: '#F3E3CB', // latte
  sidebar: '#18100F',
  sidebarAccent: '#2B201D',
  danger: '#B42318',
  dangerSoft: '#FEF3F2',
  font: { regular: 'Inter_400Regular', medium: 'Inter_500Medium', semibold: 'Inter_600SemiBold', bold: 'Inter_700Bold' },
  radius: 12,
  controlHeight: 52,
  buttonHeight: 52,
  gutter: 20,
  maxWidth: 560,
} as const;
