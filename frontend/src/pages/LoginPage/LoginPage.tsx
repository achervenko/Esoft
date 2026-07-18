import { useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { LoginForm } from './LoginForm';
import { MonsterIllustration } from './MonsterIllustration';
import './AuthPage.css';

type LoginPageProps = {
  onAuthenticated: () => Promise<void>;
};

export function LoginPage({ onAuthenticated }: LoginPageProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [eyeOffset, setEyeOffset] = useState({ x: 0, y: 0 });
  const [yellowMouth, setYellowMouth] = useState({ x: 0, rotate: 0 });
  const [orangeMouthY, setOrangeMouthY] = useState(0);
  const [isBlinking, setIsBlinking] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const blinkTimeoutRef = useRef<number | null>(null);
  const shakeTimeoutRef = useRef<number | null>(null);

  const eyeTransform = showPassword
    ? 'scaleY(0.1)'
    : isBlinking
      ? 'scaleY(0.1)'
      : `translate(${eyeOffset.x}px, ${eyeOffset.y}px)`;

  const blinkEyes = () => {
    if (showPassword) {
      return;
    }

    clearBlinkTimeout();
    setIsBlinking(true);
    blinkTimeoutRef.current = window.setTimeout(() => {
      setIsBlinking(false);
      blinkTimeoutRef.current = null;
    }, 200);
  };

  const clearBlinkTimeout = () => {
    if (blinkTimeoutRef.current !== null) {
      window.clearTimeout(blinkTimeoutRef.current);
      blinkTimeoutRef.current = null;
    }
  };

  const clearShakeTimeout = () => {
    if (shakeTimeoutRef.current !== null) {
      window.clearTimeout(shakeTimeoutRef.current);
      shakeTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearBlinkTimeout();
      clearShakeTimeout();
    };
  }, []);

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

  return (
    <main className="auth-shell" onMouseMove={handleMouseMove}>
      <MonsterIllustration
        eyeTransform={eyeTransform}
        isShaking={isShaking}
        orangeMouthY={orangeMouthY}
        yellowMouth={yellowMouth}
      />

      <LoginForm
        onAuthenticated={onAuthenticated}
        onFocusField={blinkEyes}
        onSuccessfulLogin={() => {
          clearShakeTimeout();
          setIsShaking(true);
          shakeTimeoutRef.current = window.setTimeout(() => {
            setIsShaking(false);
            shakeTimeoutRef.current = null;
          }, 600);
        }}
        onTogglePassword={() => setShowPassword((value) => !value)}
        showPassword={showPassword}
      />
    </main>
  );
}
