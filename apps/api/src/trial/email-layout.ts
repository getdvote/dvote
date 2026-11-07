/**
 * The dvote email frame, the same look as the Supabase auth emails (docs/email-templates/src/
 * build-templates.mjs: keep both in step): espresso patterned frame, white logo, a white card with an
 * eyebrow, a headline with the hand-drawn underline, the text, a blue button, and the "Good things come
 * back." footer. Images come from https://dvote.co/email/ (built by build-assets.mjs).
 */
const ASSETS = 'https://dvote.co/email/';
const C = {
  brand: '#1F3DFF', frame: '#18100F', ink: '#18100F', paper: '#F8F4F1', white: '#FFFFFF', stone: '#C2B3A6',
  body: '#3D312D', muted: '#6B5E57', line: '#E4DCD4', brandTint: '#E8EBFF',
};
const FONT = {
  latin: "'DM Sans','Segoe UI',Helvetica,Arial,sans-serif",
  arabic: "Alexandria,Tahoma,'Segoe UI',Arial,sans-serif",
};
const LANG = {
  en: { dir: 'ltr', align: 'left', font: FONT.latin, headSize: 32, headLine: 38, lh: 26 },
  ar: { dir: 'rtl', align: 'right', font: FONT.arabic, headSize: 28, headLine: 44, lh: 30 },
} as const;
type Lang = keyof typeof LANG;

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export interface EmailSection {
  eyebrow: string;
  title: string;
  /** Paragraphs, already escaped (may hold simple inline HTML). */
  body: string[];
  button: { label: string; href: string };
  /** Small grey line under the button, already escaped. */
  note?: string;
}

function section(lang: Lang, s: EmailSection, first: boolean): string {
  const L = LANG[lang];
  const p = (html: string) => `<p style="margin:0 0 16px;font-family:${L.font};font-size:16px;line-height:${L.lh}px;color:${C.body}">${html}</p>`;
  return `
<tr><td dir="${L.dir}" class="px" style="padding:${first ? '36px' : '32px'} 44px 36px;text-align:${L.align}">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px" align="${L.align}"><tr>
    <td bgcolor="${C.brandTint}" style="background:${C.brandTint};border-radius:999px;padding:5px 12px;font-family:${L.font};font-size:12px;font-weight:700;letter-spacing:${lang === 'en' ? '1.2px' : '0'};text-transform:${lang === 'en' ? 'uppercase' : 'none'};color:${C.brand}">${s.eyebrow}</td>
  </tr></table>
  <div style="clear:both"></div>
  <h1 class="h1-${lang}" style="margin:0;font-family:${L.font};font-size:${L.headSize}px;line-height:${L.headLine}px;font-weight:900;color:${C.ink}">${s.title}</h1>
  <img src="${ASSETS}underline.png" width="150" height="15" alt="" style="display:block;margin:10px 0 22px;${lang === 'ar' ? 'margin-right:0;margin-left:auto;transform:scaleX(-1);' : ''}border:0">
  ${s.body.map(p).join('')}
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 0" align="${L.align}">
    <tr><td bgcolor="${C.brand}" style="background:${C.brand};border:2px solid ${C.brand};border-radius:14px">
      <a href="${esc(s.button.href)}" target="_blank" style="display:inline-block;padding:15px 30px;font-family:${L.font};font-size:16px;font-weight:700;line-height:20px;color:${C.white};text-decoration:none;border-radius:12px">${s.button.label}&nbsp;${lang === 'ar' ? '&larr;' : '&rarr;'}</a>
    </td></tr>
  </table>
  <div style="clear:both"></div>
  ${s.note ? `<p style="margin:18px 0 0;font-family:${L.font};font-size:13px;line-height:20px;color:${C.muted}">${s.note}</p>` : ''}
</td></tr>`;
}

/** One email with both languages: `order[0]` first, a dashed line, then the other. */
export function dvoteEmail(opts: { preheader: string; ar: EmailSection; en: EmailSection; footerAr: string; footerEn: string; order?: Lang[] }): string {
  const order = opts.order ?? ['ar', 'en'];
  const divider = `<tr><td class="px" style="padding:0 44px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td style="border-top:2px dashed ${C.line};font-size:0;line-height:0">&nbsp;</td></tr></table></td></tr>`;
  return `<!doctype html>
<html lang="ar" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>dvote</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,700;9..40,900&family=Alexandria:wght@400;700;900&display=swap" rel="stylesheet">
<style>
  body{margin:0;padding:0;-webkit-text-size-adjust:100%}
  img{border:0;outline:none;text-decoration:none}
  @media (max-width:600px){
    .px{padding-left:24px!important;padding-right:24px!important}
    .h1-en{font-size:28px!important;line-height:34px!important}
    .h1-ar{font-size:24px!important;line-height:38px!important}
  }
</style>
</head>
<body style="margin:0;padding:0;background:${C.frame}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.frame}">${esc(opts.preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.frame}" background="${ASSETS}pattern-ink.png" style="background:${C.frame} url('${ASSETS}pattern-ink.png') repeat;background-size:240px 240px">
<tr><td align="center" style="padding:36px 12px 28px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">
    <tr><td align="center" style="padding:4px 0 28px">
      <a href="https://dvote.co" target="_blank"><img src="${ASSETS}logo-electric.png" width="140" height="44" alt="dvote" style="display:block;width:140px;height:auto;font-family:${FONT.latin};font-size:32px;font-weight:700;color:${C.white}"></a>
    </td></tr>
    <tr><td bgcolor="${C.white}" style="background:${C.white};border-radius:28px;overflow:hidden">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${section(order[0], opts[order[0]], true)}
        ${divider}
        ${section(order[1], opts[order[1]], false)}
      </table>
    </td></tr>
    <tr><td align="center" style="padding:36px 24px 8px">
      <img src="${ASSETS}symbol-electric.png" width="40" height="40" alt="" style="display:block;width:40px;height:40px">
      <p style="margin:14px 0 4px;font-family:${FONT.latin};font-size:22px;font-weight:900;font-style:italic;color:${C.white}">Good things come back.</p>
      <p dir="rtl" style="margin:0 0 20px;font-family:${FONT.arabic};font-size:16px;font-weight:900;color:${C.white}">الحاجات الحلوة بترجع.</p>
      <p dir="rtl" style="margin:0 0 6px;font-family:${FONT.arabic};font-size:12px;line-height:20px;color:${C.stone}">${opts.footerAr}</p>
      <p style="margin:0 0 18px;font-family:${FONT.latin};font-size:12px;line-height:19px;color:${C.stone}">${opts.footerEn}</p>
      <p style="margin:0;font-family:${FONT.latin};font-size:12px;line-height:19px;color:${C.stone}">
        <a href="https://dvote.co" target="_blank" style="color:${C.white};text-decoration:underline">dvote.co</a>
        &nbsp;·&nbsp;
        <a href="mailto:getdvote@gmail.com" style="color:${C.white};text-decoration:underline">getdvote@gmail.com</a>
      </p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}
