var express = require('express');
var router = express.Router();
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const PDFDocument = require('pdfkit-table');
const { google } = require('googleapis');
const { ObjectId } = require('mongodb');
require('dotenv').config()
const fs = require('fs');

const keyFile = process.env.SERVICE_ACCOUNT;
var columns = ['_id', 'name']

const auth = new google.auth.GoogleAuth({
    keyFile,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
});

// Create a new instance of the Drive API
const drive = google.drive({ version: 'v3', auth });

router.get('/', (req, res) => {
    if (req.session.user) {
        let user = req.session.user

        // GENERATE GREETING
        let greeting = undefined
        let hour = getHour()

        if (hour < 12) {
            greeting = `Good morning, ${user.name}!`
        } else if (hour < 18) {
            greeting = `Good afternoon, ${user.name}!`
        } else {
            greeting = `Good evening, ${user.name}!`
        }

        return res.render('data', { greeting, 'title': 'Welcome ' + user.name })
    }
    else {
        res.redirect('/login')
    }
})

router.post('/', async (req, res) => {
    const db = req.app.locals.db
    const DATA = await db.collection('LOGIN_DATA')
    // console.log(req.body)

    let start = parseInt(req.body.start)
    let length = parseInt(req.body.length)
    let draw = parseInt(req.body.draw)
    let search = req.body['search[value]']
    let isRegex = req.body['search[regex]'] === 'true'
    let startDate = req.body.startDate
    let endDate = req.body.endDate
    let order_col = parseInt(req.body['order[0][column]'])
    let order_dir = req.body['order[0][dir]']

    let order_direction = 1

    if (order_dir == 'desc') {
        order_direction = -1
    }

    let sortOptions = JSON.parse(`{"${columns[order_col - 1]}" : ${order_direction}}`)

    let query = generateQuery(startDate, endDate, search, isRegex)

    let data = await DATA.find(query).skip(start).limit(length).sort(sortOptions).toArray()
    let recordsTotal = await DATA.countDocuments()
    let recordsFiltered = await DATA.countDocuments(query)

    res.json({
        draw: draw,
        recordsTotal: recordsTotal,
        recordsFiltered: recordsFiltered,
        data: data,
    })
})

router.post('/row', async (req, res) => {
    const db = req.app.locals.db
    const DATA = await db.collection('LOGIN_DATA')

    let id = req.body.id

    let data = await DATA.findOne({ '_id': new ObjectId(id) })

    if (data) {
        let dateObj = new Date(data.year, data.month - 1, data.day)
        let month = ('0' + (dateObj.getMonth() + 1)).slice(-2)
        let day = ('0' + dateObj.getDate()).slice(-2)
        data.date = dateObj.getFullYear() + '-' + month + '-' + day
        return res.json(data)
    } else {
        console.log('ERROR')
    }
})

router.put('/row', async (req, res) => {
    const db = req.app.locals.db
    const DATA = await db.collection('LOGIN_DATA')

    let { hiddenId, editId, editName, editDate, editTimeIn, editTimeOut } = req.body

    let dateObj = new Date(editDate)
    let day = dateObj.getDate()
    let month = dateObj.getMonth() + 1
    let year = dateObj.getFullYear()

    let newData = { '_id': new ObjectId(hiddenId), 'userId': editId, 'name': editName, 'day': day, 'month': month, 'year': year, 'time_in': editTimeIn, 'time_out': editTimeOut }

    let result = await DATA.findOneAndUpdate(
        { '_id': new ObjectId(hiddenId) },
        { $set: newData })
    if (result.ok === 1) {
        let updatedData = await DATA.findOne({ '_id': new ObjectId(hiddenId) })
        return res.json(updatedData)
    } else {
        return console.log('ERROR')
    }
})

