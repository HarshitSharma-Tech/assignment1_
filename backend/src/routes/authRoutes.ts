import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Phone Number + Mock OTP Login (Credsetu Assignment Requirement)
router.post('/send-otp', AuthController.sendOtp);
router.post('/otp/send', AuthController.sendOtp);
router.post('/verify-otp', AuthController.verifyOtp);
router.post('/otp/verify', AuthController.verifyOtp);

// Standard Email/Password Login (Retained for test suite & seeds)
router.post('/register', AuthController.register);
router.post('/login', AuthController.login);

// Profile
router.get('/me', authenticateToken, AuthController.me);

export default router;
