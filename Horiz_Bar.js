'use strict';

// Wrap everything in an anonymous function to avoid polluting the global namespace
(function () {
  // Use the jQuery document ready signal to know when everything has been initialized
  $(document).ready(function () {
    // Tell Tableau we'd like to initialize our extension
    tableau.extensions.initializeAsync().then(function () {
      // Fetch the saved sheet name from settings. This will be undefined if there isn't one configured yet
      const savedSheetName = tableau.extensions.settings.get('sheet');
      if (savedSheetName) {
        // We have a saved sheet name, show its selected marks
        loadSelectedMarks(savedSheetName);
      } else {
        // If there isn't a sheet saved in settings, show the dialog
        showChooseSheetDialog();
      }

      //initializeButtons();
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
        // Get the worksheet name and save it to settings.
        const worksheetName = worksheet.name;
        tableau.extensions.settings.set('sheet', worksheetName);
        tableau.extensions.settings.saveAsync().then(function () {
          // Once the save has completed, close the dialog and show the data table for this worksheet
          $('#choose_sheet_dialog').modal('toggle');
          loadSelectedMarks(worksheetName);
        });
      });


      // Add our button to the list of worksheets to choose from
      $('#choose_sheet_buttons').append(button);
    });

    // Show the dialog
    $('#choose_sheet_dialog').modal('toggle');
  }
  
  // This variable will save off the function we can call to unregister listening to marks-selected events
  let unregisterEventHandlerFunction;