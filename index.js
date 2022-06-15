import { readFileSync } from 'fs';
import { createClient } from 'redis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const REDIS_SET_KEY = 'mobydick:words:set'
const REDIS_BLOOM_KEY = 'mobydick:words:bloom'
const REDIS_HLL_KEY = 'mobydick:words:hyperloglog'
const REDIS_TOPK_KEY = 'mobydick:words:topk'
const REDIS_SORTED_SET_KEY = 'mobydick:words:sortedset'
const REDIS_HASH_KEY = 'mobydisk:words:hash'
const REDIS_CMS_KEY = 'mobydick:words:cms'

// Create a client and connect to Redis.
const client = createClient({
  url: REDIS_URL
});
await client.connect();

// Clean up from any previous run...
await Promise.all([
  client.del(REDIS_SET_KEY),
  client.del(REDIS_BLOOM_KEY),
  client.del(REDIS_HLL_KEY),
  client.del(REDIS_TOPK_KEY),
  client.del(REDIS_HASH_KEY),
  client.del(REDIS_CMS_KEY),
  client.del(REDIS_SORTED_SET_KEY)
]);

// Initialize Bloom Filter, Count-Min Sketch and Top K.
await Promise.all([
  client.bf.reserve(REDIS_BLOOM_KEY, 0.01, 20000),
  client.topK.reserve(REDIS_TOPK_KEY, 10),
  client.cms.initByProb(REDIS_CMS_KEY, 0.001, 0.01)
]);

// Process the file of words.
const mobyDickWords = readFileSync('moby_dick_no_stop_words.txt', 'utf-8').split(' ');
console.log('Loading words... may take a moment!');

for (const word of mobyDickWords) {
  const thisWord = word.trim();
  await Promise.all([
    client.hIncrBy(REDIS_HASH_KEY, thisWord, 1),
    client.cms.incrBy(REDIS_CMS_KEY, { item: thisWord, incrementBy: 1 }),
    client.sAdd(REDIS_SET_KEY, thisWord),
    client.bf.add(REDIS_BLOOM_KEY, thisWord),
    client.pfAdd(REDIS_HLL_KEY, thisWord),
    client.topK.add(REDIS_TOPK_KEY, thisWord),
    client.zIncrBy(REDIS_SORTED_SET_KEY, 1, thisWord)
  ]);
  //console.log(lowerWord);
}

// Get some stats...
console.log(`The Hash uses ${Math.floor(await client.memoryUsage(REDIS_HASH_KEY) / 1024)}kb of memory.`);
console.log(`Example counts from the Hash:`);
console.log(`whale: ${await client.hGet(REDIS_HASH_KEY, 'whale')}`);
console.log(`porpoise: ${await client.hGet(REDIS_HASH_KEY, 'porpoise')}`);
console.log(`jonah: ${await client.hGet(REDIS_HASH_KEY, 'jonah')}`);
console.log(`The Count-Min Sketch uses ${Math.floor(await client.memoryUsage(REDIS_CMS_KEY) / 1024)}kb of memory.`);
console.log(`Example counts from the Count-Min Sketch:`);
console.log(`whale: ${await client.cms.query(REDIS_CMS_KEY, 'whale')}`);
console.log(`porpoise:  ${await client.cms.query(REDIS_CMS_KEY, 'porpoise')}`);
console.log(`jonah:  ${await client.cms.query(REDIS_CMS_KEY, 'jonah')}`);
console.log(`There are ${await client.hLen(REDIS_HASH_KEY)} distinct words in the Hash.`);
console.log(`There are ${await client.sCard(REDIS_SET_KEY)} distinct words in the Set.`);
console.log(`The Set uses ${Math.floor(await client.memoryUsage(REDIS_SET_KEY) / 1024)}kb of memory.`);
console.log(`The Hyperloglog counted ${await client.pfCount(REDIS_HLL_KEY)} distinct words.`);
console.log(`The Hyperloglog uses ${Math.floor(await client.memoryUsage(REDIS_HLL_KEY) / 1024)}kb of memory.`);
console.log(`The Bloom Filter uses ${Math.floor(await client.memoryUsage(REDIS_BLOOM_KEY) / 1024)}kb of memory.`);
console.log('The top 10 words in the Top-K are:');
console.log(await client.topK.listWithCount(REDIS_TOPK_KEY));
console.log(`The Top-K uses ${Math.floor(await client.memoryUsage(REDIS_TOPK_KEY) / 1024)}kb of memory.`);
console.log('The top 10 words in the Sorted Set are:');
console.log(await client.zRangeWithScores(REDIS_SORTED_SET_KEY, 0, 9, { REV: true }));
// zrange mobydick:words:sortedset 0 9 rev withscores
console.log(`The Sorted Set uses ${Math.floor(await client.memoryUsage(REDIS_SORTED_SET_KEY) / 1024)}kb of memory.`);

// Release Redis connection.
await client.quit();