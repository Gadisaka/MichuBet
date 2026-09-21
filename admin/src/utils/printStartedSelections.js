export function selectionIdsForPrintIndexes(ticket, rows) {
  const selections = Array.isArray(ticket?.selections) ? ticket.selections : [];
  const ids = [];
  for (const row of rows || []) {
    const idx = Number(row?.index);
    const id = Number.isFinite(idx) ? selections[idx]?.id : null;
    if (id) ids.push(id);
  }
  return [...new Set(ids)];
}

export function printStartedConfirmMessage(count) {
  if (count === 1) {
    return "1 selection has already started. Remove it and continue printing the rest?";
  }
  return `${count} selections have already started. Remove them and continue printing the rest?`;
}

export function printStartedCancelMessage() {
  return "Printing canceled. Remove started selections to continue.";
}

export function remainingCountAfterStartedRemoval(ticket, startedRows) {
  const ids = selectionIdsForPrintIndexes(ticket, startedRows);
  return (ticket?.selections || []).length - ids.length;
}
