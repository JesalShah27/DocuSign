declare global {
  namespace NodeJS {
    interface ProcessEnv {
      JWT_SECRET: string;
      FRONTEND_URL: string;
      PORT: string;
      HTTPS_PORT: string;
      SSL_KEY_PATH: string;
      SSL_CERT_PATH: string;
      SENDGRID_API_KEY: string;
      FROM_EMAIL: string;
      FROM_NAME: string;
      NODE_ENV: 'development' | 'production' | 'test';
      BLOCKED_IPS: string;
    }
  }
}