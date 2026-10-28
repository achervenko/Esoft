import assert from "node:assert/strict";
import { hasCode } from "./warehouse-transfers-test-context.mjs";

export async function verifyTransferReservationMoves(run) {
  await run(
    "explicit project reserve merges at destination and replays without double transfer",
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
      const source = await receive(a, "20"),
        target = await receive(b, "5");
      const project = await prisma.warehouseProject.create({
        data: { projectNumber: namespace },
      });
      await prisma.warehouseProjectReservation.createMany({
        data: [
          {
            balanceId: BigInt(source.id),
            projectId: project.id,
            quantity: "8",
          },
          {
            balanceId: BigInt(target.id),
            projectId: project.id,
            quantity: "2",
          },
        ],
      });
      const input = {
        ...payload("3"),
        moveReservation: true,
        projectId: String(project.id),
      };
      const result = await service.create(input, actor.id);
      assert.equal(result.moveReservation, true);
      assert.equal(result.snapshot.reservationTransfer.from.after, "5");
      assert.equal(result.snapshot.reservationTransfer.to.after, "5");
      assert.equal((await read(a)).quantity, "17");
      assert.equal((await read(b)).quantity, "8");
      const rows = await prisma.warehouseProjectReservation.findMany({
        where: { projectId: project.id },
        orderBy: { balanceId: "asc" },
      });
      assert.deepEqual(
        rows.map((r) => r.quantity.toString()),
        ["5", "5"],
      );
      assert.deepEqual(await service.create(input, actor.id), result);
      await assert.rejects(
        service.create(
          { ...input, moveReservation: false, projectId: undefined },
          actor.id,
        ),
        hasCode("WAREHOUSE_TRANSFER_REQUEST_CONFLICT", 409),
      );
      await assert.rejects(
        service.create({ ...input, ...payload("6") }, actor.id),
        hasCode("WAREHOUSE_TRANSFER_RESERVATION_INSUFFICIENT", 409),
      );
      await prisma.warehouseProject.update({
        where: { id: project.id },
        data: { projectNumber: namespace + "-renamed", isActive: false },
      });
      assert.deepEqual(await service.findOne(result.id), result);
      assert.deepEqual(await service.create(input, actor.id), result);
      await assert.rejects(
        service.create({ ...input, ...payload("1") }, actor.id),
        hasCode("WAREHOUSE_TRANSFER_PROJECT_UNAVAILABLE", 409),
      );
    },
  );
  await run(
    "full reserve moves to an absent destination and deletes the zero source reserve",
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
      const source = await receive(a, "8");
      const project = await prisma.warehouseProject.create({
        data: { projectNumber: namespace },
      });
      await prisma.warehouseProjectReservation.create({
        data: {
          balanceId: BigInt(source.id),
          projectId: project.id,
          quantity: "8",
        },
      });
      const foreign = await prisma.warehouse.create({
        data: { name: `${namespace}-Other warehouse` },
      });
      const targetLocation = await prisma.warehouseStorageLocation.create({
        data: { warehouseId: foreign.id, name: "Target" },
      });
      const input = {
        ...payload("8"),
        toLocationId: String(targetLocation.id),
        moveReservation: true,
        projectId: String(project.id),
      };
      const results = await Promise.all(
        Array.from({ length: 3 }, () => service.create(input, actor.id)),
      );
      const result = results[0];
      for (const replay of results) assert.deepEqual(replay, result);
      assert.equal(
        await prisma.warehouseTransfer.count({
          where: { createdByUserId: actor.id },
        }),
        1,
      );
      assert.equal((await read(a)).quantity, "0");
      assert.equal((await read(targetLocation)).quantity, "8");
      assert.equal(
        await prisma.warehouseProjectReservation.count({
          where: { balanceId: BigInt(source.id) },
        }),
        0,
      );
      const target = await prisma.warehouseProjectReservation.findFirstOrThrow({
        where: { projectId: project.id },
      });
      assert.equal(target.quantity.toString(), "8");
      assert.equal(String(target.balanceId), (await read(targetLocation)).id);
      assert.equal(result.snapshot.reservationTransfer.from.after, "0");
      assert.equal(result.snapshot.to.warehouseId, String(foreign.id));
    },
  );
}
