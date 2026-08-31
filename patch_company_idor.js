const fs = require('fs');
const filepath = 'src/modules/company/company.service.ts';
let code = fs.readFileSync(filepath, 'utf8');

const idorStr = `
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
            throw new ForbiddenException('Você não tem permissão para acessar os dados deste estabelecimento.');
          }
        }
      } else {
`;

code = code.replace(
  /if \(dto\?\.companyId\) \{\n        company = await this\.prisma\.company\.findFirst\(\{\n          where: \{ id: dto\.companyId, isActive: true \},\n          select: \{ id: true, businessName: true, slug: true \},\n        \}\);\n        if \(!company\) \{\n          throw new NotFoundException\('Estabelecimento não encontrado\.'\);\n        \}\n      \} else \{/m,
  idorStr
);

// We also need to fix the role check because originally it was:
// if (userRole === Role.ADMIN || userRole === Role.SUPER_ADMIN) { ... dto?.companyId ... } else { ... }
// Since we want non-admins to also be able to pass dto?.companyId (or just use their own if not passed), we need to update the logic.
