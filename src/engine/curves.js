// IEC IDMT curve constants and trip-time formula
export const CURVES = {
  EI:  { k: 80,    a: 2    },
  VI:  { k: 13.5,  a: 1    },
  SI:  { k: 0.14,  a: 0.02 },
  LTI: { k: 120,   a: 1    },
};

/**
 * IEC IDMT trip time.
 * @param {number} I   fault current (A)
 * @param {number} Ip  pickup current (A)
 * @param {number} TMS time-multiplier setting
 * @param {string} type curve key (EI | VI | SI | LTI)
 * @returns {number|null} trip time in seconds, or null if outside range
 */
export function iecT(I, Ip, TMS, type) {
  const m = I / Ip;
  if (m <= 1.001) return null;
  const { k, a } = CURVES[type];
  const t = TMS * k / (Math.pow(m, a) - 1);
  return (t >= 0.005 && t <= 9999) ? t : null;
}
