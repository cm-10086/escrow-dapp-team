type DisputeOrder = { buyer: string; seller: string; status: number | bigint };
type ArbitrationPort = {
  assertWallet: () => void;
  supportsDualArbitration: () => Promise<boolean>;
  readOrder: () => Promise<DisputeOrder>;
};

export function getArbitrationProgress(status: number, votes?: readonly number[]) {
  const known = votes?.length === 2 && votes.every(vote => [0, 1, 2].includes(vote));
  const count = known ? votes.filter(vote => vote !== 0).length : 0;
  const agreed = !!known && count === 2 && votes[0] === votes[1];
  return {
    known: !!known,
    count,
    agreed,
    phase: !known
      ? "loading"
      : status !== 4
        ? "settled"
        : count === 0
          ? "none"
          : count === 1
            ? "one"
            : agreed
              ? "agreed"
              : "disagree",
  } as const;
}

export function getVoteLabel(vote?: number) {
  return vote === 1 ? "退给买家" : vote === 2 ? "判给卖家" : vote === 0 ? "尚未投票" : "读取中…";
}

export async function voteOnDispute(
  account: string,
  sellerWins: boolean,
  port: ArbitrationPort & {
    readArbiters: () => Promise<readonly string[]>;
    readVote: () => Promise<number>;
    resolve: () => Promise<void>;
  },
) {
  port.assertWallet();
  if (!(await port.supportsDualArbitration())) throw new Error("当前合约未通过双人仲裁核验");
  const arbiters = await port.readArbiters();
  if (arbiters.length !== 2 || arbiters[0].toLowerCase() === arbiters[1].toLowerCase())
    throw new Error("仲裁人配置无效");
  if (!arbiters.some(address => address.toLowerCase() === account.toLowerCase()))
    throw new Error("只有两名指定仲裁人可以投票");
  if (Number((await port.readOrder()).status) !== 4) throw new Error("只有争议中的订单可以仲裁");
  const currentVote = await port.readVote();
  if (![0, 1, 2].includes(currentVote)) throw new Error("仲裁意见读取异常，请刷新");
  if (currentVote === (sellerWins ? 2 : 1)) throw new Error("你已提交相同意见，请等待另一名仲裁人");
  port.assertWallet();
  await port.resolve();
}

export async function disputeBonusOrder(account: string, port: ArbitrationPort & { dispute: () => Promise<void> }) {
  port.assertWallet();
  if (!(await port.supportsDualArbitration())) throw new Error("当前合约未通过双人仲裁核验");
  const order = await port.readOrder();
  if (![order.buyer.toLowerCase(), order.seller.toLowerCase()].includes(account.toLowerCase()))
    throw new Error("只有买卖双方可以发起争议");
  if (![1, 5].includes(Number(order.status))) throw new Error("当前订单不能发起争议");
  port.assertWallet();
  await port.dispute();
}
