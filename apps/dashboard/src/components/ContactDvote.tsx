import { useVendorApi } from '../lib/vendor-workspace';
import {
  CheckIcon as Check,
  CheckCircleIcon as CheckCircle,
  AltArrowRightIcon as ChevronRight,
  CopyIcon as Copy,
  EmojiFunnyCircleIcon as Love,
  LoaderIcon as Loader2,
  LetterIcon as Mail,
  SadCircleIcon as Unhappy,
  SmileCircleIcon as Okay,
} from '@solar-icons/react/linear';
import { useMutation } from '@tanstack/react-query';
import { useState, type ComponentType } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { errorMessage, type MerchantMood } from '../lib/api';
import { t } from '../i18n';

/** Where merchants reach the dvote team. Change here only. */
const DVOTE_EMAIL = 'getdvote@gmail.com';
const DVOTE_WHATSAPP = '201207118966'; // +20 120 711 8966, digits only for wa.me; not shown in the dialog

/** WhatsApp brand mark; Solar provides interface icons rather than brand logos. */
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.05 21.79h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88 2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.43 9.88-9.88 9.88m8.41-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.9c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.9 0-3.18-1.24-6.17-3.48-8.41" />
    </svg>
  );
}

/** Copies the dvote email, for people who write from another mail app. */
function CopyEmail() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(DVOTE_EMAIL);
      setCopied(true);
      toast.success(t('contact.copied'));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t('contact.copyFailed'));
    }
  };
  return (
    <Button variant="outline" size="sm" onClick={() => void copy()} aria-label={t('contact.copy')}>
      {copied ? <Check /> : <Copy />}
      {copied ? t('contact.copiedShort') : t('contact.copy')}
    </Button>
  );
}

/**
 * The "Get help" dialog (opened from the account menu): a dialog with two ways to reach the team,
 * email or WhatsApp, each opening with a ready message (who is writing, from which shop) in the
 * dashboard language.
 */
export function ContactDvote({
  name,
  shop,
  open,
  onOpenChange,
}: {
  name: string;
  shop: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const message = t('contact.template', { name, shop });
  const whatsapp = `https://wa.me/${DVOTE_WHATSAPP}?text=${encodeURIComponent(message)}`;
  const email = `mailto:${DVOTE_EMAIL}?subject=${encodeURIComponent(t('contact.subject', { shop }))}&body=${encodeURIComponent(message)}`;
  const option =
    'flex items-center gap-3 rounded-xl border bg-card p-4 text-start transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('contact.title')}</DialogTitle>
          <DialogDescription>{t('contact.hint')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <a href={whatsapp} target="_blank" rel="noreferrer" className={option}>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <WhatsAppIcon className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{t('contact.whatsapp')}</span>
              <span className="block text-xs text-muted-foreground">{t('contact.whatsappHint')}</span>
            </span>
            <ChevronRight className="size-4 text-muted-foreground rtl:rotate-180" />
          </a>
          <div className="flex items-center gap-2 rounded-xl border bg-card p-1.5 pe-2">
            <a href={email} className={cn(option, 'min-w-0 flex-1 border-0 p-2.5')}>
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Mail className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{t('contact.email')}</span>
                <span dir="ltr" className="block truncate text-xs text-muted-foreground">
                  {DVOTE_EMAIL}
                </span>
              </span>
            </a>
            <CopyEmail />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{t('contact.templateNote')}</p>
        <Separator />
        <QuickFeedback key={String(open)} />
      </DialogContent>
    </Dialog>
  );
}

const MOODS: {
  key: MerchantMood;
  icon: ComponentType<{ className?: string }>;
}[] = [
  { key: 'love', icon: Love },
  { key: 'okay', icon: Okay },
  { key: 'unhappy', icon: Unhappy },
];

/** For people who don't want a conversation: a mood and a few words, sent straight to the team. */
function QuickFeedback() {
  const vendorApi = useVendorApi();
  const [mood, setMood] = useState<MerchantMood | undefined>();
  const [message, setMessage] = useState('');
  const send = useMutation({
    mutationFn: () => vendorApi.feedback({ mood, message: message.trim() }),
    onError: (e) => void toast.error(errorMessage(e)),
  });

  if (send.isSuccess) {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-muted/60 p-4" role="status">
        <CheckCircle className="size-5 shrink-0 text-primary" />
        <div>
          <p className="text-sm font-medium">{t('contact.feedbackThanks')}</p>
          <p className="text-xs text-muted-foreground">{t('contact.feedbackThanksText')}</p>
        </div>
      </div>
    );
  }
  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (message.trim()) send.mutate();
      }}
    >
      <div>
        <h3 className="text-sm font-medium">{t('contact.feedbackTitle')}</h3>
        <p className="text-xs text-muted-foreground">{t('contact.feedbackHint')}</p>
      </div>
      <div className="flex gap-2" role="radiogroup" aria-label={t('contact.feedbackMood')}>
        {MOODS.map(({ key, icon: Icon }) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={mood === key}
            onClick={() => setMood(mood === key ? undefined : key)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs outline-none transition duration-100 ease-linear focus-visible:ring-3 focus-visible:ring-ring/50',
              mood === key ? 'border-primary bg-brand-soft font-medium' : 'hover:bg-muted',
            )}
          >
            <Icon className="size-4" /> {t(`contact.moods.${key}`)}
          </button>
        ))}
      </div>
      <Textarea
        rows={3}
        maxLength={2000}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={t('contact.feedbackPlaceholder')}
        aria-label={t('contact.feedbackTitle')}
      />
      <Button type="submit" variant="outline" disabled={!message.trim() || send.isPending}>
        {send.isPending ? <Loader2 className="animate-spin" /> : null}
        {t('contact.feedbackSend')}
      </Button>
    </form>
  );
}
