import { createController, session } from './ppe.controller.spec-fixtures';

describe('PPE size update actor', () => {
  it('passes the authenticated actor to size updates', async () => {
    const { controller, employees } = createController();
    await controller.updateEmployeeSizes(
      1,
      { shoeSize: 42.5 },
      session('ppe_specialist'),
    );
    expect(employees.updateSizes).toHaveBeenCalledWith(
      1,
      { shoeSize: 42.5 },
      'ppe-actor',
    );
  });
});
