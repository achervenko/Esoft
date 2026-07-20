import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ChecklistModulesController } from './checklist-modules/checklist-modules.controller';
import { ChecklistModulesOrderLockService } from './checklist-modules/checklist-modules-order-lock.service';
import { ChecklistModulesReorderService } from './checklist-modules/checklist-modules-reorder.service';
import { ChecklistModulesRepository } from './checklist-modules/checklist-modules.repository';
import { ChecklistModulesService } from './checklist-modules/checklist-modules.service';
import { ChecklistModulesStatusService } from './checklist-modules/checklist-modules-status.service';
import { ChecklistQuestionsAssertions } from './checklist-questions/checklist-questions.assertions';
import { ChecklistQuestionsController } from './checklist-questions/checklist-questions.controller';
import { ChecklistQuestionsOrderLockService } from './checklist-questions/checklist-questions-order-lock.service';
import { ChecklistQuestionsOrderService } from './checklist-questions/checklist-questions-order.service';
import { ChecklistQuestionsReorderService } from './checklist-questions/checklist-questions-reorder.service';
import { ChecklistQuestionsService } from './checklist-questions/checklist-questions.service';
import { ChecklistQuestionsStatusService } from './checklist-questions/checklist-questions-status.service';
import { ChecklistEventCompletionService } from './checklist-work/checklist-event-completion.service';
import { ChecklistWorkAnswersService } from './checklist-work/checklist-work-answers.service';
import { ChecklistWorkAssertions } from './checklist-work/checklist-work.assertions';
import { ChecklistWorkController } from './checklist-work/checklist-work.controller';
import { ChecklistWorkLifecycleService } from './checklist-work/checklist-work-lifecycle.service';
import { ChecklistWorkQueryService } from './checklist-work/checklist-work-query.service';
import {
  ChecklistWorkMutationRepository,
  ChecklistWorkQueryRepository,
} from './checklist-work/checklist-work.repository';
import { ChecklistWorkService } from './checklist-work/checklist-work.service';
import { ChecklistTemplateAssertions } from './checklist-templates/checklist-template.assertions';
import { ChecklistTemplateLifecycleService } from './checklist-templates/checklist-template-lifecycle.service';
import { ChecklistTemplateQueryService } from './checklist-templates/checklist-template-query.service';
import { ChecklistTemplateRepository } from './checklist-templates/checklist-template.repository';
import { ChecklistTemplatesController } from './checklist-templates/checklist-templates.controller';
import { ChecklistTemplatesService } from './checklist-templates/checklist-templates.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    ChecklistModulesController,
    ChecklistQuestionsController,
    ChecklistTemplatesController,
    ChecklistWorkController,
  ],
  providers: [
    ChecklistModulesReorderService,
    ChecklistModulesOrderLockService,
    ChecklistModulesRepository,
    ChecklistModulesService,
    ChecklistModulesStatusService,
    ChecklistQuestionsAssertions,
    ChecklistQuestionsOrderLockService,
    ChecklistQuestionsOrderService,
    ChecklistQuestionsReorderService,
    ChecklistQuestionsService,
    ChecklistQuestionsStatusService,
    ChecklistTemplateAssertions,
    ChecklistTemplateLifecycleService,
    ChecklistTemplateQueryService,
    ChecklistTemplateRepository,
    ChecklistTemplatesService,
    ChecklistEventCompletionService,
    ChecklistWorkAnswersService,
    ChecklistWorkAssertions,
    ChecklistWorkLifecycleService,
    ChecklistWorkMutationRepository,
    ChecklistWorkQueryService,
    ChecklistWorkQueryRepository,
    ChecklistWorkService,
  ],
  exports: [ChecklistEventCompletionService, ChecklistWorkService],
})
export class ChecklistsModule {}
