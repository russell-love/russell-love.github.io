'use strict';

// Wrap everything in an anonymous function to avoid polluting the global namespace
(function() {
    // Use the jQuery document ready signal to know when everything has been initialized
    $(document).ready(function() {
        // Tell Tableau we'd like to initialize our extension
        tableau.extensions.initializeAsync().then(function() {
            // Once the extension is initialized, ask the user to choose a sheet
            showChooseSheetDialog();

            initializeButtons();
        });
    });

    /**
     * Shows the choose sheet UI. Once a sheet is selected, the data table for the sheet is shown
     */
    function showChooseSheetDialog() {
        // Clear out the existing list of sheets
        $('#choose_sheet_buttons').empty();

        // Set the dashboard's name in the title
        const dashboardName = tableau.extensions.dashboardContent.dashboard.name;
        $('#choose_sheet_title').text(dashboardName);

        // The first step in choosing a sheet will be asking Tableau what sheets are available
        const worksheets = tableau.extensions.dashboardContent.dashboard.worksheets;

        // Next, we loop through all of these worksheets add add buttons for each one
        worksheets.forEach(function(worksheet) {
            // Declare our new button which contains the sheet name
            const button = createButton(worksheet.name);

            // Create an event handler for when this button is clicked
            button.click(function() {
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

    function createButton(buttonTitle) {
        const button =
            $(`<button type='button' class='btn btn-default btn-block'>
      ${buttonTitle}
    </button>`);

        return button;
    }

    function loadSelectedMarks(worksheetName) {
        //Setup variables
        var viz, sheet, options;

        //Set the desired sheet to the selected sheet
        sheet = getSelectedSheet(worksheetName);

        //Set options for the getUnderlyingData call
        options = {
            maxRows: 0, // Max rows to return. Use 0 to return all rows
            ignoreAliases: false,
            ignoreSelection: true,
            includeAllColumns: false
        };

        //getUnderlyingData call
        sheet.getUnderlyingDataAsync(options).then(function(t){
           cleanData(t); //Call the cleanData function (maps and converts)
        });      
    }

    function cleanData(t) {
        console.log(t);

        //Set variables to pass to conversion function
        var data = t.data; //Data
        var dataCols = t.columns; //Column names
        
        console.log(dataCols);
        console.log(data);
        
        var niceData = reduceToObjects(dataCols, data); //conversion call

        console.log(niceData);
    }

    //convert to field:values convention
    function reduceToObjects(cols,data) {
        //Map column names from column data
        var fieldNameMap = $.map(cols, function(col) { return col.fieldName; });

        //Map the column names to the data
        var dataToReturn = $.map(data, function(d) {
            return d.reduce(function(memo, value, idx) {
            memo[fieldNameMap[idx]] = value.formattedValue; return memo;
            }, {});
        });

        return dataToReturn;
      
    }
    
    function initializeButtons() {
        $('#show_choose_sheet_button').click(showChooseSheetDialog);
    }

    function getSelectedSheet(worksheetName) {
        // Go through all the worksheets in the dashboard and find the one we want
        return tableau.extensions.dashboardContent.dashboard.worksheets.find(function(sheet) {
            return sheet.name === worksheetName;
        });
    }
})();