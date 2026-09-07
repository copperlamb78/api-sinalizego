import { PrismaClient, Role } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.argv[2] || process.env.ADMIN_EMAIL || 'admin@sinalizego.com';
  const rawPassword = process.argv[3] || process.env.ADMIN_PASSWORD || 'Admin@SinalizeGo2026';
  const name = process.argv[4] || process.env.ADMIN_NAME || 'Super Admin SinalizeGO';
  const phone = process.argv[5] || '5561999999999';

  console.log(`\n==============================================`);
  console.log(` Criando / Promovendo Super Admin SinalizeGO`);
  console.log(` E-mail: ${email}`);
  console.log(` Nome:   ${name}`);
  console.log(`==============================================\n`);

  const hashedPassword = await bcrypt.hash(rawPassword, 10);

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    const updated = await prisma.user.update({
      where: { email },
      data: {
        name,
        role: Role.SUPER_ADMIN,
        password: hashedPassword,
        isActive: true,
        disabledAt: null,
        mustChangePassword: false,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    console.log(`✅ Usuário existente atualizado para SUPER_ADMIN com sucesso!`);
    console.log(updated);
  } else {
    const created = await prisma.user.create({
      data: {
        name,
        email,
        phone,
        password: hashedPassword,
        role: Role.SUPER_ADMIN,
        isActive: true,
        mustChangePassword: false,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    console.log(`✅ Novo usuário SUPER_ADMIN criado com sucesso!`);
    console.log(created);
  }

  console.log(`\n🔑 Credenciais de acesso configuradas:`);
  console.log(`   E-mail: ${email}`);
  console.log(`   Senha:  ${rawPassword}\n`);
}

main()
  .catch((e) => {
    console.error('❌ Erro ao criar Super Admin:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
