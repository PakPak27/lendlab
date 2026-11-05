import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { login, logout } from '../services/authService.js';

export const authRouter = Router();

// bcrypt only uses the first 72 bytes, so longer input is rejected instead of silently truncated.
const loginSchema = z.object({
  email: z
    .string({ required_error: 'E-mail is required.', invalid_type_error: 'E-mail must be text.' })
    .trim()
    .toLowerCase()
    .max(254, 'E-mail must be at most 254 characters.')
    .email('Enter a valid e-mail address.'),
  password: z
    .string({ required_error: 'Password is required.', invalid_type_error: 'Password must be text.' })
    .min(1, 'Password is required.')
    .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be at most 72 bytes.'),
});

authRouter.post('/auth/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body as z.infer<typeof loginSchema>;
    res.json(await login(email, password));
  } catch (err) {
    next(err);
  }
});

authRouter.get('/auth/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

authRouter.post('/auth/logout', authenticate, async (req, res, next) => {
  try {
    await logout(req.sessionId!);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
