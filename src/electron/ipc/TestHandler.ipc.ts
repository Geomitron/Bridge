import { IPCHandler } from '../shared/IPCHandler'
import { TestInput } from '../shared/interfaces/test.interface'

export default class TestHandler implements IPCHandler<'test-event-A'> {
  event = 'test-event-A' as 'test-event-A'
  async handler(data: TestInput) {
    await new Promise<void>((resolve) => setTimeout(() => resolve(), 3000))

    return `Processed data with value1 = ${data.value1} and value2 + 5 = ${data.value2 + 5}`
  }
}