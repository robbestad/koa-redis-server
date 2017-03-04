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
const Redis = require('koa-simple-redis');
const client = new Redis({
  url: 'redis://127.0.0.1:6379',
});
const PORT = 8666;

require('colors');

const logger = require('debug');

const redisKey = 'content';

const validateHash = async(ctx, next) => {
  const {hash, phrase} = ctx.req.headers;
  const controlHash = crypto.createHash('sha256').update(require('./secret.json') + phrase).digest('base64');
  if (hash !== controlHash) {
    return ctx.throw(404);
  }
  await next();
};

router
  .get('/content',
    validateHash,
    async ctx => {
      ctx.body = await new Promise((resolve, reject) => {
        client.get(redisKey)
          .then(data => {
            resolve(data);
          })
          .catch(err => {
            reject(err);
          })
      })
    }
  )
  .put('/content',
    validateHash,
    (async(ctx, next) => {
      await new Promise((resolve, reject) => {
        const json = parse.json(ctx).then(json => {
          client.set(redisKey,
            {"data": JSON.stringify(json)}, 10e10)
            .then(res => {
              ctx.body = res;
              ctx.status = 201;
              resolve();
            })
            .catch(err => {
              ctx.status = 500;
              reject();
            })
        })
      });
    }))
  .put('/data',
    validateHash,
    (async(ctx, next) => {
      await new Promise((resolve, reject) => {
        parse.json(ctx).then(json => {
          const {key, value} = json;
          if (!key || !value) {
            reject({statusCode: 412, message: "No key or value present in body"});
          }
          client.set(key,
            {"data": JSON.stringify(value)}, 10e10)
            .then(res => {
              ctx.body = res;
              resolve({statusCode: 201, message: "OK"});
            })
            .catch(err => {
              reject({statusCode: 418, message: "I'm sorry Dave, I'm afraid I can't do that (" + err + ")"});
            })
        })
      })
        .then(res => {
          ctx.status = res.statusCode;
          ctx.body = {
            message: res.message
          };
        })
        .catch(err => {
          ctx.status = err.statusCode || err.status || 500;
          ctx.body = {
            message: err.message
          };
        })
    }));

app
  .use(favicon(path.join(__dirname, 'favicon.ico')))
  .use(router.routes())
  .use(router.allowedMethods())
  // .use(convert(staticCache(path.join(__dirname, root, 'assets'), {
  //   maxAge: 365 * 24 * 60 * 60
  // })))
  .use(convert(bodyParser({
    formLimit: '200kb',
    jsonLimit: '200kb',
    multipart: false,
    bufferLimit: '4mb'
  })));

app.listen(PORT, function () {
  logger('app:start')('server.js listening on port ' + PORT)
});
