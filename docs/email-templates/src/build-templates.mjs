// Builds the Supabase auth email templates (English + Arabic in one email) from one shared layout.
// Writes docs/email-templates/<name>.html (paste into Supabase) and preview/<name>.html (sample data, local images).
// Run: node docs/email-templates/src/build-templates.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const ASSETS = 'https://dvote.co/email/'; // apps/web/public/email, built by build-assets.mjs

// Brand kit colours (tokens/dvote-tokens.json). Email clients need literal values.
const C = {
  electric: '#E1FF00', ink: '#11190C', paper: '#F3F1EE', white: '#FFFFFF', stone: '#CAC4B7',
  body: '#414638', muted: '#58594D', line: '#E8E5DE', brandText: '#4F5900', brandTint: '#F4F8CB',
};
const FONT = {
  display: "'Barlow Condensed','Arial Narrow',Arial,sans-serif",
  body: "Inter,'Segoe UI',Helvetica,Arial,sans-serif",
  arabic: "Cairo,Tahoma,'Segoe UI',Arial,sans-serif",
};

const LANG = {
  en: { dir: 'ltr', align: 'left', font: FONT.body, headFont: FONT.display, headSize: 44, headLine: 44, upper: true, lh: 26 },
  ar: { dir: 'rtl', align: 'right', font: FONT.arabic, headFont: FONT.arabic, headSize: 30, headLine: 46, upper: false, lh: 30 },
};

const p = (html, lang, extra = '') =>
  `<p style="margin:0 0 16px;font-family:${LANG[lang].font};font-size:16px;line-height:${LANG[lang].lh}px;color:${C.body};${extra}">${html}</p>`;
const small = (html, lang) =>
  `<p style="margin:18px 0 0;font-family:${LANG[lang].font};font-size:13px;line-height:20px;color:${C.muted}">${html}</p>`;
const ltr = (s) => `<span dir="ltr" style="unicode-bidi:isolate">${s}</span>`;

// Bulletproof button: the cell carries the colour so it survives clients that drop padding on links.
const button = (label, lang, href = '{{ .ConfirmationURL }}') => `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 0">
  <tr><td bgcolor="${C.electric}" style="background:${C.electric};border:2px solid ${C.ink};border-radius:14px">
    <a href="${href}" target="_blank" style="display:inline-block;padding:15px 30px;font-family:${LANG[lang].font};font-size:16px;font-weight:700;line-height:20px;color:${C.ink};text-decoration:none;border-radius:12px">${label}&nbsp;${lang === 'ar' ? '&larr;' : '&rarr;'}</a>
  </td></tr>
</table>`;

// A one-time code, large and easy to copy.
const code = (lang) => `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 8px">
  <tr><td dir="ltr" bgcolor="${C.paper}" style="background:${C.paper};border:2px dashed ${C.ink};border-radius:16px;padding:14px 26px;font-family:${FONT.display};font-size:40px;font-weight:700;letter-spacing:10px;line-height:44px;color:${C.ink}">{{ .Token }}</td></tr>
</table>`;

const fallbackLink = (lang) =>
  lang === 'en'
    ? small(`Button not working? Copy this link into your browser:<br><a href="{{ .ConfirmationURL }}" style="color:${C.brandText};word-break:break-all">{{ .ConfirmationURL }}</a>`, 'en')
    : '';

// Each section: eyebrow (small label), headline, body paragraphs, action.
function section(lang, { eyebrow, title, body, action }) {
  const L = LANG[lang];
  return `
<tr><td dir="${L.dir}" class="px" style="padding:${lang === 'en' ? '8px' : '32px'} 44px 36px;text-align:${L.align}">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px" align="${L.align}"><tr>
    <td bgcolor="${C.brandTint}" style="background:${C.brandTint};border-radius:999px;padding:5px 12px;font-family:${L.font};font-size:12px;font-weight:700;letter-spacing:${lang === 'en' ? '1.2px' : '0'};text-transform:${lang === 'en' ? 'uppercase' : 'none'};color:${C.brandText}">${eyebrow}</td>
  </tr></table>
  <div style="clear:both"></div>
  <h1 class="h1-${lang}" style="margin:0;font-family:${L.headFont};font-size:${L.headSize}px;line-height:${L.headLine}px;font-weight:700;color:${C.ink};${L.upper ? 'text-transform:uppercase;letter-spacing:-0.5px;' : ''}">${title}</h1>
  <img src="${ASSETS}underline.png" width="150" height="15" alt="" style="display:block;margin:10px 0 22px;${lang === 'ar' ? 'margin-right:0;margin-left:auto;transform:scaleX(-1);' : ''}border:0">
  ${body.map((b) => p(b, lang)).join('')}
  ${action}
</td></tr>`;
}

