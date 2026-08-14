export function calculateSplit(rentTotal: number, slotCount: number): number {
  if (slotCount <= 0) return 0;
  return Math.ceil(rentTotal / slotCount);
}
