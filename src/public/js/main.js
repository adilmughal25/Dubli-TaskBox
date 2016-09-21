function getParameterByName(name, url) {
        if (!url) url = window.location.href;
        name = name.replace(/[\[\]]/g, "\\$&");
        var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
            results = regex.exec(url);
        if (!results) return null;
        if (!results[2]) return '';
        return decodeURIComponent(results[2].replace(/\+/g, " "));
    }
    $.getJSON('availableReports', function(data) {

        var script = document.createElement('script');
        var currentDate = getParameterByName('date');
        script.src = (currentDate) ? "./data-" + currentDate + '.js' : 'data.js';
        script.onload = function () {
            init(currentDate);
        };
        document.head.appendChild(script);
        var selectText = currentDate?currentDate:'Current';
        $('.dropdown-toggle').html(selectText+' <span class="caret"></span>');
        currentDate && $(".dropdown-menu").append('<li><a href="report.html">Current</a></li>');
        if(currentDate) {
          data.splice(data.indexOf('data-'+currentDate+'.js'), 1);
        }
        _.map(data, (date) => {
            var reportDate = date.match(/data-(.*)\.js/)[1];
            $(".dropdown-menu").append('<li><a href="report.html?date='+reportDate+'">'+ reportDate +'</a></li>');
        });
      });
    
$.getJSON('configs.json', function(data) {
    $("#title").text(data.env.toUpperCase());
});

function init(currentReportDate) {
      
      const groupByLastSatus = _.groupBy(data, 'lastStatus');
      const chartData = _.reduce(_.keys(groupByLastSatus), function(memo, item) {
        const memoItem = [];
        memoItem.push(item);
        memoItem.push(groupByLastSatus[item].length);

        memo.push(memoItem)
        return memo;
      }, [['Task', 'Number of']]);
      google.charts.load("current", {packages:["corechart"]});
      google.charts.setOnLoadCallback(drawChart);
      function drawChart() {
        const donutData = google.visualization.arrayToDataTable(chartData);
        const options = {
          title: 'Taskbox Status',
          pieHole: 0.4,
          slices: {}
        };
        const successIndex = Object.keys(groupByLastSatus).indexOf('success');
        const errorIndex = Object.keys(groupByLastSatus).indexOf('error');
        options.slices[successIndex] = {color : 'green'};
        options.slices[errorIndex] = {color : 'red'};
        
        var errorChartOptions = {
          title: 'Taskbox Errors',
          pieHole: 0.4
        };

        var chart = new google.visualization.PieChart(document.getElementById('donutchart'));
        chart.draw(donutData, options);

        google.visualization.events.addListener(chart, 'click', selectHandler);
        

        const groupByError = _.groupBy(groupByLastSatus.error, 'lastErrorTruc');
        const errorChartData = _.reduce(_.keys(groupByError), function(memo, item) {
          const memoItem = [];
          memoItem.push(item);
          memoItem.push(groupByError[item].length);

          memo.push(memoItem)
          return memo;
        }, [['Error Tasks', 'Number of Errors']]);

        var errorData = google.visualization.arrayToDataTable(errorChartData);
        var chart = new google.visualization.PieChart(document.getElementById('errorGroupChart'));
        chart.draw(errorData, errorChartOptions);
        const errorFields = [{ title: "ID", name: "id"}, { title: "Last Error", name: "lastErrorTruc"}];
        google.visualization.events.addListener(chart, 'click', (target) => {
          const selectError = parseInt(target.targetID.split('#')[1]) + 1;
          if(target.targetID.split('#')[1] != -1 && errorChartData[selectError])  {
            $("#gridTitle").html('Errored Tasks - <i>' + errorChartData[selectError][0]+'<i>');
                $("#jsGrid").jsGrid({
                sorting: true,
          //      paging: true,
                pageIndex: 1,
                pageSize: 5,
                data: groupByError[errorChartData[selectError][0]],
fields: [
              { title: "ID", name: "id", type: "text" },
              { title: "Last Status",  name: "lastStatus"},
              { title: "Last Ended",  name: "lastEnd"},
              { title: "Next Run",  name: "next"},
              { title: "Last Elapsed",  name: "lastElapsed"}
          ]            });
          }
        });

        function selectHandler(e) {
           
          const selectId = parseInt(e.targetID.split('#')[1]) + 1;
          const fields = [{ title: "ID", name: "id"}];
          if (selectId === 2) {
            fields.push({ title: "Last Error", name: "lastErrorTruc"});
            $("#gridTitle").text('Errored Tasks');
          } else {
            $("#gridTitle").text('Success Tasks');
          }

          $("#jsGrid").jsGrid({
              width: "100%",
              sorting: true,
             // paging: true,
              pageIndex: 1,
              pageSize: 5,
              data: groupByLastSatus[chartData[selectId][0]],
        fields: [
              { title: "ID", name: "id", type: "text" },
              { title: "Last Status",  name: "lastStatus"},
              { title: "Last Ended",  name: "lastEnd"},
              { title: "Next Run",  name: "next"},
              { title: "Last Elapsed",  name: "lastElapsed"}
          ]          });
          
        }

        $("#jsGrid").jsGrid({
          width: "100%",
          sorting: true,
          data: data,
          pageIndex: 1,
        //  paging: true,
        rowClass: function(item, itemIndex) { 
          return item.lastEnd.indexOf('days') > -1 ? "alert alert-danger" : "";
        },
          pageSize: 5,
          rowClick: (args) => {
            $('#myModalLabel').html('Run Details - <i>' + args.item.id + '</i>');
            args.item.lastError ? $('#modalLastError').html('<i>'+args.item.lastError+'<i>') : $('#modalLastError').html('');
            const lastResult = args.item.lastResult && JSON.parse(args.item.lastResult);
            if(args.item.lastResult) {
              $('#modalTimeSpentSaving').html(lastResult.timeSpentSaving);
              $('#modalTimeSpentCompressing').html(lastResult.timeSpentCompressing);
              $('#modalTotalSentToKinesis').html(lastResult.totalSentToKinesis);
              $('#modalCompressedCount').html(lastResult.compressedCount);
              $('#modalUnCompressedCount').html(lastResult.uncompressedCount);
              $('#modalErrorCount').html(lastResult.errorCount);
            }
            $('#myModal').modal('show');
          },
          fields: [
              { title: "ID", name: "id", type: "text" },
              { title: "Last Status",  name: "lastStatus"},
              { title: "Last Ended",  name: "lastEnd"},
              { title: "Next Run",  name: "next"},
              { title: "Last Elapsed",  name: "lastElapsed"}
          ]
        });
      }
}