# 宋穗杰：创建、付款与确认收货交接

2026-10-31 交付。分支：`feat/order-actions`。以下保留当时的模块交接与验证记录。创建、付款、确认功能现已合并至 `main` 并接入 `/escrow`；后续路线 B 与加分项的真实验收见 [ACCEPTANCE.md](ACCEPTANCE.md)。

## 交付时的接入步骤（已完成）

已核对远端 `feat/order-list` 的 `469ab69` 版本：订单列表、顶部角色和 CZH 争议仲裁组件已经存在。本分支只交付宋的写操作，不改动组长的主页面与订单行。下一棒是彭春沐（PCM），将本分支合并到 `feat/order-list` 后完成以下两处接线：

1. 在 `packages/nextjs/app/escrow/page.tsx` 导入 `./_components/CreateOrderForm`，在订单列表前放置 `<CreateOrderForm onCreated={() => { void refresh(); }} />`，使创建成功后重新查询事件和链上订单数。
2. 在 `packages/nextjs/components/escrow/EscrowOrderRow.tsx` 导入 `~~/app/escrow/_components/PayButton`、`~~/app/escrow/_components/ConfirmButton`，在已有争议组件旁分别放置 `<PayButton orderId={orderId} order={order} onSuccess={() => void refetch()} />` 和 `<ConfirmButton orderId={orderId} order={order} onSuccess={() => void refetch()} />`。传入该行完整 getOrder 返回值，保留已有 EscrowDisputeActions。

本分支额外添加 `test:order-writes` 脚本；合并时应保留 PCM 分支已添加的 `test:events`、`test:roles` 等脚本。主页面集成后请再运行类型检查、lint 和各模块测试，然后通知彭以买家钱包发起两笔新订单验收。宋在验收中使用卖家钱包，蔡使用仲裁人钱包。

## 入口与运行

安装依赖仍使用仓库根目录的 `yarn install --immutable`，然后运行 `yarn start`，访问 `/escrow/write`。本机已用 Ubuntu WSL 中现有的依赖启动端口 3001：<http://localhost:3001/escrow/write>。当前本机的 `node_modules` 是指向 WSL 既有依赖的本地链接，不提交到 Git；本机重启可在 WSL 执行 `bash scripts/start-song-preview.sh`。新机器按标准安装步骤运行，不依赖本机的路径。

联调入口与组长将要开发的 `/escrow` 主页面分别放置，便于合并。订单列表、事件分批查询、争议与仲裁仍由组员整合；联调入口中的按 ID 读取仅用于验证三个写操作。

## 已完成的行为

| 文件（相对仓库根目录）                                       | 行为                                                                                                                                                 |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/nextjs/app/escrow/_components/CreateOrderForm.tsx` | 卖家、金额、到期分钟数、描述；动态读取 decimals/symbol；用 bigint 换算金额；读取链上时间和 orderCount；成功后从本笔回执 OrderCreated 解析真实订单 ID |
| `packages/nextjs/app/escrow/_components/PayButton.tsx`       | 仅订单买家在 Created 时显示；重新读取实际订单、余额与 allowance；只授权订单所需金额；等待成功回执后才 deposit；已有足额授权可直接付款                |
| `packages/nextjs/app/escrow/_components/ConfirmButton.tsx`   | 仅订单买家在 Paid 时显示；用户确认已收到商品或服务后调用 confirm；等待成功回执再刷新                                                                 |
| `packages/nextjs/app/escrow/_hooks/useOrderTransaction.ts`   | 钱包及 chain ID 检查、处理中禁止重复点击、签名前核对账户、回执等待、取消/替换交易处理、错误提示与交易哈希                                            |
| `packages/nextjs/app/escrow/_lib/orderWrites.ts`             | 金额和到期时间校验、可测试的付款与确认流程                                                                                                           |
| `packages/nextjs/app/escrow/write/page.tsx`                  | 联调页面，支持创建后自动选择新订单，或手动读取真实 ID                                                                                                |

合约和 ABI 均引用现有 `deployedContracts.ts`：Escrow `0x267dB7196845D6A1EE887889EeA581067aBe56Cb`，PCMToken `0x93c729e48c10EA7c5b7DC971f73DB2B130318631`，网络 60600。本次没有更改、重新部署合约。

金额输入不经过 Number/浮点运算。超过代币精度的小数会报错，避免静默四舍五入。到期时间是最新链上区块时间加所填分钟数。订单 ID 从回执事件获得，不把事前读取的 orderCount 当成最终 ID，避免并发创建时拿错订单。

## 组长集成接口

```tsx
import { CreateOrderForm } from "./_components/CreateOrderForm";
import { PayButton } from "./_components/PayButton";
import { ConfirmButton } from "./_components/ConfirmButton";

