import { useEffect, useRef, useState } from "react";
import type { BroadcastCampaignInput } from "../../lib/api";

type Backup = { input: BroadcastCampaignInput; editing?: string };
/** Serialize saves, keep a browser recovery copy, and flush when leaving the page. */
export function useCampaignAutosave(
  storageKey: string,
  active: boolean,
  backup: Backup | null,
  save: (input: BroadcastCampaignInput, id?: string) => Promise<{ id: string }>,
  onSaved: () => void,
) {
  const latest = useRef<Backup | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const saved = useRef("");
  const paused = useRef(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const owner = useRef({ key: storageKey, save });
  const backupKey = (value: Backup, prefix: string) =>
    `${prefix}:${value.input.clientDraftId}`;
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;
  const flush = () => {
    const value = latest.current;
    if (!value) return Promise.resolve(undefined);
    const signature = JSON.stringify(value);
    const { key: prefix, save: persist } = owner.current;
    const key = backupKey(value, prefix);
    const run = queue.current
      .catch(() => {})
      .then(async () => {
        if (saved.current === signature)
          return { id: value.editing ?? value.input.clientDraftId! };
        setStatus("saving");
        try {
          const result = await persist(value.input, value.editing);
          saved.current = signature;
          try {
            if (localStorage.getItem(key) === signature)
              localStorage.removeItem(key);
          } catch {
            /* storage can be unavailable */
          }
          setStatus(
            JSON.stringify(latest.current) === signature ? "saved" : "saving",
          );
          onSavedRef.current();
          return result;
        } catch (error) {
          setStatus("error");
          throw error;
        }
      });
    queue.current = run;
    return run;
  };
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => {
    owner.current = { key: storageKey, save };
    latest.current = null;
    saved.current = "";
    try {
      for (const key of Object.keys(localStorage).filter((key) =>
        key.startsWith(`${storageKey}:`),
      )) {
        const recovery = JSON.parse(localStorage.getItem(key)!) as Backup;
        if (recovery.input?.mode === "draft" && recovery.input.clientDraftId) {
          latest.current = recovery;
          void flushRef.current().catch(() => {});
        }
      }
    } catch {
      /* ignore an invalid or unavailable recovery copy */
    }
    const retry = () => {
      if (!paused.current) void flushRef.current().catch(() => {});
    };
    window.addEventListener("online", retry);
    window.addEventListener("pagehide", retry);
    return () => {
      window.removeEventListener("online", retry);
      window.removeEventListener("pagehide", retry);
      if (!paused.current) void flushRef.current().catch(() => {});
    };
  }, [storageKey]);
  const signature = JSON.stringify(backup);
  useEffect(() => {
    if (!active || !backup) return;
    paused.current = false;
    latest.current = backup;
    try {
      localStorage.setItem(backupKey(backup, storageKey), signature);
    } catch {
      /* server save still works */
    }
    if (saved.current !== signature) setStatus("saving");
    const timer = window.setTimeout(() => {
      if (!paused.current) void flushRef.current().catch(() => {});
    }, 600);
    return () => window.clearTimeout(timer);
  }, [active, signature, storageKey]);
  return {
    status,
    flush,
    pause: () => {
      paused.current = true;
    },
    resume: () => {
      paused.current = false;
    },
    reset: () => {
      paused.current = true;
      latest.current = null;
      saved.current = "";
      setStatus("idle");
    },
    clear: () => {
      paused.current = true;
      const value = latest.current;
      latest.current = null;
      saved.current = "";
      try {
        if (value) localStorage.removeItem(backupKey(value, storageKey));
      } catch {
        /* unavailable */
      }
    },
  };
}
