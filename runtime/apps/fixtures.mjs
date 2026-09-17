/** @type {import('./spec.mjs').FdeAppSpec} */
export const SUPPLIER_VISITS_SPEC = {
  spec: 'fde-app/v1',
  slug: 'supplier-visits',
  name: '供应商拜访台账',
  description: '记录供应商拜访计划与跟进',
  entities: [
    {
      name: 'visit',
      label: '拜访记录',
      titleField: 'summary',
      fields: [
        { name: 'supplier', label: '供应商', type: 'text', required: true },
        { name: 'visit_date', label: '日期', type: 'date', required: true },
        { name: 'summary', label: '摘要', type: 'longtext' },
        {
          name: 'status',
          label: '状态',
          type: 'enum',
          required: true,
          options: ['计划', '已拜访', '需跟进'],
        },
      ],
    },
  ],
  views: [
    {
      id: 'table-main',
      type: 'table',
      entity: 'visit',
      label: '列表',
      columns: ['supplier', 'visit_date', 'summary', 'status'],
      filters: ['supplier', 'status'],
      sort: { field: 'visit_date', dir: 'desc' },
    },
    { id: 'form-main', type: 'form', entity: 'visit', label: '新建' },
    {
      id: 'kanban-main',
      type: 'kanban',
      entity: 'visit',
      label: '看板',
      groupBy: 'status',
    },
  ],
  actions: [
    {
      name: 'mark-follow',
      label: '标记跟进',
      entity: 'visit',
      kind: 'set',
      set: { status: '需跟进' },
    },
  ],
  memory: { onWrite: 'none' },
}
