import test from 'blue-tape'
import createPool from '../src'

const getState = ({ size, available, pending, max, min }) => {
  const state = { size, available, pending, max, min }
  return state
}

const inUse = ({ size, available }) => size - available

let puppPool
test('create pool', async () => {
  puppPool = createPool()
})

test('create pool', async (t) => {
  const instance = await puppPool.acquire()
  const page = await instance.newPage()
  const viewportSize = await page.viewport()
  t.deepEqual(viewportSize, { height: 600, width: 800 })
  await puppPool.release(instance)
})

test('create some pools', async (t) => {
  const instances = await Promise.all([
    puppPool.acquire(),
    puppPool.acquire(),
    puppPool.acquire(),
    puppPool.acquire(),
  ])
  t.deepEqual(getState(puppPool), {
    available: 0,
    pending: 0,
    max: 10,
    min: 2,
    size: 4,
  })
  const [firstInstance, ...otherInstances] = instances
  await puppPool.release(firstInstance)
  t.deepEqual(getState(puppPool), {
    available: 1,
    pending: 0,
    max: 10,
    min: 2,
    size: 4,
  })
  await Promise.all(otherInstances.map(instance => puppPool.release(instance)))
  t.deepEqual(getState(puppPool), {
    available: 4,
    pending: 0,
    max: 10,
    min: 2,
    size: 4,
  })
})

test('use', async (t) => {
  t.equal(inUse(puppPool), 0)
  const result = await puppPool.use(async (instance) => {
    t.equal(inUse(puppPool), 1)
    const page = await instance.newPage()
    return page.setJavaScriptEnabled(true).then(() => true)
  })
  t.equal(result, true)
  t.equal(inUse(puppPool), 0)
})

test('use and throw', async (t) => {
  t.equal(inUse(puppPool), 0)
  try {
    await puppPool.use(async () => {
      t.equal(inUse(puppPool), 1)
      throw new Error('some err')
    })
  } catch (err) {
    t.equal(err.message, 'some err')
  }
  t.equal(inUse(puppPool), 0)
})

test('destroy pool', async () => {
  await puppPool.drain()
  return puppPool.clear()
})