router.post('/saveAllCSV', async (req, res) => {
    let { startDate, endDate, search } = req.body

    if (!isWithinAMonth(startDate, endDate)) {
        return res.send('Start date and end date are required to be within a month!')
    }

    const db = req.app.locals.db
    const DATA = await db.collection('LOGIN_DATA')

    let query = generateQuery(startDate, endDate, search, true)

    let data = await DATA.find(query).toArray()

    if (data.length === 0) {
        return res.send("No data to export")
    }

    // Tạo thư mục output nếu chưa tồn tại
    if (!fs.existsSync('output_csv')) {
        fs.mkdirSync('output_csv');
    }

    // Tạo thư mục output nếu chưa tồn tại
    if (!fs.existsSync('output_pdf')) {
        fs.mkdirSync('output_pdf');
    }

    data.forEach(d => {
        d.date = d.day + "/" + d.month + "/" + d.year
        d.working_time = getWorkingTime(d.time_in, d.time_out)
    })

    let month = ('0' + data[0].date.split('/')[1]).slice(-2)
    let year = data[0].date.split('/')[2]
    let folderName = `${month}-${year}`
    let folderID = await checkFolderExists(drive, process.env.REPORT_FOLDER_ID, folderName)

    console.log("FOLDER ID", folderID);

    // CHECK IF FOLDER EXISTS
    if (!folderID) {
        folderID = await createFolder(drive, process.env.REPORT_FOLDER_ID, folderName)
        console.log("FOLDER ID", folderID);
    } else {
        console.log('CANNOT CREATE FOLDER')
    }


    const csvWriter = createCsvWriter({
        path: `output_csv/data.csv`,
        header: [
            { id: 'userId', title: 'ID' },
            { id: 'name', title: 'Hour' },
            { id: 'date', title: 'Date' },
            { id: 'time_in', title: 'Time in' },
            { id: 'time_out', title: 'Time out' },
            { id: 'working_time', title: 'Working time' },
        ]
    });

    csvWriter.writeRecords(data)
        .then(async () => {
            // console.log(`Saved data.csv successfully!`);

            const fileMetadata = {
                name: 'data.csv', // Name of the file in Google Drive
                parents: [folderID], // ID of the parent folder (optional)
            };

            // Set the file content
            const media = {
                mimeType: 'text/csv',
                body: fs.createReadStream('output_csv/data.csv'),
            };

            const existingFile = await drive.files.list({
                q: `name = '${fileMetadata.name}' and '${fileMetadata.parents[0]}' in parents`,
            });

            if (existingFile.data.files.length > 0) {
                const fileId = existingFile.data.files[0].id;
                await drive.files.update({
                    fileId,
                    media: media,
                });

                console.log('Updated file csv');

                fs.unlink(`output_csv/data.csv`, (deleteErr) => {
                    if (deleteErr) {
                        console.error('Error deleting file:', deleteErr);
                    } else {
                        console.log('Local file deleted successfully.');
                    }
                });
            } else {
                await drive.files.create({
                    resource: fileMetadata,
                    media: media,
                    fields: 'id',
                });

                console.log('File uploaded successfully!');

                fs.unlink(`output_csv/data.csv`, (deleteErr) => {
                    if (deleteErr) {
                        console.error('Error deleting file:', deleteErr);
                    } else {
                        console.log('Local file deleted successfully.');
                    }
                });
            }
        })
        .catch(error => {
            console.error(`Cannot save data.csv:`, error)
        });

    const doc = new PDFDocument();
    const table = {
        headers: ['#', 'ID', 'Name', 'Date', 'Time in', 'Time out', 'Working time'],
        rows: []
    };

    doc.pipe(fs.createWriteStream(`output_pdf/data.pdf`));

    data.forEach((record, index) => {
        table.rows.push([index + 1, record.userId, record.name, record.date, record.time_in, record.time_out, record.working_time])
    });

    doc.fillColor('black').font('Helvetica').fontSize(12);

    if (startDate && endDate) {
        await doc.text(`Data from ${startDate} to ${endDate}`, { align: 'left' })
        await doc.moveDown(0.5)
    } else if (startDate) {
        await doc.text(`Data from ${startDate}`, { align: 'left' })
        await doc.moveDown(0.5)
    } else if (endDate) {
        await doc.text(`Data to ${endDate}`, { align: 'left' })
        await doc.moveDown(0.5)
    }
    await doc.table(table, 0, 0, { width: 500 })

    doc.end();

    const fileMetadata = {
        name: 'data.pdf', // Name of the file in Google Drive
        parents: [folderID], // ID of the parent folder (optional)
    };

    // Set the file content
    const media = {
        mimeType: 'application/pdf',
        body: fs.createReadStream('output_pdf/data.pdf'),
    };

    const existingFile = await drive.files.list({
        q: `name = '${fileMetadata.name}' and '${fileMetadata.parents[0]}' in parents`,
    });

    if (existingFile.data.files.length > 0) {
        const fileId = existingFile.data.files[0].id;
        await drive.files.update({
            fileId,
            media: media,
        });

        console.log('Updated file pdf');

        fs.unlink(`output_pdf/data.pdf`, (deleteErr) => {
            if (deleteErr) {
                console.error('Error deleting file:', deleteErr);
            } else {
                console.log('Local file deleted successfully.');
            }
        });
    } else {
        await drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id',
        });

        console.log('File uploaded successfully!');

        fs.unlink(`output_pdf/data.pdf`, (deleteErr) => {
            if (deleteErr) {
                console.error('Error deleting file:', deleteErr);
            } else {
                console.log('Local file deleted successfully.');
            }
        });
    }

    res.send("Saved data successfully!")
})

