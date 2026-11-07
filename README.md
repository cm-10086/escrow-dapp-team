# Escrow 托管订单 DApp

《区块链技术与应用》三人小组项目，基于彭春沐的实验三项目和 Scaffold-ETH 2，完成大作业路线 B。用户通过 MetaMask 在 POTOS 测试网上创建订单、授权付款、确认收货、发起争议及仲裁。

截至 2026-11-07，已完成路线 B 的正常成交、争议退款，以及订单时间线、卖家发货状态、双人仲裁三项加分功能的页面操作和链上核对。原合约与加分合约分别保留；实际订单、操作账户、交易哈希和验收范围见 [验收记录](docs/ACCEPTANCE.md)。

## 功能与验收结果

| 功能             | 页面行为                                                   | 已记录结果                                |
| ---------------- | ---------------------------------------------------------- | ----------------------------------------- |
| 订单列表与角色   | 读取真实订单号、订单状态、代币精度及买家／卖家／仲裁人身份 | 原合约 #7 已完成、#8 已退款               |
| 创建、付款与确认 | 创建成功后刷新列表；授权成功后再付款；成功回执后更新订单   | 原合约 #7 完成 30 个代币的正常成交        |
| 争议与单人仲裁   | 买卖任一方发起争议，指定仲裁人裁决                         | 原合约 #8 的 30 个代币退给买家            |
| 订单时间线       | 在订单行展开事件，展示时间、账户、区块和交易链接           | 加分合约 #0、#1、#2 分别为 4、3、8 条记录 |
| 卖家发货状态     | 卖家标记发货；未发货超期可退，已发货不能直接超期退款       | 加分合约 #0 发货后确认；#1 未发货超期退款 |
| 双人仲裁         | 两人分别投票，当前意见一致才结算；争议期间可以改票         | 加分合约 #2 经首票、分歧、改票一致后放款  |

## 小组成员

| 成员           | 主要开发内容                           | 验收角色                 |
| -------------- | -------------------------------------- | ------------------------ |
| 彭春沐（组长） | 项目整合、订单列表与读取、页面角色汇总 | 买家；加分合约第二仲裁人 |
| 宋穗杰         | 创建订单、授权付款、确认收货           | 卖家                     |
| 蔡焯泓         | 争议与仲裁、权限判断、验收数据汇总     | 第一仲裁人               |

开发分工不改变合约权限；每笔操作均由实际角色的钱包签名。

## 网络、合约与钱包

