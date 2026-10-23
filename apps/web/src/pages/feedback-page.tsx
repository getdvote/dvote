import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";
import {
  Button,
  ErrorNote,
  Field,
  Input,
  Page,
  Spinner,
  cx,
} from "../components/ui";
import { getLanguage, t } from "../i18n";
import { api, errorMessage } from "../lib/api";
import { useTagParams, useVendor } from "./VenuePage";

export function FeedbackPage() {
  const { slug } = useParams();
  const params = useTagParams();
  const { vendor, error } = useVendor(slug, params.get("b"));
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!slug || busy) return;
    setBusy(true);
    setSubmitError(null);
    try {
      await api.submitFeedback(slug, {
        name: name.trim(),
        phone: phone.trim() || undefined,
        message: message.trim(),
        branchId: params.get("b") ?? undefined,
      });
      setSent(true);
    } catch (e) {
      setSubmitError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const back = `/${slug}${params.size ? `?${params}` : ""}`;
  return (
    <Page>
      {error ? (
        <ErrorNote>{error}</ErrorNote>
      ) : !vendor ? (
        <Spinner />
      ) : (
        <>
          <h1 className="text-center text-2xl font-bold">
            {t("feedback.title")}
          </h1>
          <p className="mt-2 text-center text-muted">{vendor.name}</p>
          {!vendor.sections.some((s) => s.type === "feedback") ? (
            <ErrorNote>{t("feedback.unavailable")}</ErrorNote>
          ) : sent ? (
            <div
              role="status"
              className="my-6 rounded-2xl bg-canvas p-5 text-center"
            >
              {t("feedback.thanks")}
            </div>
          ) : (
            <form onSubmit={submit} className="mt-6 grid gap-5">
              <p className="text-sm text-muted">{t("feedback.hint")}</p>
              <Field label={t("feedback.name")}>
                <Input
                  required
                  maxLength={120}
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              <Field
                label={t("feedback.phone")}
                optional
              >
                <Input
                  type="tel"
                  dir="ltr"
                  maxLength={30}
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </Field>
              <Field label={t("feedback.comment")}>
                <textarea
                  placeholder={
                    vendor.sections.find((s) => s.type === "feedback")
                      ?.placeholder?.[getLanguage()] ??
                    t("feedback.placeholder")
                  }
                  required
                  maxLength={2000}
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full resize-none overflow-y-auto rounded-2xl border border-line bg-canvas p-4 outline-none focus:border-brand"
                />
                <span
                  dir="ltr"
                  aria-live="polite"
                  className={cx('mt-1 block text-end text-[13px] tabular-nums', message.length >= 1800 ? 'text-danger' : 'text-muted')}
                >
                  {message.length} / 2000
                </span>
              </Field>
              <ErrorNote>{submitError}</ErrorNote>
              <Button
                type="submit"
                busy={busy}
                disabled={!name.trim() || !message.trim()}
              >
                {t("feedback.send")}
              </Button>
            </form>
          )}
          <Link
            to={back}
            className="mt-6 block text-center text-brand-text underline"
          >
            {t("feedback.back")}
          </Link>
        </>
      )}
    </Page>
  );
}
