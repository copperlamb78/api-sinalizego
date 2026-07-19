import { PrismaService } from 'src/prisma/prisma.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class SlugHelper {
  constructor(private readonly prisma: PrismaService) {}

  async createSlug(name: string): Promise<string> {
    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-') // Substitui caracteres não alfanuméricos por hífens
      .replace(/^-+|-+$/g, ''); // Remove hífens no início e no final

    // 1. Verifica se o slug exato já existe
    const existingSlug = await this.prisma.provider.findUnique({
      where: { slug: baseSlug },
    });

    // Se não existir, retorna ele mesmo e finaliza a função
    if (!existingSlug) {
      return baseSlug;
    }

    // 2. Busca todos que começam com "baseslug-"
    // O hífen é crucial para que "nexo" não encontre "nexos-corp"
    const similarSlugs = await this.prisma.provider.findMany({
      where: {
        slug: {
          startsWith: `${baseSlug}-`,
        },
      },
    });

    // Se só existe o base, o primeiro com número será o -1
    if (similarSlugs.length === 0) {
      return `${baseSlug}-1`;
    }

    // 3. Mapeia o array para pegar apenas os números e encontra o maior deles
    const maxNumber = Math.max(
      ...similarSlugs.map((provider) => {
        const lastPart = provider.slug.split('-').pop();
        const num = parseInt(lastPart || '0', 10);
        return isNaN(num) ? 0 : num;
      }),
    );

    // Retorna o slug base somando 1 ao maior número encontrado
    return `${baseSlug}-${maxNumber + 1}`;
  }
}