function layout({ name, preheader, en, ar, footerEn, footerAr }) {
  return `<!-- Supabase → Authentication → Emails → Templates → "${TITLES[name]}". Subject: see README.md. Built by src/build-templates.mjs: edit there, not here. -->
<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>dvote</title>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700&family=Cairo:wght@400;700&family=Inter:wght@400;700&display=swap" rel="stylesheet">
<style>
  body{margin:0;padding:0;-webkit-text-size-adjust:100%}
  img{border:0;outline:none;text-decoration:none}
  a{color:${C.brandText}}
  @media (max-width:600px){
    .px{padding-left:24px!important;padding-right:24px!important}
    .h1-en{font-size:36px!important;line-height:38px!important}
    .h1-ar{font-size:26px!important;line-height:40px!important}
    .hero{width:100%!important;height:auto!important}
  }
</style>
</head>
<body style="margin:0;padding:0;background:${C.ink}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.ink}">${preheader}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.ink}" background="${ASSETS}pattern-ink.png" style="background:${C.ink} url('${ASSETS}pattern-ink.png') repeat;background-size:240px 240px">
<tr><td align="center" style="padding:36px 12px 28px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">

    <tr><td align="center" style="padding:4px 0 28px">
      <a href="https://dvote.co" target="_blank"><img src="${ASSETS}logo-electric.png" width="140" height="44" alt="dvote" style="display:block;width:140px;height:auto;font-family:${FONT.display};font-size:32px;font-weight:700;color:${C.electric}"></a>
    </td></tr>

    <tr><td bgcolor="${C.white}" style="background:${C.white};border-radius:28px;overflow:hidden">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td align="center" style="padding:28px 24px 0">
          <img class="hero" src="${ASSETS}${name}.gif" width="400" height="300" alt="" style="display:block;width:400px;max-width:100%;height:auto">
        </td></tr>
        ${section('en', en)}
        <tr><td class="px" style="padding:0 44px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="border-top:2px dashed ${C.line};font-size:0;line-height:0">&nbsp;</td>
        </tr></table></td></tr>
        ${section('ar', ar)}
      </table>
    </td></tr>

    <tr><td align="center" style="padding:36px 24px 8px">
      <img src="${ASSETS}symbol-electric.png" width="40" height="40" alt="" style="display:block;width:40px;height:40px">
      <p style="margin:14px 0 4px;font-family:${FONT.display};font-size:22px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:${C.electric}">Good things come back.</p>
      <p dir="rtl" style="margin:0 0 20px;font-family:${FONT.arabic};font-size:16px;font-weight:700;color:${C.electric}">الأشياء الجميلة تعود دائمًا.</p>
      <p style="margin:0 0 6px;font-family:${FONT.body};font-size:12px;line-height:19px;color:${C.stone}">${footerEn}</p>
      <p dir="rtl" style="margin:0 0 18px;font-family:${FONT.arabic};font-size:12px;line-height:20px;color:${C.stone}">${footerAr}</p>
      <p style="margin:0;font-family:${FONT.body};font-size:12px;line-height:19px;color:${C.stone}">
        <a href="https://dvote.co" target="_blank" style="color:${C.electric};text-decoration:underline">dvote.co</a>
        &nbsp;·&nbsp;
        <a href="mailto:getdvote@gmail.com" style="color:${C.electric};text-decoration:underline">getdvote@gmail.com</a>
      </p>
    </td></tr>

  </table>
</td></tr>
</table>
</body>
</html>
`;
}

