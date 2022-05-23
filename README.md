# Experiments with Redis Bloom and the Text from "Moby Dick"

TODO

We'll compare and contrast the following Redis data structures:

* [Set](): TODO
* [Bloom Filter](): TODO
* [Hyperloglog](): TODO
* [Top-K](): TODO

The Set and Hyperloglog are built into core Redis, to use the Bloom Filter and Top K data structures, you'll need [Redis Stack](https://redis.io/docs/stack/) or the [Redis Bloom module](https://github.com/RedisBloom/RedisBloom).

## Prerequisites

To try out this project yourself, you'll need:

* [Redis Stack](https://redis.io/docs/stack/) (installed locally, available free [in the cloud](https://redis.com/try-free/), or use the supplied Docker Compose file).
* [Docker Desktop](https://www.docker.com/products/docker-desktop/) (if using the Docker Compose file).
* [git](https://git-scm.com/download) command line tools.
* [Node.js](https://nodejs.org/) version 14.8 or higher (I've tested the code using Node.js version 16.4.2).

## Get the Code

To get the code, clone the repo to your machine:

```bash
$ git clone https://github.com/redis-developer/redisbloom-moby-dick.git
$ cd redisbloom-moby-dick
```

## Starting Redis Stack

If you're using Docker, start Redis Stack as follows:

```bash
$ docker-compose up -d
```

Redis Stack will start up and Redis will listen on the default port `6379`.

Once you're done, you can stop Redis Stack like this:

```bash
$ docker-compose down
```

If you're running Reds Stack locally, but installed it through a package manager, make sure that it is running.  See the [instructions for your package manager](https://redis.io/docs/stack/get-started/install/) for details.

If you are running Redis Stack in the cloud, you won't need to start or stop it... but you will need to set an environment variable that tells the application code where to connect to Redis.  Set the value of the `REDIS_URL` environment variable to a valid [Redis connection URL](https://github.com/redis/node-redis#usage) before starting the application.  For example:

```bash
$ export REDIS_URL=redis://simon:sssssh@redis.mydomain.com:6390
```

## Application Setup

To setup the application, first install the dependencies:

```bash
$ npm install
```

## Running the Application

Start the application as follows:

```bash
$ npm start
```

The application will log each word from the file `moby_dick_just_words.txt` to the console as it updates the following data structures in Redis with that word:

* A [Set](https://redis.io/docs/manual/data-types/data-types-tutorial/#sets) whose key is `mobydick:words:set`.
* A [Bloom Filter](https://redis.io/docs/stack/bloom/) whose key is `mobydick:words:bloom`.
* A [Hyperloglog](https://redis.io/docs/manual/data-types/data-types-tutorial/#hyperloglogs) whose key is `mobydick:words:hyperloglog`.
* A [Top-K](https://redis.io/docs/stack/bloom/) whose key is `mobydick:words:topk`.

The Set and Hyperloglog are built into Redis, the Bloom Filter and Top-K are additional capabilities added by the [RedisBloom module](https://redis.io/docs/stack/bloom/) that is part of [Redis Stack](https://redis.io/docs/stack/).

Once all the words have been loaded into these data structures, the code then prints out some summary statistics about each.  Here's some example output:

```
There are 18270 distinct words in the Redis Set.
The Redis Set uses 969.828125kb of memory.
The Redis Hyperloglog counted 18218 distinct words.
The Redis Hyperloglog uses 14.0703125kb of memory.
The Redis Bloom Filter uses 27.0703125kb of memory.
The top 10 words are:
[
  { item: 'the', count: 583 },
  { item: 'and', count: 292 },
  { item: 'of', count: 290 },
  { item: 'to', count: 285 },
  { item: 'a', count: 284 },
  { item: 'i', count: 281 },
  { item: 'you', count: 272 },
  { item: 'his', count: 14 },
  { item: 'is', count: 13 },
  { item: 'look', count: 13 }
]
```

As the Hyperloglog, Bloom Filter and Top K are probabilistic data structures, your output for these may vary. You should always see 18270 distinct words in the Redis Set though, as this is a deterministic data structure.

## How it Works

All of the code is contained in a single file: `index.js`.  This uses Node-Redis 4, and first connects to either a local instance of Redis, or one specified as a Redis connection URL in the `REDIS_URL` environment variable:

```javascript
import { createClient } from 'redis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Create a client and connect to Redis.
const client = createClient({
  url: REDIS_URL
});
await client.connect();
```

Next, we clean up after any previous run by deleting the Redis keys for each of the four different data types... putting these in a `Promise.all` causes Node Redis to TODO what?

```javascript
const REDIS_SET_KEY = "mobydick:words:set"
const REDIS_BLOOM_KEY = "mobydick:words:bloom"
const REDIS_HLL_KEY = "mobydick:words:hyperloglog"
const REDIS_TOPK_KEY = "mobydick:words:topk"

// Clean up from any previous run...
await Promise.all([
  client.del(REDIS_SET_KEY),
  client.del(REDIS_BLOOM_KEY),
  client.del(REDIS_HLL_KEY),
  client.del(REDIS_TOPK_KEY)
]);
```

There's no initialization / setup step required for the Set or Hyperloglog, but we do need to initalize the Bloom Filter and Top K:

```javascript
await Promise.all([
  client.bf.reserve(REDIS_BLOOM_KEY, 0.01, 20000),
  client.topK.reserve(REDIS_TOPK_KEY, 10)
]);
```

Node-Redis pipelines requests made during the same "tick", so that they're sent to Redis as a single network round trip.  Here, we're using `Promize.all` to take advantage of this.  [Read more about Redis pipelining on redis.io](https://redis.io/docs/manual/pipelining/).

Next, we'll want to load all of the words from the word file provided, and add them to each of the data structures.  We'll do that with Node's `readFileSync` and create an array of words by splittng the file each time we see a space:

```javascript
import { readFileSync } from 'fs';

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
```

Before loading each word into the various data structures, we normalize it by converting it to lower case, so that `Whale` and `whale` are seen as the same word.  Having done that, we use the appropriate Redis command for each data structure:

* [`SADD`](https://redis.io/commands/sadd/) adds a member to a Set, if the member already exists in the Set then nothing happens as Sets cannot contain duplicates.
* [`BF.ADD`](https://redis.io/commands/bf.add/) adds an item to a Bloom Filter, if the item may already exist in the Bloom Filter then nothing happens, and this may sometimes be in error as this is a probabilistic data structure.
* [`PFADD`](https://redis.io/commands/pfadd/) adds an item to a Hyperloglog, potentially updating the count of distinct items seen.  As this is a probabilistic data structure and hash collisions may occur, the count will be an approximation.
* [`TOPK.ADD`](https://redis.io/commands/topk.add/) adds an item to a Top K, giving it an initial score of 1.  If the item already exists, the score is incremented by 1.  As this is a probabilistic data structure and hash collisions may occur, the scores will be approximations and not entirely accurate.

Finally, let's check out some statistics about each of the data structures...

```javascript
console.log(`There are ${await client.sCard(REDIS_SET_KEY)} distinct words in the Redis Set.`);
console.log(`The Redis Set uses ${await client.memoryUsage(REDIS_SET_KEY) / 1024}kb of memory.`);
console.log(`The Redis Hyperloglog counted ${await client.pfCount(REDIS_HLL_KEY)} distinct words.`);
console.log(`The Redis Hyperloglog uses ${await client.memoryUsage(REDIS_HLL_KEY) / 1024}kb of memory.`);
console.log(`The Redis Bloom Filter uses ${await client.memoryUsage(REDIS_BLOOM_KEY) / 1024}kb of memory.`);
console.log("The top 10 words are:")
console.log(await client.topK.listWithCount(REDIS_TOPK_KEY));
```

* The [`SCARD`](https://redis.io/commands/scard/) command gives us the cardinality or number of elements in a Set.  As the set keeps all of the data, it takes up more memory than the Hyperloglog or Bloom Filter but returns an accurate word count.
* [`PFCOUNT`](https://redis.io/commands/pfcount/) returns an approximation of the number of distinct items added to the Hyperloglog.  
* [`TOPK.LIST`](https://redis.io/commands/topk.list/) with the `WITHCOUNT` modifier returns the full list of items in the Top K along with their approximated counts / scores.
* Using the [`MEMORY USAGE`](https://redis.io/commands/memory-usage/) command, we can see how much memory the Set, Hyperloglog and Bloom Filter take up in Redis.  `MEMORY USAGE` returns the memory used in bytes, so we divide by 1024 to get kilobytes.

## Further Exercises

Try using the following commands to check if a given word is in the Set, or possibly in the Bloom Filter:

* [`SISMEMBER`](https://redis.io/commands/sismember/): Find out for sure whether a word is in the Set whose key is `mobydick:words:set`.  Try checking multiple words at once with [`SMISMEMER`](https://redis.io/commands/smismember/)
* [`BF.EXISTS`](https://redis.io/commands/bf.exists/): Find out whether a word may be or is absolutely not in the Bloom Filter whose key is `mobydick:words:bloom`. Try checking multiple words at once with [`BF.MEXISTS`](https://redis.io/commands/bf.mexists/)

Why can't we say with absolute certainty that a word is in the Bloom Filter? 

## Licensing

The code is made available under the terms of the [MIT license](https://mit-license.org/).  I obtained the original text file of the book "Moby Dick" from [Project Gutenberg](https://www.gutenberg.org/policy/permission.html).  This text is in the public domain and available in its original form [here](https://www.gutenberg.org/files/2701/2701-0.txt).