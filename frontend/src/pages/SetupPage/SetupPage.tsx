import { AdminTextField } from "../../shared/ui/AdminFormControls";
import { FormField } from "../../shared/ui/FormField";
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

          {page.form.employeeId === "new" && (
            <fieldset
              className="setup-employee-fields"
              disabled={page.isSubmitting}
            >
              <legend>Новый сотрудник</legend>
              {(
                [
                  ["lastName", "Фамилия"],
                  ["firstName", "Имя"],
                  ["middleName", "Отчество"],
                ] as const
              ).map(([field, label]) => (
                  <AdminTextField
                    key={field}
                    error={page.fieldErrors[field]}
                    label={label}
                    maxLength={64}
                    required={field !== "middleName"}
                    value={page.form[field]}
                    onChange={(value) => page.setField(field, value)}
                  />
              ))}
            </fieldset>
          )}

          <FormField label="Email" error={page.fieldErrors.email}>
            <input
              autoComplete="email"
              maxLength={255}
              name="email"
              onChange={(event) => page.setField("email", event.target.value)}
              required
              type="email"
              value={page.form.email}
            />
          </FormField>

          <FormField label="Логин" error={page.fieldErrors.username}>
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
          </FormField>

          <FormField label="Пароль" error={page.fieldErrors.password}>
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
          </FormField>

          <FormField label="Повторите пароль" error={page.fieldErrors.passwordConfirmation}>
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
          </FormField>

          {page.error ? (
            <p className="form-message error">{page.error}</p>
          ) : null}
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
