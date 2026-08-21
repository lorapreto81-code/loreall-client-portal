
export function calculateTieredPrice(credits: number, basePrice: number): number {
  // Se o preço base não for o padrão (11.00), mantemos o preço customizado
  if (Number(basePrice) !== 11.00) return Number(basePrice);

  if (credits >= 1000) return 5.50;
  if (credits >= 500) return 6.00;
  if (credits >= 100) return 7.00;
  if (credits >= 50) return 8.00;
  if (credits >= 30) return 10.00;
  return 11.00;
}
