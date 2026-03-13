import { BadRequestException } from '@nestjs/common';

export const ORG_ID_HEADER = 'x-org-id';

export const requireOrgId = (orgId: string | undefined): string => {
  const cleanOrgId = orgId?.trim();
  if (!cleanOrgId) {
    throw new BadRequestException(`Missing required header: ${ORG_ID_HEADER}`);
  }
  return cleanOrgId;
};
