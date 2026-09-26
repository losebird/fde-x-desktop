---
cursor:
  subagentId: "bc-41384c33-bd2e-5d2c-9b13-5cf8e315c0b0"
---

# 增删改审：口语须收成机器值的写槽（schema + 词表 + 图）

对照 [增删改审手测集](../docs/biz-write-eval.md)。只查因，未改产品。数据源：Noco `13000` `collections:list`（只读）+ `/Users/zxz/Documents/ai-project/fdex测试/.dsh/semantic-os/graph.json` 已发布词表 + 现网 `spoken.json`。未 reload、未动 5174/4318、未点过账。

生成：2026-09-24。可写型 **40** 个（词表 `can` 含新建/改行/删除/过审之一）。

## 绑定层约定（现网 overlay）

| 机制 | 写路径 |
| --- | --- |
| enum bind | `bindPatchEnums`（预览结构化）；枚举 label/口语 → code |
| shapePatch | `bindWritePatch` → `shapePatch` + `resolveRelatedId`；m2o 口语 → `relationColumn` 的 `*Id` |
| 图边 | `kind.relations` / schema `target`；hop 现查与 `relationColumn`，不单独完成写收口 |
| 无 | 无枚举表、非 m2o、不在「关联列」→ 口语可能原样进 patch |

## 槽位归类（手测重点）

### 状态 / status·state·stage

| 型 | 表 | name | interface | type | target | enum | FK | 词表标题/口语别名 | 现网绑定 | 口语→机器 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 采购订单 | `biz_purchase_orders` | `status` | select |  | — | 6 | — | 订单状态、处理中、进行中、processing、in_progress、in progress | enum bind（词表 clues→keys） | label→code |
| 采购收货单 | `biz_purchase_receipts` | `status` | select |  | — | 3 | — | 状态、处理中、进行中、processing、in_progress、in progress | enum bind（词表 clues→keys） | label→code |
| 仓库 | `biz_warehouses` | `status` | select |  | — | 2 | — | 状态、处理中、进行中、processing、in_progress、in progress | enum bind（词表 clues→keys） | label→code |
| 发票 | `biz_invoices` | `status` | select |  | — | 3 | — | 状态、处理中、进行中、processing、in_progress、in progress | enum bind（词表 clues→keys） | label→code |
| 费用报销 | `biz_expenses` | `status` | select |  | — | 5 | — | 状态、处理中、进行中、processing、in_progress、in progress | enum bind（词表 clues→keys） | label→code |
| 付款单 | `biz_payment_vouchers` | `status` | select |  | — | 2 | — | 状态、处理中、进行中、processing、in_progress、in progress | enum bind（词表 clues→keys） | label→code |
| 岗位 | `biz_positions` | `status` | select |  | — | 2 | — | 状态、处理中、进行中、processing、in_progress、in progress | enum bind（词表 clues→keys） | label→code |
| 工单 | `biz_tickets` | `status` | select |  | — | 5 | — | 工单状态、处理中、进行中、processing、in_progress、in progress | enum bind（词表 clues→keys） | label→code |
| 供应商 | `biz_suppliers` | `status` | select |  | — | 3 | — | 状态、处理中、进行中、processing、in_progress、in progress | enum bind（词表 clues→keys） | label→code |
| 固定资产 | `biz_assets` | `status` | select |  | — | 4 | — | 资产状态、处理中、进行中、processing、in_progress、in progress | enum bind（词表 clues→keys） | label→code |
| 合同 | `biz_contracts` | `status` | select |  | — | 5 | — | 合同状态、处理中、进行中、processing、in_progress、in progress | enum bind（词表 clues→keys） | label→code |
| 考勤记录 | `biz_attendance_records` | `status` | select |  | — | 5 | — | 考勤状态、处理中、进行中、processing、in_progress、in progress | enum bind（词表 clues→keys） | label→code |
| 客户 | `biz_customers` | `status` | select |  | — | 4 | — | 客户状态、处理中、进行中、processing、in_progress、in progress | enum bind（词表 clues→keys） | label→code |
| 请假申请 | `biz_leave_requests` | `status` | select |  | — | 5 | — | 审批状态、处理中、进行中、processing、in_progress、in progress | enum bind（词表 clues→keys） | label→code |
| 商品物料 | `biz_products` | `status` | select |  | — | 2 | — | 状态、处理中、进行中、processing、in_progress、in progress | enum bind（词表 clues→keys） | label→code |
| 生产工单 | `biz_work_orders` | `status` | select |  | — | 5 | — | 状态、处理中、进行中、processing、in_progress、in progress | enum bind（词表 clues→keys） | label→code |
| 项目 | `biz_projects` | `status` | select |  | — | 5 | — | 项目状态、处理中、进行中、processing、in_progress、in progress | enum bind（词表 clues→keys） | label→code |
| 项目里程碑 | `biz_project_milestones` | `status` | select |  | — | 4 | — | 里程碑状态、处理中、进行中、processing、in_progress、in progress | enum bind（词表 clues→keys） | label→code |
| 项目任务 | `biz_project_tasks` | `status` | select |  | — | 4 | — | 任务状态、处理中、进行中、processing、in_progress、in progress | enum bind（词表 clues→keys） | label→code |
| 销售订单 | `biz_sales_orders` | `status` | select |  | — | 5 | — | 订单状态、处理中、进行中、processing、in_progress、in progress | enum bind（词表 clues→keys） | label→code |
| 销售回款 | `biz_payments` | `status` | select |  | — | 3 | — | 回款状态、处理中、进行中、processing、in_progress、in progress | enum bind（词表 clues→keys） | label→code |
| 销售商机 | `biz_opportunities` | `stage` | select |  | — | 5 | — | 销售阶段、处理中、进行中、processing、in_progress、in progress | enum bind（词表 clues→keys） | label→code |
| 销售线索 | `biz_leads` | `status` | select |  | — | 5 | — | 线索状态、处理中、进行中、processing、in_progress、in progress | enum bind（词表 clues→keys） | label→code |
| 员工档案 | `biz_employees` | `status` | select |  | — | 4 | — | 在职状态、处理中、进行中、processing、in_progress、in progress | enum bind（词表 clues→keys） | label→code |
| 资产领用归还 | `biz_asset_assignments` | `status` | select |  | — | 5 | — | 处理状态、处理中、进行中、processing、in_progress、in progress | enum bind（词表 clues→keys） | label→code |
| BOM物料清单 | `biz_boms` | `status` | select |  | — | 3 | — | 状态、处理中、进行中、processing、in_progress、in progress | enum bind（词表 clues→keys） | label→code |

### 优先级 / priority

| 型 | 表 | name | interface | type | target | enum | FK | 词表标题/口语别名 | 现网绑定 | 口语→机器 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 工单 | `biz_tickets` | `priority` | select |  | — | 4 | — | 优先级、紧急、urgent、高优、高优先级、high、低优、低优先级、low | enum bind（词表 clues→keys） | label→code |
| 项目 | `biz_projects` | `priority` | select |  | — | 4 | — | 优先级、紧急、urgent、高优、高优先级、high、低优、低优先级、low | enum bind（词表 clues→keys） | label→code |
| 项目任务 | `biz_project_tasks` | `priority` | select |  | — | 4 | — | 优先级、紧急、urgent、高优、高优先级、high、低优、低优先级、low | enum bind（词表 clues→keys） | label→code |

### 处理人 / assignee → users

| 型 | 表 | name | interface | type | target | enum | FK | 词表标题/口语别名 | 现网绑定 | 口语→机器 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 采购收货单 | `biz_purchase_receipts` | `handler` | m2o |  | biz_employees | — | Y | 经办人 | shapePatch（schema m2o） + 图边 员工档案→采购收货单(handler) | 名/标签→id |
| 出入库流水 | `biz_stock_movements` | `handler` | m2o |  | biz_employees | — | Y | 经办人 | shapePatch（schema m2o） + 图边 员工档案→出入库流水(handler) | 名/标签→id |
| 付款单 | `biz_payment_vouchers` | `handler` | m2o |  | biz_employees | — | Y | 经办人 | shapePatch（schema m2o） | 名/标签→id |
| 工单 | `biz_tickets` | `assignee` | m2o |  | users | — | Y | 处理人 | shapePatch（schema m2o + 关联列词表） | 名/标签→id |
| 工单处理记录 | `biz_ticket_logs` | `author` | m2o |  | users | — | Y | 处理人 | shapePatch（schema m2o） + 图边 {{t("Users")}}→工单处理记录(author) | 名/标签→id |
| 生产领料单 | `biz_material_issues` | `handler` | m2o |  | biz_employees | — | Y | 经办人 | shapePatch（schema m2o） + 图边 员工档案→生产领料单(handler) | 名/标签→id |
| 项目任务 | `biz_project_tasks` | `assignee` | m2o |  | users | — | Y | 负责人 | shapePatch（schema m2o） | 名/标签→id |
| 资产领用归还 | `biz_asset_assignments` | `handler` | m2o |  | users | — | Y | 经办人 | shapePatch（schema m2o） + 图边 {{t("Users")}}→资产领用归还(handler) | 名/标签→id |

### 客户 / customer → biz_customers

| 型 | 表 | name | interface | type | target | enum | FK | 词表标题/口语别名 | 现网绑定 | 口语→机器 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 发票 | `biz_invoices` | `customer` | m2o |  | biz_customers | — | Y | 客户(销项) | shapePatch（schema m2o） | 名/标签→id |
| 工单 | `biz_tickets` | `customer` | m2o |  | biz_customers | — | Y | 客户 | shapePatch（schema m2o + 关联列词表） + 图边 客户→工单(customer) | 名/标签→id |
| 合同 | `biz_contracts` | `customer` | m2o |  | biz_customers | — | Y | 客户 | shapePatch（schema m2o + 关联列词表） | 名/标签→id |
| 客户 | `biz_customers` | `customerType` | select |  | — | 4 | — | 客户类型 | enum bind（仅 schema 枚举） | label→code |
| 客户 | `biz_customers` | `level` | select |  | — | 4 | — | 客户等级 | enum bind（仅 schema 枚举） | label→code |
| 客户 | `biz_customers` | `owner` | m2o |  | users | — | Y | 客户负责人 | shapePatch（schema m2o） | 名/标签→id |
| 联系人 | `biz_contacts` | `customer` | m2o |  | biz_customers | — | Y | 所属客户 | shapePatch（schema m2o） | 名/标签→id |
| 项目 | `biz_projects` | `customer` | m2o |  | biz_customers | — | Y | 客户 | shapePatch（schema m2o + 关联列词表） | 名/标签→id |
| 销售订单 | `biz_sales_orders` | `customer` | m2o |  | biz_customers | — | Y | 客户 | shapePatch（schema m2o + 关联列词表） | 名/标签→id |
| 销售回款 | `biz_payments` | `customer` | m2o |  | biz_customers | — | Y | 客户 | shapePatch（schema m2o + 关联列词表） + 图边 客户→销售回款(customer) | 名/标签→id |
| 销售商机 | `biz_opportunities` | `customer` | m2o |  | biz_customers | — | Y | 客户 | shapePatch（schema m2o + 关联列词表） + 图边 客户→销售商机(customer) | 名/标签→id |

