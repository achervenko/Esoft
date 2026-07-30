import { Checkbox } from '@chakra-ui/react';
import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { authClient } from '../../lib/auth-client';
import './LoginForm.css';

type LoginMode = 'username' | 'email';

type LoginFormProps = {
  onAuthenticated: () => Promise<void>;
  onFocusField: () => void;
  onSuccessfulLogin: () => void;
  onTogglePassword: () => void;
  showPassword: boolean;
};

export function LoginForm({
  onAuthenticated,
  onFocusField,
  onSuccessfulLogin,
  onTogglePassword,
  showPassword,
}: LoginFormProps) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loginMode = useMemo<LoginMode>(
    () => (login.includes('@') ? 'email' : 'username'),
    [login],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const cleanLogin = login.trim();

    if (!cleanLogin || !password) {
      setError('Заполните логин и пароль.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response =
        loginMode === 'email'
          ? await authClient.signIn.email({
              email: cleanLogin,
              password,
              rememberMe: remember,
            })
          : await authClient.signIn.username({
              username: cleanLogin,
              password,
              rememberMe: remember,
            });

      if (response.error) {
        setError(response.error.message ?? 'Не удалось войти.');
        return;
      }

      onSuccessfulLogin();
      await onAuthenticated();
    } catch {
      setError('Сервер авторизации недоступен. Проверьте backend.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="auth-panel" aria-labelledby="login-title">
      <div className="auth-card">
        <div className="auth-heading">
          <h2 id="login-title">Вход в систему</h2>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label aria-label="Логин">
            <input
              autoComplete="username"
              name="login"
              onChange={(event) => setLogin(event.target.value)}
              onFocus={onFocusField}
              placeholder="Логин"
              type="text"
              value={login}
            />
          </label>

          <label aria-label="Пароль">
            <div className="password-field">
              <input
                autoComplete="current-password"
                name="password"
                onChange={(event) => setPassword(event.target.value)}
                onFocus={onFocusField}
                placeholder="Пароль"
                type={showPassword ? 'text' : 'password'}
                value={password}
              />
              <button
                aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                className="password-toggle"
                onClick={onTogglePassword}
                type="button"
              >
                {showPassword ? 'Скрыть' : 'Показать'}
              </button>
            </div>
          </label>

          <Checkbox.Root
            checked={remember}
            className="login-remember-checkbox"
            onCheckedChange={(details) =>
              setRemember(details.checked === true)
            }
          >
            <Checkbox.HiddenInput />
            <Checkbox.Control />
            <Checkbox.Label>Запомнить вход</Checkbox.Label>
          </Checkbox.Root>

          {error && <p className="form-message error">{error}</p>}

          <button className="submit-button" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Выполняется вход...' : 'Войти'}
          </button>
        </form>
      </div>
    </section>
  );
}
