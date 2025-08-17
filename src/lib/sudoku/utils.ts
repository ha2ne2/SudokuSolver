export const range = (n: number) => Array.from({ length: n }, (_, i) => i);
export const deepCopy = <T,>(o: T): T => JSON.parse(JSON.stringify(o));
export const rnd = (n: number) => Math.floor(Math.random() * n);
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function difference(a: number[], bSet: Set<number>): number[] {
  return a.filter((x) => !bSet.has(x));
}
export function intersection(...arrays: number[][]): number[] {
  return arrays.reduce((acc, curr) => {
    const s = new Set(curr);
    return acc.filter((x) => s.has(x));
  });
}
export function isEmpty<T>(arr: T[] | undefined | null): boolean {
  return !Array.isArray(arr) ? !arr : arr.length === 0;
}