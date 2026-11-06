/**
 * Native equivalents of the dashboard's brand v3.0 palette and DM Sans typography: froth canvas,
 * white surfaces, espresso type, an espresso header, dvote Blue for the main action.
 */
export const theme = {
  background: '#F8F4F1', // froth
  surface: '#FFFFFF',
  text: '#18100F', // espresso
  muted: '#6B5E57',
  placeholder: '#8C7B6E',
  primary: '#18100F',
  onPrimary: '#F8F4F1',
  brand: '#1F3DFF', // dvote blue: fills carry white (6.63:1)
  onBrand: '#FFFFFF',
  border: '#E4DCD4',
  subtle: '#EFE9E3', // oat
  sidebar: '#18100F',
  sidebarAccent: '#2B201D',
  danger: '#B42318',
  dangerSoft: '#FEF3F2',
  font: { regular: 'DMSans_400Regular', medium: 'DMSans_500Medium', semibold: 'DMSans_600SemiBold', bold: 'DMSans_700Bold', black: 'DMSans_900Black' },
  radius: 12,
  controlHeight: 52,
  buttonHeight: 52,
  gutter: 20,
  maxWidth: 560,
} as const;
