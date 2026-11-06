import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Param,
  Query,
  Headers,
  Header,
  HttpCode,
  UseFilters,
} from '@nestjs/common';
import {
  AllowAnonymous,
  Session,
  type UserSession,
} from '@thallesp/nestjs-better-auth';
import type { Auth } from '../auth/auth.config';
import { RequirePermission } from '../auth/require-permission';
import { IntegrationSourcesService } from './integration-sources.service';
import { IntegrationKeysService } from './integration-keys.service';
import { IntegrationEventsService } from './integration-events.service';
import { IntegrationRegistry } from './integration-registry';
import { IntegrationFailureFilter } from './integration-failure.filter';
import { integrationId } from './integration.validation';
@Controller('api/integrations')
@UseFilters(IntegrationFailureFilter)
export class IntegrationsController {
  constructor(
    private readonly sources: IntegrationSourcesService,
    private readonly keys: IntegrationKeysService,
    private readonly events: IntegrationEventsService,
    private readonly registry: IntegrationRegistry,
  ) {}
  @Get('sources')
  @RequirePermission('integrations.manage')
  list(@Session() session: UserSession<Auth>) {
    return this.sources.list(session.user.id);
  }
  @Post('sources')
  @RequirePermission('integrations.manage')
  create(@Body() body: unknown, @Session() session: UserSession<Auth>) {
    return this.sources.create(body, session.user.id);
  }
  @Patch('sources/:code')
  @RequirePermission('integrations.manage')
  update(
    @Param('code') code: string,
    @Body() body: unknown,
    @Session() session: UserSession<Auth>,
  ) {
    return this.sources.update(code, body, session.user.id);
  }
  @Get('flows')
  @RequirePermission('integrations.manage')
  flows() {
    return this.registry.listFlows();
  }
  @Put('sources/:code/flows/:flowCode')
  @RequirePermission('integrations.manage')
  configureFlow(
    @Param('code') code: string,
    @Param('flowCode') flow: string,
    @Body() body: unknown,
    @Session() session: UserSession<Auth>,
  ) {
    return this.sources.configureFlow(code, flow, body, session.user.id);
  }
  @Post('sources/:code/flows/:flowCode/events')
  @AllowAnonymous()
  @HttpCode(202)
  event(
    @Param('code') code: string,
    @Param('flowCode') flow: string,
    @Body() body: unknown,
    @Headers('authorization') authorization: string | undefined,
  ) {
    return this.events.accept(code, flow, body, authorization);
  }
  @Get('sources/:code/keys')
  @RequirePermission('integrations.manage')
  listKeys(@Param('code') code: string, @Session() session: UserSession<Auth>) {
    return this.keys.list(code, session.user.id);
  }
  @Post('sources/:code/keys')
  @RequirePermission('integrations.manage')
  @Header('Cache-Control', 'no-store')
  createKey(
    @Param('code') code: string,
    @Body() body: unknown,
    @Session() session: UserSession<Auth>,
  ) {
    return this.keys.create(code, body, session.user.id);
  }
  @Post('sources/:code/keys/:id/revoke')
  @RequirePermission('integrations.manage')
  revoke(
    @Param('code') code: string,
    @Param('id') id: string,
    @Session() session: UserSession<Auth>,
  ) {
    return this.keys.revoke(code, id, session.user.id);
  }
  @Get('events')
  @RequirePermission('integrations.manage')
  listEvents(@Query() query: unknown, @Session() session: UserSession<Auth>) {
    return this.events.list(query, session.user.id);
  }
  @Get('events/:id')
  @RequirePermission('integrations.manage')
  history(@Param('id') id: string, @Session() session: UserSession<Auth>) {
    return this.events.history(integrationId(id), session.user.id);
  }
  @Post('events/:id/retry')
  @RequirePermission('integrations.manage')
  retry(@Param('id') id: string, @Session() session: UserSession<Auth>) {
    return this.events.retry(integrationId(id), session.user.id);
  }
}