### 部门 / department → departments

| 型 | 表 | name | interface | type | target | enum | FK | 词表标题/口语别名 | 现网绑定 | 口语→机器 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| {{t("Departments")}} | `departments` | `parent` | m2o |  | departments | — | Y | {{t("Superior department")}} | shapePatch（schema m2o） + 图边 {{t("Departments")}}→{{t("Departments")}}(parent) | 名/标签→id |
| {{t("Users")}} | `users` | `mainDepartment` | m2o |  | departments | — | Y | {{t("Main department")}} | shapePatch（schema m2o） + 图边 {{t("Departments")}}→{{t("Users")}}(mainDepartment) | 名/标签→id |
| 费用报销 | `biz_expenses` | `department` | m2o |  | departments | — | Y | 所属部门 | shapePatch（schema m2o） | 名/标签→id |
| 岗位 | `biz_positions` | `department` | m2o |  | departments | — | Y | 所属部门 | shapePatch（schema m2o） | 名/标签→id |
| 员工档案 | `biz_employees` | `department` | m2o |  | departments | — | Y | 所属部门 | shapePatch（schema m2o） + 图边 {{t("Departments")}}→员工档案(department) | 名/标签→id |

### 仓库 / warehouse → biz_warehouses

| 型 | 表 | name | interface | type | target | enum | FK | 词表标题/口语别名 | 现网绑定 | 口语→机器 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 采购订单 | `biz_purchase_orders` | `warehouse` | m2o |  | biz_warehouses | — | Y | 收货仓库 | shapePatch（schema m2o） + 图边 仓库→采购订单(warehouse) | 名/标签→id |
| 采购收货单 | `biz_purchase_receipts` | `warehouse` | m2o |  | biz_warehouses | — | Y | 入库仓库 | shapePatch（schema m2o） + 图边 仓库→采购收货单(warehouse) | 名/标签→id |
| 仓库 | `biz_warehouses` | `whType` | select |  | — | 4 | — | 仓库类型 | enum bind（仅 schema 枚举） | label→code |
| 仓库 | `biz_warehouses` | `manager` | m2o |  | biz_employees | — | Y | 仓库管理员 | shapePatch（schema m2o） | 名/标签→id |
| 出入库流水 | `biz_stock_movements` | `warehouse` | m2o |  | biz_warehouses | — | Y | 仓库 | shapePatch（schema m2o） + 图边 仓库→出入库流水(warehouse) | 名/标签→id |
| 库存 | `biz_inventories` | `warehouse` | m2o |  | biz_warehouses | — | Y | 仓库 | shapePatch（schema m2o） | 名/标签→id |
| 生产工单 | `biz_work_orders` | `warehouse` | m2o |  | biz_warehouses | — | Y | 成品入库仓 | shapePatch（schema m2o） | 名/标签→id |
| 生产领料单 | `biz_material_issues` | `warehouse` | m2o |  | biz_warehouses | — | Y | 领出仓库 | shapePatch（schema m2o） + 图边 仓库→生产领料单(warehouse) | 名/标签→id |
| 销售订单 | `biz_sales_orders` | `warehouse` | m2o |  | biz_warehouses | — | Y | 发货仓库 | shapePatch（schema m2o） | 名/标签→id |

### 负责人·归属 / owner

| 型 | 表 | name | interface | type | target | enum | FK | 词表标题/口语别名 | 现网绑定 | 口语→机器 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 采购订单 | `biz_purchase_orders` | `owner` | m2o |  | users | — | Y | 采购员 | shapePatch（schema m2o） + 图边 {{t("Users")}}→采购订单(owner) | 名/标签→id |
| 供应商 | `biz_suppliers` | `owner` | m2o |  | users | — | Y | 负责人 | shapePatch（schema m2o） | 名/标签→id |
| 合同 | `biz_contracts` | `owner` | m2o |  | users | — | Y | 合同负责人 | shapePatch（schema m2o） | 名/标签→id |
| 联系人 | `biz_contacts` | `owner` | m2o |  | users | — | Y | 联系人负责人 | shapePatch（schema m2o） | 名/标签→id |
| 生产工单 | `biz_work_orders` | `owner` | m2o |  | biz_employees | — | Y | 生产负责人 | shapePatch（schema m2o） | 名/标签→id |
| 项目里程碑 | `biz_project_milestones` | `owner` | m2o |  | users | — | Y | 负责人 | shapePatch（schema m2o） | 名/标签→id |
| 销售订单 | `biz_sales_orders` | `owner` | m2o |  | users | — | Y | 订单负责人 | shapePatch（schema m2o） | 名/标签→id |
| 销售商机 | `biz_opportunities` | `owner` | m2o |  | users | — | Y | 商机负责人 | shapePatch（schema m2o） + 图边 {{t("Users")}}→销售商机(owner) | 名/标签→id |
| 销售线索 | `biz_leads` | `owner` | m2o |  | users | — | Y | 线索负责人 | shapePatch（schema m2o） + 图边 {{t("Users")}}→销售线索(owner) | 名/标签→id |

### 供应商 / supplier

| 型 | 表 | name | interface | type | target | enum | FK | 词表标题/口语别名 | 现网绑定 | 口语→机器 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 采购订单 | `biz_purchase_orders` | `supplier` | m2o |  | biz_suppliers | — | Y | 供应商 | shapePatch（schema m2o） + 图边 供应商→采购订单(supplier) | 名/标签→id |
| 采购收货单 | `biz_purchase_receipts` | `supplier` | m2o |  | biz_suppliers | — | Y | 供应商 | shapePatch（schema m2o） + 图边 供应商→采购收货单(supplier) | 名/标签→id |
| 发票 | `biz_invoices` | `supplier` | m2o |  | biz_suppliers | — | Y | 供应商(进项) | shapePatch（schema m2o） | 名/标签→id |
| 付款单 | `biz_payment_vouchers` | `supplier` | m2o |  | biz_suppliers | — | Y | 供应商 | shapePatch（schema m2o） | 名/标签→id |
| 供应商 | `biz_suppliers` | `category` | select |  | — | 4 | — | 供应商类别、故障类、故障、incident、投诉类、投诉、complaint、咨询类、咨询 | enum bind（词表 clues→keys） | label→code |
| 供应商 | `biz_suppliers` | `rating` | select |  | — | 4 | — | 供应商评级 | enum bind（仅 schema 枚举） | label→code |

### 其它外键（m2o）