<CreateOrderForm onCreated={(id, hash) => { /* 刷新事件列表，选中新订单，记录哈希 */ }} />
<PayButton orderId={id} order={order} onSuccess={() => { /* 重新读取 getOrder */ }} />
<ConfirmButton orderId={id} order={order} onSuccess={() => { /* 重新读取 getOrder */ }} />
```

`id` 是 bigint；`order` 直接使用 getOrder 的返回结构：buyer、seller、token、amount(bigint)、deadline(bigint)、status(number)、description。状态顺序是 Created=0、Paid=1、Completed=2、Refunded=3、Disputed=4。组件自行检查显示权限，提交时再读链上状态，合约仍负责最终权限控制。请保持每个订单组件稳定的 React key，付款完成后也保留组件，以便查看本次交易哈希。

哈希和按钮进度保留在当前组件内存中。签名后请等待回执，并保存哈希再离开页面。RPC 超时时再次点击会先查询上笔回执，不自动再发一笔；查询成功后需刷新订单或列表。刷新整个页面、切换订单或关闭标签会清除组件中的临时记录，交易本身仍可从区块浏览器查询。

## 验证结果

2026-10-31 交付前重新执行：12 项写操作测试、前端 TypeScript、此次新增页面及测试的 ESLint 均通过。以下浏览器及链上读取记录来自 2026-10-25 的开发验证，不代表 10 月 31 日的实时订单数。

- Node 22.14.0；前端 TypeScript `--noEmit --incremental false` 通过。
- 本次新增页面、组件、测试 ESLint 通过；Prettier 已格式化。
- 12 项测试通过：精确金额、超精度/零/溢出校验、分钟换算、地址大小写、授权确认前不付款、授权失败停止、足额授权重试、角色/状态/余额校验、钱包切换、付款前状态变化、付款失败不自动重试、Paid 买家才能确认。
- 浏览器实测 `/escrow/write` 返回正常页面；未连接钱包时创建按钮禁用；真实 orderCount=5；代币 symbol=PCM202430551274，decimals=18。
- 浏览器读取历史订单 #2：买家 `0xDD22eDe4D64E611519099bAF7813B5b10294b20B`，卖家（宋）`0x84707E0f5d7d22486818eb3b3F9fAda2D5Dd909e`，金额 30，状态 Completed。此记录仅证明只读查询，不能作为本次大作业新订单验收。
- 浏览器负数订单号校验正常。没有连接钱包、签名或发送链上交易。
- WSL Node 直连 RPC 本次返回 fetch failed，浏览器中的实际读取成功。`scripts/check-song-contracts.cjs` 提供只读的网络、部署地址及运行字节码核验；本次未成功执行该脚本，因此没有生成新的字节码核验结果。

运行写操作测试（Node >=22.6，本次为 22.14）：

```sh
yarn workspace @se-2/nextjs test:order-writes
yarn next:check-types
# 本次按项目 ESLint 9 配置直接检查新增文件
cd packages/nextjs
yarn exec eslint app/escrow tests/order-writes.test.mjs
```

## 交付时的三人联合验收计划（基础流程已完成）

开发分工不会改变链上角色：彭是买家，宋是卖家，蔡使用合约仲裁人钱包。宋实现的创建、付款、确认由彭的钱包验收；宋的钱包不能替代买家签名。

1. 组长合并订单列表和事件查询；蔡合并争议、仲裁与角色显示，再在 `/escrow` 主页面联合验收。
2. 彭通过页面新建正常订单 N，金额 30、约 30 分钟后到期，卖家填宋的公开地址；保存真实 ID 与创建哈希。
3. 彭点击付款，按页面顺序确认 approve、deposit 两次钱包签名，保存两个弹窗原图、哈希与 Paid 状态。
4. 买卖双方分别查看 N，记录角色差异；只有买家能看到确认收货。
5. 彭再建争议订单 M 并付款，宋发起争议，蔡仲裁退给买家；保存 Disputed、Refunded 与相应哈希。
6. 彭确认 N，保存 Completed、确认哈希和卖家收款证据。补齐 README 交易表和 4B 截图后，才可认定业务验收完成。

两笔新订单的 ID 以实际回执为准，不填旧的 0/1，也不预先保证为 5/6。

## 宋负责解释题的写作依据

“授权再付款”涉及两份合约：approve 在代币合约中设置买家允许 Escrow 使用的额度；deposit 由 Escrow 调用 transferFrom 把代币从买家转入托管。发出 approve 不代表授权已上链，必须等待成功回执，才进行 deposit。若 approve 失败则停止；若 deposit 失败而授权成功，重试先读 allowance，避免重复授权。正式报告应引用本次新订单的两笔真实哈希、金额、spender 和钱包原图。

按钮显示是交互层的角色提示，权限最终由合约的 onlyBuyer 与状态检查执行。宋即使开发买家按钮，验收时连接卖家钱包仍不能调用买家的确认操作。正式报告须使用三人新页面实操证据，不以本次单元测试或旧订单查询替代。
