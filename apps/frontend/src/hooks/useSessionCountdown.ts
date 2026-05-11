import { useEffect, useState } from 'react';

interface SessionCountdown {
  hours: number;
  minutes: number;
  seconds: number;
  /** Pre-formatted "HH:MM:SS" if hours > 0, else "MM:SS". */
  display: string;
  isWarning: boolean;
  expired: boolean;
}

export function useSessionCountdown(exp: number | undefined): SessionCountdown {
  const [remaining, setRemaining] = useState(() => {
    if (exp === undefined) return 0;
    return Math.max(0, exp * 1000 - Date.now());
  });

  useEffect(() => {
    if (exp === undefined) return;
    const tick = () => setRemaining(Math.max(0, exp * 1000 - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [exp]);

  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);

  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  const display = hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;

  return {
    hours,
    minutes,
    seconds,
    display,
    isWarning: remaining > 0 && remaining < 3 * 60_000,
    // expired is only true when exp is known AND time has run out
    expired: exp !== undefined && remaining === 0,
  };
}
