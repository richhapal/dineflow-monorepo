import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { PinLoginDto } from './dto/pin-login.dto';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.registerRestaurant(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.loginOwner(dto);
  }

  @Post('staff/pin')
  pinLogin(@Body() dto: PinLoginDto) {
    return this.authService.loginStaff(dto);
  }

  @Post('refresh')
  refresh(@Body() body: { token: string }) {
    return this.authService.refreshToken(body.token);
  }

  @Get('me')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  getMe(@CurrentUser() user: any) {
    return this.authService.getMe(user.id);
  }
}
