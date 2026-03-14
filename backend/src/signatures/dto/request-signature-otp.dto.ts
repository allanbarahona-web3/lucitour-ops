import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class RequestSignatureOtpDto {
  @ApiProperty({ required: false, enum: ['email', 'sms'] })
  @IsOptional()
  @IsString()
  @IsIn(['email', 'sms'])
  deliveryChannel?: 'email' | 'sms';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  destinationHint?: string;
}
