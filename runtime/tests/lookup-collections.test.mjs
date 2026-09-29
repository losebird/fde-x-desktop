import test from 'node:test'
import assert from 'node:assert/strict'
import { COLLECTIONS_LIST_PATHS, createLookup } from '../vendor-overlays/dsh-lan-assist/lookup.js'

test('collections list loads nested fields via appends, not a column selector', async () => {
  const urls = []
  const lookup = createLookup({
    fetchImpl: async (url) => {
      urls.push(String(url))
      if (/[?&]fields=/.test(String(url))) {
        return { ok: false, status: 400, json: async () => ({ errors: [{ message: 'Invalid SQL column or table reference' }] }) }
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            {
              name: 'biz_tickets',
              title: '工单',
              titleField: 'id',
              fields: [
                { name: 'ticketNo', interface: 'input' },
                { name: 'customer', interface: 'm2o', target: 'biz_customers', foreignKey: 'customerId' },
              ],
            },
            {
              name: 'biz_customers',
              title: '客户',
              titleField: 'id',
              fields: [{ name: 'name', interface: 'input', title: '客户名称' }],
            },
          ],
        }),
      }
    },
    resolve: async () => ({
      baseUrl: 'http://example.test',
      token: 't',
      vocab: [
        { kind: '客户', resource: 'biz_customers' },
        { kind: '工单', resource: 'biz_tickets' },
      ],
    }),
  })
  const cols = await lookup.collectionsFor()
  const tickets = cols.find((row) => row.name === 'biz_tickets')
  assert.ok(tickets && tickets.fields.length > 0)
  assert.equal(tickets.titleField, 'id')
  const ticketFields = await lookup.fieldsOf('工单', [{ kind: '工单', resource: 'biz_tickets' }])
  assert.ok(ticketFields.some((field) => field.name === 'customer'))
  assert.equal(urls.some((url) => /[?&]fields=/.test(url)), false)
  assert.ok(urls.some((url) => COLLECTIONS_LIST_PATHS.some((path) => url.includes(path.split('?')[1]))))
})
