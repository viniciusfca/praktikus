import { evaluatePassword, type PasswordCriterion, type PasswordStrength } from '@praktikus/shared';

interface PasswordStrengthMeterProps {
  password: string;
}

const STRENGTH_LABEL: Record<PasswordStrength, string> = {
  weak: 'Fraca',
  medium: 'Média',
  strong: 'Forte',
};

const STRENGTH_COLOR: Record<PasswordStrength, string> = {
  weak: 'var(--cui-danger, #e55353)',
  medium: 'var(--cui-warning, #f9b115)',
  strong: 'var(--cui-success, #2eb85c)',
};

const STRENGTH_FILL: Record<PasswordStrength, number> = {
  weak: 33,
  medium: 66,
  strong: 100,
};

const CRITERIA_LABEL: Record<PasswordCriterion, string> = {
  minLength: 'Pelo menos 8 caracteres',
  lowercase: 'Letra minúscula',
  uppercase: 'Letra maiúscula',
  number: 'Número',
  specialChar: 'Caractere especial (ex: !@#$%)',
};

const CRITERIA_ORDER: PasswordCriterion[] = [
  'minLength',
  'lowercase',
  'uppercase',
  'number',
  'specialChar',
];

export function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  if (!password) return null;

  const evaluation = evaluatePassword(password);
  const color = STRENGTH_COLOR[evaluation.strength];
  const fill = STRENGTH_FILL[evaluation.strength];

  return (
    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div
          role="progressbar"
          aria-valuenow={fill}
          aria-valuemin={0}
          aria-valuemax={100}
          style={{
            flex: 1,
            height: 6,
            background: 'var(--cui-tertiary-bg, #e9ecef)',
            borderRadius: 3,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${fill}%`,
              height: '100%',
              background: color,
              transition: 'width 150ms ease, background 150ms ease',
            }}
          />
        </div>
        <span style={{ fontSize: 12, fontWeight: 500, color, minWidth: 48 }}>
          {STRENGTH_LABEL[evaluation.strength]}
        </span>
      </div>
      {!evaluation.isValid && (
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            fontSize: 12,
            transition: 'opacity 150ms ease',
          }}
        >
          {CRITERIA_ORDER.map((c) => {
            const met = evaluation.criteria[c];
            return (
              <li
                key={c}
                style={{
                  color: met ? 'var(--cui-success, #2eb85c)' : 'var(--cui-secondary-color, #768192)',
                  display: 'flex',
                  gap: 6,
                  alignItems: 'center',
                }}
              >
                <span aria-hidden style={{ width: 12, display: 'inline-block' }}>
                  {met ? '✓' : '○'}
                </span>
                {CRITERIA_LABEL[c]}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
