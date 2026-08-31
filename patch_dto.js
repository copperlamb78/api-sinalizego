const fs = require('fs');
const filepath = 'src/modules/financial-profile/dto/create-financial-profile.dto.ts';
let code = fs.readFileSync(filepath, 'utf8');

const importStr = `
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsOptional,
  IsNumber,
  IsDateString,
  IsIn,
} from 'class-validator';
`;

// wait, the file already imports ApiProperty and others.
// Just append the fields to the end of the class.

const addStr = `
  @ApiProperty({
    example: '12345678909',
    description: 'Chave PIX para recebimento',
  })
  @IsString()
  pixAddressKey: string;

  @ApiProperty({
    example: 'CPF',
    description: 'Tipo da chave PIX (CPF, EMAIL, PHONE, RANDOM)',
  })
  @IsString()
  @IsIn(['CPF', 'CNPJ', 'EMAIL', 'PHONE', 'RANDOM'])
  pixAddressKeyType: string;
`;

code = code.replace(
  'postalCode: string;\n}',
  'postalCode: string;\n' + addStr + '\n}'
);

fs.writeFileSync(filepath, code);
