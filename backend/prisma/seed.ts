import { PrismaClient, Role, CycleType, CycleStatus } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// ─── Regions ──────────────────────────────────────────────────────────────────

const REGIONS = [
  { name: 'Global',        code: 'GLOBAL' },
  { name: 'Taiwan',        code: 'TW' },
  { name: 'North America', code: 'NA' },
  { name: 'Japan',         code: 'JP' },
  { name: 'Europe',        code: 'EU' },
]

// ─── Departments（name + region code + optional parentName）──────────────────
// parentName 指向同一 region 的上層部門

const DEPARTMENTS = [
  // Global
  { name: 'IT',                      regionCode: 'GLOBAL', parentName: null },

  // Taiwan
  { name: 'Engineering',             regionCode: 'TW',     parentName: null },
  { name: 'Process Engineering',     regionCode: 'TW',     parentName: 'Engineering' },
  { name: 'Equipment Engineering',   regionCode: 'TW',     parentName: 'Engineering' },
  { name: 'Human Resources',         regionCode: 'TW',     parentName: null },
  { name: 'Recruiting',              regionCode: 'TW',     parentName: 'Human Resources' },

  // North America
  { name: 'Engineering',             regionCode: 'NA',     parentName: null },
  { name: 'Process Engineering',     regionCode: 'NA',     parentName: 'Engineering' },
  { name: 'Human Resources',         regionCode: 'NA',     parentName: null },

  // Japan
  { name: 'Engineering',             regionCode: 'JP',     parentName: null },
  { name: 'Process Engineering',     regionCode: 'JP',     parentName: 'Engineering' },
  { name: 'Human Resources',         regionCode: 'JP',     parentName: null },

  // Europe
  { name: 'Engineering',             regionCode: 'EU',     parentName: null },
  { name: 'Process Engineering',     regionCode: 'EU',     parentName: 'Engineering' },
  { name: 'Human Resources',         regionCode: 'EU',     parentName: null },
]

// ─── Users ────────────────────────────────────────────────────────────────────
// regionCode / departmentKey 對應上方的 REGIONS / DEPARTMENTS

