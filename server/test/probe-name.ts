const fromCi = process.env.GITHUB_RUN_ID;
const token = fromCi && /^\d+$/.test(fromCi) ? fromCi : `${process.pid}${Date.now()}`;

export function probeName(kind: 'p' | 'd' | 'g', suffix = ''): string {
  const name = `probe_${kind}_${token}${suffix}`;
  if (name.length > 40) {
    throw new Error('Имя пробного аккаунта длиннее 40 символов');
  }
  return name;
}

export function ownProbe(kind: 'p' | 'd' | 'g'): RegExp {
  return new RegExp(`^probe_${kind}_${token}(?:_|$)`);
}
