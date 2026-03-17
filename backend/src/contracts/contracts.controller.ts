import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { requireOrgId } from '../common/get-org-id';
import { ContractsService } from './contracts.service';
import { SendContractPdfDto } from './dto/send-contract-pdf.dto';
import { UploadContractDocumentDto } from './dto/upload-contract-document.dto';

@ApiTags('contracts')
@Controller('contracts')
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Post('send-pdf')
  @HttpCode(HttpStatus.OK)
  async sendPdf(@Body() payload: SendContractPdfDto): Promise<{ ok: true }> {
    await this.contractsService.sendContractPdf(payload);
    return { ok: true };
  }

  @Post(':contractId/documents')
  async uploadDocument(
    @Headers('x-org-id') orgIdHeader: string | undefined,
    @Param('contractId') contractId: string,
    @Body() payload: UploadContractDocumentDto,
  ) {
    const orgId = requireOrgId(orgIdHeader);
    return this.contractsService.uploadDocument(orgId, contractId, payload);
  }

  @Get(':contractId/documents')
  async listDocuments(
    @Headers('x-org-id') orgIdHeader: string | undefined,
    @Param('contractId') contractId: string,
  ) {
    const orgId = requireOrgId(orgIdHeader);
    return this.contractsService.listDocuments(orgId, contractId);
  }
}
