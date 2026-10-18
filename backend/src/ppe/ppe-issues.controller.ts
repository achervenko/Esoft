import { ParsePositiveIntPipe } from '../application/pipes/parse-positive-int.pipe';
import { PPE_PERMISSIONS } from './ppe.permissions';
import { RequirePermission } from '../auth/require-permission';
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import type { Auth } from '../auth/auth.config';
import { PpeIssuesService } from './ppe-issues.service';
import { parseIssuePlanQuery } from './ppe-issues.validation';

@Controller('api/ppe')
export class PpeIssuesController {
  constructor(private readonly issues: PpeIssuesService) {}

  @Get('employees/:employeeId/items/:itemId/size-recommendation')
  @RequirePermission(PPE_PERMISSIONS.READ)
  recommendSize(
    @Param('employeeId', ParsePositiveIntPipe) employeeId: number,
    @Param('itemId', ParsePositiveIntPipe) itemId: number,
  ) {
    return this.issues.recommendSize(employeeId, itemId);
  }

  @Get('employees/:employeeId/issues/plan')
  @RequirePermission(PPE_PERMISSIONS.READ)
  plan(
    @Param('employeeId', ParsePositiveIntPipe) employeeId: number,
    @Query() query: unknown,
    @Session() session: UserSession<Auth>,
  ) {
    return this.issues.plan(
      employeeId,
      parseIssuePlanQuery(query, session.user.role),
    );
  }

  @Get('issues')
  @RequirePermission(PPE_PERMISSIONS.READ)
  list(@Query() query: unknown) {
    return this.issues.list(query);
  }

  @Get('issues/page')
  @RequirePermission(PPE_PERMISSIONS.READ)
  listPage(@Query() query: unknown) {
    return this.issues.listPage(query);
  }

  @Get('issues/:issueId')
  @RequirePermission(PPE_PERMISSIONS.READ)
  findOne(@Param('issueId', ParsePositiveIntPipe) issueId: number) {
    return this.issues.findOne(issueId);
  }

  @Post('issues/regular')
  @RequirePermission(PPE_PERMISSIONS.ISSUE)
  createRegular(
    @Body() payload: unknown,
    @Session() session: UserSession<Auth>,
  ) {
    return this.issues.createRegular(payload, {
      userId: session.user.id,
      role: session.user.role,
    });
  }

  @Post('issues/extra')
  @RequirePermission(PPE_PERMISSIONS.ISSUE)
  createExtra(@Body() payload: unknown, @Session() session: UserSession<Auth>) {
    return this.issues.createExtra(payload, {
      userId: session.user.id,
      role: session.user.role,
    });
  }

  @Post('issues/:issueId/cancel')
  @RequirePermission(PPE_PERMISSIONS.ISSUE)
  cancel(
    @Param('issueId', ParsePositiveIntPipe) issueId: number,
    @Body() payload: unknown,
    @Session() session: UserSession<Auth>,
  ) {
    return this.issues.cancel(issueId, payload, session.user.id);
  }
}
