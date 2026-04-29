export const STARS = Array.from({ length: 200 }, (_, i) => ({
  x: (i * 137.508 + 50) % 1440,
  y: (i * 97.31 + 30) % 900,
  r: i % 9 === 0 ? 1.5 : i % 4 === 0 ? 1.0 : 0.55,
  delay: (i * 0.37) % 5,
  dur: 2.5 + (i % 4) * 0.9,
}));
