import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { api, useStore, type InstanceInfo } from "@/state/store";
import { t } from "@/lib/i18n";
import { ConfirmDialog } from "./ConfirmDialog";

export function AddAntigravityAccount() {
  const [open, setOpen] = useState(false);
  return open ? (
    <div className="rounded-xl border border-hairline/40 p-3">
      <AntigravityAccountForm onSaved={() => setOpen(false)} onCancel={() => setOpen(false)} />
    </div>
  ) : (
    <button type="button" onClick={() => setOpen(true)} className="flex w-fit items-center gap-1.5 rounded-lg border border-hairline/40 px-3 py-1.5 text-[12px] text-ink-secondary hover:bg-raised/50 hover:text-ink">
      <Plus size={13} />{t("engines.antigravity.add")}
    </button>
  );
}

function AntigravityAccountForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const { refreshInstances } = useStore();
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (saving || !displayName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await api("/api/instances/antigravity-accounts", {
        method: "POST",
        body: JSON.stringify({ displayName: displayName.trim() }),
      });
      await refreshInstances().catch(() => {});
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={(event) => { event.preventDefault(); void save(); }} className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-[12px] text-ink-secondary">
        {t("engines.account.name")}
        <input
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder={t("engines.account.namePlaceholder")}
          maxLength={80}
          disabled={saving}
          className="w-full rounded-lg border border-hairline/40 bg-inset px-3 py-2 text-[12px] text-ink focus:border-hairline focus:outline-none disabled:opacity-50"
        />
      </label>
      <p className="text-[12px] leading-relaxed text-ink-secondary">{t("engines.antigravity.addHint")}</p>
      {error && <p role="alert" className="text-[12px] text-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} disabled={saving} className="rounded-lg px-3 py-1.5 text-[12px] text-ink-secondary hover:bg-raised/50 disabled:opacity-50">{t("common.cancel")}</button>
        <button type="submit" disabled={saving || !displayName.trim()} className="flex items-center gap-1.5 rounded-lg bg-raised px-3 py-1.5 text-[12px] text-ink hover:bg-raised-hover disabled:opacity-50">
          {saving && <Loader2 size={13} className="animate-spin" />}
          {t("engines.antigravity.add")}
        </button>
      </div>
    </form>
  );
}

export function AntigravityAccountNote({ instance }: { instance: InstanceInfo }) {
  const { refreshInstances } = useStore();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const account = instance.antigravityAccount;
  if (!account) return null;

  const remove = async () => {
    setConfirmRemove(false);
    if (busy || account.isDefault) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/instances/${encodeURIComponent(instance.instanceId)}`, { method: "DELETE" });
      await refreshInstances().catch(() => {});
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2 space-y-2 text-[12px]">
      <p className="leading-relaxed text-ink-secondary">{t(account.isDefault ? "engines.antigravity.poolBody" : "engines.antigravity.extraBody")}</p>
      {!account.isDefault && (
        <button type="button" onClick={() => setConfirmRemove(true)} disabled={busy} className="text-danger hover:underline disabled:no-underline disabled:opacity-50">
          {t("engines.antigravity.remove")}
        </button>
      )}
      {error && <p role="alert" className="text-danger">{error}</p>}
      <ConfirmDialog
        open={confirmRemove}
        title={t("engines.antigravity.removeTitle", { name: instance.displayName })}
        body={t("engines.antigravity.removeHint")}
        confirmLabel={t("engines.antigravity.remove")}
        tone="neutral"
        onCancel={() => setConfirmRemove(false)}
        onConfirm={() => void remove()}
      />
    </div>
  );
}
