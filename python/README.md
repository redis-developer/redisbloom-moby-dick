# Experiments with Redis Bloom and the Text from "Moby Dick"

This repository contains a small example using the text from the book "Moby Dick" as a data source to compare and contrast the benefits and tradeoffs of using different Redis data structures.  We'll use the deterministic Set data structure, and four probabilistic data structures: Hyperloglog, Bloom Filter, Top-K and Count-Min Sketch.  These probabilistic data structures generally use hashing to be more memory efficient at the cost of some accuracy and the ability to recall data added to them.

The Set and Hyperloglog are built into core Redis, to use the Bloom Filter, Top K and Count-Min Sketch data structures, you'll need [Redis Stack](https://redis.io/docs/stack/) or the [RedisBloom module](https://github.com/RedisBloom/RedisBloom).

## Prerequisites

To try out this project yourself, you'll need:

* [Redis Stack](https://redis.io/docs/stack/) (installed locally, available free [in the cloud](https://redis.com/try-free/), or use the supplied Docker Compose file).
* [Docker Desktop](https://www.docker.com/products/docker-desktop/) (if using the Docker Compose file).
* [git](https://git-scm.com/download) command line tools.
* [Python](https://python.org/) version 3.6 or higher (I've tested the code using Python version 3.10.6).

## Get the Code

To get the code, clone the repo to your machine:

```bash
$ git clone https://github.com/redis-developer/redisbloom-moby-dick.git
$ cd redisbloom-moby-dick/python
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

If you're running Redis Stack locally, but installed it through a package manager, make sure that it is running.  See the [instructions for your package manager](https://redis.io/docs/stack/get-started/install/) for details.

If you are running Redis Stack in the cloud, you won't need to start or stop it... but you will need to set an environment variable that tells the application code where to connect to Redis.  Set the value of the `REDIS_URL` environment variable to a valid [Redis connection URL](https://github.com/redis/node-redis#usage) before starting the application.  For example:

```bash
$ export REDIS_URL=redis://default:sssssh@redis.mydomain.com:6390
```

## Application Setup

To setup the application, first install the dependencies:

```bash
$ pip3 install -r requirements.txt
```

## Running the Application

Start the application as follows:

```bash
$ python3 main.py
```

The application will log each word from the file `moby_dick_just_words.txt` to the console as it updates the following data structures in Redis with that word:

* A [Set](https://redis.io/docs/manual/data-types/data-types-tutorial/#sets) whose key is `mobydick:words:set`.
* A [Bloom Filter](https://redis.io/docs/stack/bloom/) whose key is `mobydick:words:bloom`.
* A [Hyperloglog](https://redis.io/docs/manual/data-types/data-types-tutorial/#hyperloglogs) whose key is `mobydick:words:hyperloglog`.
* A [Top-K](https://redis.io/docs/stack/bloom/) whose key is `mobydick:words:topk`.

The Set and Hyperloglog are built into Redis, the Bloom Filter, Top K and Count-Min Sketch are additional capabilities added by the [RedisBloom module](https://redis.io/docs/stack/bloom/) that is part of [Redis Stack](https://redis.io/docs/stack/).

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

As the Hyperloglog, Bloom Filter, Top K and Count-Min Sketch are probabilistic data structures, your output for these may vary. You should always see 18270 distinct words in the Redis Set though, as this is a deterministic data structure.

## How it Works

All of the code is contained in a single file: `main.py`.  This uses redis-py library, and first connects to either a local instance of Redis, or one specified as a Redis connection URL in the `REDIS_URL` environment variable:

```python
import redis

load_dotenv()

REDIS_URL = os.environ.get("REDIS_URL", "localhost")
REDIS_SET_KEY = "mobydick:words:set"
REDIS_BLOOM_KEY = "mobydick:words:bloom"
REDIS_HLL_KEY = "mobydick:words:hyperloglog"
REDIS_TOPK_KEY = "mobydick:words:topk"
REDIS_CMS_KEY = "mobydick:words:cms"

# Create a client and connect to Redis
# Create a pipeline for bulk operations
client = redis.Redis(REDIS_URL)
pipe = client.pipeline()

```

Next, we clean up after any previous run by deleting the Redis keys for each of the four different data types.

```python
pipe.delete(REDIS_SET_KEY)
pipe.delete(REDIS_BLOOM_KEY)
pipe.delete(REDIS_HLL_KEY)
pipe.delete(REDIS_TOPK_KEY)
pipe.delete(REDIS_CMS_KEY)
```

There's no initialization / setup step required for the Set or Hyperloglog, but we do need to initalize the Bloom Filter, Top K and Count-Min Sketch:

```python
bloom_filter = pipe.bf()
bloom_filter.create(REDIS_BLOOM_KEY, 0.01, 20000)

top_k = pipe.topk()
top_k.reserve(REDIS_TOPK_KEY, 10, 8, 7, 0.9)

cms = pipe.cms()
cms.initbydim(REDIS_CMS_KEY, 2000, 5)
```

Next, we'll want to load all of the words from the word file provided, and add them to each of the data structures.  We'll do that with Python's `with open(...)` and create an array of words by splittng the file each time we see a space:

```python
with open("../moby_dick_just_words.txt", "r") as fi:
    for line in fi:
        for raw_word in line.split():
            word = raw_word.strip().lower()
            bloom_filter.add(REDIS_BLOOM_KEY, word)
            pipe.sadd(REDIS_SET_KEY, word)
            pipe.pfadd(REDIS_HLL_KEY, word)
            top_k.add(REDIS_TOPK_KEY, word)
            cms.incrby(REDIS_CMS_KEY, [word], [1])
            print(word)
```

Before loading each word into the various data structures, we normalize it by converting it to lower case, so that `Whale` and `whale` are seen as the same word.  Having done that, we use the appropriate Redis command for each data structure:

* [`SADD`](https://redis.io/commands/sadd/) adds a member to a Set, if the member already exists in the Set then nothing happens as Sets cannot contain duplicates.
* [`BF.ADD`](https://redis.io/commands/bf.add/) adds an item to a Bloom Filter, if the item may already exist in the Bloom Filter then nothing happens, and this may sometimes be in error as this is a probabilistic data structure.
* [`PFADD`](https://redis.io/commands/pfadd/) adds an item to a Hyperloglog, potentially updating the count of distinct items seen.  As this is a probabilistic data structure and hash collisions may occur, the count will be an approximation.
* [`TOPK.ADD`](https://redis.io/commands/topk.add/) adds an item to a Top K, giving it an initial score of 1.  If the item already exists, the score is incremented by 1.  As this is a probabilistic data structure and hash collisions may occur, the scores will be approximations and not entirely accurate.
* [`CMS.INCRBY`](https://redis.io/commands/cms.incrby/) Increases the count of item by increment. Multiple items can be increased with one call.

Finally, let's check out some statistics about each of the data structures...

```python
print(f"There are {client.scard(REDIS_SET_KEY)} distinct words in the Redis Set.")
print(f"The Redis Set uses {client.memory_usage(REDIS_SET_KEY) / 1024}kb of memory.")
print(f"The Redis Hyperloglog counted {client.pfcount(REDIS_HLL_KEY)} distinct words.")
print(
    f"The Redis Hyperloglog uses {client.memory_usage(REDIS_HLL_KEY) / 1024}kb of memory."
)
print(
    f"The Redis Bloom Filter uses {client.memory_usage(REDIS_BLOOM_KEY) / 1024}kb of memory."
)
print(f"The Count-Min Sketch uses {client.memory_usage(REDIS_CMS_KEY) / 1024}kb of memory.")

top_k.list(REDIS_TOPK_KEY, withcount=True)
pipe_result = pipe.execute()
top_k_list = pipe_result[-1]

words = top_k_list[::2]
freq = top_k_list[1::2]

top_k_frequency_dict = dict(zip(words, freq))

print("\nThe top 10 words by Top K are:\n", top_k_frequency_dict)

cms_word_count = client.cms().query(REDIS_CMS_KEY, *words)
cms_frequency_dict = dict(zip(words, cms_word_count))

print("\nThe top 10 words by Count-Min Sketch are:\n", cms_frequency_dict)

```

* The [`SCARD`](https://redis.io/commands/scard/) command gives us the cardinality or number of elements in a Set.  As the set keeps all of the data, it takes up more memory than the Hyperloglog or Bloom Filter but returns an accurate word count.
* [`PFCOUNT`](https://redis.io/commands/pfcount/) returns an approximation of the number of distinct items added to the Hyperloglog.  
* [`TOPK.LIST`](https://redis.io/commands/topk.list/) with the `WITHCOUNT` modifier returns the full list of items in the Top K along with their approximated counts / scores.
* [`CMS.QUERY`](https://redis.io/commands/cms.query/) returns the count for one or more items in a sketch.
* Using the [`MEMORY USAGE`](https://redis.io/commands/memory-usage/) command, we can see how much memory the Set, Hyperloglog, Bloom Filter, Top K and Count-Min Sketch take up in Redis.  `MEMORY USAGE` returns the memory used in bytes, so we divide by 1024 to get kilobytes.
