import { PrismaClient, Role } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const SEED_USERS = [
  {
    employeeId: 'admin001',
    password: 'test1234',
    name: 'Alice Admin',
    email: 'admin001@unleash.com',
    role: Role.Admin,
    region: 'Global',
    department: 'IT',
    jobLevel: 'L5',
    jobTitle: 'System Administrator',
  },
  {
    employeeId: 'hr001',
    password: 'test1234',
    name: 'Helen HR',
    email: 'hr001@unleash.com',
    role: Role.RegionalHR,
    region: 'APAC',
    department: 'Human Resources',
    jobLevel: 'L4',
    jobTitle: 'HR Specialist',
  },
  {
    employeeId: 'mgr001',
    password: 'test1234',
    name: 'Michael Manager',
    email: 'mgr001@unleash.com',
    role: Role.Manager,
    region: 'APAC',
    department: 'Engineering',
    jobLevel: 'L5',
    jobTitle: 'Engineering Manager',
  },
  {
    employeeId: 'sup001',
    password: 'test1234',
    name: 'Susan Supervisor',
    email: 'sup001@unleash.com',
    role: Role.Supervisor,
    region: 'APAC',
    department: 'Engineering',
    jobLevel: 'L4',
    jobTitle: 'Tech Lead',
    managerId: 'mgr001', // will be updated after insert
  },
  {
    employeeId: 'emp001',
    password: 'test1234',
    name: 'Eric Employee',
    email: 'emp001@unleash.com',
    role: Role.Employee,
    region: 'APAC',
    department: 'Engineering',
    jobLevel: 'L2',
    jobTitle: 'Software Engineer',
    supervisorId: 'sup001', // will be updated after insert
  },
]

async function main() {
  console.log('Seeding users...')

  const idMap: Record<string, string> = {}

  for (const userData of SEED_USERS) {
    const { password, managerId: _m, supervisorId: _s, ...rest } = userData
    const passwordHash = await bcrypt.hash(password, 10)

    const user = await prisma.user.upsert({
      where: { employeeId: rest.employeeId },
      update: {},
      create: { ...rest, passwordHash },
    })

    idMap[rest.employeeId] = user.id
    console.log(`  ✓ ${rest.employeeId} (${rest.role})`)
  }

  // Set manager / supervisor relationships
  await prisma.user.update({
    where: { employeeId: 'sup001' },
    data: { managerId: idMap['mgr001'] },
  })

  await prisma.user.update({
    where: { employeeId: 'emp001' },
    data: { supervisorId: idMap['sup001'], managerId: idMap['mgr001'] },
  })

  console.log('Seed complete.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
