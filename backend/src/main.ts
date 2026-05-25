import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import * as cookieParser from 'cookie-parser'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.setGlobalPrefix('api')

  // Swagger — available at http://localhost:4000/api/docs
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('PMS API')
      .setDescription('Unleash Innovation — Performance Management System API')
      .setVersion('1.0')
      .addCookieAuth('sessionId')
      .build()
    const document = SwaggerModule.createDocument(app, config)
    SwaggerModule.setup('api/docs', app, document)
  }

  app.use(cookieParser())

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  )

  const isDev = process.env.NODE_ENV !== 'production'
  // In production, FRONTEND_URL can be a comma-separated list of allowed origins
  // or a single origin. We parse it into a regex/array so subdomains work correctly.
  const prodOrigin = (() => {
    const raw = process.env.FRONTEND_URL ?? ''
    const origins = raw.split(',').map((o) => o.trim()).filter(Boolean)
    if (origins.length === 0) return false
    if (origins.length === 1) return origins[0]
    return origins
  })()
  app.enableCors({
    origin: isDev ? /^http:\/\/localhost:\d+$/ : prodOrigin,
    credentials: true,
  })

  const port = process.env.PORT ?? 4000
  await app.listen(port)
  console.log(`Backend running on http://localhost:${port}/api`)
}

bootstrap()
