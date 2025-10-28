import jwt from 'jsonwebtoken';
import { SignOptions } from 'jsonwebtoken';

interface UserPayload {
  id: string;
  email: string;
  role: string;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface SignerSession {
  token: string;
  signerId: string;
  envelopeId: string;
  email: string;
}

interface JwtConfig {
  jwtSecret: string;
  refreshSecret: string;
  jwtExpiry: string;
  refreshExpiry: string;
}

const getJwtConfig = (): JwtConfig => ({
  jwtSecret: process.env['JWT_SECRET'] || '',
  refreshSecret: process.env['REFRESH_TOKEN_SECRET'] || '',
  jwtExpiry: process.env['JWT_EXPIRY'] || '24h',
  refreshExpiry: process.env['REFRESH_TOKEN_EXPIRY'] || '7d'
});

export type { SignerSession, UserPayload, TokenPair };

export function createUserTokens(user: UserPayload): TokenPair {
  const config = getJwtConfig();
  
  const accessToken = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    config.jwtSecret,
    { expiresIn: config.jwtExpiry } as SignOptions
  );

  const refreshToken = jwt.sign(
    { id: user.id, tokenType: 'refresh' },
    config.refreshSecret,
    { expiresIn: config.refreshExpiry } as SignOptions
  );

  return { accessToken, refreshToken };
}

export function verifyAccessToken(token: string): UserPayload | null {
  try {
    const config = getJwtConfig();
    const decoded = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload & UserPayload;
    return {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role
    };
  } catch (error) {
    return null;
  }
}

export function verifyRefreshToken(token: string): string | null {
  try {
    const config = getJwtConfig();
    const decoded = jwt.verify(token, config.refreshSecret) as jwt.JwtPayload & {
      id: string;
      tokenType: string;
    };

    if (decoded.tokenType !== 'refresh') {
      return null;
    }

    return decoded.id;
  } catch (error) {
    return null;
  }
}

export function createSignerSession(signer: {
  id: string;
  envelopeId: string;
  email: string;
}): SignerSession {
  const config = getJwtConfig();
  const payload = {
    signerId: signer.id,
    envelopeId: signer.envelopeId,
    email: signer.email,
    type: 'signer_session'
  };

  const token = jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiry
  } as SignOptions);

  return {
    token,
    signerId: signer.id,
    envelopeId: signer.envelopeId,
    email: signer.email
  };
}

export function verifySignerSession(token: string): SignerSession | null {
  try {
    const config = getJwtConfig();
    const decoded = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload & {
      signerId: string;
      envelopeId: string;
      email: string;
      type: string;
    };

    if (decoded.type !== 'signer_session') {
      return null;
    }

    return {
      token,
      signerId: decoded.signerId,
      envelopeId: decoded.envelopeId,
      email: decoded.email
    };
  } catch (error) {
    return null;
  }
}