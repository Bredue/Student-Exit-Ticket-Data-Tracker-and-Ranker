function runBuildTool(e) {
  const ss = SpreadsheetApp.getActive();
  const sheets = ss.getSheets();

  let shouldRun = false;

  // Check Setup sheet checkbox B7
  const setupSheet = ss.getSheetByName("Setup");
  if (setupSheet) {
    const setupBox = setupSheet.getRange("B7").getValue();
    if (setupBox === true) shouldRun = true;
  }

  // Check each teacher sheet checkbox I1
  sheets.forEach(sh => {
    const name = sh.getName();
    if (["Reports", "Insights", "Groups", "Setup", "Ranks"].includes(name)) return;
    const box = sh.getRange("I1").getValue();
    if (box === true) shouldRun = true;
  });

  if (shouldRun) {
    buildEverything();

    // Clear all checkboxes after running
    if (setupSheet) setupSheet.getRange("B7").setValue(false);
    sheets.forEach(sh => {
      const name = sh.getName();
      if (["Reports", "Insights", "Groups", "Setup", "Ranks"].includes(name)) return;
      sh.getRange("I1").setValue(false);
    });
  }
}
