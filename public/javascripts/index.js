$(document).ready(function () {
    const table = $('#tableUsers').DataTable({
        pagging: true,
        processing: true,
        serverSide: true,
        responsive: true,
        ajax: {
            url: 'users',
            type: 'post',
            data: function (d) {
                d.draw = d.draw,
                    d.start = d.start || 0,
                    d.length = d.length || 10,
                    d.search.value = d.search.value || '',
                    d.search.regex = true

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
            { 'data': '_id', className: 'user-id', orderable: true },
            { 'data': 'name', orderable: true },
            { 'data': 'gender', orderable: true },
            { 'data': 'position', orderable: true },
            {
                data: null,
                className: "dt-center editor-view",
                defaultContent: '<i class="fa-solid fa-eye"></i>',
                orderable: false
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
        // order: [[1, 'asc']],
    })

    $('#tableUsers').on('click', 'td.editor-view', function (event) {
        let id = $(event.target).closest('tr').attr('id')

        $.ajax({
            url: '/users/user',
            type: 'post',
            data: { id: id },
            success: function (data) {
                $('.modal-detail-title').text(data.name)
                $('#detail-fullname').html('<b>Name: </b>' + data.name)
                $('#detail-gender').html('<b>Gender: </b>' + data.gender)
                $('#detail-position').html('<b>Position: </b>' + data.position)
                $('#detail-date_in').html('<b>Date in: </b>' + data.date_in)
                $('#detail-date_out').html('<b>Date out: </b>' + data.date_out)
                $('#detail-profile-img').attr('src', `data:image/png;base64,${data.profile_image}`)
                $('#modal-info').modal('show')
            },
            error: function () {
                console.log('err')
            }
        })
    })

    $('#tableUsers').on('click', 'td.editor-edit', function (event) {
        let id = $(event.target).closest('tr').attr('id')

        $.ajax({
            url: '/users/user',
            type: 'post',
            data: { id: id },
            success: function (data) {
                $('.modal-edit-title').text(data.name)
                $('#editUserId').val(data._id)
                $('#editName').val(data.name)
                $('#editGender').val(data.gender)
                $('#editPosition').val(data.position)
                $('#editDatein').val(data.date_in)
                $('#editDateout').val(data.date_out)
                $('#edit-profile-img').attr('src', `data:image/png;base64,${data.profile_image}`)
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
            'editUserId': $('#editUserId').val(),
            'editName': $('#editName').val(),
            'editGender': $('#editGender').val(),
            'editPosition': $('#editPosition').val(),
            'editDatein': $('#editDatein').val(),
            'editDateout': $('#editDateout').val(),
        }

        $.ajax({
            url: '/users/user',
            method: 'put',
            data: formData,
            success: function (data) {
                // console.log('UPDATED DATA: ', data)

                $(`tr#${formData.editUserId} td`).eq(1).text(data._id)
                $(`tr#${formData.editUserId} td`).eq(2).text(data.name)
                $(`tr#${formData.editUserId} td`).eq(3).text(data.gender)
                $(`tr#${formData.editUserId} td`).eq(4).text(data.position)
            },
            error: function (err) {
                console.error('ERROR: ', err)
            }
        })
    })
})