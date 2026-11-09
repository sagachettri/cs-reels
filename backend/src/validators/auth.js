import { z } from 'zod';

const email = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address.'));

const strongPassword = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(72, 'Password must be at most 72 characters.')
  .regex(/[A-Za-z]/, 'Password must contain at least one letter.')
  .regex(/\d/, 'Password must contain at least one number.');

export const registerBody = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(50, 'Name is too long.'),
  email,
  password: strongPassword,
});

export const loginBody = z.object({
  email,
  password: z.string().min(1, 'Password is required.').max(72),
});

export const updateMeBody = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(50, 'Name is too long.'),
});

export { strongPassword };
