import { AppRole } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  orgId: string;
  email: string;
  roles: AppRole[];
  sid: string;
  type: 'access' | 'refresh';
}
