import type { Request, Response, NextFunction } from 'express';
import { UAParser } from 'ua-parser-js';

export function attachRequestMeta(req: Request, _res: Response, next: NextFunction) {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
  const ua = req.headers['user-agent'] || '';
  const parser = new UAParser(ua);
  const device = parser.getResult();
  // @ts-expect-error attach meta for downstream use
  req._meta = { ip, ua, device, at: new Date().toISOString() };
  next();
}


