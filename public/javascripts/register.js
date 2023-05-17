
$(document).ready(function () {
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    var image_idx = 0
    var userId = $('#userId').val()

    navigator.mediaDevices.getUserMedia({ video: true })
        .then((stream) => {
            video.srcObject = stream;
        })
        .catch((error) => {
            console.error('Error accessing webcam:', error);
        });

    $('#captureBtn').on('click', () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataURL = canvas.toDataURL('image/jpeg');

        fetch('register/saveImage', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ image: dataURL, image_name: `${userId}_${image_idx}.jpeg` }),
        })
            .then((response) => response.json())
            .then((data) => {
                image_idx += 1
                $('#captureBtn').html(`Capture image (${image_idx})`)

                if (image_idx === 10) {
                    $('#captureBtn').prop('disabled', true)
                    $('#btnRegister').prop('disabled', false)
                }

                console.log('Image saved:', data.filename);
            })
            .catch((error) => {
                console.error('Error saving image:', error);
            });
    });

    $('#registerUser').on('submit', (e) => {
        e.preventDefault()

        $.ajax({
            url: '/register',
            method: 'post',
            data: {
                'userId': $('#userId').val(),
                'name': $('#name').val(),
                'gender': $('#gender').val(),
                'position': $('#position').val(),
                'password': $('#password').val(),
                'admin': $('#admin').is(':checked')
            },
            success: function (data) {
                console.log('success')
            },
            error: function (error) {
                console.log('error')
            }
        })

        location.href = '/login'
    })
})
