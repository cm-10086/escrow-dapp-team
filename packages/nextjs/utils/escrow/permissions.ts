export type EscrowPermissions = {
  role: "买家" | "卖家" | "仲裁人" | "旁观者" | "未连接";
  canConfirm: boolean;
  canDispute: boolean;
  canResolve: boolean;
};

export type EscrowPermissionInput = {
  account?: string;
  buyer: string;
  seller: string;
  arbiter?: string;
  status: number | bigint;
};

export const getEscrowPermissions = ({
  account,
  buyer,
  seller,
  arbiter,
  status,
}: EscrowPermissionInput): EscrowPermissions => {
  if (!account) {
    return { role: "未连接", canConfirm: false, canDispute: false, canResolve: false };
  }

  const current = account.toLowerCase();
  const isBuyer = current === buyer.toLowerCase();
  const isSeller = current === seller.toLowerCase();
  const isArbiter = Boolean(arbiter && current === arbiter.toLowerCase());
  const isPaid = Number(status) === 1 || Number(status) === 5;
  const isDisputed = Number(status) === 4;

  return {
    role: isArbiter ? "仲裁人" : isBuyer ? "买家" : isSeller ? "卖家" : "旁观者",
    canConfirm: isPaid && isBuyer,
    canDispute: isPaid && (isBuyer || isSeller),
    canResolve: isDisputed && isArbiter,
  };
};
