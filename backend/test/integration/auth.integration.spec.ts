import { UnauthorizedException } from '@nestjs/common'
import { truncateAll, connectTestDb } from '../helpers/db'
import { createUser, createRegion, createDepartment } from '../helpers/seed'
import { Role } from '@prisma/client'
import { createAuthService, disconnectTestDb } from '../helpers/integration-setup'

describe('AuthService (integration)', () => {
  const auth = createAuthService()

  beforeAll(async () => {
    await connectTestDb()
  })

  afterAll(async () => {
    await disconnectTestDb()
  })

  beforeEach(async () => {
    await truncateAll()
  })

  it('login succeeds with correct password', async () => {
    const region = await createRegion()
    const dept = await createDepartment(region)
    const user = await createUser(Role.Employee, region, dept)

    const result = await auth.login(
      { employeeId: user.employeeId, password: 'test1234' },
      '127.0.0.1',
    )

    expect(result.sessionId).toBeDefined()
    expect(result.user.employeeId).toBe(user.employeeId)
    expect(result.user.region).toBe(region.name)
  })

  it('login fails with wrong password', async () => {
    const region = await createRegion()
    const dept = await createDepartment(region)
    const user = await createUser(Role.Employee, region, dept)

    await expect(
      auth.login({ employeeId: user.employeeId, password: 'wrong' }, '127.0.0.1'),
    ).rejects.toThrow(UnauthorizedException)
  })

  it('login fails for unknown employeeId', async () => {
    await expect(
      auth.login({ employeeId: 'nobody', password: 'test1234' }, '127.0.0.1'),
    ).rejects.toThrow(UnauthorizedException)
  })

  it('getMe returns user for valid session', async () => {
    const region = await createRegion()
    const dept = await createDepartment(region)
    const user = await createUser(Role.Employee, region, dept)
    const { sessionId } = await auth.login(
      { employeeId: user.employeeId, password: 'test1234' },
      '127.0.0.1',
    )

    const me = await auth.getMe(sessionId)
    expect(me.id).toBe(user.id)
    expect(me.employeeId).toBe(user.employeeId)
  })

  it('getMe fails for expired session', async () => {
    const region = await createRegion()
    const dept = await createDepartment(region)
    const user = await createUser(Role.Employee, region, dept)
    const { sessionId } = await auth.login(
      { employeeId: user.employeeId, password: 'test1234' },
      '127.0.0.1',
    )

    const { prisma } = await import('../helpers/db')
    await prisma.session.update({
      where: { id: sessionId },
      data:  { expiresAt: new Date('2020-01-01') },
    })

    await expect(auth.getMe(sessionId)).rejects.toThrow(UnauthorizedException)
  })
})
