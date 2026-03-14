import { Injectable, ServiceUnavailableException, BadGatewayException } from '@nestjs/common';
import { Resend } from 'resend';
import { SendContractPdfDto } from './dto/send-contract-pdf.dto';

@Injectable()
export class ContractsService {
  private static toHtml(messageText: string): string {
    return messageText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map(
        (line) =>
          `<p>${line.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</p>`,
      )
      .join('');
  }

  async sendContractPdf(payload: SendContractPdfDto): Promise<void> {
    const resendApiKey = process.env.RESEND_API_KEY?.trim();
    if (!resendApiKey) {
      throw new ServiceUnavailableException('Missing RESEND_API_KEY');
    }

    const fromEmail = process.env.CONTRACTS_FROM_EMAIL?.trim();
    if (!fromEmail) {
      throw new ServiceUnavailableException('Missing CONTRACTS_FROM_EMAIL');
    }

    const resend = new Resend(resendApiKey);

    try {
      await resend.emails.send({
        from: fromEmail,
        to: [payload.to],
        subject: payload.subject,
        text: payload.messageText,
        html: ContractsService.toHtml(payload.messageText),
        attachments: [
          {
            filename: payload.fileName,
            content: payload.pdfBase64,
          },
        ],
      });
    } catch {
      throw new BadGatewayException('Unable to send email with contract PDF attachment');
    }
  }
}
