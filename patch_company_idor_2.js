const fs = require('fs');
const filepath = 'src/modules/company/company.service.ts';
let code = fs.readFileSync(filepath, 'utf8');

const idorFullStr = `
    let company: { id: string; businessName: string; slug: string; userId?: string } | null = null;

    if (dto?.companyId) {
      company = await this.prisma.company.findFirst({
        where: { id: dto.companyId, isActive: true },
        select: { id: true, businessName: true, slug: true, userId: true },
      });
      if (!company) {
        throw new NotFoundException('Estabelecimento não encontrado.');
      }
      if (userRole !== Role.ADMIN && userRole !== Role.SUPER_ADMIN) {
        if (company.userId !== userId) {
          throw new import('@nestjs/common').ForbiddenException('Você não tem permissão para acessar os dados deste estabelecimento.');
        }
      }
    } else {
      if (userRole === Role.ADMIN || userRole === Role.SUPER_ADMIN) {
        throw new BadRequestException('Informe o companyId para consultar as métricas do estabelecimento.');
      }
      company = await this.prisma.company.findFirst({
        where: { userId, isActive: true },
        select: { id: true, businessName: true, slug: true, userId: true },
      });
      if (!company) {
        throw new NotFoundException('Estabelecimento não encontrado para este usuário.');
      }
    }
`;

code = code.replace(
  /let company: \{ id: string; businessName: string; slug: string \} \| null =\n      null;\n\n    if \(userRole === Role\.ADMIN \|\| userRole === Role\.SUPER_ADMIN\) \{[\s\S]*?\}\n    \} else \{\n      \/\/ Dono de estabelecimento \(COMPANY_OWNER\)\n      company = await this\.prisma\.company\.findFirst\(\{\n        where: \{ userId, isActive: true \},\n        select: \{ id: true, businessName: true, slug: true \},\n      \}\);\n      if \(!company\) \{\n        throw new NotFoundException\(\n          'Estabelecimento não encontrado para este usuário\.',\n        \);\n      \}\n    \}/m,
  idorFullStr
);

fs.writeFileSync(filepath, code);
