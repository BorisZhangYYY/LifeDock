import { LockKeyholeIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { authServiceClient } from "@/connect";
import { useTranslate } from "@/utils/i18n";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUnlocked: () => void;
}

const PrivacyUnlockDialog = ({ open, onOpenChange, onUnlocked }: Props) => {
  const t = useTranslate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const verificationRef = useRef(0);

  useEffect(() => {
    if (!open) {
      setPassword("");
      setError("");
      setVerifying(false);
    } else {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
    return () => {
      verificationRef.current += 1;
    };
  }, [open]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      verificationRef.current += 1;
      setPassword("");
      setError("");
      setVerifying(false);
    }
    onOpenChange(nextOpen);
  };

  const unlock = async () => {
    if (!password || verifying) return;
    setVerifying(true);
    setError("");
    const verification = ++verificationRef.current;
    try {
      await authServiceClient.verifyPassword({ password });
      if (verification !== verificationRef.current) return;
      onUnlocked();
      handleOpenChange(false);
    } catch {
      if (verification !== verificationRef.current) return;
      setError(t("setting.personal-features.incorrect-password"));
      toast.error(t("setting.personal-features.incorrect-password"), { id: "privacy-unlock-error" });
      setPassword("");
      requestAnimationFrame(() => inputRef.current?.focus());
    } finally {
      if (verification === verificationRef.current) setVerifying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="sm" className="gap-3 rounded-xl p-4 md:max-w-[20rem]">
        <DialogHeader className="gap-1 pe-6 text-left">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <span className="flex size-7 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <LockKeyholeIcon className="size-3.5" />
            </span>
            {t("setting.personal-features.unlock-title")}
          </DialogTitle>
          <DialogDescription className="pl-9 text-xs leading-4">{t("setting.personal-features.unlock-description")}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <Input
            ref={inputRef}
            id="privacy-unlock-password"
            aria-label={t("common.password")}
            type="password"
            autoComplete="current-password"
            className="h-8 min-w-0 flex-1 text-sm"
            placeholder={t("common.password")}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && void unlock()}
            aria-invalid={!!error}
          />
          <Button size="sm" className="h-8 shrink-0" onClick={() => void unlock()} disabled={!password || verifying}>
            {verifying ? t("setting.personal-features.verifying") : t("setting.personal-features.unlock")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PrivacyUnlockDialog;
