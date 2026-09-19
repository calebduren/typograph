import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';

// Package the original PNG exports in an ICO container without resizing or re-encoding.
const publicDirectory = new URL('../apps/playground/public/', import.meta.url);
const sizes = [16, 32, 48];
const images = sizes.map((size) => {
  const image = readFileSync(new URL(`favicon-${size}.png`, publicDirectory));
  assert.equal(image.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(image.readUInt32BE(16), size);
  assert.equal(image.readUInt32BE(20), size);
  return image;
});
const header = Buffer.alloc(6 + sizes.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
images.forEach((image, index) => {
  const entry = 6 + index * 16;
  header.writeUInt8(sizes[index], entry);
  header.writeUInt8(sizes[index], entry + 1);
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(image.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += image.length;
});
writeFileSync(new URL('favicon.ico', publicDirectory), Buffer.concat([header, ...images]));
