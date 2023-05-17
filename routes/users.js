var express = require('express');
var router = express.Router();
const { google } = require('googleapis');
const fs = require('fs');

const keyFile = 'service_account.json';
const columns = ['_id', 'name', 'gender', 'position']

router.post('/', async (req, res) => {
	const db = req.app.locals.db
	const USER = await db.collection('USER')

	let start = parseInt(req.body.start)
	let length = parseInt(req.body.length)
	let draw = parseInt(req.body.draw)
	let search = req.body['search[value]']
	let isRegex = req.body['search[regex]'] === 'true'
	let order_col = parseInt(req.body['order[0][column]'])
	let order_dir = req.body['order[0][dir]']

	let order_direction = 1

	if (order_dir == 'desc') {
		order_direction = -1
	}

	let sortOptions = JSON.parse(`{"${columns[order_col - 1]}" : ${order_direction}}`)

	const query = isRegex ? { $regex: new RegExp(search, 'i') } : { $regex: search, $options: 'i' };

	let users = await USER.find({ $or: [{ '_id': query }, { 'name': query }] })
		.skip(start)
		.limit(length)
		.sort(sortOptions)
		.toArray()

	let recordsTotal = await USER.countDocuments()
	let recordsFiltered = await USER.countDocuments({ $or: [{ '_id': query }, { 'name': query }] })

	res.json({
		draw: draw,
		recordsTotal: recordsTotal,
		recordsFiltered: recordsFiltered,
		data: users,
	})
})

router.post('/user', async (req, res) => {
	const db = req.app.locals.db
	const USER = db.collection('USER')

	let id = req.body.id
	let user = await USER.findOne({ '_id': id })

	if (user) {

		const fileId = user.profile_image;
		const outputPath = 'public/images/user.png';

		await getImageFromDrive(fileId, outputPath);
		const img = convertPngToBase64(outputPath)

		// const img = convertPngToBase64(outputPath)
		user.profile_image = img

		fs.unlink(outputPath, (err) => {
			if (err) {
				console.log(err)
			}
		})

		return res.json(user)
	} else {
		return console.log('ERR')
	}
})

router.put('/user', async (req, res) => {
	const db = req.app.locals.db
	const USER = db.collection('USER')

	let { editUserId, editName, editGender, editPosition, editDatein, editDateout } = req.body
	let newUser = { '_id': editUserId, 'name': editName, 'gender': editGender, 'position': editPosition, 'date_in': editDatein, 'date_out': editDateout }

	let result = await USER.findOneAndUpdate(
		{ '_id': editUserId },
		{ $set: newUser })

	if (result.ok === 1) {
		let updatedUser = await USER.findOne({ '_id': editUserId })
		return res.json(updatedUser)
	} else {
		return console.log('ERROR')
	}
})

async function getImageFromDrive(fileId, outputPath) {
	try {
		// Create a new JWT client using the service account key file
		const auth = new google.auth.GoogleAuth({
			keyFile,
			scopes: ['https://www.googleapis.com/auth/drive.readonly'],
		});
		const client = await auth.getClient();

		// Create a new instance of the Google Drive API
		const drive = google.drive({ version: 'v3', auth: client });

		// Specify the file ID of the image you want to retrieve
		const fileResponse = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });

		// Create a writable stream to save the image
		const dest = fs.createWriteStream(outputPath);

		// Wait for the image to be downloaded and saved
		fileResponse.data
			.on('error', err => {
				throw err;
			})
			.pipe(dest);

		// Wait for the image to be downloaded and saved
		await new Promise((resolve, reject) => {
			dest.on('finish', resolve);
			dest.on('error', reject);
		});

		console.log('Image downloaded successfully!');
	} catch (err) {
		console.error('Error retrieving the image:', err);
	}
}

function convertImageToBinary(imagePath) {
	try {
		// Read the image file as binary data
		const binaryData = fs.readFileSync(imagePath);

		// Convert the binary data to a string
		const binaryString = binaryData.toString('binary');

		return binaryString;
	} catch (err) {
		console.error('Error converting image to binary:', err);
		return null;
	}
}

function convertPngToBase64(imagePath) {
	try {
		// Read the PNG image file as binary data
		const binaryData = fs.readFileSync(imagePath);

		// Convert the binary data to a base64-encoded string
		const base64Image = Buffer.from(binaryData).toString('base64');

		return base64Image;
	} catch (err) {
		console.error('Error converting PNG to base64:', err);
		return null;
	}
}

module.exports = router;
