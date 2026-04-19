// Per-userId async lock — prevents concurrent balance read-modify-write races.
// Usage: await withLock(`bal:${userId}`, async () => { ...read, modify, write... });

const _locks = new Map();

async function withLock(key, fn) {
  while (_locks.has(key)) {
    await _locks.get(key);
  }
  let release;
  const p = new Promise(r => { release = r; });
  _locks.set(key, p);
  try {
    return await fn();
  } finally {
    _locks.delete(key);
    release();
  }
}

module.exports = { withLock };
