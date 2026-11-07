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
      'dvote بتقدّم كروت النقط للكافيهات والمطاعم والمحلات في مصر. الصفحة دي بتوضّح إيه اللي بنجمعه لما تشترك في كارت محل، وليه، ومين يقدر يشوفه، وإيه اللي تقدر تطلبه مننا بخصوصه.',
    sections: [
      {
        heading: 'إحنا مين',
        paragraphs: [
          `‏dvote («إحنا») بتقدّم خدمة كروت النقط. كل محل («التاجر») بيحدد نقطه ومكافآته بنفسه. في كارت أي محل، dvote والتاجر ده بيستخدموا بياناتك زي ما هو موضّح هنا. كلّمنا على ${CONTACT}.`,
        ],
      },
      {
        heading: 'بنجمع إيه',
        bullets: [
          'الاسم ورقم الموبايل المصري اللي بتكتبهم لما تشترك (والإيميل بس لو كتبته).',
          'المحل اللي اشتركت فيه، والفرع لو اللينك جه من ستاند NFC أو QR بتاع فرع.',
          'كارتك: الكود ورصيد النقط وسجلها: تاريخ وفرع كل زيارة، ومبلغ الفاتورة اللي الموظف كتبه، والنقط اللي اتضافت أو اتستخدمت، والمكافآت اللي خدتها.',
          'الآراء اللي بتختار تبعتها لمحل (اسمك وتعليقك، ورقم موبايلك لو كتبته).',
          'لو ضفت الكارت على Google Wallet أو Apple Wallet: بيانات تقنية محتاجينها عشان الكارت يتحدّث هناك. مش بنشوف كروتك التانية في Wallet.',
          'بيانات تقنية بسيطة بتتسجل عندنا للأمان، زي عنوان IP ووقت الطلب.',
        ],
      },
      {
        heading: 'بنستخدمها ليه',
        bullets: [
          'عشان نعمل كارتك، ونلاقيه تاني لما تشترك بنفس رقم الموبايل، ونعرضهولك.',
          'عشان نضيف النقط ونستخدمها لما الموظف يعمل سكان لكارتك، ونحافظ على رصيدك صحيح.',
          'عشان نحدّث كارتك في Wallet، ونعرض الرسايل اللي المحل بيبعتها لزباينه (زي مكافأة جديدة)، وبحد أقصى عدد قليل في اليوم.',
          'عشان نساعد المحل يفهم زباينه (الزيارات والصرف والمكافآت) ويخدمك.',
          'عشان نمنع الاحتيال وسوء الاستخدام (زي عمليات تجميع كتير في وقت قصير) ونحافظ على أمان الخدمة.',
        ],
      },
      {
        heading: 'مين يقدر يشوفها',
        bullets: [
          'المحل اللي اشتركت فيه وموظفينه: اسمك ورقم موبايلك وزياراتك وصرفك ونقطك ومكافآتك في المحل ده. المحلات مش بتشوف كروتك في المحلات التانية.',
          'فريق dvote، بس عشان يشغّل الخدمة ويدعمها.',
          'مقدمو الخدمات اللي بيستضيفوا الخدمة أو بيوصّلوها لنا: Supabase (قاعدة البيانات وتسجيل الدخول، خوادم في الاتحاد الأوروبي)، ومزوّدو الاستضافة والشبكة (زي Cloudflare)، وGoogle أو Apple لما تضيف الكارت على Wallet بتاعهم.',
          'الجهات الرسمية، بس لما القانون يفرض ده.',
        ],
        paragraphs: ['مش بنبيع بياناتك، ومش بنعرض إعلانات.'],
      },
      {
        heading: 'الموقع',
        paragraphs: [
          'مش بنتتبّع موقعك. لو المحل شغّل تنبيهات «قريب منك»، Wallet ممكن يعرض كارته لما تكون قريب من فرع من فروعه. ده بيحصل على موبايلك عن طريق Google أو Apple، وموقعك مش بيتبعت لينا ولا للمحل.',
        ],
      },
      {
        heading: 'بنحتفظ بيها قد إيه',
        paragraphs: [
          'بنحتفظ ببياناتك طول ما كارتك موجود. لو طلبت مسحها، بنمسح اسمك وبيانات التواصل خلال 30 يوم. سجلات الزيارات والمكافآت القديمة ممكن تفضل من غير اسمك، لأن المحلات محتاجاها لحساباتها.',
        ],
      },
      {
        heading: 'اختياراتك وحقوقك',
        bullets: [
          'تطلب نسخة من بياناتك أو تصحّحها.',
          'تطلب مسح كارتك وبياناتك.',
          'تشيل الكارت من Wallet في أي وقت (ده مش بيمسح بياناتك، لازم تطلب مننا).',
          'توقّف إشعارات Wallet من إعدادات موبايلك.',
        ],
        paragraphs: [
          `ابعتلنا على ${CONTACT} من أي إيميل، مع رقم الموبايل اللي اشتركت بيه واسم المحل. ممكن نطلب منك تأكيد الطلب. بنسعى نلتزم بقانون حماية البيانات الشخصية المصري (رقم 151 لسنة 2020).`,
        ],
      },
      {
        heading: 'الأطفال',
        paragraphs: ['كارت النقط لسن 14 سنة أو أكتر. لو سنك أصغر، اسأل حد من والديك قبل ما تشترك.'],
      },
      {
        heading: 'الكوكيز وتخزين المتصفح',
        paragraphs: ['الموقع ده مش بيستخدم كوكيز للإعلانات أو التتبّع. هو بس بيفتكر اللغة اللي اخترتها في المتصفح.'],
      },
      {
        heading: 'الأمان',
        paragraphs: [
          'بياناتك بتتبعت عبر اتصالات مشفّرة وبتتحفظ، ومش بيوصلها غير اللي محتاجها. الـ QR اللي على كارتك شغّال زي المفتاح، فما تشاركش صوره.',
        ],
      },
      {
        heading: 'التغييرات',
        paragraphs: ['لو غيّرنا السياسة دي، هنحدّث التاريخ اللي فوق في الصفحة. التغييرات المهمة هتتعرض على الموقع ده.'],
      },
    ],
  },
};

