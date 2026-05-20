import { Module } from '@nestjs/common'
import { UsersController } from './users.controller'
import { UsersService } from './users.service'
import { GoalsModule } from '../goals/goals.module'
import { ReviewsModule } from '../reviews/reviews.module'

@Module({
  imports: [GoalsModule, ReviewsModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
