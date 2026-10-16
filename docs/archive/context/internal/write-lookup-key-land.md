---
cursor:
  subagentId: "bc-ef79a5c7-7771-52b0-96ee-17983e71742d"
---

# 过账查找键：已落地，未手证

本地 `be63a832`，分支 `cursor/create-write-three-cuts-cc00`。没有推远程。收法见 [write-lookup-key-plan.md](../docs/write-lookup-key-plan.md)。浏览器里还没点过确认。

`probe` 和 `writeDest` 共用 `matchedWriteIdentity`（词表列 + schema 主键界面 `snowflakeId` / `uuid` / `nanoid`）。预览行上业务号那一格有值且等于令牌号，改行 / 删除 / 过审就按那一格等值。否则令牌号对上 schema 主键，就按主键改 / 删这一行。对不上就不发。新建仍是 `POST :create`，没有 filter。update / destroy 回 200 但 0 行（`data` 空、`null`、`0`）当失败。改行读回对不上补丁，仍是「业务回了，但字段还是旧的」。

## 改了哪些文件

| 文件 | 做什么 |
|---|---|
| `runtime/vendor-overlays/dsh-lan-assist/lookup.js` | `matchedWriteIdentity` |
| `runtime/vendor-overlays/dsh-lan-assist/write.js` | 确认前用同一份身份；`writeDest` 按它滤；0 行失败 |
| `runtime/tests/write-lookup-key.test.mjs` | 主键 look、业务号有值、0 行、新建不滤 |

## 测试

`node --test runtime/tests/write-lookup-key.test.mjs`：8 项过。

- 主键 look、业务号列空：改行 update、删除 destroy、过审 update 的 filter 是 schema 主键。
- 业务号有值且等于 look：filter 仍是那一格。
- 业务号有值但不等于 look：仍走主键。
- update `data: []`、destroy `data: 0`：失败，hint「没有改到行」。
- 新建 URL 是 `:create`，没有 filter。
- 预览令牌再确认：空业务号走主键，有业务号走那一格。

`nocobase-path.test.mjs` 以及写口相关 64 项里，原先就失败的两项没动：`leftover-catalog-refuse` 的 spoken leftover、`write-name-identity` 的「成交」改写。把这次 diff 拿掉再跑，这两项一样失败。

## overlay

`cp` 了 `lookup.js`、`write.js`。没有 `POST /ai/reload`。没有重启 4318，没有动 5174。

| | SHA256 | inode |
|---|---|---|
| `lookup.js` | `e22b34ee2cd778230a6331f1aabaae6c5f8d29528f7a372cdeb9005b163ef817` | 现网 `67343334` |
| `write.js` | `bc4ae8955fd860a1525530dedf3270483b806618d2240fb282b49e189a87f610` | 现网 `67343342` |

checkout overlay、`~/.dsh-fde-x/vendor/dsh-lan-assist`、`profiles/fde-x/node_modules/dsh-lan-assist`（链到 vendor，同一 inode）这三处哈希一致。其余 overlay 文件和现网本来就一样，没再抄。

`POST /api/v1/ai/disconnect` 然后 `POST /api/v1/ai/connect`，`Origin: http://localhost:5174`。旧 DSH **67602** 已退出。新 DSH **86898**，`startedAt` `2026-09-24T16:38:54.885Z`。BFF **46288** 仍听 4318。Vite **42443** 仍听 5174。

## 手验怎么点

未手证。新开会话：

1. 找一行查找列是空的、令牌号是 schema 主键。上一笔那张 `388468591099904`（编号空着）就是这种，别的型只要同样空着也算。
2. 改一个字段，点确认。库里这一行要更新，确认面的字段进库，不要再出「业务回了，但字段还是旧的」。
3. 再删或过审一行同样条件。动的是主键这一行，不是 0 行还报成功。
4. 另找一行查找列里有值。确认后仍按那一格改，不要改成只认主键。
5. 新建仍是插一行，不拿旧号去滤。
