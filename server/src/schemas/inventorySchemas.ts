import { z } from 'zod';

// F-10 inventory input rules (contract section 3).
const INT_MAX = 2_147_483_647;
const positiveId = (label: string) =>
  z
    .number({ required_error: `${label} is required.`, invalid_type_error: `${label} must be a number.` })
    .int(`${label} must be a whole number.`)
    .positive(`${label} must be positive.`)
    .max(INT_MAX, `${label} is too large.`);

const name = z
  .string({ required_error: 'Name is required.', invalid_type_error: 'Name must be text.' })
  .trim()
  .min(2, 'Name must be 2–100 characters.')
  .max(100, 'Name must be 2–100 characters.');

const description = z
  .string({ invalid_type_error: 'Description must be text.' })
  .trim()
  .max(500, 'Description must be at most 500 characters.')
  .transform((d) => (d === '' ? null : d))
  .nullable();

export const createItemSchema = z.object({
  assetTag: z
    .string({ required_error: 'Asset tag is required.', invalid_type_error: 'Asset tag must be text.' })
    .trim()
    .min(3, 'Asset tag must be 3–20 characters.')
    .max(20, 'Asset tag must be 3–20 characters.')
    .regex(/^[A-Z0-9]+(-[A-Z0-9]+)*$/, 'Use upper-case letters, digits and single hyphens, e.g. LAP-010.'),
  name,
  categoryId: positiveId('Category'),
  locationId: positiveId('Location'),
  description: description.optional(),
});
export type CreateItemInput = z.infer<typeof createItemSchema>;

export const updateItemSchema = z
  .object({
    name: name.optional(),
    description: description.optional(),
    categoryId: positiveId('Category').optional(),
    locationId: positiveId('Location').optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Change at least one field.' });
export type UpdateItemInput = z.infer<typeof updateItemSchema>;

export const itemStatusSchema = z.object({
  status: z.enum(['AVAILABLE', 'MAINTENANCE', 'RETIRED'], {
    errorMap: () => ({ message: 'Status must be AVAILABLE, MAINTENANCE or RETIRED.' }),
  }),
});