| 型 | 表 | name | interface | type | target | enum | FK | 词表标题/口语别名 | 现网绑定 | 口语→机器 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 采购订单明细 | `biz_purchase_order_items` | `purchaseOrder` | m2o |  | biz_purchase_orders | — | Y | 采购订单 | shapePatch（schema m2o） + 图边 采购订单→采购订单明细(purchaseOrder) | 名/标签→id |
| 采购订单明细 | `biz_purchase_order_items` | `product` | m2o |  | biz_products | — | Y | 商品 | shapePatch（schema m2o） + 图边 商品物料→采购订单明细(product) | 名/标签→id |
| 采购收货单 | `biz_purchase_receipts` | `purchaseOrder` | m2o |  | biz_purchase_orders | — | Y | 采购订单 | shapePatch（schema m2o） + 图边 采购订单→采购收货单(purchaseOrder) | 名/标签→id |
| 出入库流水 | `biz_stock_movements` | `product` | m2o |  | biz_products | — | Y | 商品 | shapePatch（schema m2o） + 图边 商品物料→出入库流水(product) | 名/标签→id |
| 费用报销 | `biz_expenses` | `applicant` | m2o |  | biz_employees | — | Y | 报销人 | shapePatch（schema m2o） + 图边 员工档案→费用报销(applicant) | 名/标签→id |
| 费用报销 | `biz_expenses` | `approver` | m2o |  | biz_employees | — | Y | 审批人 | shapePatch（schema m2o） + 图边 员工档案→费用报销(approver) | 名/标签→id |
| 付款单 | `biz_payment_vouchers` | `purchaseOrder` | m2o |  | biz_purchase_orders | — | Y | 采购订单 | shapePatch（schema m2o） | 名/标签→id |
| 工单 | `biz_tickets` | `contact` | m2o |  | biz_contacts | — | Y | 联系人 | shapePatch（schema m2o） | 名/标签→id |
| 工单处理记录 | `biz_ticket_logs` | `ticket` | m2o |  | biz_tickets | — | Y | 工单 | shapePatch（schema m2o） + 图边 工单→工单处理记录(ticket) | 名/标签→id |
| 固定资产 | `biz_assets` | `category` | m2o |  | biz_asset_categories | — | Y | 资产分类、故障类、故障、incident、投诉类、投诉、complaint、咨询类、咨询 | shapePatch（schema m2o） | 名/标签→id |
| 固定资产 | `biz_assets` | `custodian` | m2o |  | biz_employees | — | Y | 当前保管人 | shapePatch（schema m2o） | 名/标签→id |
| 合同 | `biz_contracts` | `opportunity` | m2o |  | biz_opportunities | — | Y | 关联商机 | shapePatch（schema m2o） | 名/标签→id |
| 考勤记录 | `biz_attendance_records` | `employee` | m2o |  | biz_employees | — | Y | 员工 | shapePatch（schema m2o） + 图边 员工档案→考勤记录(employee) | 名/标签→id |
| 库存 | `biz_inventories` | `product` | m2o |  | biz_products | — | Y | 商品 | shapePatch（schema m2o） | 名/标签→id |
| 请假申请 | `biz_leave_requests` | `employee` | m2o |  | biz_employees | — | Y | 员工 | shapePatch（schema m2o） + 图边 员工档案→请假申请(employee) | 名/标签→id |
| 请假申请 | `biz_leave_requests` | `approver` | m2o |  | users | — | Y | 审批人 | shapePatch（schema m2o） + 图边 {{t("Users")}}→请假申请(approver) | 名/标签→id |
| 商品分类 | `biz_product_categories` | `parent` | m2o |  | biz_product_categories | — | Y | Parent | shapePatch（schema m2o） | 名/标签→id |
| 商品物料 | `biz_products` | `category` | m2o |  | biz_product_categories | — | Y | 商品分类、故障类、故障、incident、投诉类、投诉、complaint、咨询类、咨询 | shapePatch（schema m2o） + 图边 商品分类→商品物料(category) | 名/标签→id |
| 生产工单 | `biz_work_orders` | `product` | m2o |  | biz_products | — | Y | 产成品 | shapePatch（schema m2o） | 名/标签→id |
| 生产工单 | `biz_work_orders` | `bom` | m2o |  | biz_boms | — | Y | BOM | shapePatch（schema m2o） | 名/标签→id |
| 生产领料单 | `biz_material_issues` | `workOrder` | m2o |  | biz_work_orders | — | Y | 生产工单 | shapePatch（schema m2o） + 图边 生产工单→生产领料单(workOrder) | 名/标签→id |
| 生产领料单 | `biz_material_issues` | `material` | m2o |  | biz_products | — | Y | 原材料 | shapePatch（schema m2o） + 图边 商品物料→生产领料单(material) | 名/标签→id |
| 收货明细 | `biz_purchase_receipt_items` | `receipt` | m2o |  | biz_purchase_receipts | — | Y | 收货单 | shapePatch（schema m2o） | 名/标签→id |
| 收货明细 | `biz_purchase_receipt_items` | `product` | m2o |  | biz_products | — | Y | 商品 | shapePatch（schema m2o） | 名/标签→id |
| 项目 | `biz_projects` | `manager` | m2o |  | users | — | Y | 项目经理 | shapePatch（schema m2o） | 名/标签→id |
| 项目里程碑 | `biz_project_milestones` | `project` | m2o |  | biz_projects | — | Y | 项目 | shapePatch（schema m2o） | 名/标签→id |
| 项目任务 | `biz_project_tasks` | `project` | m2o |  | biz_projects | — | Y | 项目 | shapePatch（schema m2o） | 名/标签→id |
| 销售订单 | `biz_sales_orders` | `contract` | m2o |  | biz_contracts | — | Y | 合同 | shapePatch（schema m2o） | 名/标签→id |
| 销售订单明细 | `biz_sales_order_items` | `salesOrder` | m2o |  | biz_sales_orders | — | Y | 销售订单 | shapePatch（schema m2o） + 图边 销售订单→销售订单明细(salesOrder) | 名/标签→id |
| 销售订单明细 | `biz_sales_order_items` | `product` | m2o |  | biz_products | — | Y | 商品 | shapePatch（schema m2o） + 图边 商品物料→销售订单明细(product) | 名/标签→id |
| 销售回款 | `biz_payments` | `contract` | m2o |  | biz_contracts | — | Y | 合同 | shapePatch（schema m2o） + 图边 销售合同→销售回款(contract) | 名/标签→id |
| 销售回款 | `biz_payments` | `order` | m2o |  | biz_sales_orders | — | Y | 销售订单 | shapePatch（schema m2o） + 图边 销售订单→销售回款(order) | 名/标签→id |
| 销售商机 | `biz_opportunities` | `lead` | m2o |  | biz_leads | — | Y | 来源线索 | shapePatch（schema m2o） + 图边 销售线索→销售商机(lead) | 名/标签→id |
| 员工档案 | `biz_employees` | `position` | m2o |  | biz_positions | — | Y | 岗位 | shapePatch（schema m2o） + 图边 岗位→员工档案(position) | 名/标签→id |
| 员工档案 | `biz_employees` | `user` | m2o |  | users | — | Y | 系统账号 | shapePatch（schema m2o） + 图边 {{t("Users")}}→员工档案(user) | 名/标签→id |
| 员工档案 | `biz_employees` | `manager` | m2o |  | biz_employees | — | Y | 直属上级 | shapePatch（schema m2o） + 图边 员工档案→员工档案(manager) | 名/标签→id |
| 资产分类 | `biz_asset_categories` | `parent` | m2o |  | biz_asset_categories | — | Y | Parent | shapePatch（schema m2o） | 名/标签→id |
| 资产领用归还 | `biz_asset_assignments` | `asset` | m2o |  | biz_assets | — | Y | 资产 | shapePatch（schema m2o） + 图边 固定资产→资产领用归还(asset) | 名/标签→id |
| 资产领用归还 | `biz_asset_assignments` | `employee` | m2o |  | biz_employees | — | Y | 员工 | shapePatch（schema m2o） + 图边 员工档案→资产领用归还(employee) | 名/标签→id |
| BOM明细 | `biz_bom_items` | `bom` | m2o |  | biz_boms | — | Y | BOM | shapePatch（schema m2o） | 名/标签→id |
| BOM明细 | `biz_bom_items` | `material` | m2o |  | biz_products | — | Y | 原材料 | shapePatch（schema m2o） | 名/标签→id |
| BOM物料清单 | `biz_boms` | `product` | m2o |  | biz_products | — | Y | 产成品 | shapePatch（schema m2o） + 图边 商品物料→BOM物料清单(product) | 名/标签→id |

### 其它枚举列

| 型 | 表 | name | interface | type | target | enum | FK | 词表标题/口语别名 | 现网绑定 | 口语→机器 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 出入库流水 | `biz_stock_movements` | `movementType` | select |  | — | 8 | — | 业务类型 | enum bind（仅 schema 枚举） | label→code |
| 出入库流水 | `biz_stock_movements` | `refType` | select |  | — | 6 | — | 来源单据类型 | enum bind（仅 schema 枚举） | label→code |
| 发票 | `biz_invoices` | `invoiceType` | select |  | — | 2 | — | 发票类型 | enum bind（仅 schema 枚举） | label→code |
| 费用报销 | `biz_expenses` | `category` | select |  | — | 7 | — | 费用类别、故障类、故障、incident、投诉类、投诉、complaint、咨询类、咨询 | enum bind（词表 clues→keys） | label→code |
| 付款单 | `biz_payment_vouchers` | `method` | select |  | — | 3 | — | 付款方式 | enum bind（仅 schema 枚举） | label→code |
| 工单 | `biz_tickets` | `category` | select |  | — | 4 | — | 工单类型、故障类、故障、incident、投诉类、投诉、complaint、咨询类、咨询 | enum bind（词表 clues→keys） | label→code |
| 供应商 | `biz_suppliers` | `region` | select |  | — | 7 | — | 所属区域 | enum bind（仅 schema 枚举） | label→code |
| 供应商 | `biz_suppliers` | `paymentTerms` | select |  | — | 4 | — | 付款条件 | enum bind（仅 schema 枚举） | label→code |
| 合同 | `biz_contracts` | `contractType` | select |  | — | 4 | — | 合同类型 | enum bind（仅 schema 枚举） | label→code |
| 客户 | `biz_customers` | `region` | select |  | — | 7 | — | 所属区域 | enum bind（仅 schema 枚举） | label→code |
| 请假申请 | `biz_leave_requests` | `leaveType` | select |  | — | 6 | — | 请假类型 | enum bind（仅 schema 枚举） | label→code |
| 商品物料 | `biz_products` | `unit` | select |  | — | 8 | — | 单位 | enum bind（仅 schema 枚举） | label→code |
| 商品物料 | `biz_products` | `productType` | select |  | — | 4 | — | 物料类型 | enum bind（仅 schema 枚举） | label→code |
| 销售回款 | `biz_payments` | `method` | select |  | — | 4 | — | 回款方式 | enum bind（仅 schema 枚举） | label→code |
| 员工档案 | `biz_employees` | `gender` | select |  | — | 3 | — | 性别 | enum bind（仅 schema 枚举） | label→code |
| 员工档案 | `biz_employees` | `employmentType` | select |  | — | 4 | — | 用工类型 | enum bind（仅 schema 枚举） | label→code |
| 资产领用归还 | `biz_asset_assignments` | `movementType` | select |  | — | 5 | — | 业务类型 | enum bind（仅 schema 枚举） | label→code |

## 分表明细（`writableFieldChoices` 可写列）

### {{t("Departments")}} → `departments`

can：现查、改行、删除、新建；ticketField：`title`
图边：{{t("Departments")}}→{{t("Departments")}}(parent)；{{t("Departments")}}→{{t("Departments")}}(children)；{{t("Departments")}}→{{t("Users")}}(members)；{{t("Departments")}}→{{t("Roles")}}(roles)；{{t("Departments")}}→{{t("Users")}}(owners)；{{t("Departments")}}→费用报销(expenses)

| name | title | interface | type | target | enum | FK/bigint | 须收成机器值 | 现网绑定 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `title` | {{t("Department name")}} | input |  | — | — | — | 否 | — |
| `isLeaf` | isLeaf | boolean |  | — | — | — | 否 | — |
| `parent` | {{t("Superior department")}} | m2o |  | departments | — | FK | 是 | shapePatch（schema m2o） + 图边 {{t("Departments")}}→{{t("Departments")}}(parent) |
| `children` | children | hasMany |  | departments | — | — | 否 | — |
| `members` | members | belongsToMany |  | users | — | — | 否 | — |
| `roles` | {{t("Roles")}} | m2m |  | roles | — | — | 否 | — |
| `owners` | {{t("Owners")}} | m2m |  | users | — | — | 否 | — |
| `sort` | sort | sort |  | — | — | — | 否 | — |
| `expenses` | 报销单 | o2m |  | biz_expenses | — | — | 否 | — |

### {{t("Roles")}} → `roles`

can：现查、改行、删除、新建；ticketField：`name`
图边：{{t("Roles")}}→{{t("Users")}}(users)

