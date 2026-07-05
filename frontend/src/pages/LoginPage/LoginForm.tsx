import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { authClient } from '../../lib/auth-client';

type LoginMode = 'username' | 'email';

type LoginFormProps = {
  onAuthenticated: () => void;
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
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loginMode = useMemo<LoginMode>(
    () => (login.includes('@') ? 'email' : 'username'),
    [login],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
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

      setMessage('Вход выполнен.');
      onSuccessfulLogin();
      window.setTimeout(onAuthenticated, 600);
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

          <button
            aria-checked={remember}
            className="remember-pin"
            onClick={() => setRemember((value) => !value)}
            role="radio"
            type="button"
          >
            <span
              aria-hidden="true"
              className="remember-pin-indicator"
              data-checked={remember ? '' : undefined}
            >
              <span />
            </span>
            <span>Запомнить пароль</span>
          </button>

          {error && <p className="form-message error">{error}</p>}
          {message && <p className="form-message success">{message}</p>}

          <button className="submit-button" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Выполняется вход...' : 'Войти'}
          </button>
        </form>
      </div>
    </section>
  );
}
