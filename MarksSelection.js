'use strict';

// Wrap everything in an anonymous function to avoid polluting the global namespace
(function () {
  // Use the jQuery document ready signal to know when everything has been initialized
  $(document).ready(function () {
    // Tell Tableau we'd like to initialize our extension
    tableau.extensions.initializeAsync().then(function () {
      // Once the extension is initialized, ask the user to choose a sheet
      showChooseSheetDialog();
    });
  });

  /**
   * Shows the choose sheet UI. Once a sheet is selected, the data table for the sheet is shown
   */
  function showChooseSheetDialog () {
    // Clear out the existing list of sheets
    $('#choose_sheet_buttons').empty();

    // Set the dashboard's name in the title
    const dashboardName = tableau.extensions.dashboardContent.dashboard.name;
    $('#choose_sheet_title').text(dashboardName);

    // The first step in choosing a sheet will be asking Tableau what sheets are available
    const worksheets = tableau.extensions.dashboardContent.dashboard.worksheets;

    // Next, we loop through all of these worksheets add add buttons for each one
    worksheets.forEach(function (worksheet) {
      // Declare our new button which contains the sheet name
      const button = $("<button type='button' class='btn btn-default btn-block'></button>");
      button.text(worksheet.name);

      // Create an event handler for when this button is clicked
      button.click(function () {
        // Get the worksheet name which was selected
        const worksheetName = worksheet.name;

        // Close the dialog and show the data table for this worksheet
        $('#choose_sheet_dialog').modal('toggle');
        loadSelectedMarks(worksheetName);
      });

      // Add our button to the list of worksheets to choose from
      $('#choose_sheet_buttons').append(button);
    });

    // Show the dialog
    $('#choose_sheet_dialog').modal('toggle');
  }
  
  // This variable will save off the function we can call to unregister listening to marks-selected events
  let unregisterEventHandlerFunction;

  function loadSelectedMarks (worksheetName) {
    // Remove any existing event listeners
    if (unregisterEventHandlerFunction) {
      unregisterEventHandlerFunction();
    }

    const worksheets = tableau.extensions.dashboardContent.dashboard.worksheets;

    var worksheet = worksheets.find(function (sheet) {
      return sheet.name === "Sheet 1";
    });

    // Set our title to an appropriate value
    $('#selected_marks_title').text(worksheet.name);

    // Call to get the selected marks for our sheet
    worksheet.getSelectedMarksAsync().then(function (marks) {
      // Get the first DataTable for our selected marks (usually there is just one)
      const worksheetData = marks.data[0];

      // Map our data into the format which the data table component expects it
      const data = worksheetData.data.map(function (row, index) {
        const rowData = row.map(function (cell) {
          return cell.formattedValue;
        });

        return rowData;
      });

      const columns = worksheetData.columns.map(function (column) {
        return { title: column.fieldName };
      });

      // Populate the data table with the rows and columns we just pulled out
      //populateDataTable(data, columns);

      loopData(data, columns);
      //alert(`Outputting to console: ${worksheetName}`);
    });

    // Add an event listener for the selection changed event on this sheet.
    unregisterEventHandlerFunction = worksheet.addEventListener(tableau.TableauEventType.MarkSelectionChanged, function (selectionEvent) {
      // When the selection changes, reload the data
      loadSelectedMarks(worksheetName);
    });
  }


  function populateDataTable (data, columns) {
    // Do some UI setup here to change the visible section and reinitialize the table
    $('#data_table_wrapper').empty();

    if (data.length > 0) {
      $('#no_data_message').css('display', 'none');
      $('#data_table_wrapper').append(`<table id='data_table' class='table table-striped table-bordered'></table>`);

      // Do some math to compute the height we want the data table to be
      var top = $('#data_table_wrapper')[0].getBoundingClientRect().top;
      var height = $(document).height() - top - 130;

      // Initialize our data table with what we just gathered
      $('#data_table').DataTable({
        data: data,
        columns: columns,
        autoWidth: false,
        deferRender: true,
        scroller: true,
        scrollY: height,
        scrollX: true,
        dom: "<'row'<'col-sm-6'i><'col-sm-6'f>><'row'<'col-sm-12'tr>>" // Do some custom styling
      });
    } else {
      // If we didn't get any rows back, there must be no marks selected
      $('#no_data_message').css('display', 'inline');
    }
  }

  function loopData2 (data, columns) {
    //console.log(columns);
    //console.log(data);

    $('#data_table_wrapper').empty();
    $('#no_data_message').css('display', 'none');
    $('#data_table_wrapper').append(`<svg class="chart"></svg>`);

    var barValues = getCol(data,2);
    console.log(d3.max(barValues));

    var width = 420,
        barHeight = 20;

    var x = d3.scaleLinear()
        .domain([0, d3.max(barValues)+(d3.max(barValues)*0.2)])
        .range([0, width]);

    // Add scales to axis
    var x_axis = d3.axisBottom().scale(x);

    var chart = d3.select(".chart")
        .attr("width", width)
        .attr("height", barHeight * barValues.length);
    
    var tooltip = d3.select("body").append("div").attr("class", "toolTip");

    //Insert axis
    //chart.append("g").call(x_axis);

    var bar = chart.selectAll("g")
        .data(barValues)
        .enter().append("g")
        .attr("transform", function(d, i) { return "translate(0," + i * barHeight + ")"; });

    bar.append("rect")
        .attr("width", x)
        .attr("height", barHeight - 1)
        .on("mousemove", function(d){
            tooltip
              .style("left", d3.event.pageX - 50 + "px")
              .style("top", d3.event.pageY - 70 + "px")
              .style("display", "inline-block")
              .html(d);
        })
        .on("mouseout", function(d){ tooltip.style("display", "none");});
    
    bar.append("text")
        .attr("x", function(d) { return x(d) + 3; })
        .attr("y", barHeight / 2)
        .attr("dy", ".35em")
        .text(function(d) { return d;});

  }

  function loopData (data, columns) {
    //console.log(columns);
    //console.log(data);

    $('#data_table_wrapper').empty();
    $('#no_data_message').css('display', 'none');
    $('#data_table_wrapper').append(`<svg class="chart"></svg>`);

    var barValues = getCol(data,2);

    var barValues2 = joinDataCols(columns, data);
    mapData(data);
    
    console.log(barValues2);

    var width = 420,
        barHeight = 20;

    var x = d3.scaleLinear()
        .domain([0, d3.max(barValues)+(d3.max(barValues)*0.2)])
        .range([0, width]);

    // Add scales to axis
    var x_axis = d3.axisBottom().scale(x);

    var chart = d3.select(".chart")
        .attr("width", width)
        .attr("height", barHeight * barValues.length);
    
    var tooltip = d3.select("body").append("div").attr("class", "toolTip");

    //Insert axis
    //chart.append("g").call(x_axis);

    var bar = chart.selectAll("g")
        .data(barValues)
        .enter().append("g")
        .attr("transform", function(d, i) { return "translate(0," + i * barHeight + ")"; });

    bar.append("rect")
        .attr("width", x)
        .attr("height", barHeight - 1)
        .on("mousemove", function(d){
            tooltip
              .style("left", d3.event.pageX - 50 + "px")
              .style("top", d3.event.pageY - 70 + "px")
              .style("display", "inline-block")
              .html(d);
        })
        .on("mouseout", function(d){ tooltip.style("display", "none");});
    
    bar.append("text")
        .attr("x", function(d) { return x(d) + 3; })
        .attr("y", barHeight / 2)
        .attr("dy", ".35em")
        .text(function(d) { return d;});

  }
    
  function getCol(matrix, col){
       var column = [];
       for(var i=0; i<matrix.length; i++){
          column.push(parseInt(matrix[i][col]));
       }

      column.sort(d3.descending);
      return column;
    }

  function joinDataCols(cols,data) {
    var fieldNameMap = $.map(cols, function(col) { return col.title; });
    
    var dataToReturn = $.map(data, function(d) {
      return d.reduce(function(memo, value, idx) {
        memo[fieldNameMap[idx]] = value; return memo;
      }, {});
    });
    return dataToReturn;
  }

  function mapData(data) {
    var mappedData = data.map(function(d) {
      return { 
        country: d[0], 
        state: d[1],
        recordcount: d[2],
        lat: d[3],
        long: d[4]
      }
    })
    console.log(mappedData);

    return dataToReturn;
  }

})();