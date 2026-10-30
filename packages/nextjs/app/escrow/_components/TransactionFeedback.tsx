import { TransactionRecord } from "../_hooks/useOrderTransaction";
import { explorerUrl } from "../_lib/contracts";

export function TransactionFeedback({
  message,
  error,
  records,
}: {
  message: string;
  error: string;
  records: TransactionRecord[];
}) {
  return (
    <div className="space-y-2 text-sm" aria-live="polite">
      {message && <p className="my-2">{message}</p>}
      {error && (
        <p role="alert" className="text-error break-words">
          {error}
        </p>
      )}
      {records.map(record => (
        <div key={record.hash} className="break-all">
          <span>
            {record.label} · {record.confirmed ? "已确认" : "请核验回执"}：
          </span>
          <a className="link" href={`${explorerUrl}/tx/${record.hash}`} target="_blank" rel="noreferrer">
            {record.hash}
          </a>
        </div>
      ))}
    </div>
  );
}
