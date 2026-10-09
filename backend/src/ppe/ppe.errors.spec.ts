import { Prisma } from '@prisma/client';
import { rethrowPpeError } from './ppe.errors';

describe('PPE conflict errors', () => {
  it.each([
    { target: ['article'], code: 'PPE_ITEM_ARTICLE_CONFLICT' },
    { target: 'uq_ppe_items_article', code: 'PPE_ITEM_ARTICLE_CONFLICT' },
    {
      target: ['ppe_item_id', 'value', 'height_value'],
      code: 'PPE_ITEM_SIZE_CONFLICT',
    },
    {
      target: ['ppeItemId', 'value', 'heightValue'],
      code: 'PPE_ITEM_SIZE_CONFLICT',
    },
    { target: 'uq_ppe_item_sizes_item_value', code: 'PPE_ITEM_SIZE_CONFLICT' },
    { target: ['unknown'], code: 'PPE_ALREADY_EXISTS' },
    { target: undefined, code: 'PPE_ALREADY_EXISTS' },
  ])('maps target $target to $code', ({ target, code }) => {
    const error = new Prisma.PrismaClientKnownRequestError('duplicate', {
      code: 'P2002',
      clientVersion: '7.9.0',
      meta: { target },
    });

    let caught: unknown;
    try {
      rethrowPpeError(error);
    } catch (failure) {
      caught = failure;
    }
    expect(caught).toMatchObject({ status: 409, response: { code } });
  });
});