router.post('/saveCSVById', async (req, res) => {
    let { startDate, endDate, search } = req.body

    if (!isWithinAMonth(startDate, endDate)) {
        return res.send('Start date and end date are required to be within a month!')
    }

    const db = req.app.locals.db
    const DATA = await db.collection('LOGIN_DATA')

    let query = generateQuery(startDate, endDate, search, true)

    let data = await DATA.find(query).toArray()

    if (data.length === 0) {
        return res.send("No data to export")
    }

    // Tạo thư mục output nếu chưa tồn tại
    if (!fs.existsSync('output_csv')) {
        fs.mkdirSync('output_csv');
    }

    let month = ('0' + data[0].month).slice(-2)
    let year = data[0].year
    let folderName = `${month}-${year}`
    let folderID = await checkFolderExists(drive, process.env.REPORT_FOLDER_ID, folderName)
    // CHECK IF FOLDER EXISTS
    if (!folderID) {
        folderID = await createFolder(drive, process.env.REPORT_FOLDER_ID, folderName)
    }

    // Tạo tệp CSV cho từng loại user ID
    const uniqueUserIds = [...new Set(data.map(item => item.userId))];

    uniqueUserIds.forEach(userId => {
        const userRecords = data.filter(item => item.userId === userId);

        userRecords.forEach(u => {
            u.date = u.day + "/" + u.month + "/" + u.year
            u.working_time = getWorkingTime(u.time_in, u.time_out)
        })

        const csvWriter = createCsvWriter({
            path: `output_csv/${userId}.csv`,
            header: [
                { id: 'userId', title: 'ID' },
                { id: 'name', title: 'Hour' },
                { id: 'date', title: 'Date' },
                { id: 'time_in', title: 'Time in' },
                { id: 'time_out', title: 'Time out' },
                { id: 'working_time', title: 'Working time' },
            ]
        });

        csvWriter.writeRecords(userRecords)
            .then(async () => {
                // console.log(`Saved ${userId}.csv successfully!`);

                const fileMetadata = {
                    name: `${userId}.csv`, // Name of the file in Google Drive
                    parents: [folderID], // ID of the parent folder (optional)
                };

                // Set the file content
                const media = {
                    mimeType: 'text/csv',
                    body: fs.createReadStream(`output_csv/${userId}.csv`),
                };

                const existingFile = await drive.files.list({
                    q: `name = '${fileMetadata.name}' and '${fileMetadata.parents[0]}' in parents`,
                });

                if (existingFile.data.files.length > 0) {
                    const fileId = existingFile.data.files[0].id;
                    await drive.files.update({
                        fileId,
                        media: media,
                    });

                    console.log('Updated file csv');

                    fs.unlink(`output_csv/${userId}.csv`, (deleteErr) => {
                        if (deleteErr) {
                            console.error('Error deleting file:', deleteErr);
                        } else {
                            console.log('Local file deleted successfully.');
                        }
                    });
                } else {
                    await drive.files.create({
                        resource: fileMetadata,
                        media: media,
                        fields: 'id',
                    });

                    console.log('File uploaded successfully!');

                    fs.unlink(`output_csv/${userId}.csv`, (deleteErr) => {
                        if (deleteErr) {
                            console.error('Error deleting file:', deleteErr);
                        } else {
                            console.log('Local file deleted successfully.');
                        }
                    });
                }
            })
            .catch(error => {
                console.error(`Cannot save ${userId}.csv:`, error)
            });
    });

    res.send("Saved csv files successfully!")
})