export const TERMS: Record<'en' | 'ar', LegalDoc> = {
  en: {
    title: 'Terms of use',
    updated: 'Last updated: 7 November 2026',
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
          'A shop can create a dvote account on the merchant dashboard and use every feature free for 14 days. No payment card is needed for the trial.',
          'When the 14 days end, the account is locked until the shop subscribes to a paid plan: the dashboard shows only the subscription message, staff cannot scan cards, and the shop’s page and new sign-ups stop.',
          'A locked account and its data are kept, so the shop can subscribe later and carry on. dvote may delete a locked trial account for good, with all of its data (its branches, team, rewards, images, and its customers’ cards, points and history at that shop), after telling the shop or when the shop asks. Customers’ cards at other shops are not affected.',
          'Plans are paid monthly or yearly and priced by the number of branches the plan covers (see the pricing page on dvote.co). To change plan or add branches, the shop sends a request from its dashboard; it starts once dvote confirms the payment. Moving up costs the price difference for the days left in the paid period. Moving down starts at the end of the paid period: branches, rewards and team members beyond the new plan are closed, archived or switched off then (nothing is deleted), and features it doesn’t include stop.',
          'dvote emails the shop 5 days before its trial or paid period ends, and again on the end date.',
          'The shop is responsible for its own rewards and for what it tells its customers.',
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
    updated: 'آخر تحديث: 7 نوفمبر 2026',
    intro:
      'الشروط دي بتنطبق لما تشترك في كارت نقط محل على dvote، أو تستخدم الكارت في Google Wallet أو Apple Wallet، أو تستخدم الموقع ده. باشتراكك، إنت موافق عليها.',
    sections: [
      {
        heading: 'الخدمة',
        paragraphs: [
          'dvote بتقدّم التقنية بتاعة كروت النقط. كل محل («التاجر») بيدير برنامجه بنفسه: بيحدد عدد النقط اللي بتكسبها، والمكافآت اللي بيقدمها، وكل واحدة بكام نقطة. المنتجات والمكافآت نفسها بيقدمها التاجر مش dvote.',
        ],
      },
      {
        heading: 'الاشتراك وكارتك',
        bullets: [
          'بتشترك باسمك ورقم موبايل مصري. استخدم رقمك واسمك الحقيقي.',
          'كل رقم موبايل هو زبون واحد. لو اشتركت في نفس المحل تاني بنفس الرقم، هيفتح نفس الكارت.',
          'لازم يكون عمرك 14 سنة أو أكتر، أو يكون معاك إذن من حد من والديك.',
          'كارتك ليه QR. أي حد معاه يقدر يجمّع نقط أو يستخدمها على كارتك، فخليه ليك لوحدك. لو شاكك إن حد تاني بيستخدمه، كلّم المحل أو كلّمنا.',
        ],
      },
      {
        heading: 'النقط',
        bullets: [
          'النقط بتتضاف بس لما موظف المحل يعمل سكان لكارتك ويكتب فاتورتك. عدد النقط بيمشي على قاعدة المحل في اللحظة دي.',
          'النقط تخص كارتك في المحل ده. تقدر تستخدمها في أي فرع لنفس المحل، مش في محلات تانية، وما ينفعش تتنقل لحد تاني.',
          'النقط ملهاش قيمة نقدية وما تتبدلش بفلوس.',
          'التاجر يقدر يغيّر قاعدة النقط أو المكافآت. النقط اللي معاك بتفضل على كارتك، والتغييرات بتسري من وقتها.',
          'لو نقط اتضافت بالغلط أو بسبب سوء استخدام، ممكن تتصحح أو تتشال.',
        ],
      },
      {
        heading: 'المكافآت',
        bullets: [
          'إنت اللي بتختار إمتى تستخدم نقطك. اطلب ده من الموظف عند الكاشير، وهو هيعمل سكان لكارتك ويأكد المكافأة.',
          'المكافآت حسب المتاح، وممكن تخلص في فرع لفترة.',
          'النقط اللي بتتستخدم في مكافأة بتتخصم فورًا وما بترجعش، إلا لو المحل صحّح غلطة.',
        ],
      },
      {
        heading: 'الكروت في Wallet والرسايل',
        paragraphs: [
          'إضافة الكارت على Google Wallet أو Apple Wallet اختيارية، وشروطهم بتنطبق كمان. المحل ممكن يبعت رسايل قصيرة لزباينه عن طريق Wallet (زي مكافأة جديدة)، وتقدر توقّف إشعارات Wallet من إعدادات موبايلك.',
        ],
      },
      {
        heading: 'الاستخدام العادل',
        bullets: [
          'ما تنسخش أكواد الكروت ولا تشاركها ولا تزيّفها، وما تحاولش تاخد نقط من غير شراء حقيقي.',
          'ما تحاولش تعطّل الخدمة أو تضغط عليها أو تسيء استخدامها.',
        ],
        paragraphs: ['لو إحنا أو التاجر لاحظنا سوء استخدام، ممكن الكارت يتوقف والنقط تتشال.'],
      },
      {
        heading: 'الإنهاء',
        paragraphs: [
          `تقدر توقف استخدام كارتك في أي وقت وتطلب مسحه على ${CONTACT}، ونقطه بتنتهي معاه. لو محل ساب dvote أو أنهى برنامجه، كروته ونقطه بتنتهي كمان، وهنحاول ننبّه في صفحة الكارت.`,
        ],
      },
      {
        heading: 'مسؤوليتنا',
        paragraphs: [
          'بنشتغل عشان الخدمة تفضل شغّالة ونقطك تفضل صحيحة، بس الخدمة بتتقدم «زي ما هي» وممكن تقف أحيانًا. في الحدود اللي القانون يسمح بيها، dvote مش مسؤولة عن منتجات التاجر أو أسعاره أو خدمته، ولا عن الخسائر غير المباشرة. مفيش حاجة هنا بتقلل من حقوقك في قانون حماية المستهلك المصري.',
        ],
      },
      {
        heading: 'للمحلات: الحسابات والتجربة المجانية',
        bullets: [
          'المحل يقدر يعمل حساب على dvote من داشبورد التاجر ويستخدم كل المميزات مجانًا لمدة 14 يوم، من غير ما يدفع حاجة.',
          'لما الـ 14 يوم يخلصوا، الحساب بيتقفل لحد ما المحل يشترك في باقة مدفوعة: الداشبورد مش بيعرض غير رسالة الاشتراك، والموظفين ما يقدروش يعملوا سكان للكروت، وصفحة المحل والاشتراكات الجديدة بيقفوا.',
          'الحساب المقفول وبياناته بيفضلوا محفوظين، عشان المحل يقدر يشترك بعدين ويكمّل. dvote ممكن تمسح حساب تجربة مقفول نهائيًا بكل بياناته (فروعه وفريقه ومكافآته وصوره، وكروت زباينه ونقطهم وسجلهم في المحل ده) بعد ما تبلّغ المحل أو لما المحل يطلب. كروت الزباين في المحلات التانية مش بتتأثر.',
          'الباقات بتتدفع شهري أو سنوي، وسعرها حسب عدد الفروع اللي الباقة بتغطيها (شوف صفحة الأسعار على dvote.co). عشان المحل يغيّر باقته أو يزوّد فروع، بيبعت طلب من الداشبورد، والتغيير بيبدأ أول ما dvote تأكد الدفع. الترقية بتتكلّف فرق السعر للأيام الباقية من المدة المدفوعة. التخفيض بيبدأ في آخر المدة المدفوعة: الفروع والمكافآت وأعضاء الفريق اللي زيادة عن الباقة الجديدة بيتقفلوا أو يتأرشفوا وقتها (من غير ما حاجة تتمسح)، والمميزات اللي مش فيها بتقف.',
          'dvote بتبعت إيميل للمحل قبل ما التجربة أو المدة المدفوعة تخلص بـ 5 أيام، وتاني يوم ما تخلص.',
          'المحل مسؤول عن مكافآته وعن اللي بيقوله لزباينه.',
        ],
      },
      {
        heading: 'تغيير الشروط دي',
        paragraphs: ['ممكن نحدّث الشروط دي. التاريخ اللي فوق بيوضح أحدث نسخة. لو كمّلت تستخدم كارتك بعد التغيير، الشروط الجديدة بتسري.'],
      },
      {
        heading: 'القانون والتواصل',
        paragraphs: [`الشروط دي خاضعة لقوانين جمهورية مصر العربية. للأسئلة أو الشكاوى: ${CONTACT}.`],
      },
    ],
  },
};
