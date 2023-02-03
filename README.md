# Experiments with Redis Bloom and the Text from "Moby Dick"

This repository contains a small example using the text from the book "Moby Dick" as a data source to compare and contrast the benefits and tradeoffs of using different Redis data structures.  We'll use the deterministic Set data structure, and four probabilistic data structures: Hyperloglog, Bloom Filter, Top-K and Count-Min Sketch.  These probabilistic data structures generally use hashing to be more memory efficient at the cost of some accuracy and the ability to recall data added to them.

The Set and Hyperloglog are built into core Redis, to use the Bloom Filter, Top K and Count-Min Sketch data structures, you'll need [Redis Stack](https://redis.io/docs/stack/) or the [RedisBloom module](https://github.com/RedisBloom/RedisBloom).

Check out our [video on YouTube](https://www.youtube.com/watch?v=FAJXq5Qqc0Y) where [Justin](https://github.com/justincastilla) and [Simon](https://simonprickett.dev) talk about counting things at scale with Redis Stack, using examples from this repository.

We also added some extra examples, which are currently on the [adds-other-examples](https://github.com/redis-developer/redisbloom-moby-dick/blob/adds-other-examples/README.md) branch of this repository.

## Prerequisites

To try out this project yourself, you'll need:

* [Redis Stack](https://redis.io/docs/stack/) (installed locally, available free [in the cloud](https://redis.com/try-free/), or use the supplied Docker Compose file).
* [Docker Desktop](https://www.docker.com/products/docker-desktop/) (if using the Docker Compose file).
* [git](https://git-scm.com/download) command line tools.
* [Node.js](https://nodejs.org/) version 14.8 or higher (I've tested the code using Node.js version 16.4.2).
* OR
* [Python](https://python.org/) version 3.6 or higher (I've tested the code using Python version 3.10.6).
## Get the Code

To get the code, clone the repo to your machine:

```bash
$ git clone https://github.com/redis-developer/redisbloom-moby-dick.git
$ cd redisbloom-moby-dick/
```

## Application Setup

This project has two versions, one written in NodeJS and other in Python. For the NodeJS version, head to the `nodejs` directory by doing:

```bash
$ cd nodejs/
```
and follow the instructions given in the [README](/nodejs/README.md) file inside the directory.

For the Python version, head to the `python` directory by doing:

```bash
$ cd python/
```
and follow the instructions given in the [README](/python/README.md) file inside the directory.

## Further Exercises

Try using the following commands to check if a given word is in the Set, or possibly in the Bloom Filter:

* [`SISMEMBER`](https://redis.io/commands/sismember/): Find out for sure whether a word is in the Set whose key is `mobydick:words:set`.  Try checking multiple words at once with [`SMISMEMER`](https://redis.io/commands/smismember/)
* [`BF.EXISTS`](https://redis.io/commands/bf.exists/): Find out whether a word may be or is absolutely not in the Bloom Filter whose key is `mobydick:words:bloom`. Try checking multiple words at once with [`BF.MEXISTS`](https://redis.io/commands/bf.mexists/)

Why can't we say with absolute certainty that a word is in the Bloom Filter? 

## Licensing

The code is made available under the terms of the [MIT license](https://mit-license.org/).  I obtained the original text file of the book "Moby Dick" from [Project Gutenberg](https://www.gutenberg.org/policy/permission.html).  This text is in the public domain and available in its original form [here](https://www.gutenberg.org/files/2701/2701-0.txt).
