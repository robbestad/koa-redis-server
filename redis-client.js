const redis = require('redis');

const port = process.env.REDIS_PORT || 6379;
const host = process.env.REDIS_HOST || '127.0.0.1';

module.exports = redis.createClient(port, host);
