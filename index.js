import { createClient } from 'redis';

const REDIS_SET_KEY = "mobydick:words:set"
const REDIS_BLOOM_KEY = "mobydick:words:bloom"
const REDIS_HLL_KEY = "mobydick:words:count"
const REDIS_TOPK_KEY = "mobydick:words:topk"

const client = createClient();

await client.connect();
await client.del('mybloom');
await client.bf.reserve('mybloom', 0.01, 1000);

await Promise.all([
  client.bf.add('mybloom', 'leibale'),
  client.bf.add('mybloom', 'simon'),
  client.bf.add('mybloom', 'guy'),
  client.bf.add('mybloom', 'suze'),
  client.bf.add('mybloom', 'brian'),
  client.bf.add('mybloom', 'steve'),
  client.bf.add('mybloom', 'kyle'),
  client.bf.add('mybloom', 'josefin'),
  client.bf.add('mybloom', 'alex'),
  client.bf.add('mybloom', 'nava'),
]);

console.log('Added members to Bloom Filter.');

// Check whether a member exists with the BF.EXISTS command.
const simonExists = await client.bf.exists('mybloom', 'simon');
console.log(`simon ${simonExists ? 'may' : 'does not'} exist in the Bloom Filter.`);


// Get stats for the Bloom Filter with the BF.INFO command:
const info = await client.bf.info('mybloom');
// info looks like this:
//
//  {
//    capacity: 1000,
//    size: 1531,
//    numberOfFilters: 1,
//    numberOfInsertedItems: 12,
//    expansionRate: 2
//  }
console.log(info);

await client.quit();