| name | title | interface | type | target | enum | FK/bigint | 须收成机器值 | 现网绑定 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `name` | {{t("Role UID")}} | input |  | — | — | — | 否 | — |
| `title` | {{t("Role name")}} | input |  | — | — | — | 否 | — |
| `description` | description | string |  | — | — | — | 否 | — |
| `strategy` | strategy | json |  | — | — | — | 否 | — |
| `default` | default | boolean |  | — | — | — | 否 | — |
| `hidden` | hidden | boolean |  | — | — | — | 否 | — |
| `allowConfigure` | allowConfigure | boolean |  | — | — | — | 否 | — |
| `allowNewMenu` | allowNewMenu | boolean |  | — | — | — | 否 | — |
| `menuUiSchemas` | menuUiSchemas | belongsToMany |  | uiSchemas | — | — | 否 | — |
| `resources` | resources | hasMany |  | dataSourcesRolesResources | — | — | 否 | — |
| `snippets` | snippets | set |  | — | — | — | 否 | — |
| `users` | users | belongsToMany |  | users | — | — | 否 | — |
| `sort` | sort | sort |  | — | — | — | 否 | — |
| `desktopRoutes` | desktopRoutes | belongsToMany |  | desktopRoutes | — | — | 否 | — |
| `mobileRoutes` | mobileRoutes | belongsToMany |  | mobileRoutes | — | — | 否 | — |
| `allowNewMobileMenu` | allowNewMobileMenu | boolean |  | — | — | — | 否 | — |
| `aiEmployees` | aiEmployees | belongsToMany |  | aiEmployees | — | — | 否 | — |
| `allowNewAiEmployee` | allowNewAiEmployee | boolean |  | — | — | — | 否 | — |

### {{t("Users")}} → `users`

can：现查、改行、删除、新建；ticketField：`nickname`
图边：{{t("Users")}}→{{t("Roles")}}(roles)；{{t("Users")}}→{{t("Departments")}}(departments)；{{t("Departments")}}→{{t("Users")}}(mainDepartment)；{{t("Users")}}→供应商(ownedSuppliers)；{{t("Users")}}→采购订单(ownedPurchaseOrders)

| name | title | interface | type | target | enum | FK/bigint | 须收成机器值 | 现网绑定 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `nickname` | {{t("Nickname")}} | input |  | — | — | — | 否 | — |
| `username` | {{t("Username")}} | input |  | — | — | — | 否 | — |
| `email` | {{t("Email")}} | email |  | — | — | — | 否 | — |
| `phone` | {{t("Phone")}} | input |  | — | — | — | 否 | — |
| `password` | {{t("Password")}} | password |  | — | — | — | 否 | — |
| `passwordChangeTz` | passwordChangeTz | bigInt |  | — | — | — | 否 | — |
| `appLang` | appLang | string |  | — | — | — | 否 | — |
| `resetToken` | resetToken | string |  | — | — | — | 否 | — |
| `systemSettings` | systemSettings | json |  | — | — | — | 否 | — |
| `sort` | sort | sort |  | — | — | — | 否 | — |
| `roles` | {{t("Roles")}} | m2m |  | roles | — | — | 否 | — |
| `aiEmployees` | aiEmployees | belongsToMany |  | aiEmployees | — | — | 否 | — |
| `departments` | {{t("Departments")}} | m2m |  | departments | — | — | 否 | — |
| `mainDepartment` | {{t("Main department")}} | m2o |  | departments | — | FK | 是 | shapePatch（schema m2o） + 图边 {{t("Departments")}}→{{t("Users")}}(mainDepartment) |
| `ownedSuppliers` | 负责的供应商 | o2m |  | biz_suppliers | — | — | 否 | — |
| `ownedPurchaseOrders` | 负责的采购订单 | o2m |  | biz_purchase_orders | — | — | 否 | — |

### 采购订单 → `biz_purchase_orders`

can：现查、改行、删除、新建、过审；ticketField：`orderNo`
图边：供应商→采购订单(supplier)；仓库→采购订单(warehouse)；{{t("Users")}}→采购订单(owner)；采购订单→采购订单明细(items)；采购订单→采购收货单(receipts)；采购订单→付款单(paymentVouchers)

| name | title | interface | type | target | enum | FK/bigint | 须收成机器值 | 现网绑定 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `orderNo` | 采购单号 | input |  | — | — | — | 否 | — |
| `orderDate` | 下单日期 | datetime |  | — | — | — | 否 | — |
| `expectedDate` | 期望到货日期 | datetime |  | — | — | — | 否 | — |
| `status` | 订单状态 | select |  | — | Y | — | 是 | enum bind（词表 clues→keys） |
| `totalAmount` | 订单金额 | number |  | — | — | — | 否 | — |
| `taxAmount` | 税额 | number |  | — | — | — | 否 | — |
| `remarks` | 备注 | textarea |  | — | — | — | 否 | — |
| `supplier` | 供应商 | m2o |  | biz_suppliers | — | FK | 是 | shapePatch（schema m2o + 关联列词表） + 图边 供应商→采购订单(supplier) |
| `warehouse` | 收货仓库 | m2o |  | biz_warehouses | — | FK | 是 | shapePatch（schema m2o + 关联列词表） + 图边 仓库→采购订单(warehouse) |
| `owner` | 采购员 | m2o |  | users | — | FK | 是 | shapePatch（schema m2o + 关联列词表） + 图边 {{t("Users")}}→采购订单(owner) |
| `items` | 明细 | o2m |  | biz_purchase_order_items | — | — | 否 | — |
| `receipts` | 收货单 | o2m |  | biz_purchase_receipts | — | — | 否 | — |
| `paymentVouchers` | 付款单 | o2m |  | biz_payment_vouchers | — | — | 否 | — |

### 采购订单明细 → `biz_purchase_order_items`

can：现查、改行、删除、新建；ticketField：`—`
图边：采购订单→采购订单明细(purchaseOrder)；商品物料→采购订单明细(product)

| name | title | interface | type | target | enum | FK/bigint | 须收成机器值 | 现网绑定 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `quantity` | 数量 | number |  | — | — | — | 否 | — |
| `unitPrice` | 采购单价 | number |  | — | — | — | 否 | — |
| `amount` | 金额 | number |  | — | — | — | 否 | — |
| `receivedQty` | 已收数量 | number |  | — | — | — | 否 | — |
| `purchaseOrder` | 采购订单 | m2o |  | biz_purchase_orders | — | FK | 是 | shapePatch（schema m2o） + 图边 采购订单→采购订单明细(purchaseOrder) |
| `product` | 商品 | m2o |  | biz_products | — | FK | 是 | shapePatch（schema m2o） + 图边 商品物料→采购订单明细(product) |

### 采购收货单 → `biz_purchase_receipts`

can：现查、改行、删除、新建、过审；ticketField：`receiptNo`
图边：采购订单→采购收货单(purchaseOrder)；供应商→采购收货单(supplier)；仓库→采购收货单(warehouse)；员工档案→采购收货单(handler)；采购收货单→收货明细(items)

| name | title | interface | type | target | enum | FK/bigint | 须收成机器值 | 现网绑定 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `receiptNo` | 收货单号 | input |  | — | — | — | 否 | — |
| `receiptDate` | 收货日期 | datetime |  | — | — | — | 否 | — |
| `status` | 状态 | select |  | — | Y | — | 是 | enum bind（词表 clues→keys） |
| `remarks` | 备注 | textarea |  | — | — | — | 否 | — |
| `purchaseOrder` | 采购订单 | m2o |  | biz_purchase_orders | — | FK | 是 | shapePatch（schema m2o） + 图边 采购订单→采购收货单(purchaseOrder) |
| `supplier` | 供应商 | m2o |  | biz_suppliers | — | FK | 是 | shapePatch（schema m2o + 关联列词表） + 图边 供应商→采购收货单(supplier) |
| `warehouse` | 入库仓库 | m2o |  | biz_warehouses | — | FK | 是 | shapePatch（schema m2o + 关联列词表） + 图边 仓库→采购收货单(warehouse) |
| `handler` | 经办人 | m2o |  | biz_employees | — | FK | 是 | shapePatch（schema m2o） + 图边 员工档案→采购收货单(handler) |
| `items` | 明细 | o2m |  | biz_purchase_receipt_items | — | — | 否 | — |

### 仓库 → `biz_warehouses`

can：现查、改行、删除；ticketField：`code`

| name | title | interface | type | target | enum | FK/bigint | 须收成机器值 | 现网绑定 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `code` | 仓库编码 | input |  | — | — | — | 否 | — |
| `name` | 仓库名称 | input |  | — | — | — | 否 | — |
| `whType` | 仓库类型 | select |  | — | Y | — | 是 | enum bind（仅 schema 枚举） |
| `location` | 所在地点 | input |  | — | — | — | 否 | — |
| `status` | 状态 | select |  | — | Y | — | 是 | enum bind（词表 clues→keys） |
| `remarks` | 备注 | textarea |  | — | — | — | 否 | — |
| `manager` | 仓库管理员 | m2o |  | biz_employees | — | FK | 是 | shapePatch（schema m2o） |
| `purchaseOrders` | 采购订单 | o2m |  | biz_purchase_orders | — | — | 否 | — |
| `receipts` | 收货单 | o2m |  | biz_purchase_receipts | — | — | 否 | — |
| `inventories` | 库存 | o2m |  | biz_inventories | — | — | 否 | — |
| `stockMovements` | 出入库流水 | o2m |  | biz_stock_movements | — | — | 否 | — |
| `workOrders` | 生产工单 | o2m |  | biz_work_orders | — | — | 否 | — |
| `materialIssues` | 领料单 | o2m |  | biz_material_issues | — | — | 否 | — |
| `salesOrders` | 销售订单 | o2m |  | biz_sales_orders | — | — | 否 | — |

### 出入库流水 → `biz_stock_movements`

can：现查、改行、删除、新建；ticketField：`movementNo`
图边：商品物料→出入库流水(product)；仓库→出入库流水(warehouse)；员工档案→出入库流水(handler)

| name | title | interface | type | target | enum | FK/bigint | 须收成机器值 | 现网绑定 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `movementNo` | 流水单号 | input |  | — | — | — | 否 | — |
| `movementType` | 业务类型 | select |  | — | Y | — | 是 | enum bind（仅 schema 枚举） |
| `quantity` | 数量 | number |  | — | — | — | 否 | — |
| `beforeQty` | 变动前库存 | number |  | — | — | — | 否 | — |
| `afterQty` | 变动后库存 | number |  | — | — | — | 否 | — |
| `refType` | 来源单据类型 | select |  | — | Y | — | 是 | enum bind（仅 schema 枚举） |
| `refNo` | 来源单号 | input |  | — | — | — | 否 | — |
| `occurredAt` | 发生时间 | datetime |  | — | — | — | 否 | — |
| `remarks` | 备注 | textarea |  | — | — | — | 否 | — |
| `product` | 商品 | m2o |  | biz_products | — | FK | 是 | shapePatch（schema m2o） + 图边 商品物料→出入库流水(product) |
| `warehouse` | 仓库 | m2o |  | biz_warehouses | — | FK | 是 | shapePatch（schema m2o + 关联列词表） + 图边 仓库→出入库流水(warehouse) |
| `handler` | 经办人 | m2o |  | biz_employees | — | FK | 是 | shapePatch（schema m2o） + 图边 员工档案→出入库流水(handler) |