const TITLES = {
  invite: 'Invite user',
  'reset-password': 'Reset password',
  'confirm-signup': 'Confirm signup',
  'magic-link': 'Magic link',
  'change-email': 'Change email address',
  reauthentication: 'Reauthentication',
};

const hiEn = '{{ if .Data.full_name }}Hi {{ .Data.full_name }},{{ else }}Hi,{{ end }}';
const hiAr = '{{ if .Data.full_name }}أهلًا {{ .Data.full_name }}،{{ else }}أهلًا،{{ end }}';
const ignoreEn = 'Didn’t ask for this? Ignore this email: nothing changes.';
const ignoreAr = 'لم تطلب ذلك؟ تجاهل هذه الرسالة، ولن يتغيّر شيء.';

const templates = {
  invite: {
    preheader: '{{ if .Data.shop_name }}{{ .Data.shop_name }} added you to their team on dvote.{{ else }}You’re invited to dvote.{{ end }} Choose your password to start.',
    en: {
      eyebrow: 'Team invite',
      title: 'Welcome to the team',
      body: [
        hiEn,
        `{{ if .Data.shop_name }}You’ve been added to the team of <strong style="color:${C.ink}">{{ .Data.shop_name }}</strong> on dvote{{ if .Data.role_en }} as <strong style="color:${C.ink}">{{ .Data.role_en }}</strong>{{ end }}.{{ else }}You’ve been invited to dvote.{{ end }} dvote is the loyalty card the shop uses: you’ll scan customers’ cards, add points and hand out rewards.`,
        'Choose your password to start. The link works once and expires in 24 hours.',
      ],
      action: button('Set my password', 'en') + fallbackLink('en'),
    },
    ar: {
      eyebrow: 'دعوة للفريق',
      title: 'أهلًا بك في الفريق',
      body: [
        hiAr,
        `{{ if .Data.shop_name }}تمت إضافتك إلى فريق <strong style="color:${C.ink}">{{ .Data.shop_name }}</strong> على ${ltr('dvote')}{{ if .Data.role_ar }} بصفة <strong style="color:${C.ink}">{{ .Data.role_ar }}</strong>{{ end }}.{{ else }}تمت دعوتك إلى ${ltr('dvote')}.{{ end }} ${ltr('dvote')} هو نظام بطاقات الولاء الذي يستخدمه المحل: ستمسح بطاقات العملاء، وتضيف النقاط، وتسلّم المكافآت.`,
        'اختر كلمة المرور للبدء. الرابط يعمل مرة واحدة وينتهي خلال 24 ساعة.',
      ],
      action: button('اختر كلمة المرور', 'ar'),
    },
    footerEn: 'You received this because a manager at the shop invited {{ .Email }}. Not expecting it? Ignore this email.',
    footerAr: `وصلتك هذه الرسالة لأن أحد مديري المحل دعا ${ltr('{{ .Email }}')}. إذا لم تكن تتوقعها، تجاهلها.`,
  },
  'reset-password': {
    preheader: 'Choose a new password for your dvote account. The link expires in 1 hour.',
    en: {
      eyebrow: 'Password reset',
      title: 'Let’s get you back in',
      body: [hiEn, `We received a request to reset the password of your dvote account (${ltr('{{ .Email }}')}).`, 'Choose a new password with the button below. The link works once and expires in 1 hour.'],
      action: button('Choose a new password', 'en') + small('Didn’t ask for this? Ignore this email: your password stays the same.', 'en') + fallbackLink('en'),
    },
    ar: {
      eyebrow: 'كلمة المرور',
      title: 'لنُعِدك إلى حسابك',
      body: [hiAr, `وصلنا طلب لإعادة تعيين كلمة مرور حسابك على ${ltr('dvote')} (${ltr('{{ .Email }}')}).`, 'اختر كلمة مرور جديدة من الزر أدناه. الرابط يعمل مرة واحدة وينتهي خلال ساعة.'],
      action: button('اختر كلمة مرور جديدة', 'ar') + small('لم تطلب ذلك؟ تجاهل هذه الرسالة: كلمة المرور لن تتغيّر.', 'ar'),
    },
    footerEn: 'You received this because someone asked to reset the password for {{ .Email }}.',
    footerAr: `وصلتك هذه الرسالة لأن أحدهم طلب إعادة تعيين كلمة مرور ${ltr('{{ .Email }}')}.`,
  },
  // Merchant self sign-up (dashboard Signup.tsx sends full_name and shop_name) that starts the free trial.
  'confirm-signup': {
    preheader: 'Confirm your email to open {{ if .Data.shop_name }}{{ .Data.shop_name }}{{ else }}your shop{{ end }} and start your 7-day free trial.',
    en: {
      eyebrow: 'Free trial',
      title: 'Your shop is almost ready',
      body: [
        hiEn,
        `Welcome to dvote! Confirm your email to open {{ if .Data.shop_name }}<strong style="color:${C.ink}">{{ .Data.shop_name }}</strong>{{ else }}your shop{{ end }} and start your <strong style="color:${C.ink}">7-day free trial</strong> with every feature.`,
      ],
      action: button('Confirm my email', 'en') + small('Wasn’t you? Ignore this email: no shop is created.', 'en') + fallbackLink('en'),
    },
    ar: {
      eyebrow: 'تجربة مجانية',
      title: 'محلك جاهز تقريبًا',
      body: [
        hiAr,
        `مرحبًا بك في ${ltr('dvote')}! أكّد بريدك لفتح {{ if .Data.shop_name }}<strong style="color:${C.ink}">{{ .Data.shop_name }}</strong>{{ else }}محلك{{ end }} وبدء <strong style="color:${C.ink}">تجربتك المجانية لمدة 7 أيام</strong> بكل المميزات.`,
      ],
      action: button('أكّد بريدي', 'ar') + small('لم تكن أنت؟ تجاهل هذه الرسالة، ولن يُنشأ أي محل.', 'ar'),
    },
    footerEn: 'You received this because {{ .Email }} was used to sign up on dvote.',
    footerAr: `وصلتك هذه الرسالة لأن ${ltr('{{ .Email }}')} استُخدم للتسجيل في ${ltr('dvote')}.`,
  },
  'magic-link': {
    preheader: 'Your dvote sign-in link and code. They expire in 1 hour.',
    en: {
      eyebrow: 'Sign in',
      title: 'Your sign-in link',
      body: [hiEn, 'Tap the button to sign in to dvote. No password needed. The link works once and expires in 1 hour.'],
      action: button('Sign me in', 'en') + small('Or type this code where you signed in:', 'en') + code('en') + small(ignoreEn, 'en'),
    },
    ar: {
      eyebrow: 'تسجيل الدخول',
      title: 'رابط تسجيل الدخول',
      body: [hiAr, `اضغط الزر لتسجيل الدخول إلى ${ltr('dvote')} دون كلمة مرور. الرابط يعمل مرة واحدة وينتهي خلال ساعة.`],
      action: button('سجّل دخولي', 'ar') + small('أو اكتب هذا الرمز في صفحة تسجيل الدخول:', 'ar') + code('ar') + small(ignoreAr, 'ar'),
    },
    footerEn: 'You received this because someone asked to sign in as {{ .Email }}.',
    footerAr: `وصلتك هذه الرسالة لأن أحدهم طلب تسجيل الدخول بـ ${ltr('{{ .Email }}')}.`,
  },
  'change-email': {
    preheader: 'Confirm the new email address for your dvote account.',
    en: {
      eyebrow: 'Email change',
      title: 'Confirm your new email',
      body: [hiEn, `You asked to change the email of your dvote account from <strong style="color:${C.ink}">${ltr('{{ .Email }}')}</strong> to <strong style="color:${C.ink}">${ltr('{{ .NewEmail }}')}</strong>.`, 'Confirm the change with the button below. Until then, keep signing in with your current email.'],
      action: button('Confirm new email', 'en') + small('Didn’t ask for this? Ignore this email and your email stays the same.', 'en') + fallbackLink('en'),
    },
    ar: {
      eyebrow: 'تغيير البريد',
      title: 'أكّد بريدك الجديد',
      body: [hiAr, `طلبت تغيير بريد حسابك على ${ltr('dvote')} من <strong style="color:${C.ink}">${ltr('{{ .Email }}')}</strong> إلى <strong style="color:${C.ink}">${ltr('{{ .NewEmail }}')}</strong>.`, 'أكّد التغيير من الزر أدناه. حتى ذلك الحين، استمر في تسجيل الدخول ببريدك الحالي.'],
      action: button('تأكيد البريد الجديد', 'ar') + small('لم تطلب ذلك؟ تجاهل هذه الرسالة وسيبقى بريدك كما هو.', 'ar'),
    },
    footerEn: 'You received this because an email change was requested for {{ .Email }}.',
    footerAr: `وصلتك هذه الرسالة لأن تغيير البريد طُلب للحساب ${ltr('{{ .Email }}')}.`,
  },
  reauthentication: {
    preheader: 'Your dvote security code: {{ .Token }}',
    en: {
      eyebrow: 'Security code',
      title: 'Confirm it’s you',
      body: [hiEn, 'Type this code to finish what you started in dvote. It expires in 1 hour. Never share it with anyone, including the dvote team.'],
      action: code('en') + small(ignoreEn + ' Someone may know your password: change it to be safe.', 'en'),
    },
    ar: {
      eyebrow: 'رمز الأمان',
      title: 'أكّد أنك أنت',
      body: [hiAr, `اكتب هذا الرمز لإكمال ما بدأته في ${ltr('dvote')}. ينتهي خلال ساعة. لا تشاركه مع أي أحد، ولا حتى فريق ${ltr('dvote')}.`],
      action: code('ar') + small('لم تطلب ذلك؟ ربما يعرف أحدهم كلمة مرورك: غيّرها احتياطًا.', 'ar'),
    },
    footerEn: 'You received this because a security check was requested for {{ .Email }}.',
    footerAr: `وصلتك هذه الرسالة لأن تحققًا أمنيًا طُلب للحساب ${ltr('{{ .Email }}')}.`,
  },
};

