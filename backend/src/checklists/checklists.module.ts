import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ChecklistModulesController } from './checklist-modules/checklist-modules.controller';
import { ChecklistModulesService } from './checklist-modules/checklist-modules.service';
import { ChecklistQuestionsController } from './checklist-questions/checklist-questions.controller';
import { ChecklistQuestionsService } from './checklist-questions/checklist-questions.service';
import { ChecklistTemplateAssertions } from './checklist-templates/checklist-template.assertions';
import { ChecklistTemplateCopyService } from './checklist-templates/checklist-template-copy.service';
import { ChecklistTemplateLifecycleService } from './checklist-templates/checklist-template-lifecycle.service';
import { ChecklistTemplateOrderService } from './checklist-templates/checklist-template-order.service';
import { ChecklistTemplateQueryService } from './checklist-templates/checklist-template-query.service';
import { ChecklistTemplateRepository } from './checklist-templates/checklist-template.repository';
import { ChecklistTemplateStructureService } from './checklist-templates/checklist-template-structure.service';
import { ChecklistTemplatesController } from './checklist-templates/checklist-templates.controller';
import { ChecklistTemplatesService } from './checklist-templates/checklist-templates.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    ChecklistModulesController,
    ChecklistQuestionsController,
    ChecklistTemplatesController,
  ],
  providers: [
    ChecklistModulesService,
    ChecklistQuestionsService,
    ChecklistTemplateAssertions,
    ChecklistTemplateCopyService,
    ChecklistTemplateLifecycleService,
    ChecklistTemplateOrderService,
    ChecklistTemplateQueryService,
    ChecklistTemplateRepository,
    ChecklistTemplateStructureService,
    ChecklistTemplatesService,
  ],
})
export class ChecklistsModule {}
