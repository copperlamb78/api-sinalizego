import { ApiProperty } from '@nestjs/swagger';
import { Equals, IsBoolean } from 'class-validator';
import { CreateCompanyDto } from '../../company/dto/company-create.dto';

export class CreateFounderDto extends CreateCompanyDto {
  @ApiProperty({
    description:
      'Termo de consentimento obrigatório para participar do Programa de Fundadores e pesquisas de feedback',
    example: true,
  })
  @IsBoolean()
  @Equals(true, {
    message:
      'O consentimento com os termos de Fundador e pesquisas trimestrais é obrigatório para inscrição.',
  })
  surveyConsent: boolean;
}