router.post('/savePDFById', async (req, res) => {
    let { startDate, endDate, search } = req.body

    if (!isWithinAMonth(startDate, endDate)) {
        return res.send('Start date and end date are required to be within a month!')
    }

    const db = req.app.locals.db
    const DATA = await db.collection('LOGIN_DATA')
    const USER = await db.collection('USER')

    let query = generateQuery(startDate, endDate, search, true)

    let data = await DATA.find(query).toArray()

    if (data.length === 0) {
        return res.send("No data to export")
    }

    // Tạo thư mục output nếu chưa tồn tại
    if (!fs.existsSync('output_pdf')) {
        fs.mkdirSync('output_pdf');
    }

    let month = ('0' + data[0].month).slice(-2)
    let year = data[0].year
    let folderName = `${month}-${year}`
    let folderID = await checkFolderExists(drive, process.env.REPORT_FOLDER_ID, folderName)
    // CHECK IF FOLDER EXISTS
    if (!folderID) {
        folderID = await createFolder(drive, process.env.REPORT_FOLDER_ID, folderName)
    }

    // Tạo tệp PDF cho từng loại user ID
    const uniqueUserIds = [...new Set(data.map(item => item.userId))];

    uniqueUserIds.forEach(async (userId) => {
        const userRecords = data.filter(item => item.userId === userId);

        userRecords.forEach(u => {
            u.date = u.day + "/" + u.month + "/" + u.year
            u.working_time = getWorkingTime(u.time_in, u.time_out)
        })

        const doc = new PDFDocument();
        const table = {
            headers: ['#', 'ID', 'Name', 'Date', 'Time in', 'Time out', 'Working time'],
            rows: []
        };

        doc.pipe(fs.createWriteStream(`output_pdf/${userId}.pdf`));

        userRecords.forEach((record, index) => {
            table.rows.push([index + 1, record.userId, record.name, record.date, record.time_in, record.time_out, record.working_time])
        });

        let user = await USER.findOne({ '_id': userId })

        await doc.fillColor('red').font('Helvetica-Bold').fontSize(20).text(user.name, { align: 'right' })

        doc.fillColor('black').font('Helvetica').fontSize(12);
        await doc.text("Gender: " + user.gender, { align: 'right' })
        await doc.text("Position: " + user.position, { align: 'right' })
        await doc.moveDown()

        if (startDate && endDate) {
            await doc.text(`Data from ${startDate} to ${endDate}`, { align: 'left' })
            await doc.moveDown(0.5)
        } else if (startDate) {
            await doc.text(`Data from ${startDate}`, { align: 'left' })
            await doc.moveDown(0.5)
        } else if (endDate) {
            await doc.text(`Data to ${endDate}`, { align: 'left' })
            await doc.moveDown(0.5)
        }
        await doc.table(table, 0, 0, { width: 500 })

        doc.end();

        // console.log(`Saved ${userId}.pdf successfully!`);
        const fileMetadata = {
            name: `${userId}.pdf`, // Name of the file in Google Drive
            parents: [folderID], // ID of the parent folder (optional)
        };

        // Set the file content
        const media = {
            mimeType: 'application/pdf',
            body: fs.createReadStream(`output_pdf/${userId}.pdf`),
        };

        const existingFile = await drive.files.list({
            q: `name = '${fileMetadata.name}' and '${fileMetadata.parents[0]}' in parents`,
        });

        if (existingFile.data.files.length > 0) {
            const fileId = existingFile.data.files[0].id;
            await drive.files.update({
                fileId,
                media: media,
            });

            console.log('Updated file pdf');

            fs.unlink(`output_pdf/${userId}.pdf`, (deleteErr) => {
                if (deleteErr) {
                    console.error('Error deleting file:', deleteErr);
                } else {
                    console.log('Local file deleted successfully.');
                }
            });
        } else {
            await drive.files.create({
                resource: fileMetadata,
                media: media,
                fields: 'id',
            });

            console.log('File uploaded successfully!');

            fs.unlink(`output_pdf/${userId}.pdf`, (deleteErr) => {
                if (deleteErr) {
                    console.error('Error deleting file:', deleteErr);
                } else {
                    console.log('Local file deleted successfully.');
                }
            });
        }
    });

    res.send("Save pdf files successfully!")
})

