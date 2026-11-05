// F-02 record-level scope (BR-05, BR-06): the query filters that every Sprint 1 feature must use.
import { describe, expect, it } from 'vitest';
import { borrowerScope, custodianScope } from '../../src/lib/scope.js';

const borrower = { id: 7, email: 'b@lendlab.test', name: 'B', role: 'BORROWER' as const, locationIds: [] };
const custodian = { id: 9, email: 'c@lendlab.test', name: 'C', role: 'CUSTODIAN' as const, locationIds: [2, 5] };

describe('record scope filters', () => {
  it('a borrower sees only records where they are the borrower (BR-06)', () => {
    expect(borrowerScope(borrower)).toEqual({ borrowerId: 7 });
  });

  it('a custodian sees only records for items in their assigned locations (BR-05)', () => {
    expect(custodianScope(custodian)).toEqual({ item: { locationId: { in: [2, 5] } } });
  });

  it('a custodian with no assigned location matches nothing', () => {
    expect(custodianScope({ ...custodian, locationIds: [] })).toEqual({ item: { locationId: { in: [] } } });
  });
});
