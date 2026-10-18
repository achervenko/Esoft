import { createController, session } from './ppe.controller.spec-fixtures';

describe('PPE norm controller arguments', () => {
  it('passes the authenticated actor to every norm mutation', async () => {
    const { controller, norms } = createController();
    const payload = { effectiveFrom: '2027-01-01', items: [] };
    const currentSession = session('ppe_specialist');
    await controller.createNorm(payload, currentSession);
    await controller.createNormRevision(1, payload, currentSession);
    await controller.updateFutureNorm(1, payload, currentSession);
    expect(norms.create).toHaveBeenCalledWith(payload, 'ppe-actor');
    expect(norms.createRevision).toHaveBeenCalledWith(1, payload, 'ppe-actor');
    expect(norms.updateFuture).toHaveBeenCalledWith(1, payload, 'ppe-actor');
  });

  it('parses list filters and the date for effective norm reads', async () => {
    const { controller, norms } = createController();
    await controller.listNorms({ positionId: '5' });
    await controller.findEffectiveNorm(5, { date: '2027-01-01' });
    expect(norms.list).toHaveBeenCalledWith(5);
    expect(norms.findEffectiveNorm).toHaveBeenCalledWith(
      5,
      new Date('2027-01-01T00:00:00Z'),
    );
  });
});