网络为 **POTOS Testnet**，chain ID **60600**，RPC 为 `https://rpc-testnet.potos.hk`，区块浏览器为 [POTOS Blockscout](https://scan-testnet.potos.hk)。

| 合约        | 地址                                                                                                                             | 用途                                              |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 原 Escrow   | [`0x267dB7196845D6A1EE887889EeA581067aBe56Cb`](https://scan-testnet.potos.hk/address/0x267dB7196845D6A1EE887889EeA581067aBe56Cb) | 实验三及路线 B 基础验收，保留 #7、#8 等历史订单   |
| EscrowBonus | [`0x307816f6C24820700Fe11fdA93CeD97C1834190f`](https://scan-testnet.potos.hk/address/0x307816f6C24820700Fe11fdA93CeD97C1834190f) | 发货与双人仲裁统一部署，部署区块 **2800063**      |
| PCMToken    | [`0x93c729e48c10EA7c5b7DC971f73DB2B130318631`](https://scan-testnet.potos.hk/address/0x93c729e48c10EA7c5b7DC971f73DB2B130318631) | 两版共用代币，符号 `PCM202430551274`，精度 **18** |

| 成员   | 公开钱包地址                                 |
| ------ | -------------------------------------------- |
| 彭春沐 | `0xDD22eDe4D64E611519099bAF7813B5b10294b20B` |
| 宋穗杰 | `0x84707E0f5d7d22486818eb3b3F9fAda2D5Dd909e` |
| 蔡焯泓 | `0x5a11A430A712486394708358fa76a6688FFA6275` |

原合约由蔡单人仲裁；加分合约由蔡和彭共同仲裁。新合约使用独立订单计数和托管余额，原合约订单不会自动迁移。订单号必须连同合约地址一起识别。

## 本地启动

需要 Node.js `>=20.18.3`，项目固定使用 Yarn `3.2.3`。私有仓库须先获得访问权限；已下载 ZIP 的成员直接进入解压后的项目根目录即可。

```sh
git clone https://github.com/cm-10086/escrow-dapp-team.git
cd escrow-dapp-team
corepack enable
yarn install --immutable
```

在 `packages/nextjs` 下将 `.env.example` 复制为 `.env.local`，按下面说明选择合约，再从项目根目录运行：

```sh
yarn start
```

打开终端输出的本地地址，通常为 <http://localhost:3000/escrow>。钱包连接 POTOS Testnet。使用已有测试网合约无需运行 `yarn chain` 或重新部署；操作需要钱包中有测试 POT 支付手续费，买家还需持有付款代币。

### 选择加分合约

在 `packages/nextjs/.env.local` 中同时设置：

```dotenv
NEXT_PUBLIC_ESCROW_BONUS_ADDRESS=0x307816f6C24820700Fe11fdA93CeD97C1834190f
NEXT_PUBLIC_ESCROW_BONUS_DEPLOY_BLOCK=2800063
```

保存后重启 `yarn start`。页面顶部应显示新合约和蔡、彭两名仲裁人；订单列表、创建与付款、争议仲裁和时间线都会使用同一地址。页面同时核验发货和双人仲裁能力，核验成功后才允许交易。

若要查看原合约 #7、#8，将上述两个值同时留空并重启。只填一项、填写旧合约地址或无效区块都会被视为配置错误。不要手动覆盖原 `deployedContracts.ts` 和实验三部署记录。

### 其他环境变量

`NEXT_PUBLIC_ALCHEMY_API_KEY`、`NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` 是前端可选配置，当前 POTOS RPC 已在项目中配置。仅运行页面不需要导入私钥，也不需要配置 Hardhat 的部署账户。`.env.local`、Hardhat `.env`、私钥和助记词不得提交；`NEXT_PUBLIC_` 变量只保存可公开的信息。

## 页面操作

1. 彭连接买家钱包，填写宋的卖家地址、金额、截止分钟数及描述，创建订单。记录成功回执中的真实订单号。
2. 彭点击“授权并付款”，按钱包提示先授权、再付款；必须等待授权成功。已有足额授权时可直接付款。
3. 正常成交：宋在截止前标记发货，彭确认收货，托管款转给宋。
4. 未发货退款：订单付款后保持未发货，超过截止时间由彭申请退款。已发货订单不能走这条退款路径。
5. 争议订单：彭或宋发起争议。蔡、彭分别提交仲裁意见；第一票或意见分歧时继续托管，两人当前意见一致后才结算。
6. 点击订单行的“展开时间线”，查看真实事件和交易链接。授权发生在代币合约，不作为订单时间线中的一条独立订单事件。

原合约的基础验收流程没有发货和双人投票环节，仍使用原单人仲裁。三笔加分订单的实际操作顺序和结果见 [验收操作表](docs/ACCEPTANCE.md#加分项验收)。

## 实现与检查

主要目录：`packages/hardhat/contracts` 为合约，`packages/nextjs/app/escrow` 为订单页面和买家操作，`packages/nextjs/components/escrow` 为订单行、时间线、发货与仲裁组件。原模板说明保存在 [UPSTREAM_README.md](docs/UPSTREAM_README.md)。

事件查询每批最多覆盖 10 个区块；近期订单优先读取，旧历史后台补读。创建成功后直接解析回执中的真实 ID；交易操作等待成功回执再刷新。金额按代币实际精度使用 `bigint` 换算，角色与状态限制同时在合约执行。

```sh
yarn hardhat:compile
node scripts/export-escrow-bonus-abi.cjs --check
yarn hardhat:test
yarn hardhat:check-types
yarn next:check-types
yarn lint
yarn workspace @se-2/nextjs test:order-writes
yarn workspace @se-2/nextjs test:events
yarn workspace @se-2/nextjs test:roles
yarn workspace @se-2/nextjs test:timeline
yarn workspace @se-2/nextjs test:shipping
yarn workspace @se-2/nextjs test:arbitration
```

2026-11-03 完整功能版本的本地检查记录为 **37 个合约测试、70 个前端测试通过**，两端类型检查、lint 和 ABI 一致性检查通过。自动测试与公共链验收分别记录，链上证据见验收文档。

## 项目文档

- [路线 B 与加分项验收记录](docs/ACCEPTANCE.md)
- [订单时间线实现与核验](docs/ORDER_TIMELINE.md)
- [卖家发货状态](docs/SELLER_SHIPPING.md)
- [双人仲裁规则与部署](docs/DUAL_ARBITRATION.md)
- [订单列表同步问题及修复](docs/ORDER_EVENT_SYNC_FIX.md)
- [创建、付款与确认模块交接记录](docs/SONG_HANDOFF.md)
