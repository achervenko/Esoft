export function createReceiptTestAudit() {
  let failAudit = false;
  const audit = {
    writeFieldChanges: async () => {
      if (failAudit) throw Error("audit failed");
    },
  };
  return {
    audit,
    failAudit: (value) => {
      failAudit = value;
    },
  };
}
