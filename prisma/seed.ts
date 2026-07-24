import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Iniciando o seed... 🌱');

  const passwordHash = await bcrypt.hash('senha123', 10);

  // 1. Criar o Super Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@sinalizego.com' },
    update: {},
    create: {
      email: 'admin@sinalizego.com',
      name: 'Gabriel Admin',
      password: passwordHash,
      role: 'SUPER_ADMIN',
      phone: '11999999999', // 👈 Campo obrigatório adicionado
    },
  });

  // 2. Criar um Barbeiro (Provider) de teste
  const provider = await prisma.user.upsert({
    where: { email: 'barbeiro@teste.com' },
    update: {},
    create: {
      email: 'barbeiro@teste.com',
      name: 'Barbearia do Zé',
      password: passwordHash,
      role: 'PROVIDER',
      phone: '11988888888', // 👈 Campo obrigatório adicionado
    },
  });

  // 3. Criar um Cliente de teste
  const client = await prisma.user.upsert({
    where: { email: 'cliente@teste.com' },
    update: {},
    create: {
      email: 'cliente@teste.com',
      name: 'Cliente Silva',
      password: passwordHash,
      role: 'CLIENT',
      phone: '11977777777', // 👈 Campo obrigatório adicionado
    },
  });

  console.log('✅ Banco populado com sucesso!');
  console.log(`🔑 Todos os usuários criados com a senha: 'senha123'`);
  console.log({
    Admin: admin.email,
    Provider: provider.email,
    Client: client.email,
  });
}

main()
  .catch((e) => {
    console.error('❌ Erro ao rodar o seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
