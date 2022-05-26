const test = require("blue-tape")
const redisSrv = require("../test/redis-server")///==>  redisSrv  ->   { port: 18543, connect: [Function], disconnect: [Function] }
const session = require("express-session")///==> session   ->   [Function: session]{store: [], Cookie: [], Session: [], MemoryStore: []}
const redisV3 = require("redis-v3")
// const redisV4 = require("redis-v4")
const ioRedis = require("ioredis")///==>  ioRedis  ->   [Function: Redis] {...}
const redisMock = require("redis-mock") ///==>  redisMock  ->   RedisError 、RedisClient 、 Multi 、 createClient
let RedisStore = require("../")(session)///==>  RedisStore  ->   [class RedisStore extends Store]

// console.log( RedisStore ) ///==>  RedisStore  ->   [class RedisStore extends Store]

console.log( '======================================================================================================================' )

let p = (ctx, method) =>
  (...args) =>
    new Promise((resolve, reject) => {
      ctx[method](...args, (err, d) => {
        if (err) reject(err)
        resolve(d)
      })
    })

test("setup", redisSrv.connect)    ///==>  redisSrv.connect()  -> 返回 Promise { <pending> } 和 连接信息 

console.log( '======================================================================================================================' )

// test("defaults", async (t) => {
// console.log( '======================================================================================================================' )

//   // console.log( t )
//   // t.throws(() => new RedisStore(), "client is required")    ///==>  t.throws  ->   throws: [Function: bound]

//   var client = redisV3.createClient(redisSrv.port, "localhost")
//   // console.log( client )  RedisClient{}
//   var store = new RedisStore({ client })
//   console.log( store.ttl )

// //判断 redisV3 创建 的属性信息 是否 与 new RedisStore 属性值 是否相等

//   t.equal(store.client, client, "stores client") 
//   t.equal(store.prefix, "sess:", "defaults to sess:")
//   t.equal(store.ttl, 86400, "defaults to one day")
//   t.equal(store.scanCount, 100, "defaults SCAN count to 100")
//   t.equal(store.serializer, JSON, "defaults to JSON serialization")
//   t.equal(store.disableTouch, false, "defaults to having `touch` enabled")
//   t.equal(store.disableTTL, false, "defaults to having `ttl` enabled")
//   client.end(false)
// })


test("node_redis v3", async (t) => {
console.log( '======================================================================================================================' )

  var client = redisV3.createClient(redisSrv.port, "localhost")
  var store = new RedisStore({ client })
  // console.log( store )
  // const res = lifecycleTest(store, t) ///==> res   ->   Promise {<pending>}
  
  // console.log( store )
  const res = await lifecycleTest(store, t)  ///==>  res  ->   undefined
  
  client.end(false)
})

// // test("node_redis v4", async (t) => {
// //   var client = redisV4.createClient({
// //     url: `redis://localhost:${redisSrv.port}`,
// //     legacyMode: true,
// //   })
// //   await client.connect()
// //   var store = new RedisStore({ client })
// //   await lifecycleTest(store, t)
// //   await client.disconnect()
// // })

test("ioredis", async (t) => {
  var client = ioRedis.createClient(redisSrv.port, "localhost")
  var store = new RedisStore({ client })
  await lifecycleTest(store, t)
  client.disconnect()
}) 

test("redis-mock client", async (t) => {
  var client = redisMock.createClient()
  var store = new RedisStore({ client })
  await lifecycleTest(store, t)
})

test("teardown", redisSrv.disconnect)

/**
let p = (store, method) =>
  (...args) =>
    new Promise((resolve, reject) => {
      store[method](...args, (err, d) => {
        if (err) reject(err)
        resolve(d)
      })
    })
 */