// Tiny evaluator for the Go template subset used above ({{ if .X }} … {{ else }} … {{ end }} and {{ .X }}), for previews.
function render(tpl, data) {
  const get = (key) => key.split('.').filter(Boolean).reduce((o, k) => (o == null ? undefined : o[k]), data);
  const tokens = tpl.split(/({{.*?}})/);
  const stack = [{ on: true }];
  let out = '';
  for (const t of tokens) {
    const m = t.match(/^{{\s*(if|else|end)?\s*(\.[\w.]+)?\s*}}$/);
    if (!m) { if (stack.every((s) => s.on)) out += t; continue; }
    const [, kw, key] = m;
    if (kw === 'if') stack.push({ on: Boolean(get(key)), taken: Boolean(get(key)) });
    else if (kw === 'else') { const s = stack.at(-1); s.on = !s.taken; }
    else if (kw === 'end') stack.pop();
    else if (stack.every((s) => s.on)) out += get(key) ?? '';
  }
  return out;
}

const sample = {
  ConfirmationURL: 'https://cfknsqlixyeihhkleock.supabase.co/auth/v1/verify?token=preview&type=invite&redirect_to=https://admin.dvote.co',
  Email: 'sara@example.com',
  NewEmail: 'sara.new@example.com',
  Token: '482913',
  Data: { full_name: 'Sara Adel', shop_name: 'Joy Corner', role_en: 'Branch manager', role_ar: 'مدير فرع' },
};

mkdirSync(join(root, 'preview'), { recursive: true });
for (const [name, t] of Object.entries(templates)) {
  const html = layout({ name, ...t });
  writeFileSync(join(root, `${name}.html`), html);
  const preview = render(html, sample).replaceAll(ASSETS, '/apps/web/public/email/');
  writeFileSync(join(root, 'preview', `${name}.html`), preview);
  console.log(`${name}.html`);
}
