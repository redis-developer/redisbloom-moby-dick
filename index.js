import { readFileSync } from 'fs';
import { createClient } from 'redis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const REDIS_SET_KEY = "mobydick:words:set"
const REDIS_BLOOM_KEY = "mobydick:words:bloom"
const REDIS_HLL_KEY = "mobydick:words:hyperloglog"
const REDIS_TOPK_KEY = "mobydick:words:topk"

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
  client.del(REDIS_TOPK_KEY)
]);

// Initialize Bloom Filter and Top K.
await Promise.all([
  client.bf.reserve(REDIS_BLOOM_KEY, 0.01, 20000),
  client.topK.reserve(REDIS_TOPK_KEY, 10)
]);

// Process the file of words.
const mobyDickWords = readFileSync('moby_dick_just_words.txt', 'utf-8').split(' ');
for (const word of mobyDickWords) {
  const lowerWord = word.trim().toLowerCase();
  await Promise.all([
    client.sAdd(REDIS_SET_KEY, lowerWord),
    client.bf.add(REDIS_BLOOM_KEY, lowerWord),
    client.pfAdd(REDIS_HLL_KEY, lowerWord),
    client.topK.add(REDIS_TOPK_KEY, lowerWord)
  ]);
  console.log(lowerWord);
}

// Get some stats...
console.log(`There are ${await client.sCard(REDIS_SET_KEY)} distinct words in the Redis Set.`);
console.log(`The Redis Set uses ${await client.memoryUsage(REDIS_SET_KEY) / 1024}kb of memory.`);
console.log(`The Redis Hyperloglog counted ${await client.pfCount(REDIS_HLL_KEY)} distinct words.`);
console.log(`The Redis Hyperloglog uses ${await client.memoryUsage(REDIS_HLL_KEY) / 1024}kb of memory.`);
console.log(`The Redis Bloom Filter uses ${await client.memoryUsage(REDIS_BLOOM_KEY) / 1024}kb of memory.`);
console.log("The top 10 words are:")
console.log(await client.topK.listWithCount(REDIS_TOPK_KEY));

// Release Redis connection.
await client.quit();