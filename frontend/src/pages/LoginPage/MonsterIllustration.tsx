import './MonsterScene.css';

type MonsterIllustrationProps = {
  eyeTransform: string;
  isShaking: boolean;
  orangeMouthY: number;
  yellowMouth: {
    rotate: number;
    x: number;
  };
};

export function MonsterIllustration({
  eyeTransform,
  isShaking,
  orangeMouthY,
  yellowMouth,
}: MonsterIllustrationProps) {
  return (
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
  );
}
