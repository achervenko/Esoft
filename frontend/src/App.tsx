import { useMemo, useState } from 'react';
import type { FormEvent, MouseEvent } from 'react';
import { authClient } from './lib/auth-client';
import './App.css';

type LoginMode = 'username' | 'email';

function App() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [eyeOffset, setEyeOffset] = useState({ x: 0, y: 0 });
  const [yellowMouth, setYellowMouth] = useState({ x: 0, rotate: 0 });
  const [orangeMouthY, setOrangeMouthY] = useState(0);
  const [isBlinking, setIsBlinking] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

  const loginMode = useMemo<LoginMode>(
    () => (login.includes('@') ? 'email' : 'username'),
    [login],
  );

  const eyeTransform = showPassword
    ? 'scaleY(0.1)'
    : isBlinking
      ? 'scaleY(0.1)'
      : `translate(${eyeOffset.x}px, ${eyeOffset.y}px)`;

  const blinkEyes = () => {
    if (showPassword) {
      return;
    }

    setIsBlinking(true);
    window.setTimeout(() => setIsBlinking(false), 200);
  };

  const handleMouseMove = (event: MouseEvent<HTMLElement>) => {
    if (!showPassword && !isBlinking) {
      const x = (event.clientX / window.innerWidth - 0.5) * 10;
      const y = (event.clientY / window.innerHeight - 0.5) * 10;
      setEyeOffset({ x, y });
    }

    const distanceFromCenter =
      (event.clientX - window.innerWidth / 2) / (window.innerWidth / 2);

    setYellowMouth({
      x: distanceFromCenter * 30,
      rotate: distanceFromCenter * 10,
    });
    setOrangeMouthY((event.clientY / window.innerHeight - 0.5) * 8);
  };

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
      setIsShaking(true);
      window.setTimeout(() => {
        setIsShaking(false);
        setIsAuthenticated(true);
      }, 600);
    } catch {
      setError('Сервер авторизации недоступен. Проверьте backend.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isAuthenticated) {
    return <main className="empty-page" aria-label="Пустая страница" />;
  }

  return (
    <main className="auth-shell" onMouseMove={handleMouseMove}>
      <section className="auth-visual" aria-label="Esoft">
        <div className={`monster-scene${isShaking ? ' head-shake' : ''}`}>
          <div className="blue-box">
            <span className="blue-eye blue-eye-left">
              <span style={{ transform: eyeTransform }} />
            </span>
            <span className="blue-eye blue-eye-right">
              <span style={{ transform: eyeTransform }} />
            </span>
          </div>

          <div className="black-box">
            <span className="black-eye black-eye-left">
              <span style={{ transform: eyeTransform }} />
            </span>
            <span className="black-eye black-eye-right">
              <span style={{ transform: eyeTransform }} />
            </span>
          </div>

          <div className="yellow-box">
            <span className="yellow-eye" style={{ transform: eyeTransform }} />
            <span
              className="yellow-mouth"
              style={{
                transform: `translateX(${yellowMouth.x}px) rotate(${yellowMouth.rotate}deg)`,
              }}
            />
          </div>

          <div className="orange-box">
            <span className="orange-eye orange-eye-left" style={{ transform: eyeTransform }} />
            <span className="orange-eye orange-eye-right" style={{ transform: eyeTransform }} />
            <span
              className="orange-mouth"
              style={{ transform: `translateY(${orangeMouthY}px)` }}
            />
          </div>
        </div>
      </section>

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
                onFocus={blinkEyes}
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
                  onFocus={blinkEyes}
                  placeholder="Пароль"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                />
                <button
                  aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                  className="password-toggle"
                  onClick={() => setShowPassword((value) => !value)}
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
    </main>
  );
}

export default App;
