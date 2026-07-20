import { ApiProperty } from '@nestjs/swagger';

export class ListServiceBySlugDto {
  @ApiProperty({
    example: 'meu-negocio',
    description: 'Slug do negócio',
  })
  slug: string;
}
