import assert from "node:assert/strict";
import { hasCode } from "./warehouse-transfers-test-context.mjs";

export async function verifyTransferReservationSafety(run) {
  await run(
    "reserve transfer audit failure rolls back balances, both reserves and idempotency",
    async ({
      prisma,
      actor,
      a,
      b,
      receive,
      read,
      service,
      stock,
      reservations,
      WarehouseTransfersService,
      payload,
      namespace,
    }) => {
      const source = await receive(a, "8");
      const project = await prisma.warehouseProject.create({
        data: { projectNumber: namespace },
      });
      const reserve = await prisma.warehouseProjectReservation.create({
        data: {
          balanceId: BigInt(source.id),
          projectId: project.id,
          quantity: "8",
        },
      });
      const before = await prisma.auditLog.count();
      const input = {
        ...payload("8"),
        moveReservation: true,
        projectId: String(project.id),
      };
      const broken = new WarehouseTransfersService(
        prisma,
        stock,
        reservations,
        {
          writeFieldChanges: async () => {
            throw Error("Reserve transfer audit failed");
          },
        },
      );
      await assert.rejects(
        broken.create(input, actor.id),
        /Reserve transfer audit failed/,
      );
      assert.equal((await read(a)).quantity, "8");
      assert.equal(await read(b), null);
      assert.equal(
        (
          await prisma.warehouseProjectReservation.findUniqueOrThrow({
            where: { id: reserve.id },
          })
        ).quantity.toString(),
        "8",
      );
      assert.equal(
        await prisma.warehouseProjectReservation.count({
          where: { projectId: project.id },
        }),
        1,
      );
      assert.equal(await prisma.auditLog.count(), before);
      assert.equal(
        await prisma.warehouseTransfer.count({
          where: { createdByUserId: actor.id },
        }),
        0,
      );
      await service.create(input, actor.id);
      assert.equal((await read(b)).quantity, "8");
    },
  );
  await run(
    "reservation mode protects other projects during an existing shortage",
    async ({
      prisma,
      actor,
      a,
      receive,
      read,
      service,
      payload,
      namespace,
    }) => {
      const source = await receive(a, "8");
      const projects = await Promise.all(
        [0, 1].map((n) =>
          prisma.warehouseProject.create({
            data: { projectNumber: namespace + n },
          }),
        ),
      );
      await prisma.warehouseProjectReservation.createMany({
        data: projects.map((p) => ({
          balanceId: BigInt(source.id),
          projectId: p.id,
          quantity: "5",
        })),
      });
      await assert.rejects(
        service.create(
          {
            ...payload("4"),
            moveReservation: true,
            projectId: String(projects[0].id),
          },
          actor.id,
        ),
        hasCode("WAREHOUSE_TRANSFER_RESERVED_STOCK", 409),
      );
      await service.create(
        {
          ...payload("3"),
          moveReservation: true,
          projectId: String(projects[0].id),
        },
        actor.id,
      );
      assert.equal((await read(a)).quantity, "5");
      const other = await prisma.warehouseProjectReservation.findUniqueOrThrow({
        where: {
          balanceId_projectId: {
            balanceId: BigInt(source.id),
            projectId: projects[1].id,
          },
        },
      });
      assert.equal(other.quantity.toString(), "5");
    },
  );
  await run(
    "concurrent reserved transfers cannot consume the same project reserve twice",
    async ({
      prisma,
      actor,
      a,
      b,
      receive,
      read,
      service,
      payload,
      namespace,
    }) => {
      const source = await receive(a, "10");
      const project = await prisma.warehouseProject.create({
        data: { projectNumber: namespace },
      });
      await prisma.warehouseProjectReservation.create({
        data: {
          balanceId: BigInt(source.id),
          projectId: project.id,
          quantity: "10",
        },
      });
      const results = await Promise.allSettled([
        service.create(
          {
            ...payload("7"),
            moveReservation: true,
            projectId: String(project.id),
          },
          actor.id,
        ),
        service.create(
          {
            ...payload("7"),
            moveReservation: true,
            projectId: String(project.id),
          },
          actor.id,
        ),
      ]);
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
      hasCode(
        "WAREHOUSE_TRANSFER_RESERVATION_INSUFFICIENT",
        409,
      )(results.find((r) => r.status === "rejected").reason);
      assert.equal((await read(a)).quantity, "3");
      assert.equal((await read(b)).quantity, "7");
      const total = await prisma.warehouseProjectReservation.aggregate({
        where: { projectId: project.id },
        _sum: { quantity: true },
      });
      assert.equal(total._sum.quantity.toString(), "10");
    },
  );
}
