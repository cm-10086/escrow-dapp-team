# 路线 B 与加分项验收记录

本记录依据小组最新版报告及 POTOS Testnet 的成功交易回执整理。基础流程于 2026-11-01 使用原 Escrow 验收；加分流程于 2026-11-07 使用 EscrowBonus 验收。下列哈希已核对成功状态、发起账户和区块号，页面截图保存在小组报告中。

## 合约与操作人

| 用途                               | 地址                                         |
| ---------------------------------- | -------------------------------------------- |
| 原 Escrow，单人仲裁                | `0x267dB7196845D6A1EE887889EeA581067aBe56Cb` |
| EscrowBonus，发货与双人仲裁        | `0x307816f6C24820700Fe11fdA93CeD97C1834190f` |
| 两版共用 PCMToken                  | `0x93c729e48c10EA7c5b7DC971f73DB2B130318631` |
| 彭，买家及加分版第二仲裁人         | `0xDD22eDe4D64E611519099bAF7813B5b10294b20B` |
| 宋，卖家                           | `0x84707E0f5d7d22486818eb3b3F9fAda2D5Dd909e` |
| 蔡，原合约仲裁人及加分版第一仲裁人 | `0x5a11A430A712486394708358fa76a6688FFA6275` |

两版合约分别计数，订单号不得跨合约混用。代币符号为 `PCM202430551274`，精度为 18。

## 基础路线验收

| 订单      | 金额      | 实际过程                             | 最终结果                |
| --------- | --------- | ------------------------------------ | ----------------------- |
| 原合约 #7 | 30 个代币 | 彭创建、授权、付款，最后确认收货     | 已完成，30 个代币转给宋 |
| 原合约 #8 | 30 个代币 | 彭创建并付款，宋发起争议，蔡仲裁退款 | 已退款，30 个代币退给彭 |

### 基础路线交易记录

