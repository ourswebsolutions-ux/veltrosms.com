import "server-only";
import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

/**
 * Password hashing with scrypt (memory-hard KDF, built into Node — no native
 * dependency). Stored format: scrypt$<log2N>$<r>$<p>$<salt b64>$<hash b64>,
 * so parameters can be raised later and old hashes upgraded on login.
 */

const LOG_N = 15; // N = 32768
const R = 8;
const P = 1;
const KEY_LEN = 64;
const SALT_LEN = 16;

function scrypt(password: string, salt: Buffer, logN: number, r: number, p: number): Promise<Buffer> {
  const N = 2 ** logN;
  const options: ScryptOptions = { N, r, p, maxmem: 256 * N * r };
  return new Promise((resolve, reject) =>
    scryptCb(password.normalize("NFKC"), salt, KEY_LEN, options, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LEN);
  const key = await scrypt(password, salt, LOG_N, R, P);
  return ["scrypt", LOG_N, R, P, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, logN, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scrypt(password, Buffer.from(saltB64, "base64"), Number(logN), Number(r), Number(p));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** True if the hash was made with weaker parameters than the current ones. */
export function needsRehash(stored: string): boolean {
  const [, logN, r, p] = stored.split("$");
  return Number(logN) !== LOG_N || Number(r) !== R || Number(p) !== P;
}

// Precomputed lazily: used to spend the same time when the user doesn't exist,
// so response timing doesn't reveal which emails are registered.
let dummyHash: Promise<string> | undefined;
export async function verifyAgainstDummy(password: string): Promise<false> {
  dummyHash ??= hashPassword("dummy-password-for-timing-0");
  await verifyPassword(password, await dummyHash);
  return false;
}
