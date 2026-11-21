import { AdminTextField as TextField } from "../../shared/ui/AdminFormControls";
import { SelectField } from "../../shared/ui/SelectField";
import type { useReceiptSourceForm } from "./useReceiptSourceForm";

type Props = ReturnType<typeof useReceiptSourceForm>["credentials"] & {
  editing: boolean;
};

export function ReceiptSourceCredentials({
  editing,
  authMode,
  changeAuthMode,
  basic,
  hasBasicInput,
  login,
  setLogin,
  password,
  setPassword,
  authorization,
  setAuthorization,
  headerTooLong,
}: Props) {
  return (
    <>
      <SelectField
        label="Способ входа в 1С"
        value={authMode}
        onChange={changeAuthMode}
        options={[
          { value: "basic", label: "Логин и пароль (Basic)" },
          { value: "header", label: "Заголовок Authorization" },
        ]}
      />
      {basic ? (
        <>
          <TextField
            label="Логин 1С"
            value={login}
            onChange={setLogin}
            required={!editing || hasBasicInput}
            autoComplete="off"
            maxLength={1500}
            error={
              login.includes(":")
                ? "Логин не может содержать двоеточие."
                : undefined
            }
          />
          <TextField
            label="Пароль 1С"
            type="password"
            value={password}
            onChange={setPassword}
            required={!editing || hasBasicInput}
            autoComplete="new-password"
            maxLength={1500}
            error={
              headerTooLong ? "Логин и пароль слишком длинные." : undefined
            }
          />
        </>
      ) : (
        <TextField
          label="Authorization для доступа ESoft к 1С"
          required={!editing}
          type="password"
          value={authorization}
          onChange={setAuthorization}
          autoComplete="new-password"
          maxLength={2000}
        />
      )}
    </>
  );
}
