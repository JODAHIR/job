// Bounded concurrency with stable result order; a failed read rejects the load.
export async function readPool(items, read, concurrency = 6) {
  if (!Number.isInteger(concurrency) || concurrency < 1) throw Error('Concurrencia inválida');
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({length: Math.min(concurrency, items.length)}, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await read(items[index], index);
    }
  }));
  return results;
}
