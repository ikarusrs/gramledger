import { describe, expect, it } from 'vitest';

import { messages, mrMessages } from '../core/i18n/messages';

describe('i18n messages', () => {
  it('en and mr have identical key sets', () => {
    expect(Object.keys(messages.en).sort()).toEqual(Object.keys(mrMessages).sort());
  });
});
