import type { ThemeConfig } from 'antd';

/** dvote design: brand purple, Inter, soft grey canvas with white rounded cards (like the apps). */
export const brand = {
  purple: '#6155F5',
  purpleSoft: '#EFEEFE',
  ink: '#111114',
  canvas: '#F4F4F8',
  green: '#22A35A',
  greenSoft: '#E6F7EC',
  red: '#E5484D',
  muted: '#8E8E93',
};

export const theme: ThemeConfig = {
  token: {
    colorPrimary: brand.purple,
    colorInfo: brand.purple,
    colorSuccess: brand.green,
    colorError: brand.red,
    colorText: brand.ink,
    colorBgLayout: brand.canvas,
    fontFamily: "Inter, -apple-system, 'Segoe UI', Roboto, sans-serif",
    borderRadius: 10,
    borderRadiusLG: 16,
    controlHeight: 38,
  },
  components: {
    Layout: { siderBg: '#ffffff', headerBg: brand.canvas, bodyBg: brand.canvas },
    Menu: { itemBorderRadius: 10, itemSelectedBg: brand.purpleSoft, itemSelectedColor: brand.purple, itemHeight: 42 },
    Card: { paddingLG: 22 },
    Table: { headerBg: '#FAFAFC', rowHoverBg: '#F8F7FF' },
  },
};
