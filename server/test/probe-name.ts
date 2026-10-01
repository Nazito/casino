const fromCi = process.env.GITHUB_RUN_ID;
const token = fromCi && /^\d+$/.test(fromCi) ? fromCi : `${process.pid}${Date.now()}`;

export function probeName(kind: 'p' | 'd' | 'g' | 'a', suffix = ''): string {
  const name = kind === 'a' ? `probe_a_${token.slice(-14)}${suffix}` : `probe_${kind}_${token}${suffix}`;
  const limit = kind === 'a' ? 24 : 40;
  if (name.length > limit) {
    throw new Error('Имя пробного аккаунта длиннее допустимого');
  }
  return name;
}

export function ownProbe(kind: 'p' | 'd' | 'g' | 'a'): RegExp {
  if (kind === 'a') {
    return new RegExp(`^probe_a_${token.slice(-14)}`);
  }
  return new RegExp(`^probe_${kind}_${token}(?:_|$)`);
}
