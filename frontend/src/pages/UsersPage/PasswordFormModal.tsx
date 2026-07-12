import { useState } from "react";
import type { AdminUserAccount } from "../../shared/api/users-admin-api";
import { AdminModal } from "./AdminModal";

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

    if (password.length < 8) {
      setError("Пароль должен быть не короче 8 символов.");
      return;
    }

    setError(null);
    onSubmit(password);
  };

  return (
    <AdminModal onClose={onClose} title="Смена пароля">
      <form className="users-form" onSubmit={handleSubmit}>
        <p className="users-form-hint">
          Новый пароль будет установлен для учётной записи {user.username || user.email}.
        </p>
        <label className="form-field">
          <span>Новый пароль *</span>
          <input
            autoFocus
            minLength={8}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            value={password}
          />
        </label>

        {error ? <p className="users-form-error">{error}</p> : null}

        <div className="users-form-actions">
          <button className="users-secondary-button" onClick={onClose} type="button">
            Отмена
          </button>
          <button className="users-primary-button" disabled={isSaving} type="submit">
            {isSaving ? "Сохранение..." : "Сменить пароль"}
          </button>
        </div>
      </form>
    </AdminModal>
  );
}
