import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsObject, IsOptional } from 'class-validator';

export class AsaasWebhookDto {
  @ApiProperty({
    description: 'O tipo do evento gerado',
    example: 'PAYMENT_RECEIVED',
  })
  @IsString()
  event: string;

  @ApiPropertyOptional({
    description: 'Objeto de pagamento enviado pelo webhook',
  })
  @IsOptional()
  @IsObject()
  payment?: any;

  @ApiPropertyOptional({
    description: 'Objeto de nota fiscal enviado pelo webhook',
  })
  @IsOptional()
  @IsObject()
  invoice?: any;

  @ApiPropertyOptional({
    description: 'O ID do evento no Asaas',
    example: 'evt_123456',
  })
  @IsOptional()
  @IsString()
  id?: string;
}
