var express = require('express');
var router = express.Router();
const { google } = require('googleapis');
const { ObjectId } = require('mongodb');
const fs = require('fs');
const path = require('path');
require('dotenv').config()
const NodeWebcam = require('node-webcam');

const keyFile = 'service_account.json';
const Webcam = NodeWebcam.create();

const auth = new google.auth.GoogleAuth({
    keyFile,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
});

// Create a new instance of the Drive API
const drive = google.drive({ version: 'v3', auth });

// Route for the main page
router.get('/', async (req, res) => {
    const db = req.app.locals.db
    const USER = await db.collection('USER')

    let no_users = await USER.countDocuments()

    let new_id = `user${no_users + 1}`
    res.render('register', { title: 'REGISTER USER', new_id: new_id })
});

router.post('/', async (req, res) => {
    const db = req.app.locals.db
    const USER = await db.collection('USER')
    const NEW_USER = await db.collection('NEW_USER')

    // console.log(req.body);

    let { userId, name, gender, position, password, admin } = req.body
    let now = new Date()
    let day = now.getDate()
    let month = now.getMonth() + 1
    let year = now.getYear()
    let type = 'user'
    let folderId = undefined
    let img_id = undefined

    // CHECK IF FOLDER USERID EXISTS AND CREATE FOLDER
    const folderExists = await checkFolderExists(drive, process.env.IMAGE_FOLDER_ID, userId);

    if (folderExists) {
        console.log(`The folder "${userId}" exists.`);
        folderId = folderExists
    } else {
        // Create the folder
        const createdFolder = await createFolder(drive, process.env.IMAGE_FOLDER_ID, userId);
        // console.log(`The folder "${userId}" has been created with ID: ${createdFolder.id}`);
        console.log(`The folder "${userId}" has been created!`);
        folderId = createdFolder.id
    }

    for (let img_idx = 0; img_idx < 10; img_idx++) {
        img_id = await uploadImage(drive, folderId, `${userId}_${img_idx}.jpeg`)
    }

    if (admin && admin == 'true') {
        type = 'admin'
    }

    let newUser1 = { '_id': userId, 'name': name, 'gender': gender, 'position': position, 'date_in': `${day}/${month}/${year}`, 'date_out': '', 'password': password, 'type': type, 'profile_image': img_id, 'train_images': folderId }
    // console.log('FOLDER ID', folderId);
    // console.log('IMAGE ID', img_id);
    await USER.insertOne(newUser1)

    let newUser2 = { '_id': userId, 'train_images': folderId }
    await NEW_USER.insertOne(newUser2)

    res.send('')
})

router.post('/saveImage', (req, res) => {
    const { image, image_name } = req.body;
    const imagePath = path.join('captures', image_name);

    // Remove the data URL prefix
    const base64Data = image.replace(/^data:image\/jpeg;base64,/, '');

    fs.writeFile(imagePath, base64Data, 'base64', (err) => {
        if (err) {
            console.error('Error saving image:', err);
            res.status(500).json({ error: 'Error saving image' });
        } else {
            // console.log('Image saved:', image_name);
            res.json({ filename: image_name });
        }
    });
});

// Function to check if the folder exists within a specific folder ID
async function checkFolderExists(drive, folderId, folderName) {
    const query = `name = '${folderName}' and '${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder'`;
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

    return response.data;
}

async function uploadImage(drive, folderId, img_name) {
    const fileMetadata = {
        name: img_name, // Name of the file in Google Drive
        parents: [folderId], // ID of the parent folder (optional)
    };

    // Set the file content
    const media = {
        mimeType: 'image/jpeg',
        body: fs.createReadStream(`captures/${img_name}`),
    };

    try {
        const file = await drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id',
        });

        // console.log('Image uploaded successfully. File ID:', file.data.id);
        console.log('Image uploaded successfully!');
        const img_id = file.data.id;

        await fs.promises.unlink(`captures/${img_name}`);
        console.log('Local image deleted successfully.');

        return img_id;
    } catch (err) {
        console.error('Error uploading image:', err);
        throw err;
    }
}

module.exports = router