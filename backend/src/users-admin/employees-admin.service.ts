import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toEmployeeDto, employeeAdminInclude } from './users-admin.mapper';
import { EmployeesAdminEditorService } from './employees-admin-editor.service';
import { EmployeesAdminStatusService } from './employees-admin-status.service';
@Injectable()
export class EmployeesAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly editor: EmployeesAdminEditorService,
    private readonly status: EmployeesAdminStatusService,
  ) {}
  async listEmployees(currentUserId?: string | null) {
    const employees = await this.prisma.employee.findMany({
      include: employeeAdminInclude,
      orderBy: [
        { lastName: 'asc' },
        { firstName: 'asc' },
        { middleName: 'asc' },
      ],
    });

    return employees.map((employee) => toEmployeeDto(employee, currentUserId));
  }

  createEmployee(
    ...args: Parameters<EmployeesAdminEditorService['createEmployee']>
  ) {
    return this.editor.createEmployee(...args);
  }
  updateEmployee(
    ...args: Parameters<EmployeesAdminEditorService['updateEmployee']>
  ) {
    return this.editor.updateEmployee(...args);
  }
  setEmployeeStatus(
    ...args: Parameters<EmployeesAdminStatusService['setEmployeeStatus']>
  ) {
    return this.status.setEmployeeStatus(...args);
  }
}
