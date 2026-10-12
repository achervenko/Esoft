import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import type { Auth } from '../auth/auth.config';
import { assertCanIssuePpe, assertCanReadPpe } from '../auth/role-permissions';
import { PpeIssuesService } from './ppe-issues.service';
import { parseIssuePlanQuery } from './ppe-issues.validation';

@Controller('api/ppe')
export class PpeIssuesController {
  constructor(private readonly issues: PpeIssuesService) {}

  @Get('employees/:employeeId/items/:itemId/size-recommendation')
  recommendSize(
    @Param('employeeId', ParseIntPipe) employeeId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Session() session: UserSession<Auth>,
  ) {
    assertCanReadPpe(session.user.role);
    return this.issues.recommendSize(employeeId, itemId);
  }

  @Get('employees/:employeeId/issues/plan')
  plan(
    @Param('employeeId', ParseIntPipe) employeeId: number,
    @Query() query: unknown,
    @Session() session: UserSession<Auth>,
  ) {
    assertCanReadPpe(session.user.role);
    return this.issues.plan(
      employeeId,
      parseIssuePlanQuery(query, session.user.role),
    );
  }

  @Get('issues')
  list(@Query() query: unknown, @Session() session: UserSession<Auth>) {
    assertCanReadPpe(session.user.role);
    return this.issues.list(query);
  }

  @Get('issues/page')
  listPage(@Query() query: unknown, @Session() session: UserSession<Auth>) {
    assertCanReadPpe(session.user.role);
    return this.issues.listPage(query);
  }

  @Get('issues/:issueId')
  findOne(
    @Param('issueId', ParseIntPipe) issueId: number,
    @Session() session: UserSession<Auth>,
  ) {
    assertCanReadPpe(session.user.role);
    return this.issues.findOne(issueId);
  }

  @Post('issues/regular')
  createRegular(
    @Body() payload: unknown,
    @Session() session: UserSession<Auth>,
  ) {
    assertCanIssuePpe(session.user.role);
    return this.issues.createRegular(payload, {
      userId: session.user.id,
      role: session.user.role,
    });
  }

  @Post('issues/extra')
  createExtra(@Body() payload: unknown, @Session() session: UserSession<Auth>) {
    assertCanIssuePpe(session.user.role);
    return this.issues.createExtra(payload, {
      userId: session.user.id,
      role: session.user.role,
    });
  }

  @Post('issues/:issueId/cancel')
  cancel(
    @Param('issueId', ParseIntPipe) issueId: number,
    @Body() payload: unknown,
    @Session() session: UserSession<Auth>,
  ) {
    assertCanIssuePpe(session.user.role);
    return this.issues.cancel(issueId, payload, session.user.id);
  }
}
