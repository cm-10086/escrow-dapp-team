import { EscrowOrderParticipants, getEscrowAccountRoles } from "~~/utils/escrow/accountRoles";

export function EscrowAccountRoles({
  account,
  arbiter,
  arbiters,
  orders,
  dataState,
}: {
  account?: string;
  arbiter?: string;
  arbiters?: readonly string[];
  orders: readonly EscrowOrderParticipants[];
  dataState: "loading" | "ready" | "error";
}) {
  const roles = getEscrowAccountRoles({ account, arbiter, arbiters, orders });
  const fallback = !account
    ? "未连接"
    : dataState === "error"
      ? "读取失败"
      : dataState === "loading"
        ? "读取中…"
        : "旁观者";

  return (
    <section className="mt-3 space-y-2" aria-label="当前账户角色" aria-live="polite" aria-atomic="true">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm">当前角色：</span>
        {roles.length > 0 ? (
          roles.map(role => (
            <span key={role} className="badge badge-primary badge-outline">
              {role}
            </span>
          ))
        ) : (
          <span className="badge badge-outline">{fallback}</span>
        )}
      </div>
      {account && dataState === "loading" && <p className="my-0 text-xs opacity-70">正在读取订单，角色信息待补全。</p>}
      {account && dataState === "error" && (
        <p className="my-0 text-xs text-error">角色信息读取失败，请刷新订单重试。</p>
      )}
    </section>
  );
}
