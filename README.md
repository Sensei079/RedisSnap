# RedisSnap - Custom Redis-like Server Implementation

 This project is a custom implementation of a Redis-like server built using Node.js. It mimics some of the core functionalities of Redis, including data storage, key-value operations, and basic data structures.

 # Features

1. Key-Value Storage: Basic commands to set and get key-value pairs.
2. Password Protection: Users must set a password before executing other commands. Authentication is required to access most operations.
3. Data Structures: Support for simple data structures like lists, sets, hashes, and sorted sets.
4. Expiration: Key-value pairs can be set to expire after a specified time.
5. Error Handling: Implements error handling for invalid commands and authentication issues.

# Supported Commands

1. Key-Value Operations: SET, GET, DEL, EXPIRE, TTL, INCR, DECR
2. List Operations: LPUSH, RPUSH, LPOP, RPOP, LLEN, LRANGE
3. Set Operations: SADD, SREM, SMEMBERS, SCARD
4. Hash Operations: HSET, HGET, HDEL, HGETALL
5. Sorted Set Operations: ZADD, ZRANGE, ZREM
6. Password Management: SETPASS, AUTH
7. Ping Command: PING to test server connectivity

# Getting Started

1. Clone the Repository

`git clone https://github.com/Sensei079/RedisSnap.git`<br> 
`cd RedisSnap`


2. Install Dependencies

`npm install`

3. Run the Server

`node index.js`

4. Interact with the Server: Use a TCP client to connect to the server on port 6379. Commands can be sent to test functionality.

# Usage

1. Set a password with SETPASS <password>.
2. Authenticate with AUTH <password>.
3. Use supported commands to interact with the server.

# Contributing

Feel free to submit issues or pull requests if you have suggestions or improvements.

