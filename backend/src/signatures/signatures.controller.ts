import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { requireOrgId } from '../common/get-org-id';
import { CreateSignatureRequestDto } from './dto/create-signature-request.dto';
import { RequestSignatureOtpDto } from './dto/request-signature-otp.dto';
import { ReviewSignatureRequestDto } from './dto/review-signature-request.dto';
import { SubmitSignatureDto } from './dto/submit-signature.dto';
import { SignaturesService } from './signatures.service';

@ApiTags('signatures')
@Controller('signatures')
export class SignaturesController {
  constructor(private readonly signaturesService: SignaturesService) {}

  @Post('requests')
  async createRequest(
    @Headers('x-org-id') orgIdHeader: string | undefined,
    @Body() payload: CreateSignatureRequestDto,
  ) {
    const orgId = requireOrgId(orgIdHeader);
    return this.signaturesService.createRequest(orgId, payload);
  }

  @Post('requests/:requestId/otp')
  async requestOtp(
    @Headers('x-org-id') orgIdHeader: string | undefined,
    @Param('requestId') requestId: string,
    @Body() payload: RequestSignatureOtpDto,
  ) {
    const orgId = requireOrgId(orgIdHeader);
    return this.signaturesService.requestOtp(orgId, requestId, payload);
  }

  @Post('requests/:requestId/submit')
  async submitSignature(
    @Headers('x-org-id') orgIdHeader: string | undefined,
    @Param('requestId') requestId: string,
    @Body() payload: SubmitSignatureDto,
  ) {
    const orgId = requireOrgId(orgIdHeader);
    return this.signaturesService.submitSignature(orgId, requestId, payload);
  }

  @Post('requests/:requestId/review')
  async reviewRequest(
    @Headers('x-org-id') orgIdHeader: string | undefined,
    @Param('requestId') requestId: string,
    @Body() payload: ReviewSignatureRequestDto,
  ) {
    const orgId = requireOrgId(orgIdHeader);
    return this.signaturesService.reviewRequest(orgId, requestId, payload);
  }

  @Get('requests/:requestId')
  async getRequest(
    @Headers('x-org-id') orgIdHeader: string | undefined,
    @Param('requestId') requestId: string,
  ) {
    const orgId = requireOrgId(orgIdHeader);
    return this.signaturesService.getRequest(orgId, requestId);
  }
}