const SEED_USERS = [
  // ── Global Admin ─────────────────────────────────────────────────────────
  {
    employeeId: 'admin001', password: 'test1234',
    name: 'Alice Admin', email: 'admin001@tsmc-pmd.com',
    role: Role.Admin,
    regionCode: 'GLOBAL', departmentName: 'IT',
    jobLevel: 'L6', jobTitle: 'System Administrator',
  },
  {
    employeeId: 'ghr001', password: 'test1234',
    name: 'Bob GlobalHR', email: 'ghr001@tsmc-pmd.com',
    role: Role.GlobalHR,
    regionCode: 'GLOBAL', departmentName: 'IT',
    jobLevel: 'L5', jobTitle: 'Global HR Director',
  },

  // ── Taiwan ───────────────────────────────────────────────────────────────
  {
    employeeId: 'tw-hr001', password: 'test1234',
    name: '林淑慧 Helen Lin', email: 'tw-hr001@tsmc-pmd.com',
    role: Role.RegionalHR,
    regionCode: 'TW', departmentName: 'Human Resources',
    jobLevel: 'L4', jobTitle: 'HR Specialist',
  },
  {
    employeeId: 'tw-mgr001', password: 'test1234',
    name: '陳俊宏 Michael Chen', email: 'tw-mgr001@tsmc-pmd.com',
    role: Role.Manager,
    regionCode: 'TW', departmentName: 'Engineering',
    jobLevel: 'L6', jobTitle: 'Engineering Manager',
  },
  {
    employeeId: 'tw-sup001', password: 'test1234',
    name: '王雅婷 Susan Wang', email: 'tw-sup001@tsmc-pmd.com',
    role: Role.Supervisor,
    regionCode: 'TW', departmentName: 'Process Engineering',
    jobLevel: 'L5', jobTitle: 'Tech Lead',
    managerId: 'tw-mgr001',
  },
  {
    employeeId: 'tw-emp001', password: 'test1234',
    name: '張志明 Eric Chang', email: 'tw-emp001@tsmc-pmd.com',
    role: Role.Employee,
    regionCode: 'TW', departmentName: 'Process Engineering',
    jobLevel: 'L2', jobTitle: 'Process Engineer',
    supervisorId: 'tw-sup001',
  },

  {
    employeeId: 'tw-sup002', password: 'test1234',
    name: '吳志豪 Victor Wu', email: 'tw-sup002@tsmc-pmd.com',
    role: Role.Supervisor,
    regionCode: 'TW', departmentName: 'Equipment Engineering',
    jobLevel: 'L5', jobTitle: 'Equipment Engineering Lead',
    managerId: 'tw-mgr001',
  },
  {
    employeeId: 'tw-emp002', password: 'test1234',
    name: '黃建宏 Jason Huang', email: 'tw-emp002@tsmc-pmd.com',
    role: Role.Employee,
    regionCode: 'TW', departmentName: 'Equipment Engineering',
    jobLevel: 'L2', jobTitle: 'Equipment Engineer',
    supervisorId: 'tw-sup002',
  },
  {
    employeeId: 'tw-sup003', password: 'test1234',
    name: '許雅文 Grace Hsu', email: 'tw-sup003@tsmc-pmd.com',
    role: Role.Supervisor,
    regionCode: 'TW', departmentName: 'Recruiting',
    jobLevel: 'L5', jobTitle: 'Recruiting Lead',
    managerId: 'tw-hr001',
  },
  {
    employeeId: 'tw-emp003', password: 'test1234',
    name: '李佳芸 Karen Lee', email: 'tw-emp003@tsmc-pmd.com',
    role: Role.Employee,
    regionCode: 'TW', departmentName: 'Recruiting',
    jobLevel: 'L3', jobTitle: 'HR Recruiter',
    supervisorId: 'tw-sup003',
  },
  {
    employeeId: 'tw-emp004', password: 'test1234',
    name: '陳冠廷 Kevin Chen', email: 'tw-emp004@tsmc-pmd.com',
    role: Role.Employee,
    regionCode: 'TW', departmentName: 'Process Engineering',
    jobLevel: 'L3', jobTitle: 'Process Engineer',
    supervisorId: 'tw-sup001',
  },

  // ── North America ─────────────────────────────────────────────────────────
  {
    employeeId: 'na-hr001', password: 'test1234',
    name: 'Nancy Carter', email: 'na-hr001@tsmc-pmd.com',
    role: Role.RegionalHR,
    regionCode: 'NA', departmentName: 'Human Resources',
    jobLevel: 'L4', jobTitle: 'HR Business Partner',
  },
  {
    employeeId: 'na-mgr001', password: 'test1234',
    name: 'Mark Thompson', email: 'na-mgr001@tsmc-pmd.com',
    role: Role.Manager,
    regionCode: 'NA', departmentName: 'Engineering',
    jobLevel: 'L6', jobTitle: 'Fab Engineering Manager',
  },
  {
    employeeId: 'na-sup001', password: 'test1234',
    name: 'Sarah Mitchell', email: 'na-sup001@tsmc-pmd.com',
    role: Role.Supervisor,
    regionCode: 'NA', departmentName: 'Process Engineering',
    jobLevel: 'L5', jobTitle: 'Senior Process Engineer',
    managerId: 'na-mgr001',
  },
  {
    employeeId: 'na-emp001', password: 'test1234',
    name: 'Jake Williams', email: 'na-emp001@tsmc-pmd.com',
    role: Role.Employee,
    regionCode: 'NA', departmentName: 'Process Engineering',
    jobLevel: 'L2', jobTitle: 'Process Engineer',
    supervisorId: 'na-sup001',
  },

  // ── Japan ─────────────────────────────────────────────────────────────────
  {
    employeeId: 'jp-hr001', password: 'test1234',
    name: '田中花子 Hanako Tanaka', email: 'jp-hr001@tsmc-pmd.com',
    role: Role.RegionalHR,
    regionCode: 'JP', departmentName: 'Human Resources',
    jobLevel: 'L4', jobTitle: 'HR Specialist',
  },
  {
    employeeId: 'jp-mgr001', password: 'test1234',
    name: '山田太郎 Taro Yamada', email: 'jp-mgr001@tsmc-pmd.com',
    role: Role.Manager,
    regionCode: 'JP', departmentName: 'Engineering',
    jobLevel: 'L6', jobTitle: 'Manufacturing Manager',
  },
  {
    employeeId: 'jp-sup001', password: 'test1234',
    name: '佐藤健 Ken Sato', email: 'jp-sup001@tsmc-pmd.com',
    role: Role.Supervisor,
    regionCode: 'JP', departmentName: 'Process Engineering',
    jobLevel: 'L5', jobTitle: 'Process Integration Lead',
    managerId: 'jp-mgr001',
  },
  {
    employeeId: 'jp-emp001', password: 'test1234',
    name: '鈴木一郎 Ichiro Suzuki', email: 'jp-emp001@tsmc-pmd.com',
    role: Role.Employee,
    regionCode: 'JP', departmentName: 'Process Engineering',
    jobLevel: 'L2', jobTitle: 'Process Engineer',
    supervisorId: 'jp-sup001',
  },

  // ── Europe ────────────────────────────────────────────────────────────────
  {
    employeeId: 'eu-hr001', password: 'test1234',
    name: 'Greta Müller', email: 'eu-hr001@tsmc-pmd.com',
    role: Role.RegionalHR,
    regionCode: 'EU', departmentName: 'Human Resources',
    jobLevel: 'L4', jobTitle: 'HR Business Partner',
  },
  {
    employeeId: 'eu-mgr001', password: 'test1234',
    name: 'Hans Schneider', email: 'eu-mgr001@tsmc-pmd.com',
    role: Role.Manager,
    regionCode: 'EU', departmentName: 'Engineering',
    jobLevel: 'L6', jobTitle: 'Site Engineering Manager',
  },
  {
    employeeId: 'eu-sup001', password: 'test1234',
    name: 'Ingrid Weber', email: 'eu-sup001@tsmc-pmd.com',
    role: Role.Supervisor,
    regionCode: 'EU', departmentName: 'Process Engineering',
    jobLevel: 'L5', jobTitle: 'Senior Process Engineer',
    managerId: 'eu-mgr001',
  },
  {
    employeeId: 'eu-emp001', password: 'test1234',
    name: 'Fritz Bauer', email: 'eu-emp001@tsmc-pmd.com',
    role: Role.Employee,
    regionCode: 'EU', departmentName: 'Process Engineering',
    jobLevel: 'L2', jobTitle: 'Process Engineer',
    supervisorId: 'eu-sup001',
  },
]

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Regions
  console.log('Seeding regions...')
  const regionMap: Record<string, string> = {}
  for (const r of REGIONS) {
    const rec = await prisma.region.upsert({
      where:  { code: r.code },
      update: { name: r.name },
      create: { name: r.name, code: r.code },
    })
    regionMap[r.code] = rec.id
    console.log(`  ✓ Region: ${r.name} (${r.code})`)
  }

  // 2. Departments（先建父部門，再建子部門）
  console.log('Seeding departments...')
  const deptMap: Record<string, string> = {}  // key = "regionCode:name"

  // 兩輪：第一輪建 parent=null，第二輪建有 parent 的
  for (const pass of [0, 1]) {
    for (const d of DEPARTMENTS) {
      if (pass === 0 && d.parentName !== null) continue
      if (pass === 1 && d.parentName === null) continue

      const regionId = regionMap[d.regionCode]
      const parentId = d.parentName
        ? deptMap[`${d.regionCode}:${d.parentName}`]
        : undefined

      const rec = await prisma.department.upsert({
        where:  { name_regionId: { name: d.name, regionId } },
        update: { parentId: parentId ?? null },
        create: { name: d.name, regionId, parentId: parentId ?? null },
      })
      deptMap[`${d.regionCode}:${d.name}`] = rec.id
      console.log(`  ✓ Department: ${d.regionCode} / ${d.name}${d.parentName ? ` (parent: ${d.parentName})` : ''}`)
    }
  }

  // 3. Users
  console.log('Seeding users...')
  const idMap: Record<string, string> = {}

  for (const u of SEED_USERS) {
    const { password, managerId: _m, supervisorId: _s, regionCode, departmentName, ...rest } = u
    const passwordHash = await bcrypt.hash(password, 10)
    const regionId     = regionMap[regionCode]
    const departmentId = deptMap[`${regionCode}:${departmentName}`]

    const user = await prisma.user.upsert({
      where:  { employeeId: rest.employeeId },
      update: { ...rest, passwordHash, regionId, departmentId },
      create: { ...rest, passwordHash, regionId, departmentId },
    })
    idMap[rest.employeeId] = user.id
    console.log(`  ✓ ${rest.employeeId} (${rest.role}) — ${regionCode}/${departmentName}`)
  }

  // 4. Manager / Supervisor 關聯
  const relationships = [
    // Supervisors → Manager
    { employeeId: 'tw-sup001', data: { managerId: idMap['tw-mgr001'] } },
    { employeeId: 'tw-sup002', data: { managerId: idMap['tw-mgr001'] } },
    { employeeId: 'tw-sup003', data: { managerId: idMap['tw-hr001'] } },
    { employeeId: 'na-sup001', data: { managerId: idMap['na-mgr001'] } },
    { employeeId: 'jp-sup001', data: { managerId: idMap['jp-mgr001'] } },
    { employeeId: 'eu-sup001', data: { managerId: idMap['eu-mgr001'] } },
    // Employees → Supervisor (only; Manager is inferred transitively)
    { employeeId: 'tw-emp001', data: { supervisorId: idMap['tw-sup001'] } },
    { employeeId: 'tw-emp002', data: { supervisorId: idMap['tw-sup002'] } },
    { employeeId: 'tw-emp003', data: { supervisorId: idMap['tw-sup003'] } },
    { employeeId: 'tw-emp004', data: { supervisorId: idMap['tw-sup001'] } },
    { employeeId: 'na-emp001', data: { supervisorId: idMap['na-sup001'] } },
    { employeeId: 'jp-emp001', data: { supervisorId: idMap['jp-sup001'] } },
    { employeeId: 'eu-emp001', data: { supervisorId: idMap['eu-sup001'] } },
  ]
  for (const rel of relationships) {
    await prisma.user.update({ where: { employeeId: rel.employeeId }, data: rel.data })
  }

  // 5. Performance Cycles（示範資料，upsert by stable id）
  console.log('Seeding cycles...')
  const SEED_CYCLES = [
    {
      id: 'seed-tw-annual-2026',
      name: '2026 年度績效考核',
      type: CycleType.Annual,
      status: CycleStatus.GoalSetting,
      regions: ['Taiwan'],
      goalSettingStart: new Date('2026-01-01'),
      goalSettingEnd:   new Date('2026-03-31'),
      reviewStart:      new Date('2026-10-01'),
      reviewEnd:        new Date('2026-12-15'),
    },
    {
      id: 'seed-tw-q1-2026',
      name: '2026 Q1 季度績效考核',
      type: CycleType.Quarterly,
      status: CycleStatus.Completed,
      regions: ['Taiwan'],
      goalSettingStart: new Date('2025-12-01'),
      goalSettingEnd:   new Date('2026-01-15'),
      reviewStart:      new Date('2026-02-15'),
      reviewEnd:        new Date('2026-03-31'),
    },
    {
      id: 'seed-tw-q2-2026',
      name: '2026 Q2 季度績效考核',
      type: CycleType.Quarterly,
      status: CycleStatus.InProgress,
      regions: ['Taiwan'],
      goalSettingStart: new Date('2026-03-01'),
      goalSettingEnd:   new Date('2026-04-15'),
      reviewStart:      new Date('2026-05-01'),
      reviewEnd:        new Date('2026-06-30'),
    },
  ]
  for (const c of SEED_CYCLES) {
    await prisma.performanceCycle.upsert({
      where:  { id: c.id },
      update: {},
      create: c,
    })
    console.log(`  ✓ Cycle: ${c.name} (${c.status})`)
  }

  console.log('\nSeed complete.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