### 发票 → `biz_invoices`

can：现查、改行、删除；ticketField：`invoiceNo`

| name | title | interface | type | target | enum | FK/bigint | 须收成机器值 | 现网绑定 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `invoiceNo` | 发票号 | input |  | — | — | — | 否 | — |
| `invoiceType` | 发票类型 | select |  | — | Y | — | 是 | enum bind（仅 schema 枚举） |
| `relatedOrderNo` | 关联单号 | input |  | — | — | — | 否 | — |
| `amount` | 金额(不含税) | number |  | — | — | — | 否 | — |
| `taxRate` | 税率 | percent |  | — | — | — | 否 | — |
| `taxAmount` | 税额 | number |  | — | — | — | 否 | — |
| `totalAmount` | 价税合计 | number |  | — | — | — | 否 | — |
| `issueDate` | 开票日期 | datetime |  | — | — | — | 否 | — |
| `status` | 状态 | select |  | — | Y | — | 是 | enum bind（词表 clues→keys） |
| `remarks` | 备注 | textarea |  | — | — | — | 否 | — |
| `customer` | 客户(销项) | m2o |  | biz_customers | — | FK | 是 | shapePatch（schema m2o） |
| `supplier` | 供应商(进项) | m2o |  | biz_suppliers | — | FK | 是 | shapePatch（schema m2o） |

### 费用报销 → `biz_expenses`

can：现查、改行、删除、新建、过审；ticketField：`expenseNo`
图边：员工档案→费用报销(applicant)；员工档案→费用报销(approver)

| name | title | interface | type | target | enum | FK/bigint | 须收成机器值 | 现网绑定 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `expenseNo` | 报销单号 | input |  | — | — | — | 否 | — |
| `category` | 费用类别 | select |  | — | Y | — | 是 | enum bind（词表 clues→keys） |
| `amount` | 报销金额 | number |  | — | — | — | 否 | — |
| `expenseDate` | 发生日期 | datetime |  | — | — | — | 否 | — |
| `status` | 状态 | select |  | — | Y | — | 是 | enum bind（词表 clues→keys） |
| `paymentDate` | 付款日期 | datetime |  | — | — | — | 否 | — |
| `remarks` | 事由 | textarea |  | — | — | — | 否 | — |
| `applicant` | 报销人 | m2o |  | biz_employees | — | FK | 是 | shapePatch（schema m2o） + 图边 员工档案→费用报销(applicant) |
| `department` | 所属部门 | m2o |  | departments | — | FK | 是 | shapePatch（schema m2o） |
| `approver` | 审批人 | m2o |  | biz_employees | — | FK | 是 | shapePatch（schema m2o） + 图边 员工档案→费用报销(approver) |

### 付款单 → `biz_payment_vouchers`

can：现查、改行、删除、过审；ticketField：`voucherNo`

| name | title | interface | type | target | enum | FK/bigint | 须收成机器值 | 现网绑定 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `voucherNo` | 付款单号 | input |  | — | — | — | 否 | — |
| `amount` | 付款金额 | number |  | — | — | — | 否 | — |
| `paymentDate` | 付款日期 | datetime |  | — | — | — | 否 | — |
| `method` | 付款方式 | select |  | — | Y | — | 是 | enum bind（仅 schema 枚举） |
| `status` | 状态 | select |  | — | Y | — | 是 | enum bind（词表 clues→keys） |
| `remarks` | 备注 | textarea |  | — | — | — | 否 | — |
| `supplier` | 供应商 | m2o |  | biz_suppliers | — | FK | 是 | shapePatch（schema m2o） |
| `purchaseOrder` | 采购订单 | m2o |  | biz_purchase_orders | — | FK | 是 | shapePatch（schema m2o） |
| `handler` | 经办人 | m2o |  | biz_employees | — | FK | 是 | shapePatch（schema m2o） |

### 岗位 → `biz_positions`

can：现查、改行、删除；ticketField：`code`

| name | title | interface | type | target | enum | FK/bigint | 须收成机器值 | 现网绑定 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `name` | 岗位名称 | input |  | — | — | — | 否 | — |
| `code` | 岗位编码 | input |  | — | — | — | 否 | — |
| `grade` | 职级 | input |  | — | — | — | 否 | — |
| `status` | 状态 | select |  | — | Y | — | 是 | enum bind（词表 clues→keys） |
| `description` | 岗位说明 | textarea |  | — | — | — | 否 | — |
| `department` | 所属部门 | m2o |  | departments | — | FK | 是 | shapePatch（schema m2o） |
| `employees` | 员工 | o2m |  | biz_employees | — | — | 否 | — |

### 工单 → `biz_tickets`

can：现查、改行、删除、新建；ticketField：`ticketNo`
图边：客户→工单(customer)

| name | title | interface | type | target | enum | FK/bigint | 须收成机器值 | 现网绑定 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `ticketNo` | 工单编号 | input |  | — | — | — | 否 | — |
| `title` | 工单标题 | input |  | — | — | — | 否 | — |
| `category` | 工单类型 | select |  | — | Y | — | 是 | enum bind（词表 clues→keys） |
| `priority` | 优先级 | select |  | — | Y | — | 是 | enum bind（词表 clues→keys） |
| `status` | 工单状态 | select |  | — | Y | — | 是 | enum bind（词表 clues→keys） |
| `dueAt` | 截止时间 | datetime |  | — | — | — | 否 | — |
| `description` | 问题描述 | textarea |  | — | — | — | 否 | — |
| `customer` | 客户 | m2o |  | biz_customers | — | FK | 是 | shapePatch（schema m2o + 关联列词表） + 图边 客户→工单(customer) |
| `contact` | 联系人 | m2o |  | biz_contacts | — | FK | 是 | shapePatch（schema m2o） |
| `assignee` | 处理人 | m2o |  | users | — | FK | 是 | shapePatch（schema m2o） |
| `logs` | 处理记录 | o2m |  | biz_ticket_logs | — | — | 否 | — |

### 工单处理记录 → `biz_ticket_logs`

can：现查、改行、删除、新建；ticketField：`ticket`
图边：工单→工单处理记录(ticket)；{{t("Users")}}→工单处理记录(author)

| name | title | interface | type | target | enum | FK/bigint | 须收成机器值 | 现网绑定 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `content` | 处理内容 | textarea |  | — | — | — | 否 | — |
| `spentHours` | 耗时小时 | number |  | — | — | — | 否 | — |
| `occurredAt` | 处理时间 | datetime |  | — | — | — | 否 | — |
| `ticket` | 工单 | m2o |  | biz_tickets | — | FK | 是 | shapePatch（schema m2o） + 图边 工单→工单处理记录(ticket) |
| `author` | 处理人 | m2o |  | users | — | FK | 是 | shapePatch（schema m2o） + 图边 {{t("Users")}}→工单处理记录(author) |

### 供应商 → `biz_suppliers`

can：现查、改行、删除；ticketField：`code`

| name | title | interface | type | target | enum | FK/bigint | 须收成机器值 | 现网绑定 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `code` | 供应商编码 | input |  | — | — | — | 否 | — |
| `name` | 供应商名称 | input |  | — | — | — | 否 | — |
| `category` | 供应商类别 | select |  | — | Y | — | 是 | enum bind（词表 clues→keys） |
| `contactPerson` | 联系人 | input |  | — | — | — | 否 | — |
| `phone` | 联系电话 | input |  | — | — | — | 否 | — |
| `email` | 邮箱 | input |  | — | — | — | 否 | — |
| `address` | 地址 | textarea |  | — | — | — | 否 | — |
| `region` | 所属区域 | select |  | — | Y | — | 是 | enum bind（仅 schema 枚举） |
| `paymentTerms` | 付款条件 | select |  | — | Y | — | 是 | enum bind（仅 schema 枚举） |
| `rating` | 供应商评级 | select |  | — | Y | — | 是 | enum bind（仅 schema 枚举） |
| `status` | 状态 | select |  | — | Y | — | 是 | enum bind（词表 clues→keys） |
| `remarks` | 备注 | textarea |  | — | — | — | 否 | — |
| `owner` | 负责人 | m2o |  | users | — | FK | 是 | shapePatch（schema m2o） |
| `purchaseOrders` | 采购订单 | o2m |  | biz_purchase_orders | — | — | 否 | — |
| `receipts` | 收货单 | o2m |  | biz_purchase_receipts | — | — | 否 | — |
| `invoices` | 发票 | o2m |  | biz_invoices | — | — | 否 | — |
| `paymentVouchers` | 付款单 | o2m |  | biz_payment_vouchers | — | — | 否 | — |

### 固定资产 → `biz_assets`

can：现查、改行、删除；ticketField：`assetNo`

| name | title | interface | type | target | enum | FK/bigint | 须收成机器值 | 现网绑定 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `assetNo` | 资产编号 | input |  | — | — | — | 否 | — |
| `name` | 资产名称 | input |  | — | — | — | 否 | — |
| `brand` | 品牌 | input |  | — | — | — | 否 | — |
| `model` | 规格型号 | input |  | — | — | — | 否 | — |
| `status` | 资产状态 | select |  | — | Y | — | 是 | enum bind（词表 clues→keys） |
| `purchaseDate` | 购置日期 | dateOnly |  | — | — | — | 否 | — |
| `purchaseAmount` | 购置金额 | number |  | — | — | — | 否 | — |
| `storageLocation` | 存放地点 | input |  | — | — | — | 否 | — |
| `notes` | 备注 | textarea |  | — | — | — | 否 | — |
| `category` | 资产分类 | m2o |  | biz_asset_categories | — | FK | 是 | shapePatch（schema m2o） |
| `custodian` | 当前保管人 | m2o |  | biz_employees | — | FK | 是 | shapePatch（schema m2o） |
| `assignments` | 领用归还记录 | o2m |  | biz_asset_assignments | — | — | 否 | — |

### 合同 → `biz_contracts`

can：现查、改行、删除、新建、过审；ticketField：`contractNo`
图边：销售合同→销售回款(payments)

