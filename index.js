const net = require('net');
const Parser = require('redis-parser');

const store = {};
const expirations = {};
const sets = {};
const hashes = {};
const sortedSets = {};

const PASSWORD_NOT_SET_MESSAGE = '-ERR Password must be set before executing commands.\r\n';

const server = net.createServer(connection => {
    console.log('Client connected...');

    const parser = new Parser({
        returnReply: (reply) => {
            console.log('Reply:', reply);

            const command = reply[0].toLowerCase();
            const key = reply[1];
            const value = reply[2];

            if (!store.__passwordSet) {
                if (command === 'setpass') {
                    store.__password = key;
                    store.__passwordSet = true;
                    connection.write('+OK Password set successfully.\r\n');
                } else {
                    connection.write(PASSWORD_NOT_SET_MESSAGE);
                }
                return;
            }

            if (command !== 'auth' && command !== 'setpass' && !store.__authenticatedClients?.has(connection)) {
                connection.write('-NOAUTH Authentication required.\r\n');
                return;
            }

            switch (command) {
                case 'auth': {
                    const providedPassword = key;
                    if (providedPassword === store.__password) {
                        if (!store.__authenticatedClients) {
                            store.__authenticatedClients = new Set();
                        }
                        store.__authenticatedClients.add(connection);
                        connection.write('+Thank You\r\n');
                    } else {
                        connection.write('-ERR invalid password\r\n');
                    }
                    break;
                }

                case 'setpass': {
                    if (!store.__authenticatedClients?.has(connection)) {
                        connection.write('-ERR You must authenticate first.\r\n');
                        break;
                    }

                    if (reply.length < 2) {
                        connection.write('-ERR Usage: setpass <newpassword>\r\n');
                        break;
                    }

                    const newPassword = reply[1];
                    store.__password = newPassword;
                    connection.write('+OK Password set successfully.\r\n');
                    break;
                }

                case 'ping': {
                    connection.write('+PONG\r\n');
                    break;
                }

                case 'set': {
                    store[key] = value;
                    connection.write('+Thank You\r\n');
                    break;
                }

                case 'get': {
                    if (expirations[key] && Date.now() > expirations[key]) {
                        delete store[key];
                        delete expirations[key];
                        connection.write('$-1\r\n');
                    } else if (store[key]) {
                        connection.write(`$${store[key].length}\r\n${store[key]}\r\n`);
                    } else {
                        connection.write('$-1\r\n');
                    }
                    break;
                }

                case 'expire': {
                    const seconds = Number(value);
                    if (store[key]) {
                        expirations[key] = Date.now() + seconds * 1000;
                        connection.write(':1\r\n');
                    } else {
                        connection.write(':0\r\n');
                    }
                    break;
                }

                case 'ttl': {
                    if (!store[key]) {
                        connection.write(':-2\r\n');
                    } else if (expirations[key]) {
                        const ttl = Math.ceil((expirations[key] - Date.now()) / 1000);
                        connection.write(`:${ttl}\r\n`);
                    } else {
                        connection.write(':-1\r\n');
                    }
                    break;
                }

                case 'del': {
                    const keysToDelete = reply.slice(1);
                    let deletedCount = 0;

                    for (const k of keysToDelete) {
                        if (store[k]) {
                            delete store[k];
                            delete expirations[k];
                            deletedCount++;
                        }
                    }
                    connection.write(`:${deletedCount}\r\n`);
                    break;
                }

                case 'incr': {
                    if (store[key]) {
                        const currentVal = parseInt(store[key], 10);
                        if (!isNaN(currentVal)) {
                            store[key] = (currentVal + 1).toString();
                            connection.write(`:${store[key]}\r\n`);
                        } else {
                            connection.write('-ERR value is not an integer\r\n');
                        }
                    } else {
                        store[key] = '1';
                        connection.write(':1\r\n');
                    }
                    break;
                }

                case 'decr': {
                    if (store[key]) {
                        const currentVal = parseInt(store[key], 10);
                        if (!isNaN(currentVal)) {
                            store[key] = (currentVal - 1).toString();
                            connection.write(`:${store[key]}\r\n`);
                        } else {
                            connection.write('-ERR value is not an integer\r\n');
                        }
                    } else {
                        store[key] = '-1';
                        connection.write(':-1\r\n');
                    }
                    break;
                }

                case 'lpush': {
                    if (!store[key]) {
                        store[key] = [];
                    }
                    for (let i = 2; i < reply.length; i++) {
                        store[key].unshift(reply[i]);
                    }
                    connection.write(`:${store[key].length}\r\n`);
                    break;
                }

                case 'rpush': {
                    if (!store[key]) {
                        store[key] = [];
                    }
                    store[key].push(value);
                    connection.write(`:${store[key].length}\r\n`);
                    break;
                }

                case 'lpop': {
                    if (!store[key] || store[key].length === 0) {
                        connection.write('$-1\r\n');
                    } else {
                        const poppedValue = store[key].shift();
                        connection.write(`$${poppedValue.length}\r\n${poppedValue}\r\n`);
                    }
                    break;
                }

                case 'rpop': {
                    if (!store[key] || store[key].length === 0) {
                        connection.write('$-1\r\n');
                    } else {
                        const poppedValue = store[key].pop();
                        connection.write(`$${poppedValue.length}\r\n${poppedValue}\r\n`);
                    }
                    break;
                }

                case 'llen': {
                    if (!store[key]) {
                        connection.write(':0\r\n');
                    } else {
                        connection.write(`:${store[key].length}\r\n`);
                    }
                    break;
                }

                case 'lrange': {
                    const start = Number(reply[2]);
                    const end = Number(reply[3]);

                    if (!store[key] || !Array.isArray(store[key])) {
                        connection.write('*0\r\n');
                    } else {
                        const listLength = store[key].length;
                        const startIndex = start < 0 ? Math.max(listLength + start, 0) : Math.min(start, listLength);
                        const endIndex = end < 0 ? Math.max(listLength + end + 1, 0) : Math.min(end + 1, listLength);

                        const range = store[key].slice(startIndex, endIndex);
                        connection.write(`*${range.length}\r\n`);
                        range.forEach(item => {
                            connection.write(`$${item.length}\r\n${item}\r\n`);
                        });
                    }
                    break;
                }

                case 'sadd': {
                    if (!sets[key]) {
                        sets[key] = new Set();
                    }
                    const members = reply.slice(2);
                    let addedCount = 0;
                    members.forEach(member => {
                        if (!sets[key].has(member)) {
                            sets[key].add(member);
                            addedCount++;
                        }
                    });
                    connection.write(`:${addedCount}\r\n`);
                    break;
                }

                case 'srem': {
                    if (!sets[key]) {
                        connection.write(':0\r\n');
                        break;
                    }
                    const members = reply.slice(2);
                    let removedCount = 0;
                    members.forEach(member => {
                        if (sets[key].delete(member)) {
                            removedCount++;
                        }
                    });
                    connection.write(`:${removedCount}\r\n`);
                    break;
                }

                case 'smembers': {
                    if (!sets[key]) {
                        connection.write('*0\r\n');
                        break;
                    }
                    const members = Array.from(sets[key]);
                    connection.write(`*${members.length}\r\n`);
                    members.forEach(member => {
                        connection.write(`$${member.length}\r\n${member}\r\n`);
                    });
                    break;
                }

                case 'scard': {
                    if (!sets[key]) {
                        connection.write(':0\r\n');
                    } else {
                        connection.write(`:${sets[key].size}\r\n`);
                    }
                    break;
                }

                case 'hset': {
                    if (!hashes[key]) {
                        hashes[key] = {};
                    }
                    const field = reply[2];
                    const value = reply[3];
                    hashes[key][field] = value;
                    connection.write(':1\r\n');
                    break;
                }

                case 'hget': {
                    if (!hashes[key] || !(reply[2] in hashes[key])) {
                        connection.write('$-1\r\n');
                    } else {
                        const value = hashes[key][reply[2]];
                        connection.write(`$${value.length}\r\n${value}\r\n`);
                    }
                    break;
                }

                case 'hdel': {
                    if (!hashes[key]) {
                        connection.write(':0\r\n');
                        break;
                    }
                    const fields = reply.slice(2);
                    let deletedCount = 0;
                    fields.forEach(field => {
                        if (field in hashes[key]) {
                            delete hashes[key][field];
                            deletedCount++;
                        }
                    });
                    connection.write(`:${deletedCount}\r\n`);
                    break;
                }

                case 'hgetall': {
                    if (!hashes[key]) {
                        connection.write('*0\r\n');
                        break;
                    }
                    const fields = Object.entries(hashes[key]);
                    connection.write(`*${fields.length * 2}\r\n`);
                    fields.forEach(([field, value]) => {
                        connection.write(`$${field.length}\r\n${field}\r\n`);
                        connection.write(`$${value.length}\r\n${value}\r\n`);
                    });
                    break;
                }

                case 'zadd': {
                    if (!sortedSets[key]) {
                        sortedSets[key] = new Map();
                    }
                    const score = Number(reply[2]);
                    const member = reply[3];
                    sortedSets[key].set(member, score);
                    connection.write(':1\r\n');
                    break;
                }

                case 'zrange': {
                    if (!sortedSets[key]) {
                        connection.write('*0\r\n');
                        break;
                    }
                    const start = Number(reply[2]);
                    const end = Number(reply[3]);
                    const sortedSet = Array.from(sortedSets[key]).sort((a, b) => a[1] - b[1]);
                    const range = sortedSet.slice(start, end + 1);
                    connection.write(`*${range.length}\r\n`);
                    range.forEach(([member]) => {
                        connection.write(`$${member.length}\r\n${member}\r\n`);
                    });
                    break;
                }

                case 'zrem': {
                    if (!sortedSets[key]) {
                        connection.write(':0\r\n');
                        break;
                    }
                    const members = reply.slice(2);
                    let removedCount = 0;
                    members.forEach(member => {
                        if (sortedSets[key].delete(member)) {
                            removedCount++;
                        }
                    });
                    connection.write(`:${removedCount}\r\n`);
                    break;
                }

                default:
                    connection.write('-ERR unknown command\r\n');
                    break;
            }
        },
        returnError: (error) => {
            console.error('Error:', error);
            connection.write(`-ERR ${error.message}\r\n`);
        }
    });

    connection.on('data', data => {
        parser.execute(data);
    });

    connection.on('end', () => {
        console.log('Client disconnected.');
    });
});

server.listen(6379, () => {
    console.log('Server listening on port 6379...');
});
