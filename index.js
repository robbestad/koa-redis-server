const koa = require('koa');
const path = require('path');
const Router = require('koa-router');
const router = new Router();
const bodyParser = require('koa-better-body');
const favicon = require('koa-favicon');
const convert = require('koa-convert');
const parse = require('co-body');
const crypto = require('crypto');
const app = new koa();
const curry = require('curry');
const PORT = 8666;

const redisClient = require('./redis-client');

require('colors');

const logger = require('debug');

const validateHash = async(ctx, next) => {
  const {hash, phrase} = ctx.req.headers;
  const controlHash = crypto.createHash('sha256').update(require('./secret.json') + phrase).digest('base64');
  if (hash !== controlHash) {
    return ctx.throw(404);
  }
  await next();
};

const resolvePromise = curry((ctx, promise) => {
  return promise.then(res => {
    ctx.status = res.statusCode;
    ctx.body = res.message
  })
    .catch(err => {
      ctx.status = err.statusCode || err.status || 500;
      ctx.body = {
        message: err.message
      };
    })
});

router
  .get('/data/:key',
    validateHash,
    (async(ctx, next) => {
      await resolvePromise(ctx)(new Promise((resolve, reject) => {
        const {key} = ctx.params;
        if (!key) {
          reject({statusCode: 412, message: "No key in request"});
        }
        redisClient.get(key, (err, id) => {
          if (err) {
            reject({statusCode: 418, message: "I'm sorry Dave, I'm afraid I can't do that (" + err + ")"});
          }
          resolve({statusCode: 201, message: id});
        })
      }))
    }))
  .put('/counter',
    validateHash,
    (async(ctx, next) => {
      await resolvePromise(ctx)(new Promise((resolve, reject) => {
        redisClient.incr('webcounter', (err, id) => {
          if (err) {
            reject({statusCode: 418, message: "I'm sorry Dave, I'm afraid I can't do that (" + err + ")"});
          }
          resolve({statusCode: 201, message: id});
        })
      }))
    }))
  .put('/data',
    validateHash,
    (async(ctx, next) => {
      await resolvePromise(ctx)(new Promise((resolve, reject) => {
        parse.json(ctx).then(json => {
          const {key, value} = json;
          if (!key || !value) {
            reject({statusCode: 412, message: "No key or value present in body"});
          }
          redisClient.set(key, JSON.stringify({"data": value}), (err, id) => {
            if (err) {
              reject({statusCode: 418, message: "I'm sorry Dave, I'm afraid I can't do that (" + err + ")"});
            }
            resolve({statusCode: 201, message: id});
          })
        })
      }))
    }));

app
  .use(favicon(path.join(__dirname, 'favicon.ico')))
  .use(router.routes())
  .use(router.allowedMethods())
  .use(convert(bodyParser({
    formLimit: '200kb',
    jsonLimit: '200kb',
    multipart: false,
    bufferLimit: '4mb'
  })));

app.listen(PORT, function () {
  logger('app:start')('server.js listening on port ' + PORT)
});