| name | title | interface | type | target | enum | FK/bigint | 须收成机器值 | 现网绑定 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `contractNo` | 合同编号 | input |  | — | — | — | 否 | — |
| `title` | 合同名称 | input |  | — | — | — | 否 | — |
| `contractType` | 合同类型 | select |  | — | Y | — | 是 | enum bind（仅 schema 枚举） |
| `status` | 合同状态 | select |  | — | Y | — | 是 | enum bind（词表 clues→keys） |
| `amount` | 合同金额 | number |  | — | — | — | 否 | — |
| `signDate` | 签署日期 | date |  | — | — | — | 否 | — |
| `startDate` | 开始日期 | date |  | — | — | — | 否 | — |
| `endDate` | 结束日期 | date |  | — | — | — | 否 | — |
| `notes` | 备注 | textarea |  | — | — | — | 否 | — |
| `customer` | 客户 | m2o |  | biz_customers | — | FK | 是 | shapePatch（schema m2o） |
| `opportunity` | 关联商机 | m2o |  | biz_opportunities | — | FK | 是 | shapePatch（schema m2o） |
| `owner` | 合同负责人 | m2o |  | users | — | FK | 是 | shapePatch（schema m2o） |
| `salesOrders` | 销售订单 | o2m |  | biz_sales_orders | — | — | 否 | — |
| `payments` | 回款 | o2m |  | biz_payments | — | — | 否 | — |

### 考勤记录 → `biz_attendance_records`

can：现查、改行、删除、新建、过审；ticketField：`—`
图边：员工档案→考勤记录(employee)

| name | title | interface | type | target | enum | FK/bigint | 须收成机器值 | 现网绑定 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `workDate` | 考勤日期 | dateOnly |  | — | — | — | 否 | — |
| `checkInAt` | 上班打卡 | datetime |  | — | — | — | 否 | — |
| `checkOutAt` | 下班打卡 | datetime |  | — | — | — | 否 | — |
| `status` | 考勤状态 | select |  | — | Y | — | 是 | enum bind（词表 clues→keys） |
| `notes` | 备注 | textarea |  | — | — | — | 否 | — |
| `employee` | 员工 | m2o |  | biz_employees | — | FK | 是 | shapePatch（schema m2o） + 图边 员工档案→考勤记录(employee) |

### 客户 → `biz_customers`

can：现查、改行、删除；ticketField：`code`

| name | title | interface | type | target | enum | FK/bigint | 须收成机器值 | 现网绑定 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `name` | 客户名称 | input |  | — | — | — | 否 | — |
| `code` | 客户编号 | input |  | — | — | — | 否 | — |
| `customerType` | 客户类型 | select |  | — | Y | — | 是 | enum bind（仅 schema 枚举） |
| `level` | 客户等级 | select |  | — | Y | — | 是 | enum bind（仅 schema 枚举） |
| `status` | 客户状态 | select |  | — | Y | — | 是 | enum bind（词表 clues→keys） |
| `industry` | 所属行业 | input |  | — | — | — | 否 | — |
| `source` | 客户来源 | input |  | — | — | — | 否 | — |
| `phone` | 联系电话 | phone |  | — | — | — | 否 | — |
| `email` | 邮箱 | email |  | — | — | — | 否 | — |
| `address` | 地址 | textarea |  | — | — | — | 否 | — |
| `notes` | 备注 | textarea |  | — | — | — | 否 | — |
| `owner` | 客户负责人 | m2o |  | users | — | FK | 是 | shapePatch（schema m2o） |
| `contacts` | 联系人 | o2m |  | biz_contacts | — | — | 否 | — |
| `opportunities` | 商机 | o2m |  | biz_opportunities | — | — | 否 | — |
| `contracts` | 合同 | o2m |  | biz_contracts | — | — | 否 | — |
| `salesOrders` | 销售订单 | o2m |  | biz_sales_orders | — | — | 否 | — |
| `tickets` | 工单 | o2m |  | biz_tickets | — | — | 否 | — |
| `projects` | 项目 | o2m |  | biz_projects | — | — | 否 | — |
| `invoices` | 发票 | o2m |  | biz_invoices | — | — | 否 | — |
| `region` | 所属区域 | select |  | — | Y | — | 是 | enum bind（仅 schema 枚举） |

### 库存 → `biz_inventories`

can：现查、改行、删除；ticketField：`id`

| name | title | interface | type | target | enum | FK/bigint | 须收成机器值 | 现网绑定 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `quantity` | 库存数量 | number |  | — | — | — | 否 | — |
| `lockedQty` | 锁定数量 | number |  | — | — | — | 否 | — |
| `availableQty` | 可用数量 | number |  | — | — | — | 否 | — |
| `product` | 商品 | m2o |  | biz_products | — | FK | 是 | shapePatch（schema m2o） |
| `warehouse` | 仓库 | m2o |  | biz_warehouses | — | FK | 是 | shapePatch（schema m2o） |

### 联系人 → `biz_contacts`

can：现查、改行、删除；ticketField：`name`

| name | title | interface | type | target | enum | FK/bigint | 须收成机器值 | 现网绑定 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `name` | 姓名 | input |  | — | — | — | 否 | — |
| `position` | 职务 | input |  | — | — | — | 否 | — |
| `mobile` | 手机 | phone |  | — | — | — | 否 | — |
| `email` | 邮箱 | email |  | — | — | — | 否 | — |
| `isPrimary` | 主要联系人 | checkbox |  | — | — | — | 否 | — |
| `wechat` | 微信 | input |  | — | — | — | 否 | — |
| `notes` | 备注 | textarea |  | — | — | — | 否 | — |
| `customer` | 所属客户 | m2o |  | biz_customers | — | FK | 是 | shapePatch（schema m2o） |
| `owner` | 联系人负责人 | m2o |  | users | — | FK | 是 | shapePatch（schema m2o） |

### 请假申请 → `biz_leave_requests`

can：现查、改行、删除、新建、过审；ticketField：`requestNo`
图边：员工档案→请假申请(employee)；{{t("Users")}}→请假申请(approver)

| name | title | interface | type | target | enum | FK/bigint | 须收成机器值 | 现网绑定 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `requestNo` | 申请编号 | input |  | — | — | — | 否 | — |
| `leaveType` | 请假类型 | select |  | — | Y | — | 是 | enum bind（仅 schema 枚举） |
| `startAt` | 开始时间 | datetime |  | — | — | — | 否 | — |
| `endAt` | 结束时间 | datetime |  | — | — | — | 否 | — |
| `days` | 请假天数 | number |  | — | — | — | 否 | — |
| `status` | 审批状态 | select |  | — | Y | — | 是 | enum bind（词表 clues→keys） |
| `reason` | 请假原因 | textarea |  | — | — | — | 否 | — |
| `employee` | 员工 | m2o |  | biz_employees | — | FK | 是 | shapePatch（schema m2o） + 图边 员工档案→请假申请(employee) |
| `approver` | 审批人 | m2o |  | users | — | FK | 是 | shapePatch（schema m2o） + 图边 {{t("Users")}}→请假申请(approver) |

### 商品分类 → `biz_product_categories`

can：现查、改行、删除；ticketField：`code`

| name | title | interface | type | target | enum | FK/bigint | 须收成机器值 | 现网绑定 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `parent` | Parent | m2o |  | biz_product_categories | — | FK | 是 | shapePatch（schema m2o） |
| `children` | Children | o2m |  | biz_product_categories | — | — | 否 | — |
| `code` | 分类编码 | input |  | — | — | — | 否 | — |
| `name` | 分类名称 | input |  | — | — | — | 否 | — |
| `description` | 说明 | textarea |  | — | — | — | 否 | — |
| `products` | 商品 | o2m |  | biz_products | — | — | 否 | — |

### 商品物料 → `biz_products`

can：现查、改行、删除、新建、过审；ticketField：`code`
图边：商品分类→商品物料(category)；商品物料→采购订单明细(purchaseOrderItems)；商品物料→收货明细(receiptItems)；商品物料→库存(inventories)；商品物料→出入库流水(stockMovements)；商品物料→BOM物料清单(boms)；商品物料→BOM明细(bomItems)；商品物料→生产工单(workOrders)；商品物料→生产领料单(materialIssues)；商品物料→销售订单明细(salesOrderItems)

| name | title | interface | type | target | enum | FK/bigint | 须收成机器值 | 现网绑定 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `code` | 商品编码 | input |  | — | — | — | 否 | — |
| `name` | 商品名称 | input |  | — | — | — | 否 | — |
| `spec` | 规格型号 | input |  | — | — | — | 否 | — |
| `brand` | 品牌 | input |  | — | — | — | 否 | — |
| `unit` | 单位 | select |  | — | Y | — | 是 | enum bind（仅 schema 枚举） |
| `productType` | 物料类型 | select |  | — | Y | — | 是 | enum bind（仅 schema 枚举） |
| `salePrice` | 销售单价 | number |  | — | — | — | 否 | — |
| `costPrice` | 成本单价 | number |  | — | — | — | 否 | — |
| `taxRate` | 税率 | percent |  | — | — | — | 否 | — |
| `safetyStock` | 安全库存 | integer |  | — | — | — | 否 | — |
| `status` | 状态 | select |  | — | Y | — | 是 | enum bind（词表 clues→keys） |
| `remarks` | 备注 | textarea |  | — | — | — | 否 | — |
| `category` | 商品分类 | m2o |  | biz_product_categories | — | FK | 是 | shapePatch（schema m2o） + 图边 商品分类→商品物料(category) |
| `purchaseOrderItems` | 采购明细 | o2m |  | biz_purchase_order_items | — | — | 否 | — |
| `receiptItems` | 收货明细 | o2m |  | biz_purchase_receipt_items | — | — | 否 | — |
| `inventories` | 库存 | o2m |  | biz_inventories | — | — | 否 | — |
| `stockMovements` | 出入库流水 | o2m |  | biz_stock_movements | — | — | 否 | — |
| `boms` | BOM | o2m |  | biz_boms | — | — | 否 | — |
| `bomItems` | BOM用料 | o2m |  | biz_bom_items | — | — | 否 | — |
| `workOrders` | 生产工单 | o2m |  | biz_work_orders | — | — | 否 | — |
| `materialIssues` | 领料记录 | o2m |  | biz_material_issues | — | — | 否 | — |
| `salesOrderItems` | 销售明细 | o2m |  | biz_sales_order_items | — | — | 否 | — |

