export type EscrowAccountRole = "仲裁人" | "买家" | "卖家";

export type EscrowOrderParticipants = {
  buyer?: string;
  seller?: string;
};

/** Summarize all identities; order-specific permissions still depend on its status. */
export function getEscrowAccountRoles({
  account,
  arbiter,
  orders,
}: {
  account?: string;
  arbiter?: string;
  orders: readonly EscrowOrderParticipants[];
}): EscrowAccountRole[] {
  if (!account) return [];
  const current = account.toLowerCase();
  const roles: EscrowAccountRole[] = [];

  if (arbiter?.toLowerCase() === current) roles.push("仲裁人");
  if (orders.some(order => order.buyer?.toLowerCase() === current)) roles.push("买家");
  if (orders.some(order => order.seller?.toLowerCase() === current)) roles.push("卖家");

  return roles;
}