function getHour() {
    // get current hour
    let now = new Date()
    let options = { timeZone: 'Asia/Ho_Chi_Minh', hour12: false }
    let vnHour = now.toLocaleString('en-US', options).split(', ')[1].split(':')[0]
    return parseInt(vnHour)
}

function generateQuery(startDate, endDate, search, isRegex) {
    // SEARCH DATA MATCH userId AND name
    let sQuery = isRegex ? { $regex: new RegExp(search, 'i') } : { $regex: search, $options: 'i' };
    let searchQuery = { $or: [{ 'userId': sQuery }, { 'name': sQuery }] }

    // CREATE DATE RANGE QUERY
    const dateRangeQuery = {};

    // HANDLE START DATE
    if (startDate !== '') {
        const startDateObj = new Date(startDate);
        dateRangeQuery.$and = [
            {
                $or: [
                    { year: { $gt: startDateObj.getFullYear() } },
                    {
                        $and: [
                            { year: startDateObj.getFullYear() },
                            { month: { $gt: startDateObj.getMonth() + 1 } }
                        ]
                    },
                    {
                        $and: [
                            { year: startDateObj.getFullYear() },
                            { month: startDateObj.getMonth() + 1 },
                            { day: { $gte: startDateObj.getDate() } }
                        ]
                    }
                ]
            }
        ];
    }

    // HANDLE END DATE
    if (endDate !== '') {
        const endDateObj = new Date(endDate);
        if (!dateRangeQuery.$and) {
            dateRangeQuery.$and = [];
        }
        dateRangeQuery.$and.push(
            {
                $or: [
                    { year: { $lt: endDateObj.getFullYear() } },
                    {
                        $and: [
                            { year: endDateObj.getFullYear() },
                            { month: { $lt: endDateObj.getMonth() + 1 } }
                        ]
                    },
                    {
                        $and: [
                            { year: endDateObj.getFullYear() },
                            { month: endDateObj.getMonth() + 1 },
                            { day: { $lte: endDateObj.getDate() } }
                        ]
                    }
                ]
            }
        );
    }

    let finalQuery = {
        $and: [dateRangeQuery, searchQuery]
    }

    return finalQuery
}

function getWorkingTime(time_in, time_out) {
    // CALCULATE TOTAL WORKING TIME FROM TIME IN AND TIME OUT
    // RETURN: XXhYYm
    var timeIn = time_in.split(':')
    var timeOut = time_out.split(':')

    let t1 = new Date();
    t1.setHours(parseInt(timeIn[0], 10));
    t1.setMinutes(parseInt(timeIn[1], 10));

    let t2 = new Date();
    t2.setHours(parseInt(timeOut[0], 10));
    t2.setMinutes(parseInt(timeOut[1], 10));

    let difference = Math.abs(t2 - t1)

    const hours = Math.floor(difference / 3600000);
    const minutes = Math.floor((difference % 3600000) / 60000);

    return `${hours}h${minutes}m`
}

function isWithinAMonth(startDate, endDate) {
    startObj = new Date(startDate)

    if (endDate === "") {
        endObj = new Date()
    } else {
        endObj = new Date(endDate)
    }

    return startObj.getMonth() === endObj.getMonth() && startObj.getFullYear() === endObj.getFullYear()
}

// Function to check if the folder exists within a specific folder ID, if it is created, return folderid
async function checkFolderExists(drive, folderId, folderName) {
    const query = `name='${folderName}' and '${folderId}' in parents and mimeType='application/vnd.google-apps.folder'`;
    const response = await drive.files.list({ q: query });

    if (response.data.files.length > 0) {
        return response.data.files[0].id;
    }

    return null;
}

// Function to create a folder within a specific folder ID
async function createFolder(drive, folderId, folderName) {
    const fileMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [folderId],
    };

    const response = await drive.files.create({
        resource: fileMetadata,
        fields: 'id',
    });

    return response.data.id;
}

module.exports = router;