### 生产工单 → `biz_work_orders`

can：现查、改行、删除；ticketField：`workOrderNo`

| name | title | interface | type | target | enum | FK/bigint | 须收成机器值 | 现网绑定 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `workOrderNo` | 工单号 | input |  | — | — | — | 否 | — |
| `plannedQty` | 计划数量 | number |  | — | — | — | 否 | — |
| `producedQty` | 已产数量 | number |  | — | — | — | 否 | — |
| `qualifiedQty` | 合格数量 | number |  | — | — | — | 否 | — |
| `status` | 状态 | select |  | — | Y | — | 是 | enum bind（词表 clues→keys） |
| `planStartDate` | 计划开工 | datetime |  | — | — | — | 否 | — |
| `planEndDate` | 计划完工 | datetime |  | — | — | — | 否 | — |
| `actualEndDate` | 实际完工 | datetime |  | — | — | — | 否 | — |
| `remarks` | 备注 | textarea |  | — | — | — | 否 | — |
| `product` | 产成品 | m2o |  | biz_products | — | FK | 是 | shapePatch（schema m2o） |
| `bom` | BOM | m2o |  | biz_boms | — | FK | 是 | shapePatch（schema m2o） |
| `warehouse` | 成品入库仓 | m2o |  | biz_warehouses | — | FK | 是 | shapePatch（schema m2o） |
| `owner` | 生产负责人 | m2o |  | biz_employees | — | FK | 是 | shapePatch（schema m2o） |
| `materialIssues` | 领料单 | o2m |  | biz_material_issues | — | — | 否 | — |

### 生产领料单 → `biz_material_issues`

can：现查、改行、删除、新建；ticketField：`issueNo`
图边：生产工单→生产领料单(workOrder)；商品物料→生产领料单(material)；仓库→生产领料单(warehouse)；员工档案→生产领料单(handler)

| name | title | interface | type | target | enum | FK/bigint | 须收成机器值 | 现网绑定 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `issueNo` | 领料单号 | input |  | — | — | — | 否 | — |
| `quantity` | 领用数量 | number |  | — | — | — | 否 | — |
| `issueDate` | 领料日期 | datetime |  | — | — | — | 否 | — |
| `workOrder` | 生产工单 | m2o |  | biz_work_orders | — | FK | 是 | shapePatch（schema m2o） + 图边 生产工单→生产领料单(workOrder) |
| `material` | 原材料 | m2o |  | biz_products | — | FK | 是 | shapePatch（schema m2o） + 图边 商品物料→生产领料单(material) |
| `warehouse` | 领出仓库 | m2o |  | biz_warehouses | — | FK | 是 | shapePatch（schema m2o + 关联列词表） + 图边 仓库→生产领料单(warehouse) |
| `handler` | 经办人 | m2o |  | biz_employees | — | FK | 是 | shapePatch（schema m2o） + 图边 员工档案→生产领料单(handler) |

### 收货明细 → `biz_purchase_receipt_items`

can：现查、改行、删除；ticketField：`id`

| name | title | interface | type | target | enum | FK/bigint | 须收成机器值 | 现网绑定 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `quantity` | 收货数量 | number |  | — | — | — | 否 | — |
| `qualifiedQty` | 合格数量 | number |  | — | — | — | 否 | — |
| `receipt` | 收货单 | m2o |  | biz_purchase_receipts | — | FK | 是 | shapePatch（schema m2o） |
| `product` | 商品 | m2o |  | biz_products | — | FK | 是 | shapePatch（schema m2o） |

### 项目 → `biz_projects`

can：现查、改行、删除；ticketField：`code`

| name | title | interface | type | target | enum | FK/bigint | 须收成机器值 | 现网绑定 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `code` | 项目编号 | input |  | — | — | — | 否 | — |
| `name` | 项目名称 | input |  | — | — | — | 否 | — |
| `status` | 项目状态 | select |  | — | Y | — | 是 | enum bind（词表 clues→keys） |
| `priority` | 优先级 | select |  | — | Y | — | 是 | enum bind（词表 clues→keys） |
| `startDate` | 开始日期 | dateOnly |  | — | — | — | 否 | — |
| `endDate` | 结束日期 | dateOnly |  | — | — | — | 否 | — |
| `budget` | 预算 | number |  | — | — | — | 否 | — |
| `description` | 项目说明 | textarea |  | — | — | — | 否 | — |
| `customer` | 客户 | m2o |  | biz_customers | — | FK | 是 | shapePatch（schema m2o） |
| `manager` | 项目经理 | m2o |  | users | — | FK | 是 | shapePatch（schema m2o） |
| `tasks` | 任务 | o2m |  | biz_project_tasks | — | — | 否 | — |
| `milestones` | 里程碑 | o2m |  | biz_project_milestones | — | — | 否 | — |

### 项目里程碑 → `biz_project_milestones`

can：现查、改行、删除；ticketField：`name`

| name | title | interface | type | target | enum | FK/bigint | 须收成机器值 | 现网绑定 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `name` | 里程碑名称 | input |  | — | — | — | 否 | — |
| `dueDate` | 计划完成日期 | dateOnly |  | — | — | — | 否 | — |
| `status` | 里程碑状态 | select |  | — | Y | — | 是 | enum bind（词表 clues→keys） |
| `notes` | 备注 | textarea |  | — | — | — | 否 | — |
| `project` | 项目 | m2o |  | biz_projects | — | FK | 是 | shapePatch（schema m2o） |
| `owner` | 负责人 | m2o |  | users | — | FK | 是 | shapePatch（schema m2o） |

### 项目任务 → `biz_project_tasks`

can：现查、改行、删除；ticketField：`title`

| name | title | interface | type | target | enum | FK/bigint | 须收成机器值 | 现网绑定 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `title` | 任务标题 | input |  | — | — | — | 否 | — |
| `status` | 任务状态 | select |  | — | Y | — | 是 | enum bind（词表 clues→keys） |
| `priority` | 优先级 | select |  | — | Y | — | 是 | enum bind（词表 clues→keys） |
| `startDate` | 开始日期 | dateOnly |  | — | — | — | 否 | — |
| `dueDate` | 截止日期 | dateOnly |  | — | — | — | 否 | — |
| `progress` | 进度百分比 | integer |  | — | — | — | 否 | — |
| `description` | 任务说明 | textarea |  | — | — | — | 否 | — |
| `project` | 项目 | m2o |  | biz_projects | — | FK | 是 | shapePatch（schema m2o） |
| `assignee` | 负责人 | m2o |  | users | — | FK | 是 | shapePatch（schema m2o） |

### 销售订单 → `biz_sales_orders`

can：现查、改行、删除；ticketField：`orderNo`
图边：销售合同→销售订单(salesOrders)；销售订单→销售订单明细(salesOrder)；销售订单→销售回款(order)

| name | title | interface | type | target | enum | FK/bigint | 须收成机器值 | 现网绑定 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `orderNo` | 订单编号 | input |  | — | — | — | 否 | — |
| `status` | 订单状态 | select |  | — | Y | — | 是 | enum bind（词表 clues→keys） |
| `orderDate` | 下单日期 | date |  | — | — | — | 否 | — |
| `totalAmount` | 订单金额 | number |  | — | — | — | 否 | — |
| `deliveryDate` | 预计交付日期 | date |  | — | — | — | 否 | — |
| `remarks` | 备注 | textarea |  | — | — | — | 否 | — |
| `customer` | 客户 | m2o |  | biz_customers | — | FK | 是 | shapePatch（schema m2o） |
| `contract` | 合同 | m2o |  | biz_contracts | — | FK | 是 | shapePatch（schema m2o） |
| `owner` | 订单负责人 | m2o |  | users | — | FK | 是 | shapePatch（schema m2o） |
| `payments` | 回款 | o2m |  | biz_payments | — | — | 否 | — |
| `items` | 订单明细 | o2m |  | biz_sales_order_items | — | — | 否 | — |
| `warehouse` | 发货仓库 | m2o |  | biz_warehouses | — | FK | 是 | shapePatch（schema m2o） |

### 销售订单明细 → `biz_sales_order_items`

can：现查、改行、删除、新建；ticketField：`—`
图边：销售订单→销售订单明细(salesOrder)；商品物料→销售订单明细(product)

| name | title | interface | type | target | enum | FK/bigint | 须收成机器值 | 现网绑定 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `quantity` | 数量 | number |  | — | — | — | 否 | — |
| `unitPrice` | 销售单价 | number |  | — | — | — | 否 | — |
| `amount` | 金额 | number |  | — | — | — | 否 | — |
| `cost` | 成本 | number |  | — | — | — | 否 | — |
| `salesOrder` | 销售订单 | m2o |  | biz_sales_orders | — | FK | 是 | shapePatch（schema m2o） + 图边 销售订单→销售订单明细(salesOrder) |
| `product` | 商品 | m2o |  | biz_products | — | FK | 是 | shapePatch（schema m2o） + 图边 商品物料→销售订单明细(product) |

### 销售回款 → `biz_payments`

can：现查、改行、删除、新建、过审；ticketField：`paymentNo`
图边：客户→销售回款(customer)；销售合同→销售回款(contract)；销售订单→销售回款(order)

| name | title | interface | type | target | enum | FK/bigint | 须收成机器值 | 现网绑定 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `paymentNo` | 回款编号 | input |  | — | — | — | 否 | — |
| `amount` | 回款金额 | number |  | — | — | — | 否 | — |
| `paymentDate` | 回款日期 | dateOnly |  | — | — | — | 否 | — |
| `method` | 回款方式 | select |  | — | Y | — | 是 | enum bind（仅 schema 枚举） |
| `status` | 回款状态 | select |  | — | Y | — | 是 | enum bind（词表 clues→keys） |
| `remarks` | 备注 | textarea |  | — | — | — | 否 | — |
| `customer` | 客户 | m2o |  | biz_customers | — | FK | 是 | shapePatch（schema m2o + 关联列词表） + 图边 客户→销售回款(customer) |
| `contract` | 合同 | m2o |  | biz_contracts | — | FK | 是 | shapePatch（schema m2o） + 图边 销售合同→销售回款(contract) |
| `order` | 销售订单 | m2o |  | biz_sales_orders | — | FK | 是 | shapePatch（schema m2o） + 图边 销售订单→销售回款(order) |

### 销售商机 → `biz_opportunities`

can：现查、改行、删除、新建；ticketField：`name`
图边：客户→销售商机(customer)；销售线索→销售商机(lead)；{{t("Users")}}→销售商机(owner)

