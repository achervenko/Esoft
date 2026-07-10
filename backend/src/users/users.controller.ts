import { Controller, Get, Param } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('api/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':id/profile')
  findProfile(@Param('id') id: string) {
    return this.usersService.findProfile(id);
  }
}
