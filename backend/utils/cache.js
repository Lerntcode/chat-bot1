const redis = require('redis');
const env = require('../config/env');

class Cache {
  constructor() {
    // Only initialize Redis in production or when explicitly enabled
    if (env.REDIS_URL || env.IS_PROD) {
      this.client = redis.createClient({
        url: env.REDIS_URL || 'redis://localhost:6379'
      });
      
      this.client.on('error', (err) => {
        console.error('Redis Client Error', err);
      });
      
      this.client.connect();
    } else {
      // Mock client for development
      this.client = {
        get: async (key) => {
          console.log(`CACHE MISS: ${key}`);
          return null;
        },
        set: async (key, value, options) => {
          console.log(`CACHE SET: ${key}`);
          return 'OK';
        },
        del: async (key) => {
          console.log(`CACHE DEL: ${key}`);
          return 1;
        },
        quit: async () => {
          return 'OK';
        }
      };
    }
  }

  async get(key) {
    try {
      const value = await this.client.get(key);
      if (value) {
        return JSON.parse(value);
      }
      return null;
    } catch (error) {
      console.error('Cache GET error:', error);
      return null;
    }
  }

  async set(key, value, ttlSeconds = 300) { // Default 5 minutes TTL
    try {
      const serializedValue = JSON.stringify(value);
      if (ttlSeconds) {
        return await this.client.set(key, serializedValue, {
          EX: ttlSeconds
        });
      } else {
        return await this.client.set(key, serializedValue);
      }
    } catch (error) {
      console.error('Cache SET error:', error);
      return null;
    }
  }

  async del(key) {
    try {
      return await this.client.del(key);
    } catch (error) {
      console.error('Cache DEL error:', error);
      return null;
    }
  }

  async quit() {
    try {
      return await this.client.quit();
    } catch (error) {
      console.error('Cache QUIT error:', error);
      return null;
    }
  }

  async ping() {
    try {
      if (!this.client || !this.client.ping) return false;
      const res = await this.client.ping();
      return res === 'PONG' || res === 'OK' || res === true;
    } catch (e) {
      return false;
    }
  }
}

module.exports = new Cache();