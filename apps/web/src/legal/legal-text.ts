/**
 * Privacy policy and terms of use shown at m.dvote.co/privacy and m.dvote.co/terms.
 * Kept here, not in the i18n dictionaries: long legal text, one block per language.
 * Draft written 2026-10-18 for launch; have it reviewed by a lawyer before going live.
 * Keep the English and Arabic versions saying the same thing.
 */

export interface LegalSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
}

export interface LegalDoc {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}

const CONTACT = 'getdvote@gmail.com';

export const PRIVACY: Record<'en' | 'ar', LegalDoc> = {
  en: {
    title: 'Privacy policy',
    updated: 'Last updated: 18 October 2026',
    intro:
      'dvote runs loyalty cards for cafés, restaurants and shops in Egypt. This page explains what we collect when you join a shop’s loyalty card, why, who can see it, and what you can ask us to do with it.',
    sections: [
      {
        heading: 'Who we are',
        paragraphs: [
          `dvote ("we") provides the loyalty card service. Each shop ("the merchant") decides its own points and rewards. For the loyalty card at a shop, dvote and that merchant both use your details as described here. Contact us at ${CONTACT}.`,
        ],
      },
      {
        heading: 'What we collect',
        bullets: [
          'The name and Egyptian mobile number you type when you join (and an email address only if you give one).',
          'Which shop you joined, and if the link came from a branch’s NFC tag or QR code, which branch.',
          'Your card: its code, points balance and history: the date and branch of each visit, the bill amount the staff typed, points added or used, and rewards you received.',
          'Feedback you choose to send to a shop (your name, comment and, if you add it, your mobile number).',
          'If you add the card to Google Wallet or Apple Wallet: technical identifiers the wallet needs to keep your card up to date. We do not see your other wallet cards.',
          'Basic technical data our servers record for security, such as your IP address and the time of a request.',
        ],
      },
      {
        heading: 'Why we use it',
        bullets: [
          'To create your card, find it again when you join with the same mobile number, and show it to you.',
          'To add and use points when staff scan your card, and to keep your balance correct.',
          'To keep your wallet card up to date, and to show messages the shop sends to its card holders (for example a new reward). At most a few per day.',
          'To let the shop understand its customers (visits, spending and rewards) and serve you.',
          'To prevent fraud and misuse (for example many collects in a short time) and to keep the service secure.',
        ],
      },
      {
        heading: 'Who can see it',
        bullets: [
          'The shop you joined and its staff: your name, mobile number, visits, spending, points and rewards at that shop. Shops do not see your cards at other shops.',
          'dvote’s own team, only to run and support the service.',
          'Service providers that host or deliver the service for us: Supabase (database and sign-in, servers in the European Union), our hosting and network providers (such as Cloudflare), and Google or Apple when you add the card to their wallet.',
          'Authorities, only when the law requires it.',
        ],
        paragraphs: ['We do not sell your data, and we do not show advertising.'],
      },
      {
        heading: 'Location',
        paragraphs: [
          'We do not track your location. If a shop turns on “nearby” alerts, your wallet app may show its card when you are close to a branch; that is done on your phone by Google or Apple, and your location is not sent to us or to the shop.',
        ],
      },
      {
        heading: 'How long we keep it',
        paragraphs: [
          'We keep your details while your card exists. If you ask us to delete them, we remove your name and contact details within 30 days. Records of past visits and rewards may be kept without your name, because shops need them for their accounts.',
        ],
      },
      {
        heading: 'Your choices and rights',
        bullets: [
          'Ask for a copy of your details, or ask us to correct them.',
          'Ask us to delete your card and details.',
          'Remove the card from your wallet at any time (this does not delete your details; ask us for that).',
          'Turn off wallet notifications in your phone’s settings.',
        ],
        paragraphs: [
          `Write to ${CONTACT} from any address, with the mobile number you joined with and the shop name. We may ask you to confirm the request. We aim to follow Egypt’s Personal Data Protection Law (No. 151 of 2020).`,
        ],
      },
      {
        heading: 'Children',
        paragraphs: ['The loyalty card is meant for people aged 14 or older. If you are younger, ask a parent before joining.'],
      },
      {
        heading: 'Cookies and browser storage',
        paragraphs: [
          'This website does not use advertising or tracking cookies. It only remembers your language choice in your browser.',
        ],
      },
      {
        heading: 'Security',
        paragraphs: [
          'Your data is sent over encrypted connections and stored with access limited to the people who need it. The QR code on your card works like a key: do not share pictures of it.',
        ],
      },
      {
        heading: 'Changes',
        paragraphs: ['If we change this policy, we will update the date at the top of this page. Important changes will be shown on this website.'],
      },
    ],
  },
  ar: {
    title: 'سياسة الخصوصية',
    updated: 'آخر تحديث: 18 أكتوبر 2026',
    intro:
      'تقدّم dvote بطاقات الولاء للمقاهي والمطاعم والمحلات في مصر. توضّح هذه الصفحة ما نجمعه عند اشتراكك في بطاقة ولاء أحد المحلات، ولماذا، ومن يمكنه رؤيته، وما يمكنك أن تطلبه منا بشأنه.',
    sections: [
      {
        heading: 'من نحن',
        paragraphs: [
          `‏dvote («نحن») تقدّم خدمة بطاقات الولاء. كل محل («التاجر») يحدّد نقاطه ومكافآته بنفسه. بالنسبة لبطاقة الولاء في محل ما، تستخدم dvote وذلك التاجر بياناتك كما هو موضّح هنا. تواصل معنا على ${CONTACT}.`,
        ],
      },
      {
        heading: 'ما الذي نجمعه',
        bullets: [
          'الاسم ورقم الموبايل المصري اللذان تكتبهما عند الاشتراك (والبريد الإلكتروني فقط إذا أعطيته).',
          'المحل الذي اشتركت فيه، والفرع إذا جاء الرابط من شريحة NFC أو كود QR الخاص بفرع.',
          'بطاقتك: الكود ورصيد النقاط وسجلها: تاريخ وفرع كل زيارة، ومبلغ الفاتورة الذي كتبه الموظف، والنقاط المضافة أو المستخدمة، والمكافآت التي حصلت عليها.',
          'الآراء التي تختار إرسالها لمحل (اسمك وتعليقك، ورقم موبايلك إذا أضفته).',
          'إذا أضفت البطاقة إلى محفظة Google أو Apple: معرّفات تقنية تحتاجها المحفظة لتحديث بطاقتك. لا نرى بطاقاتك الأخرى في المحفظة.',
          'بيانات تقنية بسيطة تسجّلها خوادمنا للأمان، مثل عنوان IP ووقت الطلب.',
        ],
      },
      {
        heading: 'لماذا نستخدمها',
        bullets: [
          'لإنشاء بطاقتك، وإيجادها مرة أخرى عند اشتراكك بنفس رقم الموبايل، وعرضها لك.',
          'لإضافة النقاط واستخدامها عندما يمسح الموظف بطاقتك، وللحفاظ على رصيدك صحيحًا.',
          'لتحديث بطاقتك في المحفظة، ولعرض الرسائل التي يرسلها المحل لحاملي بطاقاته (مثل مكافأة جديدة)، بحد أقصى عدد قليل يوميًا.',
          'لمساعدة المحل على فهم عملائه (الزيارات والإنفاق والمكافآت) وخدمتك.',
          'لمنع الاحتيال وسوء الاستخدام (مثل عمليات تجميع كثيرة في وقت قصير) وللحفاظ على أمان الخدمة.',
        ],
      },
      {
        heading: 'من يمكنه رؤيتها',
        bullets: [
          'المحل الذي اشتركت فيه وموظفوه: اسمك ورقم موبايلك وزياراتك وإنفاقك ونقاطك ومكافآتك في هذا المحل. لا ترى المحلات بطاقاتك في المحلات الأخرى.',
          'فريق dvote فقط لتشغيل الخدمة ودعمها.',
          'مقدّمو الخدمات الذين يستضيفون الخدمة أو يوصّلونها لنا: Supabase (قاعدة البيانات وتسجيل الدخول، خوادم في الاتحاد الأوروبي)، ومزوّدو الاستضافة والشبكة (مثل Cloudflare)، وGoogle أو Apple عند إضافة البطاقة إلى محفظتهما.',
          'الجهات الرسمية فقط عندما يفرض القانون ذلك.',
        ],
        paragraphs: ['لا نبيع بياناتك، ولا نعرض إعلانات.'],
      },
      {
        heading: 'الموقع',
        paragraphs: [
          'لا نتتبّع موقعك. إذا فعّل المحل تنبيهات «بالقرب منك»، قد يعرض تطبيق المحفظة بطاقته عندما تكون قريبًا من أحد فروعه؛ يتم ذلك على هاتفك بواسطة Google أو Apple، ولا يُرسل موقعك إلينا أو إلى المحل.',
        ],
      },
      {
        heading: 'مدة الاحتفاظ',
        paragraphs: [
          'نحتفظ ببياناتك طالما بطاقتك موجودة. إذا طلبت حذفها، نحذف اسمك وبيانات التواصل خلال 30 يومًا. قد تبقى سجلات الزيارات والمكافآت السابقة بدون اسمك، لأن المحلات تحتاجها لحساباتها.',
        ],
      },
      {
        heading: 'اختياراتك وحقوقك',
        bullets: [
          'أن تطلب نسخة من بياناتك أو تصحيحها.',
          'أن تطلب حذف بطاقتك وبياناتك.',
          'أن تزيل البطاقة من محفظتك في أي وقت (هذا لا يحذف بياناتك؛ اطلب منا ذلك).',
          'أن توقف إشعارات المحفظة من إعدادات هاتفك.',
        ],
        paragraphs: [
          `راسلنا على ${CONTACT} من أي بريد، مع رقم الموبايل الذي اشتركت به واسم المحل. قد نطلب منك تأكيد الطلب. نسعى للالتزام بقانون حماية البيانات الشخصية المصري (رقم 151 لسنة 2020).`,
        ],
      },
      {
        heading: 'الأطفال',
        paragraphs: ['بطاقة الولاء مخصّصة لمن عمرهم 14 سنة أو أكثر. إذا كنت أصغر، اسأل أحد والديك قبل الاشتراك.'],
      },
      {
        heading: 'ملفات تعريف الارتباط وتخزين المتصفح',
        paragraphs: ['لا يستخدم هذا الموقع ملفات تعريف ارتباط للإعلانات أو التتبّع. هو فقط يتذكّر اللغة التي اخترتها في متصفحك.'],
      },
      {
        heading: 'الأمان',
        paragraphs: [
          'تُرسل بياناتك عبر اتصالات مشفّرة وتُحفظ مع قصر الوصول على من يحتاجها. كود QR على بطاقتك يعمل كمفتاح: لا تشارك صوره.',
        ],
      },
      {
        heading: 'التغييرات',
        paragraphs: ['إذا غيّرنا هذه السياسة، سنحدّث التاريخ أعلى هذه الصفحة. التغييرات المهمة ستُعرض على هذا الموقع.'],
      },
    ],
  },
};

