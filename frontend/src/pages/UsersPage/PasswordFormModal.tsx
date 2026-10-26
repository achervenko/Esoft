import { TextField } from "../../shared/ui/TextField";
import { useState } from "react";
import {
  isValidPassword,
  MAX_PASSWORD_LENGTH,
  PASSWORD_POLICY_MESSAGE,
} from "../../shared/lib/password-validation";
import type { AdminUserAccount } from "../../shared/api/users-admin-api";
import { GuardedAdminModal } from "../../shared/ui/GuardedAdminModal";

type PasswordFormModalProps = {
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (password: string) => void;
  user: AdminUserAccount;
};

export function PasswordFormModal({
  isSaving,
  onClose,
  onSubmit,
  user,
}: PasswordFormModalProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSaving) {
      return;
    }

    if (!isValidPassword(password, user)) {
      setError(PASSWORD_POLICY_MESSAGE);
      return;
    }

    setError(null);
    onSubmit(password);
  };

  return (
    <GuardedAdminModal
      hasChanges={password !== ""}
      isCloseDisabled={isSaving}
      onClose={onClose}
      title="Смена пароля"
    >
      {(requestLeave) => (
        <form className="admin-form" onSubmit={handleSubmit}>
          <p className="admin-form-hint">
            Новый пароль будет установлен для учётной записи{" "}
            {user.username || user.email}.
          </p>
          <TextField
            label="Новый пароль"
            required
            error={error ?? undefined}
            disabled={isSaving}
            autoFocus
            minLength={8}
            maxLength={MAX_PASSWORD_LENGTH}
            onChange={(value) => setPassword(value)}
            type="password"
            value={password}
          />

          <div className="admin-form-actions">
            <button
              className="admin-secondary-button"
              disabled={isSaving}
              onClick={() => requestLeave(onClose)}
              type="button"
            >
              Отмена
            </button>
            <button
              className="admin-primary-button"
              disabled={isSaving}
              type="submit"
            >
              {isSaving ? "Сохранение..." : "Сменить пароль"}
            </button>
          </div>
        </form>
      )}
    </GuardedAdminModal>
  );
}
