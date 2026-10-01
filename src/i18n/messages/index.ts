import "server-only";
import type { Locale } from "../config";
import type { Messages } from "../translate";
import { bn } from "./bn";
import { en } from "./en";
import { hi } from "./hi";
import { ur } from "./ur";

export const dictionaries: Record<Locale, Messages> = { en, ur, hi, bn };
