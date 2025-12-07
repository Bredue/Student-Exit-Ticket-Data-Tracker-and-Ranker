function buildEverything() {
  const ss = SpreadsheetApp.getActive();
  const sheets = ss.getSheets();

  let results = {}; // teacher -> data

  // ------------------------------------------------------
  // READ ALL TEACHER SHEETS
  // ------------------------------------------------------
  sheets.forEach(sh => {
    const name = sh.getName();
    if (["reports","insights","groups","ranks","setup"].includes(name.toLowerCase())) return;

    const data = sh.getDataRange().getValues();
    if (data.length < 3) return;

    // ---- EXIT TICKETS (row 2, col D → until blank) ----
    let exitTickets = [];
    let col = 3; // column D index
    let blanks = 0;
    while (blanks < 2) {
      const val = data[1][col];
      if (!val) blanks++;
      else {
        exitTickets.push({name: val.toString(), colIndex: col});
        blanks = 0;
      }
      col++;
      if (col > 50) break;
    }
    exitTickets.reverse();

    // ---- STUDENTS (row 3 ↓) ----
    let students = [];
    let periodMap = {};
    for (let r = 2; r < data.length; r++) {
      const first = data[r][0];
      const last = data[r][1];
      const period = data[r][2];
      if (!first && !last) continue;

      let entry = {
        fullName: `${first} ${last}`,
        period: period,
        results: {}
      };

      exitTickets.forEach(t => {
        entry.results[t.name] = data[r][t.colIndex] === true ? 1 : 0;
      });

      const vals = exitTickets.map(t => entry.results[t.name]);
      const totalTaken = vals.length;
      const correct = vals.reduce((a,b)=>a+b,0);
      entry.pct = totalTaken > 0 ? Math.round((correct / totalTaken) * 100) : 0; // <-- correct percent
      entry.correctCount = `${correct}/${totalTaken}`;
      entry.lastTen = vals.slice(-10);

      students.push(entry);

      if (!periodMap[period]) periodMap[period] = [];
      periodMap[period].push({name: entry.fullName, pct: entry.pct});
    }

    results[name] = {
      teacher: name,
      exitTickets: exitTickets.map(e => e.name),
      students,
      periodMap,
      sortedPeriods: Object.keys(periodMap).sort((a,b)=>a-b)
    };
  });

  // ------------------------------------------------------
  // BUILD "REPORTS" SHEET
  // ------------------------------------------------------
  let reports = ss.getSheetByName("Reports") || ss.insertSheet("Reports");
  reports.clear();
  reports.clearFormats();

  let startCol = 1;
  for (const teacher in results) {
    const block = results[teacher];
    let repRow = 1;

    reports.getRange(repRow, startCol, 1, 3).merge().setValue(teacher).setFontWeight("bold").setBackground("#ffffcc");
    reports.setFrozenRows(1);
    repRow++;

    block.exitTickets.forEach(ticket => {
      const passed = [];
      const failed = [];
      const passedColors = [];
      const failedColors = [];

      block.students.forEach(s => {
        if (s.results[ticket]) {
          passed.push(s.fullName);
          passedColors.push(["#d9ead3"]);
        } else {
          failed.push(s.fullName);
          failedColors.push(["#f4cccc"]);
        }
      });

      const maxRows = Math.max(passed.length, failed.length);
      let values = Array.from({length:maxRows}, (_, i) => [
        '', 
        passed[i] || '', 
        failed[i] || ''
      ]);

      let bgColors = Array.from({length:maxRows}, (_, i) => [
        '', 
        passedColors[i] ? passedColors[i][0] : '',
        failedColors[i] ? failedColors[i][0] : ''
      ]);

      // Add header row with counts
      values.unshift([ticket, `Students Passed - ${passed.length}`, `Students Failed - ${failed.length}`]);
      bgColors.unshift(["#ffffcc","#d3d3d3","#d3d3d3"]);

      reports.getRange(repRow, startCol, values.length, 3).setValues(values);
      reports.getRange(repRow, startCol, values.length, 3).setBackgrounds(bgColors);
      reports.getRange(repRow, startCol, 1, 3).setFontWeight("bold");

      repRow += values.length + 1;
    });

    startCol += 4;
  }
  reports.autoResizeColumns(1, startCol - 1);

  // ------------------------------------------------------
  // BUILD "GROUPS" SHEET
  // ------------------------------------------------------
  let groups = ss.getSheetByName("Groups") || ss.insertSheet("Groups");
  groups.clear();
  groups.clearFormats();

  let startColGrp = 1;
  for (const teacher in results) {
    const block = results[teacher];
    let grpRow = 1;

    groups.getRange(grpRow, startColGrp, 1, 3).merge().setValue(teacher).setFontWeight("bold");
    groups.setFrozenRows(2);
    grpRow++;

    groups.getRange(grpRow, startColGrp, 1, 3).setValues([["Period","Group 1","Group 2"]]).setFontWeight("bold").setBackground("#ffffcc");
    grpRow++;

    block.sortedPeriods.forEach(period => {
      const students = block.periodMap[period].slice().sort((a,b)=>b.pct-a.pct);
      const mid = Math.ceil(students.length / 2);
      const topHalf = students.slice(0, mid).map(s => ({name:s.name,pct:s.pct}));
      const bottomHalf = students.slice(mid).map(s => ({name:s.name,pct:s.pct}));

      const maxRows = Math.max(topHalf.length, bottomHalf.length);
      let values = Array.from({length:maxRows}, (_, i) => [
        period,
        topHalf[i] ? topHalf[i].name : '',
        bottomHalf[i] ? bottomHalf[i].name : ''
      ]);

      let colors = Array.from({length:maxRows}, (_, i) => [
        '',
        topHalf[i] ? getPastelColor(topHalf[i].pct) : '',
        bottomHalf[i] ? getPastelColor(bottomHalf[i].pct) : ''
      ]);

      groups.getRange(grpRow, startColGrp, maxRows, 3).setValues(values);
      groups.getRange(grpRow, startColGrp, maxRows, 3).setBackgrounds(colors);

      grpRow += maxRows;
      grpRow++; // blank row after each period
    });

    startColGrp += 4;
  }
  groups.autoResizeColumns(1,startColGrp-1);

  // ------------------------------------------------------
  // BUILD "RANKS" SHEET
  // ------------------------------------------------------
  let ranks = ss.getSheetByName("Ranks") || ss.insertSheet("Ranks");
  ranks.clear();
  ranks.clearFormats();
  ranks.setFrozenRows(1);

  let colOffset = 1;

  for (const teacher in results) {
    const block = results[teacher];
    ranks.getRange(1,colOffset,1,3).merge().setValue(`${teacher} - Period Rankings`).setFontWeight("bold").setBackground("#ffffcc");
    let row = 2;
    if(block.sortedPeriods.length === 0) {
      ranks.getRange(row,colOffset,1,3).setValues([["No data","",""]]);
      row++;
    } else {
      block.sortedPeriods.forEach(period => {
        const students = block.periodMap[period].slice().sort((a,b)=>b.pct-a.pct);
        ranks.getRange(row,colOffset,1,3).setValues([[`Period ${period}`,"",""]]).setFontWeight("bold").setBackground("#ffffcc");
        row++;
        const values = students.map((s,i)=>[i+1,s.name,s.pct+"%"]);
        const nameColors = students.map(s => ['', getPastelColor(s.pct), '']);
        ranks.getRange(row,colOffset,values.length,3).setValues(values);
        ranks.getRange(row,colOffset,values.length,3).setBackgrounds(nameColors);
        row += values.length + 1;
      });
    }
    colOffset += 4;
  }

  for (const teacher in results) {
    const block = results[teacher];
    const students = block.students.slice().sort((a,b)=>b.pct-a.pct);
    ranks.getRange(1,colOffset,1,3).merge().setValue(`${teacher} - All Student Rankings`).setFontWeight("bold").setBackground("#ffffcc");
    if(students.length === 0) ranks.getRange(2,colOffset,1,3).setValues([["No data","",""]]);
    else {
      const values = students.map((s,i)=>[i+1,s.fullName,s.pct+"%"]);
      const nameColors = students.map(s=>['', getPastelColor(s.pct), '']);
      ranks.getRange(2,colOffset,values.length,3).setValues(values).setBackgrounds(nameColors);
    }
    colOffset += 4;
  }

  const allStudents = [];
  for(const teacher in results) results[teacher].students.forEach(s=>allStudents.push({name:s.fullName,pct:s.pct}));
  ranks.getRange(1,colOffset,1,3).merge().setValue("School - Rankings").setFontWeight("bold").setBackground("#ffffcc");
  if(allStudents.length === 0) ranks.getRange(2,colOffset,1,3).setValues([["No data","",""]]);
  else {
    allStudents.sort((a,b)=>b.pct-a.pct);
    const values = allStudents.map((s,i)=>[i+1,s.name,s.pct+"%"]);
    const nameColors = allStudents.map(s=>['', getPastelColor(s.pct), '']);
    ranks.getRange(2,colOffset,values.length,3).setValues(values).setBackgrounds(nameColors);
  }
  ranks.autoResizeColumns(1,colOffset+2);

  // ------------------------------------------------------
  // BUILD "INSIGHTS" SHEET
  // ------------------------------------------------------
  const insightsSheet = ss.getSheetByName("Insights") || ss.insertSheet("Insights");
  insightsSheet.clear();
  insightsSheet.clearFormats();

  let colStart = 1;

  Object.keys(results).forEach(teacherName => {
    const block = results[teacherName];
    let row = 1;

    insightsSheet.getRange(row, colStart).setValue(teacherName + " — Student Insights").setFontWeight("bold").setFontSize(12);
    row += 2;

    const consistentHigh = [];
    const consistentLow = [];
    const growing = [];
    const decreasing = [];

    block.students.forEach(s => {
      const pct = s.pct; // same as ranks
      const last = s.lastTen.slice(-5).filter(n => !isNaN(n)); // last 5
      if(last.length === 0){
        if(pct>=50) consistentHigh.push(s);
        else consistentLow.push(s);
        return;
      }

      if(last.length === 1) {
        if(last[0] >= 50) consistentHigh.push(s);
        else consistentLow.push(s);
      } else {
        const first = last[0];
        const lastVal = last[last.length-1];
        if(first > lastVal) growing.push(s);
        else if(first < lastVal) decreasing.push(s);
        else if(pct >= 50) consistentHigh.push(s);
        else consistentLow.push(s);
      }
    });

    function writeCategory(title, arr){
      insightsSheet.getRange(row,colStart).setValue(title).setFontWeight("bold");
      row++;
      insightsSheet.getRange(row,colStart,1,3).setValues([["Student","% Correct","# Correct"]]).setFontWeight("bold");
      row++;
      arr.forEach(s=>{
        insightsSheet.getRange(row,colStart,1,3).setValues([[s.fullName,s.pct+"%",s.correctCount]]);
        const color = getPastelColor(s.pct);
        insightsSheet.getRange(row,colStart,1,3).setBackground(color);
        row++;
      });
      row++;
    }

    writeCategory("Consistent High (≥ 50%)", consistentHigh);
    writeCategory("Consistent Low (< 50%)", consistentLow);
    writeCategory("Growing (Recent)", growing);
    writeCategory("Decreasing (Recent)", decreasing);

    colStart += 5; // blank column between teachers
  });

  insightsSheet.autoResizeColumns(1, colStart+1);

  // ------------------------------------------------------
  // HELPER: PASTEL COLORS
  // ------------------------------------------------------
  function getPastelColor(pct){
    if(pct>=85) return "#a4c2f4";
    if(pct>=60) return "#b6d7a8";
    if(pct>=30) return "#fff2b2";
    return "#f4cccc";
  }

  SpreadsheetApp.getUi().alert("Reports + Groups + Ranks + Insights generated successfully.");
}
