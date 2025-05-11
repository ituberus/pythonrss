import dotenv from 'dotenv';
dotenv.config();

export default {
  port: process.env.PORT || 5000,
  mongoURI: process.env.MONGODB_URI || 'mongodb://localhost:27017/riskpay',
  jwtSecret: process.env.JWT_SECRET || 'your_jwt_secret_key_change_this_in_production',
  nodeEnv: process.env.NODE_ENV || 'development',
  defaultTimezone: process.env.DEFAULT_TIMEZONE || 'America/Sao_Paulo',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  emailFrom: process.env.EMAIL_FROM || 'noreply@riskpay.com',
  holdDays: 14, // Default days to hold funds
  supportedCountries: ['US', 'BR'], // Available countries for merchants
};