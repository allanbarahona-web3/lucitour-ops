import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ContractsService } from './contracts.service';
import { SendContractPdfDto } from './dto/send-contract-pdf.dto';

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
}
