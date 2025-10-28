import { Request, Response, NextFunction } from 'express';
import { GeoLocation, getLocationFromIP } from '../utils/geolocation.js';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      signingMetadata?: SigningMetadata;
    }
  }
}

export interface LocationData {
  latitude: number;
  longitude: number;
  geoLocation?: GeoLocation;
}

export interface SigningMetadata {
  ipAddress: string;
  userAgent: string;
  location?: LocationData;
}

export async function trackSigningMetadata(req: Request, _res: Response, next: NextFunction) {
  try {
    // Robust client IP extraction
    const xff = req.headers['x-forwarded-for'];
    let rawIp: string | undefined;
    if (typeof xff === 'string' && xff.length > 0) {
      rawIp = xff.split(',')[0]?.trim();
    } else if (Array.isArray(xff) && xff.length > 0) {
      rawIp = String(xff[0]).trim();
    }
    if (!rawIp) {
      const xri = req.headers['x-real-ip'];
      rawIp = (Array.isArray(xri) ? xri[0] : (xri as string | undefined)) || undefined;
    }
    if (!rawIp) {
      rawIp = req.socket.remoteAddress || (req.connection as any)?.remoteAddress || (req as any).ip || undefined;
    }
    const normalizeIp = (ip?: string) => {
      if (!ip) return undefined;
      let v = ip;
      // strip port if present
      if (v.includes(':') && v.includes('.')) {
        // IPv4-mapped with port like ::ffff:127.0.0.1:12345
        const parts = v.split(':');
        const lastPart = parts[parts.length - 1];
        if (lastPart) v = lastPart;
      }
      if (v.startsWith('::ffff:')) v = v.replace('::ffff:', '');
      if (v === '::1') v = '127.0.0.1';
      return v;
    };
    const ip = normalizeIp(rawIp) || 'Unknown';

    // Get user agent
    const userAgent = req.headers['user-agent'] || 'Unknown';

    const location = req.body.location || {}; // Get browser location if provided

    // Get geolocation from IP (skip private/local IP lookups)
    const ipForGeo = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|127\.|::1|fc00:|fe80:|fd)/.test(ip) ? '' : ip;
    const geoLocation = await getLocationFromIP(ipForGeo);

    // Attach to request object
    req.signingMetadata = {
      ipAddress: ip,
      userAgent,
      location: {
        ...location,
        geoLocation
      }
    };

    next();
  } catch (error) {
    console.error('Error in tracking middleware:', error);
    next(error);
  }
}