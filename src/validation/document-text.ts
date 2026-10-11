import { z } from 'zod';

/** XML 1.0 permits tabs, line endings and Unicode scalar values, but not lone surrogates. */
export const documentTextSchema = z
  .string()
  .refine((value) => {
    for (const character of value) {
      const code = character.codePointAt(0)!;
      if (
        code !== 9 &&
        code !== 10 &&
        code !== 13 &&
        !(code >= 0x20 && code <= 0xd7ff) &&
        !(code >= 0xe000 && code <= 0xfffd) &&
        !(code >= 0x10000 && code <= 0x10ffff)
      )
        return false;
    }
    return true;
  }, 'Text contains characters that XML 1.0 cannot represent')
  .describe(
    'Literal document text; unsupported XML control characters are rejected.',
  );
