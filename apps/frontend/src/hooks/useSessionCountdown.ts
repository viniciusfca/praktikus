import { useEffect, useState } from 'react';

interface SessionCountdown {
  minutes: number;
  seconds: number;
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

  const minutes = Math.floor(remaining / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);

  return {
    minutes,
    seconds,
    isWarning: remaining > 0 && remaining < 3 * 60_000,
    // expired is only true when exp is known AND time has run out
    expired: exp !== undefined && remaining === 0,
  };
}