| 操作                           | 交易哈希                                                             | 区块浏览器链接                                                                                              | 发起账户                                     |
| ------------------------------ | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| 实验三部署 Escrow（路线 B）    | `0x1e5f71706b8fcbad6bc91d40357874ce0adefb31637de5ffe2035082aeae21ea` | [查看](https://scan-testnet.potos.hk/tx/0x1e5f71706b8fcbad6bc91d40357874ce0adefb31637de5ffe2035082aeae21ea) | `0xDD22eDe4D64E611519099bAF7813B5b10294b20B` |
| createOrder 订单 7             | `0x4187137d8a0c567056e514a297e195f1b36b727055e11e9f967e15b61c3cdc03` | [查看](https://scan-testnet.potos.hk/tx/0x4187137d8a0c567056e514a297e195f1b36b727055e11e9f967e15b61c3cdc03) | `0xDD22eDe4D64E611519099bAF7813B5b10294b20B` |
| approve（订单 7 付款前）       | `0xfdb2a0ff88811601dfe43893e1d8001df0fbc4fbe40aa836a0912ca0c0eb7cfa` | [查看](https://scan-testnet.potos.hk/tx/0xfdb2a0ff88811601dfe43893e1d8001df0fbc4fbe40aa836a0912ca0c0eb7cfa) | `0xDD22eDe4D64E611519099bAF7813B5b10294b20B` |
| deposit 订单 7                 | `0xfaf17ea84ca13fd25a97e98b9117c086276a656e85f1e0a310b5462b27eb7aeb` | [查看](https://scan-testnet.potos.hk/tx/0xfaf17ea84ca13fd25a97e98b9117c086276a656e85f1e0a310b5462b27eb7aeb) | `0xDD22eDe4D64E611519099bAF7813B5b10294b20B` |
| createOrder 订单 8             | `0xbb056559a1c23fa18797909b3ff0fce454db5c4ec73c37f4fb155c641a5c1ec3` | [查看](https://scan-testnet.potos.hk/tx/0xbb056559a1c23fa18797909b3ff0fce454db5c4ec73c37f4fb155c641a5c1ec3) | `0xDD22eDe4D64E611519099bAF7813B5b10294b20B` |
| deposit 订单 8                 | `0x1423b35bff5ae195f8a318f58538d5380e5f8b7a42dfbe49bde6cb3eb6d40a97` | [查看](https://scan-testnet.potos.hk/tx/0x1423b35bff5ae195f8a318f58538d5380e5f8b7a42dfbe49bde6cb3eb6d40a97) | `0xDD22eDe4D64E611519099bAF7813B5b10294b20B` |
| dispute 订单 8                 | `0x8f48c3557f067e2849808e1c5fb51c42e70f3f281f49a56df925a65d627a6120` | [查看](https://scan-testnet.potos.hk/tx/0x8f48c3557f067e2849808e1c5fb51c42e70f3f281f49a56df925a65d627a6120) | `0x84707E0f5d7d22486818eb3b3F9fAda2D5Dd909e` |
| resolve 订单 8（退款）         | `0x93154b497287200c783ce37a442de6df666ee56b0280b8c87cf89d1e7f6f4792` | [查看](https://scan-testnet.potos.hk/tx/0x93154b497287200c783ce37a442de6df666ee56b0280b8c87cf89d1e7f6f4792) | `0x5a11A430A712486394708358fa76a6688FFA6275` |
| confirm 订单 7                 | `0x2009e035580323dc6cf7bcba8eebd4d8777da7780f58e3fb29b9fb464f03c8c0` | [查看](https://scan-testnet.potos.hk/tx/0x2009e035580323dc6cf7bcba8eebd4d8777da7780f58e3fb29b9fb464f03c8c0) | `0xDD22eDe4D64E611519099bAF7813B5b10294b20B` |
| resolve 失败（路线 A 第 6 步） | 不适用（本组选择路线 B）                                             | —                                                                                                           | —                                            |

授权发生在代币合约，表中订单关联用于说明后续付款用途，授权事件自身没有订单号。本表列出已核对的交易，不补造 #8 单独授权哈希；是否需要新增授权取决于当时的实际额度。

## 加分项验收

三笔加分订单均为 10 个代币，使用新合约。下表按实际交易先后整理；#1 的超期退款发生在 #2 完成双人仲裁之后。

| 步骤 | 操作人 | 操作                              | 实际结果                                             |
| ---- | ------ | --------------------------------- | ---------------------------------------------------- |
| 1    | 彭     | 创建订单 #0，并完成授权和付款     | 订单显示“已付款”，10 个代币进入托管                  |
| 2    | 宋     | 在截止前为 #0 标记发货            | 订单显示“已发货”，资金继续托管                       |
| 3    | 彭     | 确认 #0 收货                      | 订单显示“已完成”，10 个代币转给宋                    |
| 4    | 彭     | 依次创建 #1、#2，并分别授权和付款 | 两笔均显示“已付款”，各托管 10 个代币；#1 保持未发货  |
| 5    | 宋     | 在截止前为 #2 标记发货            | #2 显示“已发货”                                      |
| 6    | 宋     | 为 #2 发起争议                    | #2 显示“争议中”，资金继续托管                        |
| 7    | 蔡     | 为 #2 选择“判给卖家”              | 投票进度 1/2，订单仍为“争议中”，未放款               |
| 8    | 彭     | 为 #2 选择“退给买家”              | 投票进度 2/2，但意见不一致，订单仍为“争议中”，未放款 |
| 9    | 彭     | 将 #2 的意见改为“判给卖家”        | 两人意见一致，订单显示“已完成”，10 个代币转给宋      |
| 10   | 彭     | #1 超期后申请未发货退款           | #1 显示“已退款”，10 个代币退给彭                     |
| 11   | 三人   | 展开三笔订单时间线并核对交易      | #0 为 4 条，#1 为 3 条，#2 为 8 条记录               |

### 加分项交易记录

| 操作                             | 交易哈希                                                             | 区块浏览器链接                                                                                              | 发起账户                                     |
| -------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| 部署 EscrowBonus                 | `0x84a4df0a785707e818f11ef035538fd6fcbfbe7c4562f02e17f97d5275b8802d` | [查看](https://scan-testnet.potos.hk/tx/0x84a4df0a785707e818f11ef035538fd6fcbfbe7c4562f02e17f97d5275b8802d) | `0xDD22eDe4D64E611519099bAF7813B5b10294b20B` |
| createOrder 订单 0               | `0x18046d6af1cb2e0941d1d93afe03aba6a5e6a60662ec533e0df5b27032dcdc3a` | [查看](https://scan-testnet.potos.hk/tx/0x18046d6af1cb2e0941d1d93afe03aba6a5e6a60662ec533e0df5b27032dcdc3a) | `0xDD22eDe4D64E611519099bAF7813B5b10294b20B` |
| approve（订单 0 付款前）         | `0x3a7095a2fe44f4f48de734fda96f5b6cd8193dbf05df3d76e079adf6ec4c6569` | [查看](https://scan-testnet.potos.hk/tx/0x3a7095a2fe44f4f48de734fda96f5b6cd8193dbf05df3d76e079adf6ec4c6569) | `0xDD22eDe4D64E611519099bAF7813B5b10294b20B` |
| deposit 订单 0                   | `0x67a6173509ae945a01148a1efa200b533fc50560191590b2e80a09b3f3b659df` | [查看](https://scan-testnet.potos.hk/tx/0x67a6173509ae945a01148a1efa200b533fc50560191590b2e80a09b3f3b659df) | `0xDD22eDe4D64E611519099bAF7813B5b10294b20B` |
| markShipped 订单 0               | `0x9ab11302259adc0c00fa84412ca5982cc45693e1837151e17b9b6854ab08cf62` | [查看](https://scan-testnet.potos.hk/tx/0x9ab11302259adc0c00fa84412ca5982cc45693e1837151e17b9b6854ab08cf62) | `0x84707E0f5d7d22486818eb3b3F9fAda2D5Dd909e` |
| confirm 订单 0                   | `0xd28db867082ab6ec4fb6b142857bce555a5abfe2c346ea8dd29b6e27c3fc1e87` | [查看](https://scan-testnet.potos.hk/tx/0xd28db867082ab6ec4fb6b142857bce555a5abfe2c346ea8dd29b6e27c3fc1e87) | `0xDD22eDe4D64E611519099bAF7813B5b10294b20B` |
| createOrder 订单 1               | `0x67825bfa2cd212ce3dc2b6c79a214b35589d4c975cd7086924dbcb4f1197dc7a` | [查看](https://scan-testnet.potos.hk/tx/0x67825bfa2cd212ce3dc2b6c79a214b35589d4c975cd7086924dbcb4f1197dc7a) | `0xDD22eDe4D64E611519099bAF7813B5b10294b20B` |
| approve（订单 1 付款前）         | `0x8fe244316be4241f539131de9016eb5a8d1a2bd9a4388fe759ab3b2add45f277` | [查看](https://scan-testnet.potos.hk/tx/0x8fe244316be4241f539131de9016eb5a8d1a2bd9a4388fe759ab3b2add45f277) | `0xDD22eDe4D64E611519099bAF7813B5b10294b20B` |
| deposit 订单 1                   | `0x39c1124d930262061d674c580a50d58bbd22a0b16b238bf8e2ad1c8dbef20a97` | [查看](https://scan-testnet.potos.hk/tx/0x39c1124d930262061d674c580a50d58bbd22a0b16b238bf8e2ad1c8dbef20a97) | `0xDD22eDe4D64E611519099bAF7813B5b10294b20B` |
| createOrder 订单 2               | `0x74223281eeb0eafb70a6d0e456b7d240968e4f12efd618c93e2af7814eae81cd` | [查看](https://scan-testnet.potos.hk/tx/0x74223281eeb0eafb70a6d0e456b7d240968e4f12efd618c93e2af7814eae81cd) | `0xDD22eDe4D64E611519099bAF7813B5b10294b20B` |
| approve（订单 2 付款前）         | `0x2f7dc09546793ae6bd1a2c2b7b22c21895bbe1595c919fc85e377c1014ef3a9d` | [查看](https://scan-testnet.potos.hk/tx/0x2f7dc09546793ae6bd1a2c2b7b22c21895bbe1595c919fc85e377c1014ef3a9d) | `0xDD22eDe4D64E611519099bAF7813B5b10294b20B` |
| deposit 订单 2                   | `0xa52aa2bc775d4c23f76e5b76a4bd35595290ec49a5942000eb7dd9ceb17a45f0` | [查看](https://scan-testnet.potos.hk/tx/0xa52aa2bc775d4c23f76e5b76a4bd35595290ec49a5942000eb7dd9ceb17a45f0) | `0xDD22eDe4D64E611519099bAF7813B5b10294b20B` |
| markShipped 订单 2               | `0xc93435d2375cc1127d965bde8c885609bd088c2d14c8f53e1e869da39c438ad3` | [查看](https://scan-testnet.potos.hk/tx/0xc93435d2375cc1127d965bde8c885609bd088c2d14c8f53e1e869da39c438ad3) | `0x84707E0f5d7d22486818eb3b3F9fAda2D5Dd909e` |
| dispute 订单 2                   | `0xdf63a773de8c766761062b02ae8f4a4dad83ef2fbd6d749e1cf2ceef4850e6b3` | [查看](https://scan-testnet.potos.hk/tx/0xdf63a773de8c766761062b02ae8f4a4dad83ef2fbd6d749e1cf2ceef4850e6b3) | `0x84707E0f5d7d22486818eb3b3F9fAda2D5Dd909e` |
| resolve 订单 2（蔡：判给卖家）   | `0xdedfe37a88d1a1151474bdea7779556779a5c39350d74800ef6a4c74137ad3c3` | [查看](https://scan-testnet.potos.hk/tx/0xdedfe37a88d1a1151474bdea7779556779a5c39350d74800ef6a4c74137ad3c3) | `0x5a11A430A712486394708358fa76a6688FFA6275` |
| resolve 订单 2（彭：退给买家）   | `0x1a98ca0cea714ca99db9ac9658086cb1c19852afa6ab8af0f3a5d6b4dd4c5f68` | [查看](https://scan-testnet.potos.hk/tx/0x1a98ca0cea714ca99db9ac9658086cb1c19852afa6ab8af0f3a5d6b4dd4c5f68) | `0xDD22eDe4D64E611519099bAF7813B5b10294b20B` |
| resolve 订单 2（彭：改投并结算） | `0x33fcd2214ab5e6c40fbdc761dba1d94d2439574f7902ac76fb51cb930bf66a63` | [查看](https://scan-testnet.potos.hk/tx/0x33fcd2214ab5e6c40fbdc761dba1d94d2439574f7902ac76fb51cb930bf66a63) | `0xDD22eDe4D64E611519099bAF7813B5b10294b20B` |
| refund 订单 1                    | `0x7b57560283e9557f9e4f38ece31283eb615f264ce6628338f6e4a29e06163226` | [查看](https://scan-testnet.potos.hk/tx/0x7b57560283e9557f9e4f38ece31283eb615f264ce6628338f6e4a29e06163226) | `0xDD22eDe4D64E611519099bAF7813B5b10294b20B` |

### 时间线与验收范围

- #0：创建、付款、发货、确认收货，共 4 条。
- #1：创建、付款、未发货超期退款，共 3 条。
- #2：创建、付款、发货、争议、三次投票、最终裁决，共 8 条。最后一次投票与最终裁决在同一笔交易中，按日志位置分别展示。

#2 的前两次投票交易未发生代币转出；第三次投票与另一人的当前意见一致后才转给卖家。#1 的退款来自未发货超期退款，不作为双人仲裁退款的证据。

报告包含“已发货不能直接超期退款”的页面限制截图，但记录中没有对应的已打包失败交易哈希，因此不填写链上失败交易或消耗 gas 的结论。已发货退款限制、非卖家发货、重复投票、非仲裁人投票、终态重复结算及双人仲裁退款分支，另由合约代码和自动测试覆盖；未逐项描述为公共链实操。

## 本地自动检查记录

2026-11-03 完整功能版本通过 37 个合约测试、70 个前端测试、两端类型检查与 lint，以及前端 ABI 与编译产物一致性检查。复现命令见 [README](../README.md#实现与检查)，持续集成配置见 [lint.yaml](../.github/workflows/lint.yaml)。自动测试结果和上述真实交易分别作为证据，不互相替代。