export const TERMS: Record<'en' | 'ar', LegalDoc> = {
  en: {
    title: 'Terms of use',
    updated: 'Last updated: 21 October 2026',
    intro:
      'These terms apply when you join a shop’s loyalty card on dvote, use the card in Google Wallet or Apple Wallet, or use this website. By joining, you agree to them.',
    sections: [
      {
        heading: 'The service',
        paragraphs: [
          'dvote provides the technology for loyalty cards. Each shop (“the merchant”) runs its own programme: it decides how many points you earn, which rewards it offers, and what they cost in points. The products and rewards themselves come from the merchant, not from dvote.',
        ],
      },
      {
        heading: 'Joining and your card',
        bullets: [
          'You join with your name and an Egyptian mobile number. Use your own number and your real name.',
          'One mobile number is one customer. Joining the same shop again with the same number opens the same card.',
          'You need to be 14 or older, or have a parent’s permission.',
          'Your card has a QR code. Anyone who has it can collect or use points on your card, so keep it to yourself. If you think someone else is using it, contact the shop or us.',
        ],
      },
      {
        heading: 'Points',
        bullets: [
          'Points are added only when the shop’s staff scan your card and enter your bill. The amount of points follows the shop’s rule at that moment.',
          'Points belong to your card at that shop. They can be used at any branch of the same shop, but not at other shops, and they cannot be moved to another person.',
          'Points have no cash value. They cannot be exchanged for money.',
          'The merchant may change its points rule or its rewards. Points you already have stay on your card; changes apply from then on.',
          'If points were added by mistake or through misuse, they may be corrected or removed.',
        ],
      },
      {
        heading: 'Rewards',
        bullets: [
          'You choose when to use your points. Ask the staff at the till; they scan your card and confirm the reward.',
          'Rewards depend on availability and may be sold out at a branch for a time.',
          'Points used for a reward are deducted at once and cannot be returned, unless the shop corrects a mistake.',
        ],
      },
      {
        heading: 'Wallet cards and messages',
        paragraphs: [
          'Adding the card to Google Wallet or Apple Wallet is optional. Their own terms also apply. The shop may send short messages to its card holders through the wallet (for example a new reward); you can turn wallet notifications off in your phone’s settings.',
        ],
      },
      {
        heading: 'Fair use',
        bullets: [
          'Do not copy, share or fake card codes, or try to get points without a real purchase.',
          'Do not try to break, overload or misuse the service.',
        ],
        paragraphs: ['If we or the merchant see misuse, the card may be blocked and points removed.'],
      },
      {
        heading: 'Ending',
        paragraphs: [
          `You can stop using your card at any time and ask us to delete it at ${CONTACT}; its points end with it. If a shop leaves dvote or closes its programme, its cards and points end too; we will try to give notice on the card page.`,
        ],
      },
      {
        heading: 'Our responsibility',
        paragraphs: [
          'We work to keep the service running and your points correct, but it is provided “as is” and may sometimes be unavailable. To the extent the law allows, dvote is not responsible for the merchant’s products, prices or service, or for indirect losses. Nothing here limits rights you have under Egyptian consumer protection law.',
        ],
      },
      {
        heading: 'For shops: accounts and the free trial',
        bullets: [
          'A shop can create a dvote account on the merchant dashboard and use every feature free for 7 days. No payment card is needed for the trial.',
          'When the 7 days end, the account is locked until the shop subscribes to a paid plan: the dashboard shows only the subscription message, staff cannot scan cards, and the shop’s page and new sign-ups stop.',
          'If no paid plan is active 30 days after sign-up, the shop’s account and all of its data are deleted for good and cannot be recovered: its branches, team, rewards, images, and its customers’ cards, points and history at that shop. Customers’ cards at other shops are not affected.',
          'Plans are monthly and priced by the number of branches (see the pricing page on dvote.co). The shop is responsible for its own rewards and for what it tells its customers.',
        ],
      },
      {
        heading: 'Changes to these terms',
        paragraphs: ['We may update these terms. The date at the top shows the latest version. If you keep using your card after a change, the new terms apply.'],
      },
      {
        heading: 'Law and contact',
        paragraphs: [`These terms follow the laws of the Arab Republic of Egypt. Questions or complaints: ${CONTACT}.`],
      },
    ],
  },
  ar: {
    title: 'شروط الاستخدام',
    updated: 'آخر تحديث: 21 أكتوبر 2026',
    intro:
      'تنطبق هذه الشروط عند اشتراكك في بطاقة ولاء أحد المحلات على dvote، أو استخدام البطاقة في محفظة Google أو Apple، أو استخدام هذا الموقع. باشتراكك، أنت توافق عليها.',
    sections: [
      {
        heading: 'الخدمة',
        paragraphs: [
          'تقدّم dvote التقنية الخاصة ببطاقات الولاء. كل محل («التاجر») يدير برنامجه بنفسه: يحدّد عدد النقاط التي تكسبها، والمكافآت التي يقدّمها، وكم تكلّف بالنقاط. المنتجات والمكافآت نفسها يقدّمها التاجر وليس dvote.',
        ],
      },
      {
        heading: 'الاشتراك وبطاقتك',
        bullets: [
          'تشترك باسمك ورقم موبايل مصري. استخدم رقمك واسمك الحقيقي.',
          'كل رقم موبايل هو عميل واحد. الاشتراك في نفس المحل مرة أخرى بنفس الرقم يفتح نفس البطاقة.',
          'يجب أن يكون عمرك 14 سنة أو أكثر، أو أن يكون لديك إذن أحد والديك.',
          'بطاقتك لها كود QR. أي شخص يملكه يمكنه تجميع النقاط أو استخدامها على بطاقتك، فاحتفظ به لنفسك. إذا ظننت أن شخصًا آخر يستخدمه، تواصل مع المحل أو معنا.',
        ],
      },
      {
        heading: 'النقاط',
        bullets: [
          'تُضاف النقاط فقط عندما يمسح موظف المحل بطاقتك ويُدخل فاتورتك. عدد النقاط يتبع قاعدة المحل في تلك اللحظة.',
          'النقاط تخص بطاقتك في ذلك المحل. يمكن استخدامها في أي فرع لنفس المحل، وليس في محلات أخرى، ولا يمكن نقلها لشخص آخر.',
          'النقاط ليس لها قيمة نقدية ولا يمكن استبدالها بالمال.',
          'يمكن للتاجر تغيير قاعدة النقاط أو المكافآت. النقاط التي لديك تبقى على بطاقتك، والتغييرات تسري من وقتها.',
          'إذا أُضيفت نقاط بالخطأ أو بسبب سوء استخدام، قد يتم تصحيحها أو إزالتها.',
        ],
      },
      {
        heading: 'المكافآت',
        bullets: [
          'أنت تختار متى تستخدم نقاطك. اطلب ذلك من الموظف عند الكاشير؛ يمسح بطاقتك ويؤكّد المكافأة.',
          'المكافآت حسب التوفّر، وقد تنفد في أحد الفروع لفترة.',
          'النقاط المستخدمة في مكافأة تُخصم فورًا ولا تُسترد، إلا إذا صحّح المحل خطأً.',
        ],
      },
      {
        heading: 'بطاقات المحفظة والرسائل',
        paragraphs: [
          'إضافة البطاقة إلى محفظة Google أو Apple اختيارية، وتنطبق شروطهما أيضًا. قد يرسل المحل رسائل قصيرة لحاملي بطاقاته عبر المحفظة (مثل مكافأة جديدة)؛ يمكنك إيقاف إشعارات المحفظة من إعدادات هاتفك.',
        ],
      },
      {
        heading: 'الاستخدام العادل',
        bullets: [
          'لا تنسخ أكواد البطاقات أو تشاركها أو تزيّفها، ولا تحاول الحصول على نقاط بدون شراء حقيقي.',
          'لا تحاول تعطيل الخدمة أو إثقالها أو إساءة استخدامها.',
        ],
        paragraphs: ['إذا لاحظنا نحن أو التاجر سوء استخدام، قد يتم إيقاف البطاقة وإزالة النقاط.'],
      },
      {
        heading: 'الإنهاء',
        paragraphs: [
          `يمكنك التوقّف عن استخدام بطاقتك في أي وقت وطلب حذفها على ${CONTACT}، وتنتهي نقاطها معها. إذا غادر محل dvote أو أنهى برنامجه، تنتهي بطاقاته ونقاطه أيضًا؛ وسنحاول التنبيه على صفحة البطاقة.`,
        ],
      },
      {
        heading: 'مسؤوليتنا',
        paragraphs: [
          'نعمل على استمرار الخدمة وصحة نقاطك، لكنها تُقدَّم «كما هي» وقد تتوقّف أحيانًا. في الحدود التي يسمح بها القانون، لا تتحمّل dvote مسؤولية منتجات التاجر أو أسعاره أو خدمته، ولا الخسائر غير المباشرة. لا شيء هنا يحدّ من حقوقك وفق قانون حماية المستهلك المصري.',
        ],
      },
      {
        heading: 'للمحلات: الحسابات والتجربة المجانية',
        bullets: [
          'يمكن للمحل إنشاء حساب على dvote من لوحة تحكم التاجر واستخدام كل المميزات مجاناً لمدة 7 أيام، دون الحاجة إلى بطاقة دفع.',
          'عند انتهاء الأيام السبعة، يُقفل الحساب حتى يشترك المحل في باقة مدفوعة: لا تعرض لوحة التحكم إلا رسالة الاشتراك، ولا يستطيع الموظفون مسح البطاقات، وتتوقف صفحة المحل والاشتراكات الجديدة.',
          'إذا لم تكن هناك باقة مدفوعة مفعّلة بعد 30 يوماً من التسجيل، يُحذف حساب المحل وكل بياناته نهائياً ولا يمكن استرجاعها: فروعه وفريقه ومكافآته وصوره، وبطاقات عملائه ونقاطهم وسجلهم في هذا المحل. لا تتأثر بطاقات العملاء في المحلات الأخرى.',
          'الباقات شهرية وتُسعّر حسب عدد الفروع (راجع صفحة الأسعار على dvote.co). المحل مسؤول عن مكافآته وعما يخبر به عملاءه.',
        ],
      },
      {
        heading: 'تغيير هذه الشروط',
        paragraphs: ['قد نحدّث هذه الشروط. التاريخ في الأعلى يوضّح أحدث نسخة. إذا واصلت استخدام بطاقتك بعد التغيير، تسري الشروط الجديدة.'],
      },
      {
        heading: 'القانون والتواصل',
        paragraphs: [`تخضع هذه الشروط لقوانين جمهورية مصر العربية. للأسئلة أو الشكاوى: ${CONTACT}.`],
      },
    ],
  },
};
