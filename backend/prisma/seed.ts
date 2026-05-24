import { PrismaClient, Role, CycleType, CycleStatus, GoalStatus, GoalType, ReviewStatus, ReviewGrade, AppealStatus } from '@prisma/client'
import * as bcrypt from 'bcryptjs'
import { Client as EsClient } from '@elastic/elasticsearch'

const prisma = new PrismaClient()

// ─── Regions ──────────────────────────────────────────────────────────────────

const REGIONS = [
  { name: 'Global',        code: 'GLOBAL' },
  { name: 'Taiwan',        code: 'TW' },
  { name: 'North America', code: 'NA' },
  { name: 'Japan',         code: 'JP' },
  { name: 'Europe',        code: 'EU' },
]

// ─── Departments ──────────────────────────────────────────────────────────────

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

const SEED_USERS = [
  // ── Global ───────────────────────────────────────────────────────────────
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
  {
    employeeId: 'na-emp002', password: 'test1234',
    name: 'Tom Anderson', email: 'na-emp002@tsmc-pmd.com',
    role: Role.Employee,
    regionCode: 'NA', departmentName: 'Process Engineering',
    jobLevel: 'L3', jobTitle: 'Process Engineer',
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
  {
    employeeId: 'jp-emp002', password: 'test1234',
    name: '中村健二 Kenji Nakamura', email: 'jp-emp002@tsmc-pmd.com',
    role: Role.Employee,
    regionCode: 'JP', departmentName: 'Process Engineering',
    jobLevel: 'L3', jobTitle: 'Process Engineer',
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
  {
    employeeId: 'eu-emp002', password: 'test1234',
    name: 'Klaus Wagner', email: 'eu-emp002@tsmc-pmd.com',
    role: Role.Employee,
    regionCode: 'EU', departmentName: 'Process Engineering',
    jobLevel: 'L3', jobTitle: 'Process Engineer',
    supervisorId: 'eu-sup001',
  },
]

// ─── RegionConfig ─────────────────────────────────────────────────────────────

const REGION_CONFIGS = [
  // Taiwan（勞基法）
  { regionCode: 'TW', key: 'appeal_window_days',          value: '7',        label: '申訴期限（天）' },
  { regionCode: 'TW', key: 'review_cycle_min_days',       value: '30',       label: '評核週期最短天數' },
  { regionCode: 'TW', key: 'grade_distribution_required', value: 'true',     label: '是否強制比例分佈' },
  { regionCode: 'TW', key: 'overtime_policy',             value: '"hourly"', label: '加班計算方式' },
  // Japan
  { regionCode: 'JP', key: 'appeal_window_days',          value: '14',       label: '申訴期限（天）' },
  { regionCode: 'JP', key: 'review_cycle_min_days',       value: '60',       label: '評核週期最短天數' },
  { regionCode: 'JP', key: 'grade_distribution_required', value: 'false',    label: '是否強制比例分佈' },
  { regionCode: 'JP', key: 'overtime_policy',             value: '"fixed"',  label: '加班計算方式' },
  // North America
  { regionCode: 'NA', key: 'appeal_window_days',          value: '10',       label: 'Appeal Window (days)' },
  { regionCode: 'NA', key: 'review_cycle_min_days',       value: '30',       label: 'Min Cycle Days' },
  { regionCode: 'NA', key: 'grade_distribution_required', value: 'false',    label: 'Enforce Grade Distribution' },
  { regionCode: 'NA', key: 'overtime_policy',             value: '"hourly"', label: 'Overtime Policy' },
  // Europe（GDPR）
  { regionCode: 'EU', key: 'appeal_window_days',          value: '14',       label: 'Appeal Window (days)' },
  { regionCode: 'EU', key: 'review_cycle_min_days',       value: '30',       label: 'Min Cycle Days' },
  { regionCode: 'EU', key: 'grade_distribution_required', value: 'false',    label: 'Enforce Grade Distribution' },
  { regionCode: 'EU', key: 'gdpr_data_retention_days',   value: '365',      label: 'GDPR Data Retention (days)' },
]

// ─── Sample answers by locale ─────────────────────────────────────────────────

const EMPLOYEE_ANSWERS: Record<string, { text: string; rating: string; choice: string }> = {
  zh: {
    text:   '本季度完成了製程優化計畫，成功將良率從 87.3% 提升至 91.8%，超過目標 5%。主導了 3 次跨部門技術討論，並輔導 2 名新進工程師熟悉製程標準作業程序。',
    rating: '4',
    choice: 'Excellent',
  },
  en: {
    text:   'Led process optimization initiative resulting in 4.2% yield improvement this quarter. Collaborated with the equipment team to identify and resolve contamination issues. Mentored two junior engineers on SOP compliance and best practices.',
    rating: '4',
    choice: 'Excellent',
  },
  ja: {
    text:   '今期は製造プロセスの最適化に注力し、歩留まりを 87.3% から 91.8% に改善しました。また、装置チームと連携して汚染問題を特定・解決し、新入社員 2 名への技術指導にも積極的に取り組みました。',
    rating: '4',
    choice: 'Excellent',
  },
}

const SUPERVISOR_ANSWERS: Record<string, { text: string; rating: string; choice: string; comment: string }> = {
  zh: {
    text:    '受評員工本季表現優異，不僅超額達成良率目標，更在跨部門合作中展現積極的領導力。對新進成員的輔導態度認真，獲得團隊正面回饋。建議下季承擔更多跨廠技術推廣任務。',
    rating:  '4',
    choice:  'Excellent',
    comment: '整體表現達到並超越預期，技術能力與團隊合作俱佳。本季最大亮點為主動發現並解決製程瓶頸，顯著降低設備停機風險。下一季建議承擔跨廠技術交流任務，持續發揮影響力。',
  },
  en: {
    text:    'Employee demonstrated strong technical skills and proactive problem-solving this quarter. Actively contributed to team goals and collaborated effectively across departments. Coaching of junior staff was well-received.',
    rating:  '4',
    choice:  'Excellent',
    comment: 'Overall performance meets and exceeds expectations. The standout contribution this quarter was proactively identifying and resolving a contamination bottleneck that significantly reduced equipment downtime. Recommend taking on cross-site technical initiatives next cycle.',
  },
  ja: {
    text:    '今期は技術面で高い能力を発揮し、歩留まり改善に大きく貢献しました。装置チームとの連携も円滑で、新入社員への指導にも積極的に取り組んでいました。',
    rating:  '4',
    choice:  'Excellent',
    comment: '総合的なパフォーマンスは期待を上回っています。今期最大の成果は汚染問題を主体的に特定・解決したことで、設備停止リスクを大幅に低減しました。次期はより広い範囲での技術交流・推進を期待します。',
  },
}

function buildEmpAnswers(qIds: string[], locale: string): { questionId: string; answer: string }[] {
  const a = EMPLOYEE_ANSWERS[locale] ?? EMPLOYEE_ANSWERS['en']
  if (!qIds.length) return []
  return [
    { questionId: qIds[0], answer: a.text },
    { questionId: qIds[1], answer: a.rating },
    { questionId: qIds[2], answer: a.choice },
  ]
}

function buildSupAnswers(qIds: string[], locale: string): { questionId: string; answer: string }[] {
  const a = SUPERVISOR_ANSWERS[locale] ?? SUPERVISOR_ANSWERS['en']
  if (!qIds.length) return []
  return [
    { questionId: qIds[0], answer: a.text },
    { questionId: qIds[1], answer: a.rating },
    { questionId: qIds[2], answer: a.choice },
  ]
}

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
  const deptMap: Record<string, string> = {}

  for (const pass of [0, 1]) {
    for (const d of DEPARTMENTS) {
      if (pass === 0 && d.parentName !== null) continue
      if (pass === 1 && d.parentName === null) continue

      const regionId = regionMap[d.regionCode]
      const parentId = d.parentName ? deptMap[`${d.regionCode}:${d.parentName}`] : undefined

      const rec = await prisma.department.upsert({
        where:  { name_regionId: { name: d.name, regionId } },
        update: { parentId: parentId ?? null },
        create: { name: d.name, regionId, parentId: parentId ?? null },
      })
      deptMap[`${d.regionCode}:${d.name}`] = rec.id
      console.log(`  ✓ Dept: ${d.regionCode}/${d.name}`)
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
    { employeeId: 'tw-sup001', data: { managerId: idMap['tw-mgr001'] } },
    { employeeId: 'tw-sup002', data: { managerId: idMap['tw-mgr001'] } },
    { employeeId: 'tw-sup003', data: { managerId: idMap['tw-hr001'] } },
    { employeeId: 'na-sup001', data: { managerId: idMap['na-mgr001'] } },
    { employeeId: 'jp-sup001', data: { managerId: idMap['jp-mgr001'] } },
    { employeeId: 'eu-sup001', data: { managerId: idMap['eu-mgr001'] } },
    { employeeId: 'tw-emp001', data: { supervisorId: idMap['tw-sup001'] } },
    { employeeId: 'tw-emp002', data: { supervisorId: idMap['tw-sup002'] } },
    { employeeId: 'tw-emp003', data: { supervisorId: idMap['tw-sup003'] } },
    { employeeId: 'tw-emp004', data: { supervisorId: idMap['tw-sup001'] } },
    { employeeId: 'na-emp001', data: { supervisorId: idMap['na-sup001'] } },
    { employeeId: 'na-emp002', data: { supervisorId: idMap['na-sup001'] } },
    { employeeId: 'jp-emp001', data: { supervisorId: idMap['jp-sup001'] } },
    { employeeId: 'jp-emp002', data: { supervisorId: idMap['jp-sup001'] } },
    { employeeId: 'eu-emp001', data: { supervisorId: idMap['eu-sup001'] } },
    { employeeId: 'eu-emp002', data: { supervisorId: idMap['eu-sup001'] } },
  ]
  for (const rel of relationships) {
    await prisma.user.update({ where: { employeeId: rel.employeeId }, data: rel.data })
  }
  console.log('  ✓ Relationships set')

  // 5. RegionConfig
  console.log('Seeding region configs...')
  for (const c of REGION_CONFIGS) {
    const regionId = regionMap[c.regionCode]
    await prisma.regionConfig.upsert({
      where:  { regionId_key: { regionId, key: c.key } },
      update: { value: c.value, label: c.label },
      create: { regionId, key: c.key, value: c.value, label: c.label },
    })
    console.log(`  ✓ Config: ${c.regionCode}/${c.key} = ${c.value}`)
  }

  // 6. Performance Cycles（每個地區各自的週期）
  console.log('Seeding cycles...')
  const SEED_CYCLES = [
    // Taiwan
    {
      id: 'seed-tw-annual-2026',
      name: '2026 年度績效考核',
      type: CycleType.Annual,
      status: CycleStatus.GoalSetting,
      regionCode: 'TW',
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
      regionCode: 'TW',
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
      regionCode: 'TW',
      goalSettingStart: new Date('2026-03-01'),
      goalSettingEnd:   new Date('2026-04-15'),
      reviewStart:      new Date('2026-05-01'),
      reviewEnd:        new Date('2026-06-30'),
    },
    // North America
    {
      id: 'seed-na-annual-2026',
      name: '2026 Annual Performance Review',
      type: CycleType.Annual,
      status: CycleStatus.InProgress,
      regionCode: 'NA',
      goalSettingStart: new Date('2026-01-01'),
      goalSettingEnd:   new Date('2026-02-28'),
      reviewStart:      new Date('2026-10-01'),
      reviewEnd:        new Date('2026-12-15'),
    },
    {
      id: 'seed-na-q2-2026',
      name: '2026 Q2 Performance Review',
      type: CycleType.Quarterly,
      status: CycleStatus.InProgress,
      regionCode: 'NA',
      goalSettingStart: new Date('2026-03-01'),
      goalSettingEnd:   new Date('2026-04-15'),
      reviewStart:      new Date('2026-05-01'),
      reviewEnd:        new Date('2026-06-30'),
    },
    // Japan
    {
      id: 'seed-jp-annual-2026',
      name: '2026年度パフォーマンスレビュー',
      type: CycleType.Annual,
      status: CycleStatus.InProgress,
      regionCode: 'JP',
      goalSettingStart: new Date('2026-04-01'),
      goalSettingEnd:   new Date('2026-05-31'),
      reviewStart:      new Date('2026-10-01'),
      reviewEnd:        new Date('2026-12-31'),
    },
    // Europe
    {
      id: 'seed-eu-annual-2026',
      name: '2026 Annual Performance Review',
      type: CycleType.Annual,
      status: CycleStatus.InProgress,
      regionCode: 'EU',
      goalSettingStart: new Date('2026-01-01'),
      goalSettingEnd:   new Date('2026-02-28'),
      reviewStart:      new Date('2026-10-01'),
      reviewEnd:        new Date('2026-12-15'),
    },
  ]

  const cycleMap: Record<string, string> = {}
  for (const c of SEED_CYCLES) {
    const { regionCode, ...data } = c
    const regionId = regionMap[regionCode]
    const cycle = await prisma.performanceCycle.upsert({
      where:  { id: data.id },
      update: {},
      create: { ...data, regionId },
    })
    cycleMap[c.id] = cycle.id
    console.log(`  ✓ Cycle: ${c.name}`)
  }

  // 7. Form Templates（每個 InProgress/GoalSetting cycle 各一份）
  console.log('Seeding templates...')
  const TEMPLATE_DEFS = [
    {
      id:          'seed-tpl-tw-annual',
      name:        '2026 台灣年度考評表',
      cycleId:     'seed-tw-annual-2026',
      regionCode:  'TW',
      appliesGrades: ['L2', 'L3', 'L4', 'L5'],
      applyTitles:   ['Process Engineer', 'Equipment Engineer', 'HR Recruiter', 'Tech Lead', 'Equipment Engineering Lead', 'Recruiting Lead'],
    },
    {
      id:          'seed-tpl-tw-q2',
      name:        '2026 Q2 台灣季度考評表',
      cycleId:     'seed-tw-q2-2026',
      regionCode:  'TW',
      appliesGrades: ['L2', 'L3', 'L4', 'L5'],
      applyTitles:   ['Process Engineer', 'Equipment Engineer', 'HR Recruiter', 'Tech Lead', 'Equipment Engineering Lead', 'Recruiting Lead'],
    },
    {
      id:          'seed-tpl-na-annual',
      name:        '2026 NA Annual Review Form',
      cycleId:     'seed-na-annual-2026',
      regionCode:  'NA',
      appliesGrades: ['L2', 'L3', 'L4', 'L5'],
      applyTitles:   ['Process Engineer', 'Senior Process Engineer'],
    },
    {
      id:          'seed-tpl-jp-annual',
      name:        '2026年度 評価フォーム',
      cycleId:     'seed-jp-annual-2026',
      regionCode:  'JP',
      appliesGrades: ['L2', 'L3', 'L4', 'L5'],
      applyTitles:   ['Process Engineer', 'Process Integration Lead'],
    },
    {
      id:          'seed-tpl-eu-annual',
      name:        '2026 EU Annual Review Form',
      cycleId:     'seed-eu-annual-2026',
      regionCode:  'EU',
      appliesGrades: ['L2', 'L3', 'L4', 'L5'],
      applyTitles:   ['Process Engineer', 'Senior Process Engineer'],
    },
  ]

  const templateMap: Record<string, string> = {}
  // tplId → ordered question UUIDs (used when building review answers)
  const questionIdMap: Record<string, string[]> = {}

  for (const t of TEMPLATE_DEFS) {
    const { regionCode, ...data } = t
    const regionId = regionMap[regionCode]
    const tpl = await prisma.formTemplate.upsert({
      where:  { id: data.id },
      update: { status: 'Published' },
      create: { ...data, regionId, status: 'Published', createdById: idMap['admin001'] },
    })
    templateMap[t.id] = tpl.id

    // Seed 3 questions per template if not already present
    const existing = await prisma.templateQuestion.count({ where: { templateId: tpl.id } })
    if (existing === 0) {
      await prisma.templateQuestion.createMany({
        data: [
          {
            templateId:   tpl.id,
            questionText: 'Describe your key achievements this period.',
            questionType: 'Text',
            required:     true,
            orderIndex:   0,
          },
          {
            templateId:   tpl.id,
            questionText: 'Rate your overall performance (1–5).',
            questionType: 'Rating',
            required:     true,
            orderIndex:   1,
          },
          {
            templateId:   tpl.id,
            questionText: 'How do you assess your collaboration?',
            questionType: 'MultipleChoice',
            options:      ['Excellent', 'Good', 'Needs Improvement'],
            required:     true,
            orderIndex:   2,
          },
        ],
      })
    }

    // Always query to capture question IDs (works on first run and re-runs)
    const questions = await prisma.templateQuestion.findMany({
      where:   { templateId: tpl.id },
      orderBy: { orderIndex: 'asc' },
    })
    questionIdMap[t.id] = questions.map(q => q.id)

    console.log(`  ✓ Template: ${t.name}`)
  }

  // 8. Goals（每位 Employee 各 2 個）
  console.log('Seeding goals...')
  const EMPLOYEE_IDS = [
    'tw-emp001', 'tw-emp002', 'tw-emp003', 'tw-emp004',
    'na-emp001', 'na-emp002',
    'jp-emp001', 'jp-emp002',
    'eu-emp001', 'eu-emp002',
  ]
  for (const empId of EMPLOYEE_IDS) {
    const uid = idMap[empId]
    // Draft goal
    await prisma.goal.upsert({
      where:  { id: `seed-goal-draft-${empId}` },
      update: {},
      create: {
        id:          `seed-goal-draft-${empId}`,
        userId:      uid,
        title:       'Improve process yield rate',
        description: 'Target 5% improvement in Q2',
        metric:      'Yield %',
        targetValue: '+5%',
        relevance:   'Directly impacts fab output',
        dueDate:     new Date('2026-06-30'),
        type:        GoalType.Personal,
        status:      GoalStatus.Draft,
      },
    })
    // Approved goal
    await prisma.goal.upsert({
      where:  { id: `seed-goal-approved-${empId}` },
      update: {},
      create: {
        id:          `seed-goal-approved-${empId}`,
        userId:      uid,
        title:       'Complete safety training certification',
        description: 'Obtain ISO safety cert by end of Q1',
        metric:      'Certification status',
        targetValue: 'Certified',
        relevance:   'Compliance requirement',
        dueDate:     new Date('2026-03-31'),
        type:        GoalType.Personal,
        status:      GoalStatus.Approved,
      },
    })
  }
  console.log(`  ✓ Goals seeded for ${EMPLOYEE_IDS.length} employees`)

  // 8b. Goal Milestones（每個 goal 各有里程碑）
  console.log('Seeding goal milestones...')
  for (const empId of EMPLOYEE_IDS) {
    // Draft goal: 1 completed + 1 pending (showing work-in-progress)
    await prisma.goalMilestone.upsert({
      where:  { id: `seed-ms-draft-${empId}-1` },
      update: {},
      create: {
        id:          `seed-ms-draft-${empId}-1`,
        goalId:      `seed-goal-draft-${empId}`,
        title:       'Analyze current yield baseline data',
        completedAt: new Date('2026-03-15'),
        note:        'Baseline established at 87.3%',
        orderIndex:  0,
      },
    })
    await prisma.goalMilestone.upsert({
      where:  { id: `seed-ms-draft-${empId}-2` },
      update: {},
      create: {
        id:          `seed-ms-draft-${empId}-2`,
        goalId:      `seed-goal-draft-${empId}`,
        title:       'Implement process improvement plan',
        completedAt: null,
        orderIndex:  1,
      },
    })

    // Approved goal: all 3 milestones completed (showing 100% achievement)
    await prisma.goalMilestone.upsert({
      where:  { id: `seed-ms-approved-${empId}-1` },
      update: {},
      create: {
        id:          `seed-ms-approved-${empId}-1`,
        goalId:      `seed-goal-approved-${empId}`,
        title:       'Register for ISO safety certification course',
        completedAt: new Date('2026-01-10'),
        note:        'Registration confirmed, course starts Jan 15',
        orderIndex:  0,
      },
    })
    await prisma.goalMilestone.upsert({
      where:  { id: `seed-ms-approved-${empId}-2` },
      update: {},
      create: {
        id:          `seed-ms-approved-${empId}-2`,
        goalId:      `seed-goal-approved-${empId}`,
        title:       'Complete all 4 training modules',
        completedAt: new Date('2026-02-28'),
        orderIndex:  1,
      },
    })
    await prisma.goalMilestone.upsert({
      where:  { id: `seed-ms-approved-${empId}-3` },
      update: {},
      create: {
        id:          `seed-ms-approved-${empId}-3`,
        goalId:      `seed-goal-approved-${empId}`,
        title:       'Pass final certification exam',
        completedAt: new Date('2026-03-20'),
        note:        'Score: 94/100',
        orderIndex:  2,
      },
    })
  }
  console.log(`  ✓ Goal milestones seeded (${EMPLOYEE_IDS.length * 5} records)`)

  // 9. Performance Reviews
  console.log('Seeding reviews...')

  // Status guide:
  // TW: all 4 stages demonstrated (PendingEmployeeSubmit, PendingSupervisorReview, PendingManagerApproval, Appealed)
  // NA/JP/EU: emp001 → PendingManagerApproval (so calibration works for every region's manager)
  //           emp002 → Published (→ set to Appealed by appeal seeding below)
  const REVIEW_SEEDS: {
    id: string; cycleId: string; tplId: string; empId: string; supId: string;
    status: ReviewStatus; locale: string; grade: string | null;
  }[] = [
    // TW Q2 — full status coverage
    { id: 'rev-tw-q2-emp001', cycleId: 'seed-tw-q2-2026', tplId: 'seed-tpl-tw-q2', empId: 'tw-emp001', supId: 'tw-sup001', status: ReviewStatus.PendingEmployeeSubmit,   locale: 'zh', grade: null },
    { id: 'rev-tw-q2-emp002', cycleId: 'seed-tw-q2-2026', tplId: 'seed-tpl-tw-q2', empId: 'tw-emp002', supId: 'tw-sup002', status: ReviewStatus.PendingSupervisorReview, locale: 'zh', grade: null },
    { id: 'rev-tw-q2-emp003', cycleId: 'seed-tw-q2-2026', tplId: 'seed-tpl-tw-q2', empId: 'tw-emp003', supId: 'tw-sup003', status: ReviewStatus.PendingManagerApproval,  locale: 'zh', grade: 'S'  },
    { id: 'rev-tw-q2-emp004', cycleId: 'seed-tw-q2-2026', tplId: 'seed-tpl-tw-q2', empId: 'tw-emp004', supId: 'tw-sup001', status: ReviewStatus.Published,               locale: 'zh', grade: 'S'  },
    // NA Annual — emp001 in calibration so na-mgr001 can demo grade picker
    { id: 'rev-na-ann-emp001', cycleId: 'seed-na-annual-2026', tplId: 'seed-tpl-na-annual', empId: 'na-emp001', supId: 'na-sup001', status: ReviewStatus.PendingManagerApproval, locale: 'en', grade: 'S' },
    { id: 'rev-na-ann-emp002', cycleId: 'seed-na-annual-2026', tplId: 'seed-tpl-na-annual', empId: 'na-emp002', supId: 'na-sup001', status: ReviewStatus.Published,               locale: 'en', grade: 'S' },
    // JP Annual — emp001 in calibration so jp-mgr001 can demo grade picker
    { id: 'rev-jp-ann-emp001', cycleId: 'seed-jp-annual-2026', tplId: 'seed-tpl-jp-annual', empId: 'jp-emp001', supId: 'jp-sup001', status: ReviewStatus.PendingManagerApproval, locale: 'ja', grade: 'S' },
    { id: 'rev-jp-ann-emp002', cycleId: 'seed-jp-annual-2026', tplId: 'seed-tpl-jp-annual', empId: 'jp-emp002', supId: 'jp-sup001', status: ReviewStatus.Published,               locale: 'ja', grade: 'S' },
    // EU Annual — emp001 in calibration so eu-mgr001 can demo grade picker
    { id: 'rev-eu-ann-emp001', cycleId: 'seed-eu-annual-2026', tplId: 'seed-tpl-eu-annual', empId: 'eu-emp001', supId: 'eu-sup001', status: ReviewStatus.PendingManagerApproval, locale: 'en', grade: 'S' },
    { id: 'rev-eu-ann-emp002', cycleId: 'seed-eu-annual-2026', tplId: 'seed-tpl-eu-annual', empId: 'eu-emp002', supId: 'eu-sup001', status: ReviewStatus.Published,               locale: 'en', grade: 'S' },
  ]

  for (const r of REVIEW_SEEDS) {
    const qIds = questionIdMap[r.tplId] ?? []

    const needsEmpAnswers = r.status !== ReviewStatus.PendingEmployeeSubmit
    const needsSupAnswers = r.status === ReviewStatus.PendingManagerApproval
      || r.status === ReviewStatus.Published

    const empAnswers = needsEmpAnswers ? buildEmpAnswers(qIds, r.locale) : []
    const supAnswers = needsSupAnswers ? buildSupAnswers(qIds, r.locale) : []
    const supComment = needsSupAnswers
      ? (SUPERVISOR_ANSWERS[r.locale]?.comment ?? SUPERVISOR_ANSWERS['en'].comment)
      : null
    const isPublished = r.status === ReviewStatus.Published

    await prisma.performanceReview.upsert({
      where:  { id: r.id },
      update: {
        status:            r.status,
        grade:             (r.grade ?? null) as ReviewGrade | null,
        supervisorComment: supComment,
        publishedAt:       isPublished ? new Date('2026-05-01') : null,
        employeeAnswers:   empAnswers,
        supervisorAnswers: supAnswers,
      },
      create: {
        id:                r.id,
        cycleId:           cycleMap[r.cycleId] ?? r.cycleId,
        templateId:        templateMap[r.tplId] ?? r.tplId,
        employeeId:        idMap[r.empId],
        supervisorId:      idMap[r.supId],
        status:            r.status,
        grade:             (r.grade ?? null) as ReviewGrade | null,
        supervisorComment: supComment,
        publishedAt:       isPublished ? new Date('2026-05-01') : null,
        employeeAnswers:   empAnswers,
        supervisorAnswers: supAnswers,
      },
    })
  }
  console.log(`  ✓ Reviews seeded`)

  // 10. Appeals（每個地區各一筆，基於 Published review）
  console.log('Seeding appeals...')

  // For appealed reviews, we also need supervisor answers — get the qIds for each template
  const APPEAL_SEEDS = [
    { id: 'appeal-tw-q2-emp004',  reviewId: 'rev-tw-q2-emp004',   empId: 'tw-emp004', mgrId: 'tw-mgr001', reason: '評分結果與自評差異過大，申請複查。' },
    { id: 'appeal-na-ann-emp002', reviewId: 'rev-na-ann-emp002',  empId: 'na-emp002', mgrId: 'na-mgr001', reason: 'Disagree with performance rating, requesting review.' },
    { id: 'appeal-jp-ann-emp002', reviewId: 'rev-jp-ann-emp002',  empId: 'jp-emp002', mgrId: 'jp-mgr001', reason: '評価結果に不服があり、再審査を申請します。' },
    { id: 'appeal-eu-ann-emp002', reviewId: 'rev-eu-ann-emp002',  empId: 'eu-emp002', mgrId: 'eu-mgr001', reason: 'Rating does not reflect my contributions. Requesting reconsideration.' },
  ]

  for (const a of APPEAL_SEEDS) {
    const reviewExists = await prisma.performanceReview.findUnique({ where: { id: a.reviewId } })
    if (!reviewExists) {
      console.log(`  ⚠ Review ${a.reviewId} not found, skipping appeal`)
      continue
    }
    await prisma.appeal.upsert({
      where:  { id: a.id },
      update: {},
      create: {
        id:         a.id,
        reviewId:   a.reviewId,
        employeeId: idMap[a.empId],
        managerId:  idMap[a.mgrId],
        reason:     a.reason,
        status:     AppealStatus.Pending,
      },
    })
    // Mark review as Appealed (answers seeded above remain intact)
    await prisma.performanceReview.update({
      where: { id: a.reviewId },
      data:  { status: ReviewStatus.Appealed },
    })
  }
  console.log(`  ✓ Appeals seeded`)

  // ── Audit Logs (Elasticsearch) ───────────────────────────────────────────────
  console.log('Seeding audit logs (Elasticsearch)...')
  const es = new EsClient({
    node: process.env.ELASTICSEARCH_NODE ?? 'http://localhost:9200',
    requestTimeout: 5000,
    maxRetries: 0,
  })

  try {
    const indexExists = await es.indices.exists({ index: 'audit-logs' })
    if (!indexExists) {
      await es.indices.create({
        index: 'audit-logs',
        mappings: {
          dynamic: 'strict',
          properties: {
            userId:       { type: 'keyword' },
            userName:     { type: 'keyword' },
            userRegionId: { type: 'keyword' },
            action:       { type: 'keyword' },
            outcome:      { type: 'keyword' },
            resource:     { type: 'keyword' },
            resourceId:   { type: 'keyword' },
            httpMethod:   { type: 'keyword' },
            httpPath:     { type: 'keyword' },
            httpStatus:   { type: 'integer' },
            ipAddress:    { type: 'ip' },
            userAgent:    { type: 'text', index: false },
            detail:       { type: 'object', dynamic: true },
            createdAt:    { type: 'date' },
          },
        },
      } as any)
    } else {
      await es.indices.putMapping({
        index: 'audit-logs',
        properties: { userRegionId: { type: 'keyword' } },
      } as any)
    }

    const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

    const AUDIT_LOGS = [
      // ── TW ────────────────────────────────────────────────────────────────────
      { userId: idMap['tw-emp001'], userName: '張志明 Eric Chang',     userRegionId: regionMap['TW'], action: 'GOAL_SUBMIT',              outcome: 'SUCCESS',   resource: 'goal',          resourceId: `seed-goal-draft-tw-emp001`,    httpMethod: 'PATCH', httpPath: '/goals/seed-goal-draft-tw-emp001/submit',           httpStatus: 200, ipAddress: '192.168.1.10', userAgent: UA, detail: {}, createdAt: new Date('2026-04-20T09:15:00Z') },
      { userId: idMap['tw-emp001'], userName: '張志明 Eric Chang',     userRegionId: regionMap['TW'], action: 'REVIEW_ANSWERS_SAVE',      outcome: 'SUCCESS',   resource: 'review',        resourceId: 'rev-tw-q2-emp001',             httpMethod: 'PUT',   httpPath: '/reviews/rev-tw-q2-emp001/answers',                 httpStatus: 200, ipAddress: '192.168.1.10', userAgent: UA, detail: {}, createdAt: new Date('2026-05-05T10:30:00Z') },
      { userId: idMap['tw-emp001'], userName: '張志明 Eric Chang',     userRegionId: regionMap['TW'], action: 'REVIEW_SUBMIT',            outcome: 'SUCCESS',   resource: 'review',        resourceId: 'rev-tw-q2-emp001',             httpMethod: 'POST',  httpPath: '/reviews/rev-tw-q2-emp001/submit',                  httpStatus: 200, ipAddress: '192.168.1.10', userAgent: UA, detail: {}, createdAt: new Date('2026-05-05T11:00:00Z') },
      { userId: idMap['tw-emp001'], userName: '張志明 Eric Chang',     userRegionId: regionMap['TW'], action: 'ACCESS_DENIED',            outcome: 'FORBIDDEN', resource: 'review',        resourceId: undefined,                      httpMethod: 'GET',   httpPath: '/reviews/calibrate/seed-tw-q2-2026',                httpStatus: 403, ipAddress: '192.168.1.10', userAgent: UA, detail: {}, createdAt: new Date('2026-05-12T09:55:00Z') },
      { userId: idMap['tw-emp002'], userName: '黃建宏 Jason Huang',    userRegionId: regionMap['TW'], action: 'GOAL_SUBMIT',              outcome: 'SUCCESS',   resource: 'goal',          resourceId: `seed-goal-draft-tw-emp002`,    httpMethod: 'PATCH', httpPath: '/goals/seed-goal-draft-tw-emp002/submit',           httpStatus: 200, ipAddress: '192.168.1.11', userAgent: UA, detail: {}, createdAt: new Date('2026-04-21T14:00:00Z') },
      { userId: idMap['tw-emp002'], userName: '黃建宏 Jason Huang',    userRegionId: regionMap['TW'], action: 'REVIEW_ANSWERS_SAVE',      outcome: 'SUCCESS',   resource: 'review',        resourceId: 'rev-tw-q2-emp002',             httpMethod: 'PUT',   httpPath: '/reviews/rev-tw-q2-emp002/answers',                 httpStatus: 200, ipAddress: '192.168.1.11', userAgent: UA, detail: {}, createdAt: new Date('2026-05-06T09:00:00Z') },
      { userId: idMap['tw-emp003'], userName: '李怡君 Amy Lee',        userRegionId: regionMap['TW'], action: 'GOAL_SUBMIT',              outcome: 'SUCCESS',   resource: 'goal',          resourceId: `seed-goal-draft-tw-emp003`,    httpMethod: 'PATCH', httpPath: '/goals/seed-goal-draft-tw-emp003/submit',           httpStatus: 200, ipAddress: '192.168.1.12', userAgent: UA, detail: {}, createdAt: new Date('2026-04-22T10:00:00Z') },
      { userId: idMap['tw-sup001'], userName: '王雅婷 Susan Wang',     userRegionId: regionMap['TW'], action: 'GOAL_APPROVE',             outcome: 'SUCCESS',   resource: 'goal',          resourceId: `seed-goal-draft-tw-emp001`,    httpMethod: 'PATCH', httpPath: '/goals/seed-goal-draft-tw-emp001/approve',          httpStatus: 200, ipAddress: '192.168.1.20', userAgent: UA, detail: {}, createdAt: new Date('2026-04-25T11:00:00Z') },
      { userId: idMap['tw-sup001'], userName: '王雅婷 Susan Wang',     userRegionId: regionMap['TW'], action: 'REVIEW_SUPERVISOR_SAVE',   outcome: 'SUCCESS',   resource: 'review',        resourceId: 'rev-tw-q2-emp002',             httpMethod: 'PUT',   httpPath: '/reviews/rev-tw-q2-emp002/supervisor',              httpStatus: 200, ipAddress: '192.168.1.20', userAgent: UA, detail: {}, createdAt: new Date('2026-05-08T15:00:00Z') },
      { userId: idMap['tw-sup001'], userName: '王雅婷 Susan Wang',     userRegionId: regionMap['TW'], action: 'REVIEW_SUPERVISOR_SUBMIT', outcome: 'SUCCESS',   resource: 'review',        resourceId: 'rev-tw-q2-emp002',             httpMethod: 'POST',  httpPath: '/reviews/rev-tw-q2-emp002/supervisor/submit',       httpStatus: 200, ipAddress: '192.168.1.20', userAgent: UA, detail: {}, createdAt: new Date('2026-05-08T15:45:00Z') },
      { userId: idMap['tw-mgr001'], userName: '陳俊宏 Michael Chen',   userRegionId: regionMap['TW'], action: 'REVIEW_CALIBRATE',         outcome: 'SUCCESS',   resource: 'review',        resourceId: 'rev-tw-q2-emp003',             httpMethod: 'PUT',   httpPath: '/reviews/rev-tw-q2-emp003/calibrate',               httpStatus: 200, ipAddress: '192.168.1.30', userAgent: UA, detail: { grade: 'S' }, createdAt: new Date('2026-05-12T10:00:00Z') },
      { userId: idMap['tw-mgr001'], userName: '陳俊宏 Michael Chen',   userRegionId: regionMap['TW'], action: 'REVIEW_PUBLISH_ALL',       outcome: 'SUCCESS',   resource: 'review',        resourceId: undefined,                      httpMethod: 'POST',  httpPath: '/reviews/cycle/seed-tw-q2-2026/publish',            httpStatus: 200, ipAddress: '192.168.1.30', userAgent: UA, detail: {}, createdAt: new Date('2026-05-15T16:00:00Z') },

      // ── NA ────────────────────────────────────────────────────────────────────
      { userId: idMap['na-emp001'], userName: 'Aaron Brooks',          userRegionId: regionMap['NA'], action: 'GOAL_SUBMIT',              outcome: 'SUCCESS',   resource: 'goal',          resourceId: `seed-goal-draft-na-emp001`,    httpMethod: 'PATCH', httpPath: '/goals/seed-goal-draft-na-emp001/submit',           httpStatus: 200, ipAddress: '10.0.1.10',    userAgent: UA, detail: {}, createdAt: new Date('2026-04-18T16:00:00Z') },
      { userId: idMap['na-emp001'], userName: 'Aaron Brooks',          userRegionId: regionMap['NA'], action: 'REVIEW_ANSWERS_SAVE',      outcome: 'SUCCESS',   resource: 'review',        resourceId: 'rev-na-ann-emp001',            httpMethod: 'PUT',   httpPath: '/reviews/rev-na-ann-emp001/answers',                httpStatus: 200, ipAddress: '10.0.1.10',    userAgent: UA, detail: {}, createdAt: new Date('2026-05-04T14:00:00Z') },
      { userId: idMap['na-emp001'], userName: 'Aaron Brooks',          userRegionId: regionMap['NA'], action: 'REVIEW_SUBMIT',            outcome: 'SUCCESS',   resource: 'review',        resourceId: 'rev-na-ann-emp001',            httpMethod: 'POST',  httpPath: '/reviews/rev-na-ann-emp001/submit',                 httpStatus: 200, ipAddress: '10.0.1.10',    userAgent: UA, detail: {}, createdAt: new Date('2026-05-04T14:30:00Z') },
      { userId: idMap['na-emp002'], userName: 'Chloe Davis',           userRegionId: regionMap['NA'], action: 'GOAL_SUBMIT',              outcome: 'SUCCESS',   resource: 'goal',          resourceId: `seed-goal-draft-na-emp002`,    httpMethod: 'PATCH', httpPath: '/goals/seed-goal-draft-na-emp002/submit',           httpStatus: 200, ipAddress: '10.0.1.11',    userAgent: UA, detail: {}, createdAt: new Date('2026-04-19T17:00:00Z') },
      { userId: idMap['na-emp002'], userName: 'Chloe Davis',           userRegionId: regionMap['NA'], action: 'ACCESS_DENIED',            outcome: 'FORBIDDEN', resource: 'review',        resourceId: undefined,                      httpMethod: 'GET',   httpPath: '/reviews/calibrate/seed-na-annual-2026',            httpStatus: 403, ipAddress: '10.0.1.11',    userAgent: UA, detail: {}, createdAt: new Date('2026-05-11T09:00:00Z') },
      { userId: idMap['na-sup001'], userName: 'David Thompson',        userRegionId: regionMap['NA'], action: 'GOAL_APPROVE',             outcome: 'SUCCESS',   resource: 'goal',          resourceId: `seed-goal-draft-na-emp001`,    httpMethod: 'PATCH', httpPath: '/goals/seed-goal-draft-na-emp001/approve',          httpStatus: 200, ipAddress: '10.0.1.20',    userAgent: UA, detail: {}, createdAt: new Date('2026-04-23T10:00:00Z') },
      { userId: idMap['na-sup001'], userName: 'David Thompson',        userRegionId: regionMap['NA'], action: 'REVIEW_SUPERVISOR_SUBMIT', outcome: 'SUCCESS',   resource: 'review',        resourceId: 'rev-na-ann-emp001',            httpMethod: 'POST',  httpPath: '/reviews/rev-na-ann-emp001/supervisor/submit',      httpStatus: 200, ipAddress: '10.0.1.20',    userAgent: UA, detail: {}, createdAt: new Date('2026-05-07T11:00:00Z') },
      { userId: idMap['na-mgr001'], userName: 'Emma Wilson',           userRegionId: regionMap['NA'], action: 'REVIEW_CALIBRATE',         outcome: 'SUCCESS',   resource: 'review',        resourceId: 'rev-na-ann-emp001',            httpMethod: 'PUT',   httpPath: '/reviews/rev-na-ann-emp001/calibrate',              httpStatus: 200, ipAddress: '10.0.1.30',    userAgent: UA, detail: { grade: 'S' }, createdAt: new Date('2026-05-11T09:30:00Z') },

      // ── JP ────────────────────────────────────────────────────────────────────
      { userId: idMap['jp-emp001'], userName: '田中 健太 Kenta Tanaka', userRegionId: regionMap['JP'], action: 'GOAL_SUBMIT',              outcome: 'SUCCESS',   resource: 'goal',          resourceId: `seed-goal-draft-jp-emp001`,    httpMethod: 'PATCH', httpPath: '/goals/seed-goal-draft-jp-emp001/submit',           httpStatus: 200, ipAddress: '172.16.1.10',  userAgent: UA, detail: {}, createdAt: new Date('2026-04-17T09:00:00Z') },
      { userId: idMap['jp-emp001'], userName: '田中 健太 Kenta Tanaka', userRegionId: regionMap['JP'], action: 'REVIEW_ANSWERS_SAVE',      outcome: 'SUCCESS',   resource: 'review',        resourceId: 'rev-jp-ann-emp001',            httpMethod: 'PUT',   httpPath: '/reviews/rev-jp-ann-emp001/answers',                httpStatus: 200, ipAddress: '172.16.1.10',  userAgent: UA, detail: {}, createdAt: new Date('2026-05-03T10:00:00Z') },
      { userId: idMap['jp-emp001'], userName: '田中 健太 Kenta Tanaka', userRegionId: regionMap['JP'], action: 'REVIEW_SUBMIT',            outcome: 'SUCCESS',   resource: 'review',        resourceId: 'rev-jp-ann-emp001',            httpMethod: 'POST',  httpPath: '/reviews/rev-jp-ann-emp001/submit',                 httpStatus: 200, ipAddress: '172.16.1.10',  userAgent: UA, detail: {}, createdAt: new Date('2026-05-03T10:30:00Z') },
      { userId: idMap['jp-sup001'], userName: '山本 彩 Aya Yamamoto',  userRegionId: regionMap['JP'], action: 'GOAL_APPROVE',             outcome: 'SUCCESS',   resource: 'goal',          resourceId: `seed-goal-draft-jp-emp001`,    httpMethod: 'PATCH', httpPath: '/goals/seed-goal-draft-jp-emp001/approve',          httpStatus: 200, ipAddress: '172.16.1.20',  userAgent: UA, detail: {}, createdAt: new Date('2026-04-22T14:00:00Z') },
      { userId: idMap['jp-sup001'], userName: '山本 彩 Aya Yamamoto',  userRegionId: regionMap['JP'], action: 'REVIEW_SUPERVISOR_SAVE',   outcome: 'SUCCESS',   resource: 'review',        resourceId: 'rev-jp-ann-emp001',            httpMethod: 'PUT',   httpPath: '/reviews/rev-jp-ann-emp001/supervisor',             httpStatus: 200, ipAddress: '172.16.1.20',  userAgent: UA, detail: {}, createdAt: new Date('2026-05-06T16:00:00Z') },
      { userId: idMap['jp-sup001'], userName: '山本 彩 Aya Yamamoto',  userRegionId: regionMap['JP'], action: 'REVIEW_SUPERVISOR_SUBMIT', outcome: 'SUCCESS',   resource: 'review',        resourceId: 'rev-jp-ann-emp001',            httpMethod: 'POST',  httpPath: '/reviews/rev-jp-ann-emp001/supervisor/submit',      httpStatus: 200, ipAddress: '172.16.1.20',  userAgent: UA, detail: {}, createdAt: new Date('2026-05-06T16:30:00Z') },
      { userId: idMap['jp-mgr001'], userName: '佐藤 誠 Makoto Sato',   userRegionId: regionMap['JP'], action: 'REVIEW_CALIBRATE',         outcome: 'SUCCESS',   resource: 'review',        resourceId: 'rev-jp-ann-emp001',            httpMethod: 'PUT',   httpPath: '/reviews/rev-jp-ann-emp001/calibrate',              httpStatus: 200, ipAddress: '172.16.1.30',  userAgent: UA, detail: { grade: 'S' }, createdAt: new Date('2026-05-10T11:00:00Z') },

      // ── EU ────────────────────────────────────────────────────────────────────
      { userId: idMap['eu-emp001'], userName: 'Fritz Bauer',           userRegionId: regionMap['EU'], action: 'GOAL_SUBMIT',              outcome: 'SUCCESS',   resource: 'goal',          resourceId: `seed-goal-draft-eu-emp001`,    httpMethod: 'PATCH', httpPath: '/goals/seed-goal-draft-eu-emp001/submit',           httpStatus: 200, ipAddress: '10.10.1.10',   userAgent: UA, detail: {}, createdAt: new Date('2026-04-16T14:00:00Z') },
      { userId: idMap['eu-emp001'], userName: 'Fritz Bauer',           userRegionId: regionMap['EU'], action: 'REVIEW_ANSWERS_SAVE',      outcome: 'SUCCESS',   resource: 'review',        resourceId: 'rev-eu-ann-emp001',            httpMethod: 'PUT',   httpPath: '/reviews/rev-eu-ann-emp001/answers',                httpStatus: 200, ipAddress: '10.10.1.10',   userAgent: UA, detail: {}, createdAt: new Date('2026-05-02T09:00:00Z') },
      { userId: idMap['eu-emp001'], userName: 'Fritz Bauer',           userRegionId: regionMap['EU'], action: 'REVIEW_SUBMIT',            outcome: 'SUCCESS',   resource: 'review',        resourceId: 'rev-eu-ann-emp001',            httpMethod: 'POST',  httpPath: '/reviews/rev-eu-ann-emp001/submit',                 httpStatus: 200, ipAddress: '10.10.1.10',   userAgent: UA, detail: {}, createdAt: new Date('2026-05-02T09:30:00Z') },
      { userId: idMap['eu-emp002'], userName: 'Klaus Wagner',          userRegionId: regionMap['EU'], action: 'ACCESS_DENIED',            outcome: 'FORBIDDEN', resource: 'review',        resourceId: undefined,                      httpMethod: 'GET',   httpPath: '/reviews/calibrate/seed-eu-annual-2026',            httpStatus: 403, ipAddress: '10.10.1.11',   userAgent: UA, detail: {}, createdAt: new Date('2026-05-09T09:45:00Z') },
      { userId: idMap['eu-sup001'], userName: 'Hans Müller',           userRegionId: regionMap['EU'], action: 'GOAL_APPROVE',             outcome: 'SUCCESS',   resource: 'goal',          resourceId: `seed-goal-draft-eu-emp001`,    httpMethod: 'PATCH', httpPath: '/goals/seed-goal-draft-eu-emp001/approve',          httpStatus: 200, ipAddress: '10.10.1.20',   userAgent: UA, detail: {}, createdAt: new Date('2026-04-21T16:00:00Z') },
      { userId: idMap['eu-sup001'], userName: 'Hans Müller',           userRegionId: regionMap['EU'], action: 'REVIEW_SUPERVISOR_SAVE',   outcome: 'SUCCESS',   resource: 'review',        resourceId: 'rev-eu-ann-emp001',            httpMethod: 'PUT',   httpPath: '/reviews/rev-eu-ann-emp001/supervisor',             httpStatus: 200, ipAddress: '10.10.1.20',   userAgent: UA, detail: {}, createdAt: new Date('2026-05-05T15:00:00Z') },
      { userId: idMap['eu-mgr001'], userName: 'Sophie Laurent',        userRegionId: regionMap['EU'], action: 'REVIEW_CALIBRATE',         outcome: 'SUCCESS',   resource: 'review',        resourceId: 'rev-eu-ann-emp001',            httpMethod: 'PUT',   httpPath: '/reviews/rev-eu-ann-emp001/calibrate',              httpStatus: 200, ipAddress: '10.10.1.30',   userAgent: UA, detail: { grade: 'S' }, createdAt: new Date('2026-05-09T10:00:00Z') },
    ]

    for (const entry of AUDIT_LOGS) {
      await es.index({
        index: 'audit-logs',
        document: { ...entry, createdAt: entry.createdAt.toISOString() },
      })
    }
    console.log(`  ✓ Audit logs seeded (${AUDIT_LOGS.length} entries across TW/NA/JP/EU)`)
  } catch (err) {
    console.warn('  ⚠ Elasticsearch unavailable — skipping audit log seed:', (err as Error).message)
  }

  console.log('\n✅ Seed complete.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
