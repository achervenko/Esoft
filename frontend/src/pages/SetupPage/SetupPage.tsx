import type { FormEvent } from "react";
import { SelectDropdown } from "../../shared/ui/SelectDropdown";
import { useSetupPage } from "./useSetupPage";
import "./SetupPage.css";

type SetupPageProps = {
  onCompleted: () => void;
};

export function SetupPage({ onCompleted }: SetupPageProps) {
  const page = useSetupPage({ onCompleted });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void page.submit();
  };

  if (page.isLoadingEmployees) {
    return (
      <main className="setup-shell">
        <section className="setup-panel">Загрузка сотрудников...</section>
      </main>
    );
  }

  return (
    <main className="setup-shell">
      <section className="setup-panel" aria-labelledby="setup-title">
        <div className="setup-heading">
          <h1 id="setup-title">Первоначальная настройка</h1>
          <p>
            В системе ещё нет администратора. Создайте первую учётную запись
            администратора.
          </p>
        </div>

        <form className="setup-form" onSubmit={handleSubmit}>
          <SelectDropdown
            error={page.fieldErrors.employeeId}
            label="Сотрудник"
            onChange={(value) => page.setField("employeeId", value)}
            options={page.employeeOptions}
            placeholder="Выберите сотрудника"
            required
            value={page.form.employeeId}
          />

          <label className="form-field">
            <span>Email</span>
            <input
              autoComplete="email"
              maxLength={255}
              name="email"
              onChange={(event) => page.setField("email", event.target.value)}
              required
              type="email"
              value={page.form.email}
            />
            {page.fieldErrors.email ? (
              <small className="field-error">{page.fieldErrors.email}</small>
            ) : null}
          </label>

          <label className="form-field">
            <span>Логин</span>
            <input
              autoComplete="username"
              maxLength={64}
              minLength={3}
              name="username"
              onChange={(event) =>
                page.setField("username", event.target.value)
              }
              required
              type="text"
              value={page.form.username}
            />
            {page.fieldErrors.username ? (
              <small className="field-error">{page.fieldErrors.username}</small>
            ) : null}
          </label>

          <label className="form-field">
            <span>Пароль</span>
            <input
              autoComplete="new-password"
              maxLength={128}
              minLength={8}
              name="password"
              onChange={(event) =>
                page.setField("password", event.target.value)
              }
              required
              type="password"
              value={page.form.password}
            />
            {page.fieldErrors.password ? (
              <small className="field-error">{page.fieldErrors.password}</small>
            ) : null}
          </label>

          <label className="form-field">
            <span>Повторите пароль</span>
            <input
              autoComplete="new-password"
              maxLength={128}
              minLength={8}
              name="passwordConfirmation"
              onChange={(event) =>
                page.setField("passwordConfirmation", event.target.value)
              }
              required
              type="password"
              value={page.form.passwordConfirmation}
            />
            {page.fieldErrors.passwordConfirmation ? (
              <small className="field-error">
                {page.fieldErrors.passwordConfirmation}
              </small>
            ) : null}
          </label>

          {page.error ? <p className="form-message error">{page.error}</p> : null}
          {page.message ? (
            <p className="form-message success">{page.message}</p>
          ) : null}

          <button
            className="submit-button"
            disabled={page.isSubmitting}
            type="submit"
          >
            {page.isSubmitting ? "Создание..." : "Создать администратора"}
          </button>
        </form>
      </section>
    </main>
  );
}
