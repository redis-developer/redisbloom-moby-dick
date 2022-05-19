# Experiments with Redis Bloom and the Text from "Moby Dick"

TODO

covered in the stream:

* set
* compared set with bloom filter from perspective of space/accuracy, no lookups in bloom filter
* hyperloglog for counting things approximately
* top k

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

The Set and Hyperloglog are built into Redis, the Bloom Filter and Top-K are additional capabilities added by the RedisBloom module that is part of Redis Stack.

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

As the Hyperloglog and Bloom Filter are probabilistic data structures, your output for these may vary. You should always see 18270 distinct words in the Redis Set though, as this is a deterministic data structure.

## Licensing

The code is made available under the terms of the [MIT license](https://mit-license.org/).  I obtained the original text file of the book "Moby Dick" from [Project Gutenberg](https://www.gutenberg.org/policy/permission.html).  This text is in the public domain and available in its original form [here](https://www.gutenberg.org/files/2701/2701-0.txt).