| name | title | interface | type | target | enum | FK/bigint | 须收成机器值 | 现网绑定 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `name` | 商机名称 | input |  | — | — | — | 否 | — |
| `stage` | 销售阶段 | select |  | — | Y | — | 是 | enum bind（词表 clues→keys） |
| `amount` | 预计金额 | number |  | — | — | — | 否 | — |
| `probability` | 赢单概率 | integer |  | — | — | — | 否 | — |
| `expectedCloseDate` | 预计成交日期 | dateOnly |  | — | — | — | 否 | — |
| `competitor` | 竞争对手 | input |  | — | — | — | 否 | — |
| `notes` | 备注 | textarea |  | — | — | — | 否 | — |
| `customer` | 客户 | m2o |  | biz_customers | — | FK | 是 | shapePatch（schema m2o + 关联列词表） + 图边 客户→销售商机(customer) |
| `lead` | 来源线索 | m2o |  | biz_leads | — | FK | 是 | shapePatch（schema m2o） + 图边 销售线索→销售商机(lead) |
| `owner` | 商机负责人 | m2o |  | users | — | FK | 是 | shapePatch（schema m2o + 关联列词表） + 图边 {{t("Users")}}→销售商机(owner) |

### 销售线索 → `biz_leads`

can：现查、改行、删除、新建、过审；ticketField：`name`
图边：{{t("Users")}}→销售线索(owner)

| name | title | interface | type | target | enum | FK/bigint | 须收成机器值 | 现网绑定 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `name` | 线索名称 | input |  | — | — | — | 否 | — |
| `company` | 公司名称 | input |  | — | — | — | 否 | — |
| `source` | 线索来源 | input |  | — | — | — | 否 | — |
| `status` | 线索状态 | select |  | — | Y | — | 是 | enum bind（词表 clues→keys） |
| `phone` | 联系电话 | phone |  | — | — | — | 否 | — |
| `email` | 邮箱 | email |  | — | — | — | 否 | — |
| `nextFollowAt` | 下次跟进时间 | datetime |  | — | — | — | 否 | — |
| `notes` | 备注 | textarea |  | — | — | — | 否 | — |
| `owner` | 线索负责人 | m2o |  | users | — | FK | 是 | shapePatch（schema m2o + 关联列词表） + 图边 {{t("Users")}}→销售线索(owner) |

### 员工档案 → `biz_employees`

can：现查、改行、删除、新建、过审；ticketField：`employeeNo`
图边：{{t("Departments")}}→员工档案(department)；岗位→员工档案(position)；{{t("Users")}}→员工档案(user)；员工档案→员工档案(manager)；员工档案→员工档案(subordinates)；员工档案→考勤记录(attendanceRecords)；员工档案→请假申请(leaveRequests)；员工档案→仓库(managedWarehouses)；员工档案→采购收货单(handledReceipts)；员工档案→出入库流水(handledMovements)；员工档案→费用报销(expenses)；员工档案→费用报销(approvedExpenses)；员工档案→付款单(handledVouchers)；员工档案→生产工单(workOrders)；员工档案→生产领料单(handledIssues)

| name | title | interface | type | target | enum | FK/bigint | 须收成机器值 | 现网绑定 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `employeeNo` | 员工编号 | input |  | — | — | — | 否 | — |
| `name` | 姓名 | input |  | — | — | — | 否 | — |
| `gender` | 性别 | select |  | — | Y | — | 是 | enum bind（仅 schema 枚举） |
| `status` | 在职状态 | select |  | — | Y | — | 是 | enum bind（词表 clues→keys） |
| `phone` | 手机号 | phone |  | — | — | — | 否 | — |
| `email` | 邮箱 | email |  | — | — | — | 否 | — |
| `hireDate` | 入职日期 | dateOnly |  | — | — | — | 否 | — |
| `employmentType` | 用工类型 | select |  | — | Y | — | 是 | enum bind（仅 schema 枚举） |
| `remarks` | 备注 | textarea |  | — | — | — | 否 | — |
| `department` | 所属部门 | m2o |  | departments | — | FK | 是 | shapePatch（schema m2o） + 图边 {{t("Departments")}}→员工档案(department) |
| `position` | 岗位 | m2o |  | biz_positions | — | FK | 是 | shapePatch（schema m2o） + 图边 岗位→员工档案(position) |
| `user` | 系统账号 | m2o |  | users | — | FK | 是 | shapePatch（schema m2o） + 图边 {{t("Users")}}→员工档案(user) |
| `manager` | 直属上级 | m2o |  | biz_employees | — | FK | 是 | shapePatch（schema m2o） + 图边 员工档案→员工档案(manager) |
| `subordinates` | 下属 | o2m |  | biz_employees | — | — | 否 | — |
| `attendanceRecords` | 考勤记录 | o2m |  | biz_attendance_records | — | — | 否 | — |
| `leaveRequests` | 请假申请 | o2m |  | biz_leave_requests | — | — | 否 | — |
| `managedWarehouses` | 管理的仓库 | o2m |  | biz_warehouses | — | — | 否 | — |
| `handledReceipts` | 经办收货单 | o2m |  | biz_purchase_receipts | — | — | 否 | — |
| `handledMovements` | 经办流水 | o2m |  | biz_stock_movements | — | — | 否 | — |
| `expenses` | 报销单 | o2m |  | biz_expenses | — | — | 否 | — |
| `approvedExpenses` | 审批的报销单 | o2m |  | biz_expenses | — | — | 否 | — |
| `handledVouchers` | 经办付款单 | o2m |  | biz_payment_vouchers | — | — | 否 | — |
| `workOrders` | 负责的工单 | o2m |  | biz_work_orders | — | — | 否 | — |
| `handledIssues` | 经办领料单 | o2m |  | biz_material_issues | — | — | 否 | — |

### 资产分类 → `biz_asset_categories`

can：现查、改行、删除；ticketField：`code`

| name | title | interface | type | target | enum | FK/bigint | 须收成机器值 | 现网绑定 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `parent` | Parent | m2o |  | biz_asset_categories | — | FK | 是 | shapePatch（schema m2o） |
| `children` | Children | o2m |  | biz_asset_categories | — | — | 否 | — |
| `title` | 分类名称 | input |  | — | — | — | 否 | — |
| `code` | 分类编码 | input |  | — | — | — | 否 | — |
| `description` | 说明 | textarea |  | — | — | — | 否 | — |
| `assets` | 资产 | o2m |  | biz_assets | — | — | 否 | — |

### 资产领用归还 → `biz_asset_assignments`

can：现查、改行、删除、新建、过审；ticketField：`assignmentNo`
图边：固定资产→资产领用归还(asset)；员工档案→资产领用归还(employee)；{{t("Users")}}→资产领用归还(handler)

| name | title | interface | type | target | enum | FK/bigint | 须收成机器值 | 现网绑定 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `assignmentNo` | 单据编号 | input |  | — | — | — | 否 | — |
| `movementType` | 业务类型 | select |  | — | Y | — | 是 | enum bind（仅 schema 枚举） |
| `status` | 处理状态 | select |  | — | Y | — | 是 | enum bind（词表 clues→keys） |
| `handledAt` | 处理时间 | datetime |  | — | — | — | 否 | — |
| `notes` | 备注 | textarea |  | — | — | — | 否 | — |
| `asset` | 资产 | m2o |  | biz_assets | — | FK | 是 | shapePatch（schema m2o） + 图边 固定资产→资产领用归还(asset) |
| `employee` | 员工 | m2o |  | biz_employees | — | FK | 是 | shapePatch（schema m2o） + 图边 员工档案→资产领用归还(employee) |
| `handler` | 经办人 | m2o |  | users | — | FK | 是 | shapePatch（schema m2o） + 图边 {{t("Users")}}→资产领用归还(handler) |

### BOM明细 → `biz_bom_items`

can：现查、改行、删除；ticketField：`id`

| name | title | interface | type | target | enum | FK/bigint | 须收成机器值 | 现网绑定 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `quantity` | 用量 | number |  | — | — | — | 否 | — |
| `unit` | 单位 | input |  | — | — | — | 否 | — |
| `lossRate` | 损耗率 | percent |  | — | — | — | 否 | — |
| `bom` | BOM | m2o |  | biz_boms | — | FK | 是 | shapePatch（schema m2o） |
| `material` | 原材料 | m2o |  | biz_products | — | FK | 是 | shapePatch（schema m2o） |

### BOM物料清单 → `biz_boms`

can：现查、改行、删除、新建、过审；ticketField：`bomNo`
图边：商品物料→BOM物料清单(product)；BOM物料清单→BOM明细(items)；BOM物料清单→生产工单(workOrders)

| name | title | interface | type | target | enum | FK/bigint | 须收成机器值 | 现网绑定 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `bomNo` | BOM编号 | input |  | — | — | — | 否 | — |
| `version` | 版本 | input |  | — | — | — | 否 | — |
| `outputQty` | 产出数量 | number |  | — | — | — | 否 | — |
| `status` | 状态 | select |  | — | Y | — | 是 | enum bind（词表 clues→keys） |
| `remarks` | 备注 | textarea |  | — | — | — | 否 | — |
| `product` | 产成品 | m2o |  | biz_products | — | FK | 是 | shapePatch（schema m2o） + 图边 商品物料→BOM物料清单(product) |
| `items` | 明细 | o2m |  | biz_bom_items | — | — | 否 | — |
| `workOrders` | 生产工单 | o2m |  | biz_work_orders | — | — | 否 | — |

## 与 biz-write-eval 的对应

| 编号 | 写槽 |
| --- | --- |
| W1–W5 新建 | 各型 `writableFieldChoices`；FK/枚举见上表 |
| W6–W10 改行 | 单列 patch；状态/优先级走 enum bind |
| W16–W20 过审 | **费用报销** `biz_expenses.status`（非图谱「报销单」） |
| W21 问卡 | 客户 `name` 歧义（现查）；改备注为文本列 |

## 收口备注

- `spoken.json`「关联列」仅列：customer、supplier、contact、owner、assignee、warehouse；其余 m2o 仅靠 schema 触发 shapePatch。
- 处理人 `assignee`→`users` 已接 shapePatch（见 `internal/handler-bigint-fix.md`）；解析失败不得写入字符串。
- `*Id` 列被 `writableFieldChoices` 排除，但模型若写 `customerId` 仍会 `resolveRelatedId`。
