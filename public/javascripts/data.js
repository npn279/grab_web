$(document).ready(function () {
    const table = $('#tableData').DataTable({
        pagging: true,
        processing: true,
        serverSide: true,
        responsive: true,
        ajax: {
            url: 'data',
            type: 'post',
            data: function (d) {
                d.draw = d.draw,
                    d.start = d.start || 0,
                    d.length = d.length || 10,
                    d.search.value = d.search.value || '',
                    d.search.regex = true
                d.startDate = $('#startDate').val()
                d.endDate = $('#endDate').val()

                // console.log(d)
            }
        },
        columns: [
            {
                title: '#',
                data: null,
                defaultContent: '',
                orderable: false,
                searchable: false,
                className: 'dt-body-center',
                render: function (data, type, row, meta) {
                    return meta.row + 1;
                }
            },
            { 'data': 'userId', className: 'user-id', orderable: true },
            { 'data': 'name', orderable: true },
            {
                'data': null,
                orderable: false,
                render: function (data, type, row) {
                    let day = ('0' + data.day).slice(-2)
                    let month = ('0' + data.month).slice(-2)
                    return day + '/' + month + '/' + data.year
                }
            },
            { 'data': 'time_in', orderable: false },
            { 'data': 'time_out', orderable: false },
            {
                data: null,
                orderable: false,
                render: function (data, type, row) {
                    var timeIn = data.time_in.split(':')
                    var timeOut = data.time_out.split(':')

                    let t1 = new Date();
                    t1.setHours(parseInt(timeIn[0], 10));
                    t1.setMinutes(parseInt(timeIn[1], 10));
                    t1.setSeconds(parseInt(timeIn[2], 10));

                    let t2 = new Date();
                    t2.setHours(parseInt(timeOut[0], 10));
                    t2.setMinutes(parseInt(timeOut[1], 10));
                    t2.setSeconds(parseInt(timeOut[2], 10));

                    let difference = Math.abs(t2 - t1)

                    const hours = Math.floor(difference / 3600000);
                    const minutes = Math.floor((difference % 3600000) / 60000);

                    return `${hours}h${minutes}m`
                }
            },
            {
                data: null,
                className: "dt-center editor-edit",
                defaultContent: '<i class="fa-solid fa-pen-to-square"></i>',
                orderable: false
            },
        ],
        rowId: '_id',
        search: {
            smart: false, // disable smart search
            caseInsensitive: true, // enable case-insensitive search
            regex: true // enable regular expression search
        },
        columnDefs: [
            {
                targets: [-1, -2], // Target the last column
                createdCell: function (cell, cellData, rowData, rowIndex, colIndex) {
                    $(cell).attr('id', rowData._id);
                }
            },
        ],
    })

    $('#startDate').on('change', () => {
        $('#tableData').DataTable().draw();
    })

    $('#endDate').on('change', () => {
        $('#tableData').DataTable().draw();
    })

    $('#btnSaveCSV').on('click', () => {
        $.ajax({
            url: 'data/saveAllCSV',
            type: 'post',
            data: {
                startDate: $('#startDate').val(),
                endDate: $('#endDate').val(),
                search: table.search()
            },
            success: function (data) {
                $("#notice").html(data)
                $("#notice").show()

                setTimeout(function () {
                    $("#notice").hide()
                }, 2000);
            },
            error: function () {
                $("#notice").html('Cannot save file!')
                $("#notice").show()

                setTimeout(function () {
                    $("#notice").hide()
                }, 2000);
            }
        })
    })

    $('#btnSaveCSVById').on('click', () => {
        $.ajax({
            url: '/data/saveCSVById',
            type: 'post',
            data: {
                startDate: $('#startDate').val(),
                endDate: $('#endDate').val(),
                search: table.search()
            },
            success: function (d) {
                $("#notice").html(d)
                $("#notice").show()

                setTimeout(function () {
                    $("#notice").hide()
                }, 2000);
            },
            error: function (err) {
                $("#notice").html('Cannot save files!')
                $("#notice").show()

                setTimeout(function () {
                    $("#notice").hide()
                }, 2000);
            }
        })
    })

    $('#btnSavePDFById').on('click', () => {
        $.ajax({
            url: 'data/savePDFById',
            type: 'post',
            data: {
                startDate: $('#startDate').val(),
                endDate: $('#endDate').val(),
                search: table.search()
            },
            success: function (data) {
                $("#notice").html(data)
                $("#notice").show()

                setTimeout(function () {
                    $("#notice").hide()
                }, 2000);
            },
            error: function () {
                $("#notice").html('Cannot save files!')
                $("#notice").show()

                setTimeout(function () {
                    $("#notice").hide()
                }, 2000);
            }
        })
    })

    $('#tableData').on('click', 'td.editor-edit', (event) => {
        let id = $(event.target).closest('tr').attr('id')

        $.ajax({
            url: '/data/row',
            type: 'post',
            data: { id: id },
            success: function (data) {
                $('.modal-edit-title').text(data.name)
                $('#hiddenId').val(data._id)
                $('#editId').val(data.userId)
                $('#editName').val(data.name)
                $('#editDate').val(data.date)
                $('#editTimeIn').val(data.time_in)
                $('#editTimeOut').val(data.time_out)
                $('#modal-edit').modal('show')
            },
            error: function () {
                console.log('err')
            }
        })
    })

    $('#modal-edit').on('submit', (e) => {
        e.preventDefault()

        let formData = {
            hiddenId: $('#hiddenId').val(),
            editId: $('#editId').val(),
            editName: $('#editName').val(),
            editDate: $('#editDate').val(),
            editTimeIn: $('#editTimeIn').val(),
            editTimeOut: $('#editTimeOut').val()
        }

        $.ajax({
            url: '/data/row',
            type: 'put',
            data: formData,
            success: function (data) {
                // console.log(data);
                let day = ('0' + data.day).slice(-2)
                let month = ('0' + data.month).slice(-2)
                $(`tr#${formData.hiddenId} td`).eq(3).text(day + '/' + month + '/' + data.year)
                $(`tr#${formData.hiddenId} td`).eq(4).text(data.time_in)
                $(`tr#${formData.hiddenId} td`).eq(5).text(data.time_out)

                var timeIn = data.time_in.split(':')
                var timeOut = data.time_out.split(':')

                let t1 = new Date();
                t1.setHours(parseInt(timeIn[0], 10));
                t1.setMinutes(parseInt(timeIn[1], 10));

                let t2 = new Date();
                t2.setHours(parseInt(timeOut[0], 10));
                t2.setMinutes(parseInt(timeOut[1], 10));

                let difference = Math.abs(t2 - t1)

                const hours = Math.floor(difference / 3600000);
                const minutes = Math.floor((difference % 3600000) / 60000);

                $(`tr#${formData.hiddenId} td`).eq(6).text(`${hours}h${minutes}m`)
            },
            error: function (error) {
                console.log('ERROR')
            }
        })
    })
})