// 操作redis sess文件夹 key为sess:123 value为json
async function lifecycleTest(store, t) {
  // console.log( store )
  ///==>    ->   设置 {"key": sess:123, "value": { "foo": "bar" }}
  let res = await p(store, "set")("123", { foo: "bar" })   ///==>  store  ->   new RedisStore({ client })
  console.log( res )
  t.equal(res, "OK", "set value")

  ///==>    ->   获取 {"key": sess:123, "value": { "foo": "bar" }}
  res = await p(store, "get")("123")///==>  res  ->   { foo: "bar" }
  t.same(res, { foo: "bar" }, "get value") 

  ///==>    ->   设置{"key": sess:123, "value": TTL }   指定 key 的时间
  res = await p(store.client, "ttl")("sess:123")
  t.ok(res >= 86399, "check one day ttl")
 
  /**
   * 设置 Multiple(事务) 的key为 456
   * 方法 Method：set 、 ttl 、 touch 、 length 、 ids 、 all
   */
  let ttl = 60
  let expires = new Date(Date.now() + ttl * 1000).toISOString()
  res = await p(store, "set")("456", { cookie: { expires } })
  t.equal(res, "OK", "set cookie expires")//------------指定失效时间为 60s

  res = await p(store.client, "ttl")("sess:456")
  t.ok(res <= 60, "check expires ttl")//----------------检查失效时间是否小于60s

  ttl = 900
  let newExpires = new Date(Date.now() + ttl * 1000).toISOString()
  // note: cookie 过期将不会更新的redis
  res = await p(store, "touch")("456", { cookie: { expires: newExpires } })
  t.equal(res, "OK", "set cookie expires touch")//-------设置失效时间为900s

  res = await p(store.client, "ttl")("sess:456")
  t.ok(res > 60, "check expires ttl touch")////----------检查失效时间是否大于 60s

  res = await p(store, "length")()
  t.equal(res, 2, "stored two keys length")///-----------查看Key Statistics的 Keys 长度是否等于2 (多少个key)

  res = await p(store, "ids")()
  res.sort()
  t.same(res, ["123", "456"], "stored two keys ids")//---查看ids属性 是否为 数组 ["123", "456"]

  res = await p(store, "all")()
  // console.log( res )//返回的res为逆序
  res.sort((a, b) => (a.id > b.id ? 1 : -1))  //// 1和-1代表 res的返回值  || 返回值的数组是顺序
  t.same(
    res,
    [
      { id: "123", foo: "bar" },
      { id: "456", cookie: { expires } },
    ],
    "stored two keys data"
  )

  res = await p(store, "destroy")("456")
  t.equal(res, 1, "destroyed one")//------------------销毁key为456键

  res = await p(store, "length")()
  t.equal(res, 1, "one key remains")//-----------------销毁一个键后 、 所剩keys的长度为 1

  res = await p(store, "clear")()
  t.equal(res, 1, "cleared remaining key")///----------redis的keys都被销毁了

  res = await p(store, "length")()
  t.equal(res, 0, "no key remains")//------------------redis的keys长度为0

  let count = 1000
  ///==>  load  ->   function load(store: any, count: any): Promise<any>
  await load(store, count)

  res = await p(store, "length")()
  t.equal(res, count, "bulk count")

  res = await p(store, "clear")()
  t.equal(res, count, "bulk clear")

  expires = new Date(Date.now() + ttl * 1000).toISOString() // expires in the future
  res = await p(store, "set")("789", { cookie: { expires } })
  t.equal(res, "OK", "set value")////------------------设置失效时间为900s   {"key": sess:789, "value": {"cookie":{"expires":"2022-05-26T11:30:27.032Z"}} }

  res = await p(store, "length")()
  t.equal(res, 1, "one key exists (session 789)")//-----查看keys的长度是否为1

  expires = new Date(Date.now() - ttl * 1000).toISOString() // expires in the past
  res = await p(store, "set")("789", { cookie: { expires } })
  t.equal(res, 1, "returns 1 because destroy was invoked")  //----------因为调用了destroy，所以返回1

  res = await p(store, "length")()
  t.equal(res, 0, "no key remains and that includes session 789")//-----没有密钥保留，包括会话789
}

function load(store, count) {
  return new Promise((resolve, reject) => {
    let set = (sid) => {
      store.set(
        "s" + sid,
        {
          cookie: { expires: new Date(Date.now() + 1000) },
          data: "some data",
        },
        (err) => {
          if (err) {
            return reject(err)
          }

          if (sid === count) {///如果 sid === 1000  return resole()
            return resolve()
          }

          set(sid + 1)
        }
      )
    }
    set(1)
  })
}
