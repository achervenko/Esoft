import { setup } from './integration-flows.test-helpers';

describe('actor permission revocation', () => {
  function permissionState() {
    const s = setup();
    const shared = 'warehouse.receipts.read';
    s.registry.registerFlow({
      ...s.registry.findFlow(s.flow.flowCode)!,
      flowCode: 'second.flow',
      actorPermissions: ['warehouse.receipts.integration', shared],
    });
    const flows = [s.flow, { ...s.flow, flowCode: 'second.flow' }];
    const grants = [
      {
        sourceId: s.source.id,
        actorUserId: s.source.actorUserId,
        permission: 'warehouse.receipts.integration',
      },
      {
        sourceId: s.source.id,
        actorUserId: s.source.actorUserId,
        permission: shared,
      },
      {
        sourceId: 'other-source',
        actorUserId: s.source.actorUserId,
        permission: shared,
      },
      { sourceId: s.source.id, actorUserId: 'other-actor', permission: shared },
    ];
    s.findFlows.mockImplementation(() =>
      Promise.resolve(flows.filter((flow) => flow.isActive)),
    );
    jest
      .spyOn(s.tx.integrationFlow, 'updateMany')
      .mockImplementation((args) => {
        const where = args.where as {
          sourceId: string;
          flowCode: { notIn: string[] };
        };
        let count = 0;
        for (const flow of flows) {
          if (
            where.sourceId === s.source.id &&
            flow.isActive &&
            !where.flowCode.notIn.includes(flow.flowCode)
          ) {
            flow.isActive = false;
            count++;
          }
        }
        return Promise.resolve({ count }) as never;
      });
    s.upsert.mockImplementation(
      ({
        where,
        update,
      }: {
        where: { sourceId_flowCode: { flowCode: string } };
        update: Partial<typeof s.flow>;
      }) => {
        const flow = flows.find(
          (f) => f.flowCode === where.sourceId_flowCode.flowCode,
        )!;
        Object.assign(flow, update);
        return Promise.resolve(flow);
      },
    );
    s.grant.mockImplementation(
      ({ create }: { create: (typeof grants)[number] }) => {
        if (
          !grants.some(
            (g) =>
              g.sourceId === create.sourceId &&
              g.actorUserId === create.actorUserId &&
              g.permission === create.permission,
          )
        )
          grants.push(create);
        return Promise.resolve(create);
      },
    );
    const remove = s.remove;
    remove.mockImplementation(
      ({
        where: filter,
      }: {
        where: {
          sourceId: string;
          actorUserId: string;
          permission: { notIn: string[] };
        };
      }) => {
        let count = 0;
        for (let i = grants.length - 1; i >= 0; i--) {
          const g = grants[i];
          if (
            g.sourceId === filter.sourceId &&
            g.actorUserId === filter.actorUserId &&
            !filter.permission.notIn.includes(g.permission)
          ) {
            grants.splice(i, 1);
            count++;
          }
        }
        return Promise.resolve({ count });
      },
    );
    const disableSecond = () =>
      s.service.configureFlow(
        'source-code',
        'second.flow',
        { configVersion: 1, config: {}, isActive: false },
        'admin-id',
      );
    return { ...s, flows, grants, remove, shared, disableSecond };
  }

  it('removes a disabled flow unique permission and preserves a shared permission', async () => {
    const s = permissionState();
    await s.disableSecond();
    expect(
      s.grants.filter(
        (g) =>
          g.sourceId === s.source.id && g.actorUserId === s.source.actorUserId,
      ),
    ).toEqual([
      {
        sourceId: s.source.id,
        actorUserId: s.source.actorUserId,
        permission: 'warehouse.receipts.integration',
      },
    ]);
    expect(s.remove).toHaveBeenCalledWith({
      where: {
        sourceId: s.source.id,
        actorUserId: s.source.actorUserId,
        permission: { notIn: ['warehouse.receipts.integration'] },
      },
    });
    expect(s.findFlows).toHaveBeenCalledWith({
      where: { sourceId: s.source.id, isActive: true },
      select: { flowCode: true },
    });
  });

  it('does not revoke permissions belonging to another source or actor', async () => {
    const s = permissionState();
    await s.disableSecond();
    expect(s.grants).toEqual(
      expect.arrayContaining([
        {
          sourceId: 'other-source',
          actorUserId: s.source.actorUserId,
          permission: s.shared,
        },
        {
          sourceId: s.source.id,
          actorUserId: 'other-actor',
          permission: s.shared,
        },
      ]),
    );
  });

  it.each(['create', 'update', 'configure'])(
    'never deletes with an unresolved active handler but adds known grants during %s',
    async (operation) => {
      const s = permissionState();
      s.flows.push({ ...s.flow, flowCode: 'missing.handler' });
      jest
        .spyOn(s.tx.integrationFlow, 'findUnique')
        .mockResolvedValue(s.flows.at(-1) as never);
      s.grants.splice(0, 2);
      const previous = [...s.grants];
      if (operation === 'create')
        await s.service.createForSource(s.tx, s.source, []);
      else if (operation === 'update')
        await s.service.updateForSource(s.tx, s.source, s.flows, 'admin-id');
      else await s.disableSecond();
      expect(s.remove).not.toHaveBeenCalled();
      expect(s.grants).toEqual(expect.arrayContaining(previous));
      expect(s.grants).toContainEqual({
        sourceId: s.source.id,
        actorUserId: s.source.actorUserId,
        permission: 'warehouse.receipts.integration',
      });
      expect(s.grant).toHaveBeenCalled();
    },
  );

  it('an empty replacement disables even an unresolved flow and permits revocation', async () => {
    const s = permissionState();
    s.flows.push({ ...s.flow, flowCode: 'missing.handler' });
    await s.service.updateForSource(s.tx, s.source, [], 'admin-id');
    expect(s.flows.every((flow) => !flow.isActive)).toBe(true);
    expect(s.remove).toHaveBeenCalledWith({
      where: {
        sourceId: s.source.id,
        actorUserId: s.source.actorUserId,
        permission: { notIn: [] },
      },
    });
    expect(
      s.grants.filter(
        (g) =>
          g.sourceId === s.source.id && g.actorUserId === s.source.actorUserId,
      ),
    ).toEqual([]);
    expect(s.grant).not.toHaveBeenCalled();
  });
});
