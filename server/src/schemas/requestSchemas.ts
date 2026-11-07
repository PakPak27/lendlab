import { z } from 'zod';

// F-04 input rules (contract section 3).
// BR-04: loan length is a whole number of days, 1-14. A string such as "7" is rejected, not converted.
// BR-14: purpose is required, 5-200 characters after trimming.
export const createRequestSchema = z.object({
  itemId: z
    .number({ required_error: 'Item is required.', invalid_type_error: 'Item id must be a number.' })
    .int('Item id must be a whole number.')
    .positive('Item id must be positive.'),
  purpose: z
    .string({ required_error: 'Purpose is required.', invalid_type_error: 'Purpose must be text.' })
    .trim()
    .min(5, 'Purpose must be at least 5 characters.')
    .max(200, 'Purpose must be at most 200 characters.'),
  requestedDays: z
    .number({
      required_error: 'Loan length is required.',
      invalid_type_error: 'Loan length must be a number of days.',
    })
    .int('Loan length must be a whole number of days.')
    .min(1, 'Loan length must be at least 1 day.')
    .max(14, 'Loan length must be at most 14 days.'),
});

export type CreateRequestInput = z.infer<typeof createRequestSchema>;

export const requestIdParams = z.object({
  id: z
    .string()
    .regex(/^[1-9]\d*$/, 'Request id must be a positive whole number.')
    .transform(Number),
});
